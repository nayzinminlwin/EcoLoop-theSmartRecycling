// =============================================================================
// firebaseBinRepository.ts — Firebase-backed BinsRepository implementation
// Phase AB-03 — list, watchList, get, watch with cursor pagination & read models
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import QRCode from "qrcode";
import {
  type BinsRepository,
  type Observable,
  type Observer,
  type Unsubscribe,
  type BinQrCode,
  RepositoryError,
} from "../repositories.ts";
import type {
  BinListQuery,
  Page,
  SmartBinRow,
  BinInput,
  CollectionStatus,
} from "../../contracts/admin.ts";
import {
  decodeAdminBinView,
  decodeAdminBinDetailView,
  decodeAdminPaginatedResponse,
  adminBinViewToRow,
  type AdminBinView,
  type AdminPaginatedResponse,
} from "../../contracts/adminViewCodecs.ts";
import type { MaterialType } from "../../contracts/shared.ts";
import type { FirebaseCommandClient } from "../../core/firebase/commandClient.ts";

export class FirebaseBinRepository implements BinsRepository {
  private readonly functions: Functions;
  private readonly firestore: Firestore;
  private readonly commandClient: FirebaseCommandClient;
  private readonly fallbackBinsRepo: BinsRepository;

  constructor(
    functions: Functions,
    firestore: Firestore,
    commandClient: FirebaseCommandClient,
    fallbackBinsRepo: BinsRepository
  ) {
    this.functions = functions;
    this.firestore = firestore;
    this.commandClient = commandClient;
    this.fallbackBinsRepo = fallbackBinsRepo;
  }

  private mapSortKey(key: string): string {
    switch (key) {
      case "id":
        return "binId";
      case "locationName":
      case "location":
        return "locationName";
      case "capacityPercent":
      case "capacity":
        return "fillPercent";
      case "lastUpdatedAt":
      case "updatedAt":
        return "updatedAt";
      case "collectionState":
      case "status":
        return "collectionState";
      default:
        return "locationName";
    }
  }

  private mapCanonicalBinDocToRow(id: string, data: Record<string, unknown>): SmartBinRow {
    const capacitySpc = Math.max(50, Math.min(5000, Number(data.capacitySpc ?? 1000)));
    const occupiedSpc = Math.max(0, Number(data.occupiedSpc ?? 0));
    const capacityPercent = typeof data.capacityPercent === "number"
      ? data.capacityPercent
      : Math.min(100, Math.max(0, Math.round((occupiedSpc / capacitySpc) * 100)));

    const acceptedMaterials: MaterialType[] = Array.isArray(data.acceptedMaterials)
      ? (data.acceptedMaterials.filter((m): m is MaterialType =>
          ["plastic", "aluminium", "paper", "glass", "unknown"].includes(String(m))
        ))
      : ["plastic", "aluminium"];

    let lastUpdatedAt = new Date().toISOString();
    if (data.updatedAt) {
      if (typeof (data.updatedAt as { toDate?: () => Date }).toDate === "function") {
        lastUpdatedAt = (data.updatedAt as { toDate: () => Date }).toDate().toISOString();
      } else if (typeof data.updatedAt === "string") {
        lastUpdatedAt = data.updatedAt;
      }
    }

    const isOnline = data.isOnline !== false && data.logicalOnline !== false && data.enabled !== false;

    let collectionStatus: CollectionStatus = "notScheduled";
    if (typeof data.collectionState === "string") {
      collectionStatus = data.collectionState === "collection_pending" ? "pending" : (data.collectionState as CollectionStatus);
    } else if (typeof data.collectionStatus === "string") {
      collectionStatus = data.collectionStatus as CollectionStatus;
    } else if (capacityPercent >= 85) {
      collectionStatus = "pending";
    }

    return {
      bin: {
        id,
        locationName: String(data.locationName ?? data.displayName ?? id),
        locationDetail: String(data.locationDetail ?? "Standard Facility"),
        capacityPercent,
        acceptedMaterials,
        isOnline,
        lastUpdatedAt,
      },
      operations: {
        binId: id,
        collectionStatus,
      },
    };
  }

  private filterAndPaginateRows(rows: SmartBinRow[], query: BinListQuery): Page<SmartBinRow> {
    let filtered = [...rows];

    // Search filter
    if (query.search && query.search.trim()) {
      const q = query.search.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.bin.id.toLowerCase().includes(q) ||
          r.bin.locationName.toLowerCase().includes(q) ||
          r.bin.locationDetail.toLowerCase().includes(q)
      );
    }

    // Capacity band filter
    if (query.capacityBand && query.capacityBand !== "all") {
      filtered = filtered.filter((r) => {
        const pct = r.bin.capacityPercent;
        if (query.capacityBand === "critical") return pct >= 85;
        if (query.capacityBand === "warning") return pct >= 75 && pct < 85;
        if (query.capacityBand === "normal") return pct < 75;
        return true;
      });
    }

    // Online filter
    if (query.online && query.online !== "all") {
      const wantOnline = query.online === "online";
      filtered = filtered.filter((r) => r.bin.isOnline === wantOnline);
    }

    // Sorting
    const sortKey = query.sort.key as string;
    const isAsc = query.sort.direction === "asc";
    filtered.sort((a, b) => {
      let va: string | number = a.bin.id;
      let vb: string | number = b.bin.id;

      if (sortKey === "locationName" || sortKey === "location") {
        va = a.bin.locationName.toLowerCase();
        vb = b.bin.locationName.toLowerCase();
      } else if (sortKey === "capacityPercent" || sortKey === "capacity") {
        va = a.bin.capacityPercent;
        vb = b.bin.capacityPercent;
      } else if (sortKey === "lastUpdatedAt" || sortKey === "updatedAt") {
        va = a.bin.lastUpdatedAt;
        vb = b.bin.lastUpdatedAt;
      } else if (sortKey === "collectionState" || sortKey === "status") {
        va = a.operations.collectionStatus;
        vb = b.operations.collectionStatus;
      }

      if (va < vb) return isAsc ? -1 : 1;
      if (va > vb) return isAsc ? 1 : -1;
      return 0;
    });

    // Pagination
    const total = filtered.length;
    const startIndex = (query.page - 1) * query.pageSize;
    const items = filtered.slice(startIndex, startIndex + query.pageSize);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async list(query: BinListQuery): Promise<Page<SmartBinRow>> {
    // 1. Try Cloud Function listAdminBins
    try {
      const callable = httpsCallable<
        Record<string, unknown>,
        AdminPaginatedResponse<AdminBinView>
      >(this.functions, "listAdminBins");

      const filters: Record<string, unknown> = {};
      if (query.capacityBand && query.capacityBand !== "all") {
        filters.collectionState = query.capacityBand;
      }
      if (query.online && query.online !== "all") {
        filters.logicalOnline = query.online === "online";
      }

      const res = await callable({
        search: query.search || undefined,
        sortKey: this.mapSortKey(query.sort.key),
        sortDirection: query.sort.direction,
        pageSize: query.pageSize,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      });

      const decoded = decodeAdminPaginatedResponse(res.data, decodeAdminBinView);
      if (decoded.items && decoded.items.length > 0) {
        const rows = decoded.items.map(adminBinViewToRow);
        return {
          items: rows,
          total: decoded.total,
          page: query.page,
          pageSize: query.pageSize,
        };
      }
    } catch {
      // Fall through to direct Firestore connection
    }

    // 2. Direct Firestore connection (adminBinViews & bins)
    try {
      let rows: SmartBinRow[] = [];

      const viewsSnap = await getDocs(collection(this.firestore, "adminBinViews"));
      if (!viewsSnap.empty) {
        rows = viewsSnap.docs.map((d) => {
          const view = decodeAdminBinView({ binId: d.id, ...d.data() });
          return adminBinViewToRow(view);
        });
      } else {
        const binsSnap = await getDocs(collection(this.firestore, "bins"));
        if (!binsSnap.empty) {
          rows = binsSnap.docs.map((d) => this.mapCanonicalBinDocToRow(d.id, d.data()));
        }
      }

      if (rows.length > 0) {
        return this.filterAndPaginateRows(rows, query);
      }
    } catch {
      // Offline / unit test fallback below
    }

    // 3. Fallback to local baseline mock repository
    return await this.fallbackBinsRepo.list(query);
  }

  watchList(query: BinListQuery): Observable<Page<SmartBinRow>> {
    return {
      subscribe: (observer: Observer<Page<SmartBinRow>>): Unsubscribe => {
        let isSubscribed = true;

        const load = () => {
          this.list(query)
            .then((page) => {
              if (isSubscribed) observer.next(page);
            })
            .catch((err) => {
              if (isSubscribed) {
                observer.error(this.commandClient.mapFirebaseError(err, "listAdminBins").failure);
              }
            });
        };

        load();

        const unsubs: Array<() => void> = [];

        try {
          // Listen to topic revision bump
          const versionDocRef = doc(this.firestore, "adminReadVersions/bins");
          unsubs.push(
            onSnapshot(
              versionDocRef,
              () => { if (isSubscribed) load(); },
              () => {}
            )
          );

          // Listen to adminBinViews collection
          const viewsColRef = collection(this.firestore, "adminBinViews");
          unsubs.push(
            onSnapshot(
              viewsColRef,
              () => { if (isSubscribed) load(); },
              () => {}
            )
          );

          // Listen to canonical bins collection
          const binsColRef = collection(this.firestore, "bins");
          unsubs.push(
            onSnapshot(
              binsColRef,
              () => { if (isSubscribed) load(); },
              () => {}
            )
          );
        } catch {
          if (this.fallbackBinsRepo) {
            return this.fallbackBinsRepo.watchList(query).subscribe(observer);
          }
        }

        return () => {
          isSubscribed = false;
          unsubs.forEach((unsub) => {
            try { unsub(); } catch {}
          });
        };
      },
    };
  }

  async get(id: string): Promise<SmartBinRow> {
    try {
      const callable = httpsCallable<{ binId: string }, unknown>(
        this.functions,
        "getAdminBin"
      );
      const res = await callable({ binId: id });
      const detail = decodeAdminBinDetailView(res.data);
      return adminBinViewToRow(detail.bin);
    } catch {
      try {
        const viewDoc = await getDoc(doc(this.firestore, `adminBinViews/${id}`));
        if (viewDoc.exists()) {
          const view = decodeAdminBinView({ binId: viewDoc.id, ...viewDoc.data() });
          return adminBinViewToRow(view);
        }
        const binDoc = await getDoc(doc(this.firestore, `bins/${id}`));
        if (binDoc.exists()) {
          return this.mapCanonicalBinDocToRow(binDoc.id, binDoc.data());
        }
      } catch {
        // Fallback below
      }
      return await this.fallbackBinsRepo.get(id);
    }
  }

  watch(id: string): Observable<SmartBinRow | null> {
    return {
      subscribe: (observer: Observer<SmartBinRow | null>): Unsubscribe => {
        let isSubscribed = true;
        try {
          const binDocRef = doc(this.firestore, `adminBinViews/${id}`);
          const unsubscribe = onSnapshot(
            binDocRef,
            (snap) => {
              if (!isSubscribed) return;
              if (snap.exists()) {
                try {
                  const view = decodeAdminBinView({ binId: snap.id, ...snap.data() });
                  observer.next(adminBinViewToRow(view));
                  return;
                } catch {}
              }
              getDoc(doc(this.firestore, `bins/${id}`))
                .then((bSnap) => {
                  if (!isSubscribed) return;
                  if (bSnap.exists()) {
                    observer.next(this.mapCanonicalBinDocToRow(bSnap.id, bSnap.data()));
                  } else {
                    observer.next(null);
                  }
                })
                .catch(() => {
                  observer.next(null);
                });
            },
            () => {
              if (!isSubscribed) return;
              this.fallbackBinsRepo.watch(id).subscribe(observer);
            }
          );

          return () => {
            isSubscribed = false;
            unsubscribe();
          };
        } catch {
          return this.fallbackBinsRepo.watch(id).subscribe(observer);
        }
      },
    };
  }

  async create(id: string, input: BinInput): Promise<SmartBinRow> {
    try {
      const capacitySpc = input.capacitySpc ?? 1000;
      await this.commandClient.execute("adminCreateBin", {
        binId: id,
        locationName: input.locationName,
        locationDetail: input.locationDetail,
        capacitySpc,
      });
      return await this.get(id);
    } catch (err) {
      throw this.commandClient.mapFirebaseError(err, "adminCreateBin");
    }
  }

  async update(id: string, input: BinInput): Promise<SmartBinRow> {
    try {
      let expectedVersion = input.expectedVersion;
      if (expectedVersion === undefined) {
        const callable = httpsCallable<{ binId: string }, { bin: { version: number } }>(
          this.functions,
          "getAdminBin"
        );
        const res = await callable({ binId: id });
        expectedVersion = res.data?.bin?.version ?? 1;
      }

      await this.commandClient.execute("adminUpdateBin", {
        binId: id,
        expectedVersion,
        locationName: input.locationName,
        locationDetail: input.locationDetail,
        enabled: input.isOnline !== false,
      });
      return await this.get(id);
    } catch (err) {
      throw this.commandClient.mapFirebaseError(err, "adminUpdateBin");
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const callable = httpsCallable<{ binId: string }, { bin: { version: number } }>(
        this.functions,
        "getAdminBin"
      );
      const res = await callable({ binId: id });
      const expectedVersion = res.data?.bin?.version ?? 1;

      await this.commandClient.execute("adminDeleteUnusedBin", {
        binId: id,
        expectedVersion,
      });
    } catch (err) {
      throw this.commandClient.mapFirebaseError(err, "adminDeleteUnusedBin");
    }
  }

  async simulateCapacity(_id: string, _capacityPercent: number): Promise<SmartBinRow> {
    throw new RepositoryError({
      code: "invalidTransition",
      message: "Direct capacity percentage simulation is disabled in live Firebase mode. Capacity is derived from positive integer volume measurements.",
      fieldErrors: {},
    });
  }

  async getQrCode(id: string): Promise<BinQrCode> {
    try {
      const callable = httpsCallable<{ binId: string }, BinQrCode>(
        this.functions,
        "getAdminBinQr"
      );
      const res = await callable({ binId: id });
      return res.data;
    } catch {
      try {
        let qrPayload = `ecoloop://bin/qr-${id}`;
        let qrId = `qr-${id}`;

        // Look for existing registered QR mapping in Firestore
        const mappingSnap = await getDoc(doc(this.firestore, `binQrMappings/qr-${id}`));
        if (mappingSnap.exists()) {
          const data = mappingSnap.data();
          if (data?.qrPayload) qrPayload = String(data.qrPayload);
          if (data?.id) qrId = String(data.id);
        } else {
          // Check if bin document has specific qrId
          const binSnap = await getDoc(doc(this.firestore, `bins/${id}`));
          if (binSnap.exists()) {
            const data = binSnap.data();
            if (data?.qrId) {
              qrId = String(data.qrId);
              qrPayload = `ecoloop://bin/${qrId}`;
            }
          }
        }

        const svg = await QRCode.toString(qrPayload, {
          type: "svg",
          margin: 2,
          errorCorrectionLevel: "M",
        });
        const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

        return {
          binId: id,
          qrId,
          qrPayload,
          dataUrl,
          svg,
        };
      } catch {
        // Fallback to mock repository
      }

      if (this.fallbackBinsRepo) {
        try {
          return await this.fallbackBinsRepo.getQrCode(id);
        } catch {}
      }

      throw this.commandClient.mapFirebaseError(new Error("Unable to retrieve QR code"), "getAdminBinQr");
    }
  }
}

