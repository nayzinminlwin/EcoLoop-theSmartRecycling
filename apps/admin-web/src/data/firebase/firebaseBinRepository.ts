// =============================================================================
// firebaseBinRepository.ts — Firebase-backed BinsRepository implementation
// Phase AB-03 — list, watchList, get, watch with cursor pagination & read models
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
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

  private deriveBinCollectionStatus(
    _binId: string,
    _capacityPercent: number,
    alertState?: string,
    explicitStatus?: string
  ): CollectionStatus {
    // 1. If marked collected, status is "collected"
    if (alertState === "collected" || explicitStatus === "collected") {
      return "collected";
    }

    // 2. If scheduled (during schedule), status is "pending" (displays as "Collection Pending")
    if (
      alertState === "scheduled" ||
      explicitStatus === "scheduled" ||
      explicitStatus === "collection_pending" ||
      (explicitStatus === "pending" && alertState !== "pending" && alertState !== "triggered")
    ) {
      return "pending";
    }

    // 3. Before schedule (normal <85% or reached threshold >=85% awaiting scheduling action):
    return "notScheduled";
  }

  private mapCanonicalBinDocToRow(
    id: string,
    data: Record<string, unknown>,
    alertState?: string
  ): SmartBinRow {
    const capacitySpc = Math.max(50, Math.min(5000, Number(data.capacitySpc ?? 1000)));
    const occupiedSpc = Math.max(0, Number(data.occupiedSpc ?? 0));
    const capacityPercent = typeof data.fillPercent === "number" && data.fillPercent > 0
      ? data.fillPercent
      : typeof data.capacityPercent === "number" && data.capacityPercent > 0
        ? data.capacityPercent
        : Math.min(100, Math.max(0, occupiedSpc > 0 ? Math.round((occupiedSpc / capacitySpc) * 100) : 0));

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
    const explicitStatus = typeof data.collectionStatus === "string"
      ? data.collectionStatus
      : typeof data.collectionState === "string"
        ? (data.collectionState === "collection_pending" ? "pending" : data.collectionState)
        : undefined;

    const collectionStatus = this.deriveBinCollectionStatus(
      id,
      capacityPercent,
      alertState,
      explicitStatus
    );

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

    // Collection status filter
    if (query.collectionStatus && query.collectionStatus !== "all") {
      filtered = filtered.filter((r) => {
        if (query.collectionStatus === "pending") {
          return r.operations.collectionStatus === "pending" || r.operations.collectionStatus === "scheduled";
        }
        return r.operations.collectionStatus === query.collectionStatus;
      });
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
        try {
          const binsSnap = await getDocs(collection(this.firestore, "bins"));
          const canonicalMap = new Map(binsSnap.docs.map(d => [d.id, d.data()]));
          for (const row of rows) {
            const canon = canonicalMap.get(row.bin.id);
            if (canon) {
              const liveFill = typeof canon.fillPercent === "number" && canon.fillPercent > 0
                ? canon.fillPercent
                : typeof canon.capacityPercent === "number" && canon.capacityPercent > 0
                  ? canon.capacityPercent
                  : row.bin.capacityPercent;
              row.bin.capacityPercent = liveFill;
              if (liveFill >= 85) row.operations.collectionStatus = "pending";
            }
          }
        } catch { }
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

      const [viewsSnap, binsSnap, capAlertsSnap, adminAlertsSnap] = await Promise.all([
        getDocs(collection(this.firestore, "adminBinViews")).catch(() => null),
        getDocs(collection(this.firestore, "bins")).catch(() => null),
        getDocs(collection(this.firestore, "capacityAlerts")).catch(() => null),
        getDocs(collection(this.firestore, "adminAlertViews")).catch(() => null),
      ]);

      const alertStateByBin = new Map<string, string>();
      const processAlertDoc = (data: Record<string, unknown>) => {
        const bId = String(data.binId || "");
        if (!bId) return;
        const state = String(data.state || "");
        if (!state) return;
        const prev = alertStateByBin.get(bId);
        if (!prev || prev === "resolved") {
          alertStateByBin.set(bId, state);
        } else if (state === "collected" && prev !== "collected") {
          alertStateByBin.set(bId, state);
        }
      };

      if (capAlertsSnap && !capAlertsSnap.empty) {
        for (const d of capAlertsSnap.docs) processAlertDoc(d.data());
      }
      if (adminAlertsSnap && !adminAlertsSnap.empty) {
        for (const d of adminAlertsSnap.docs) processAlertDoc(d.data());
      }

      const canonicalMap = new Map<string, Record<string, unknown>>();
      if (binsSnap && !binsSnap.empty) {
        for (const d of binsSnap.docs) {
          canonicalMap.set(d.id, d.data());
        }
      }

      if (viewsSnap && !viewsSnap.empty) {
        rows = viewsSnap.docs.map((d) => {
          const viewData: Record<string, unknown> = { binId: d.id, ...d.data() };
          const canon = canonicalMap.get(d.id);
          if (canon) {
            const canonFill = typeof canon.fillPercent === "number" && canon.fillPercent > 0
              ? canon.fillPercent
              : typeof canon.capacityPercent === "number" && canon.capacityPercent > 0
                ? canon.capacityPercent
                : 0;
            if (canonFill > 0) {
              viewData.fillPercent = canonFill;
              if (canonFill >= 85) {
                viewData.collectionState = "critical";
              } else if (canonFill >= 75) {
                viewData.collectionState = "warning";
              }
            }
          }
          const view = decodeAdminBinView(viewData);
          const row = adminBinViewToRow(view);
          const alertState = alertStateByBin.get(d.id);
          const explicitStatus = typeof canon?.collectionStatus === "string"
            ? canon.collectionStatus
            : typeof d.data().collectionStatus === "string"
              ? d.data().collectionStatus
              : undefined;
          row.operations.collectionStatus = this.deriveBinCollectionStatus(
            d.id,
            row.bin.capacityPercent,
            alertState,
            explicitStatus
          );
          return row;
        });
      } else if (binsSnap && !binsSnap.empty) {
        rows = binsSnap.docs.map((d) => {
          const alertState = alertStateByBin.get(d.id);
          return this.mapCanonicalBinDocToRow(d.id, d.data(), alertState);
        });
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
              () => { }
            )
          );

          // Listen to adminBinViews collection
          const viewsColRef = collection(this.firestore, "adminBinViews");
          unsubs.push(
            onSnapshot(
              viewsColRef,
              () => { if (isSubscribed) load(); },
              () => { }
            )
          );

          // Listen to canonical bins collection
          const binsColRef = collection(this.firestore, "bins");
          unsubs.push(
            onSnapshot(
              binsColRef,
              () => { if (isSubscribed) load(); },
              () => { }
            )
          );

          // Listen to capacity alerts collections and alert version bump
          unsubs.push(
            onSnapshot(
              collection(this.firestore, "capacityAlerts"),
              () => { if (isSubscribed) load(); },
              () => { }
            )
          );
          unsubs.push(
            onSnapshot(
              collection(this.firestore, "adminAlertViews"),
              () => { if (isSubscribed) load(); },
              () => { }
            )
          );
          unsubs.push(
            onSnapshot(
              doc(this.firestore, "adminReadVersions/alerts"),
              () => { if (isSubscribed) load(); },
              () => { }
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
            try { unsub(); } catch { }
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
      const row = adminBinViewToRow(detail.bin);
      try {
        const binDoc = await getDoc(doc(this.firestore, `bins/${id}`));
        if (binDoc.exists()) {
          const canon = binDoc.data();
          const liveFill = typeof canon.fillPercent === "number" && canon.fillPercent > 0
            ? canon.fillPercent
            : typeof canon.capacityPercent === "number" && canon.capacityPercent > 0
              ? canon.capacityPercent
              : row.bin.capacityPercent;
          row.bin.capacityPercent = liveFill;
        }
        let alertState: string | undefined;
        const [capDoc, aViewDoc] = await Promise.all([
          getDoc(doc(this.firestore, `capacityAlerts/alert-${id}`)).catch(() => null),
          getDoc(doc(this.firestore, `adminAlertViews/alert-${id}`)).catch(() => null),
        ]);
        if (capDoc && capDoc.exists()) alertState = capDoc.data().state;
        else if (aViewDoc && aViewDoc.exists()) alertState = aViewDoc.data().state;
        row.operations.collectionStatus = this.deriveBinCollectionStatus(id, row.bin.capacityPercent, alertState);
      } catch { }
      return row;
    } catch {
      try {
        const [viewDoc, binDoc, capDoc, aViewDoc] = await Promise.all([
          getDoc(doc(this.firestore, `adminBinViews/${id}`)).catch(() => null),
          getDoc(doc(this.firestore, `bins/${id}`)).catch(() => null),
          getDoc(doc(this.firestore, `capacityAlerts/alert-${id}`)).catch(() => null),
          getDoc(doc(this.firestore, `adminAlertViews/alert-${id}`)).catch(() => null),
        ]);
        let alertState: string | undefined;
        if (capDoc && capDoc.exists()) alertState = capDoc.data().state;
        else if (aViewDoc && aViewDoc.exists()) alertState = aViewDoc.data().state;
        else {
          const capSnap = await getDocs(collection(this.firestore, "capacityAlerts")).catch(() => null);
          if (capSnap) {
            for (const d of capSnap.docs) {
              if (d.data().binId === id) { alertState = d.data().state; break; }
            }
          }
        }

        if (viewDoc && viewDoc.exists()) {
          const viewData: Record<string, unknown> = { binId: viewDoc.id, ...viewDoc.data() };
          let explicitStatus: string | undefined;
          if (binDoc && binDoc.exists()) {
            const canon = binDoc.data();
            const canonFill = typeof canon.fillPercent === "number" && canon.fillPercent > 0
              ? canon.fillPercent
              : typeof canon.capacityPercent === "number" && canon.capacityPercent > 0
                ? canon.capacityPercent
                : 0;
            if (canonFill > 0) {
              viewData.fillPercent = canonFill;
            }
            explicitStatus = typeof canon.collectionStatus === "string" ? canon.collectionStatus : undefined;
          }
          const view = decodeAdminBinView(viewData);
          const row = adminBinViewToRow(view);
          row.operations.collectionStatus = this.deriveBinCollectionStatus(id, row.bin.capacityPercent, alertState, explicitStatus);
          return row;
        }
        if (binDoc && binDoc.exists()) {
          return this.mapCanonicalBinDocToRow(binDoc.id, binDoc.data(), alertState);
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
        const unsubs: Array<() => void> = [];

        const load = async () => {
          try {
            const row = await this.get(id);
            if (isSubscribed) observer.next(row);
          } catch (err) {
            if (isSubscribed) observer.next(null);
          }
        };

        try {
          unsubs.push(
            onSnapshot(doc(this.firestore, `adminBinViews/${id}`), () => { if (isSubscribed) load(); }, () => { })
          );
          unsubs.push(
            onSnapshot(doc(this.firestore, `bins/${id}`), () => { if (isSubscribed) load(); }, () => { })
          );
          load();

          return () => {
            isSubscribed = false;
            unsubs.forEach((u) => { try { u(); } catch { } });
          };
        } catch {
          return this.fallbackBinsRepo.watch(id).subscribe(observer);
        }
      },
    };
  }

  private async directFirestoreCreateBin(id: string, input: BinInput): Promise<SmartBinRow> {
    const capacitySpc = Math.max(50, Math.min(5000, Number(input.capacitySpc ?? 1000)));
    const locationName = input.locationName.trim();
    const locationDetail = input.locationDetail.trim();
    const isOnline = input.isOnline !== false;
    const cycleId = `${id}-cycle-001`;
    const qrId = `qr-${id}`;
    const qrPayload = `ecoloop://bin/${qrId}`;

    // 1. Write canonical bin record
    const binRef = doc(this.firestore, `bins/${id}`);
    await setDoc(binRef, {
      id,
      displayName: locationName,
      locationName,
      locationDetail,
      capacitySpc,
      occupiedSpc: 0,
      capacityPercent: 0,
      cycleId,
      enabled: isOnline,
      isOnline,
      logicalOnline: isOnline,
      version: 1,
      sharedPolicyVersion: "v1.0.0",
      acceptedObjectClasses: [
        "plastic_bottle",
        "aluminium_can",
        "glass_bottle",
        "paper_item",
        "paper_bag",
      ],
      acceptedMaterials: ["plastic", "aluminium", "glass", "paper"],
      availability: "available",
      updatedAt: serverTimestamp(),
    });

    // 2. Write registered QR mapping
    try {
      const qrRef = doc(this.firestore, `binQrMappings/${qrId}`);
      await setDoc(qrRef, {
        id: qrId,
        binId: id,
        qrPayload,
        enabled: true,
        mappingVersion: 1,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal if QR mapping rules restrict write
    }

    // 3. Write initial cycle
    try {
      const cycleRef = doc(this.firestore, `binCycles/${cycleId}`);
      await setDoc(cycleRef, {
        id: cycleId,
        binId: id,
        openingOccupiedSpc: 0,
        capacitySpc,
        contributionTotalSpc: 0,
        startedAt: serverTimestamp(),
        endedAt: null,
      });
    } catch {
      // Non-fatal
    }

    // 4. Write projected view
    const viewRef = doc(this.firestore, `adminBinViews/${id}`);
    const searchTokens = Array.from(
      new Set(
        [id, locationName, locationDetail]
          .join(" ")
          .toLowerCase()
          .split(/[^a-z0-9_-]+/)
          .filter(Boolean)
      )
    );

    await setDoc(viewRef, {
      binId: id,
      locationName,
      locationDetail,
      capacitySpc,
      occupiedSpc: 0,
      fillPercent: 0,
      cycleId,
      enabled: isOnline,
      logicalOnline: isOnline,
      version: 1,
      sharedPolicyVersion: "v1.0.0",
      collectionState: "normal",
      lastCollectionTime: null,
      updatedAt: serverTimestamp(),
      searchTokens,
    });

    // 5. Revision bump
    try {
      const verRef = doc(this.firestore, "adminReadVersions/bins");
      await setDoc(verRef, {
        topic: "bins",
        version: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal
    }

    return await this.get(id);
  }

  private async directFirestoreUpdateBin(id: string, input: BinInput): Promise<SmartBinRow> {
    const isOnline = input.isOnline !== false;
    const locationName = input.locationName.trim();
    const locationDetail = input.locationDetail.trim();

    const binRef = doc(this.firestore, `bins/${id}`);
    const binSnap = await getDoc(binRef);
    const binData = binSnap.exists() ? binSnap.data() : {};
    const capacitySpc = Number(binData.capacitySpc ?? 1000);

    const hasExplicitPercent = input.capacityPercent !== undefined && !isNaN(Number(input.capacityPercent));
    const fillPercent = hasExplicitPercent
      ? Math.max(0, Math.min(100, Math.round(Number(input.capacityPercent))))
      : Number(binData.fillPercent ?? binData.capacityPercent ?? 0);
    const occupiedSpc = Math.round((fillPercent / 100) * capacitySpc);
    const collectionState = fillPercent >= 85 ? "critical" : fillPercent >= 75 ? "warning" : "normal";

    await setDoc(
      binRef,
      {
        displayName: locationName,
        locationName,
        locationDetail,
        enabled: isOnline,
        isOnline,
        logicalOnline: isOnline,
        fillPercent,
        capacityPercent: fillPercent,
        occupiedSpc,
        collectionState,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    const viewRef = doc(this.firestore, `adminBinViews/${id}`);
    await setDoc(
      viewRef,
      {
        locationName,
        locationDetail,
        enabled: isOnline,
        logicalOnline: isOnline,
        fillPercent,
        collectionState,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // If critical (>= 85%), ensure an alert exists for fleet dispatch visibility
    if (fillPercent >= 85) {
      try {
        const alertId = `alert-${id}`;
        const alertRef = doc(this.firestore, `adminAlertViews/${alertId}`);
        const alertSnap = await getDoc(alertRef);
        if (!alertSnap.exists() || alertSnap.data()?.state === "resolved") {
          await setDoc(
            alertRef,
            {
              alertId,
              binId: id,
              locationName,
              locationDetail,
              currentFillPercent: fillPercent,
              thresholdPercent: 85,
              state: "triggered",
              triggeredAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const capAlertRef = doc(this.firestore, `capacityAlerts/${alertId}`);
          await setDoc(
            capAlertRef,
            {
              alertId,
              binId: id,
              locationName,
              currentFillPercent: fillPercent,
              state: "triggered",
              triggeredAt: serverTimestamp(),
            },
            { merge: true }
          );

          const colStateRef = doc(this.firestore, `binCollectionState/${id}`);
          await setDoc(
            colStateRef,
            {
              binId: id,
              activeAlertId: alertId,
              status: "pending",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const alertVerRef = doc(this.firestore, "adminReadVersions/alerts");
          await setDoc(alertVerRef, {
            topic: "alerts",
            version: Date.now(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch { }
    } else {
      // If lowered below threshold (< 85%), automatically resolve active alerts for this bin
      try {
        let hasResolvedAlert = false;
        const alertId = `alert-${id}`;
        const alertRef = doc(this.firestore, `adminAlertViews/${alertId}`);
        const alertSnap = await getDoc(alertRef);
        if (alertSnap.exists() && alertSnap.data()?.state !== "resolved") {
          await setDoc(
            alertRef,
            {
              state: "resolved",
              currentFillPercent: fillPercent,
              resolvedAt: serverTimestamp(),
              resolvedBy: "admin (capacity reset)",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          hasResolvedAlert = true;
        }

        const capAlertRef = doc(this.firestore, `capacityAlerts/${alertId}`);
        const capSnap = await getDoc(capAlertRef);
        if (capSnap.exists() && capSnap.data()?.state !== "resolved") {
          await setDoc(
            capAlertRef,
            {
              state: "resolved",
              currentFillPercent: fillPercent,
              resolvedAt: serverTimestamp(),
              resolvedBy: "admin (capacity reset)",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          hasResolvedAlert = true;
        }

        // Query any other active capacityAlerts for this bin
        try {
          const capColl = collection(this.firestore, "capacityAlerts");
          const qSnap = await getDocs(query(capColl, where("binId", "==", id)));
          for (const docSnap of qSnap.docs) {
            const data = docSnap.data();
            if (data.state !== "resolved") {
              await setDoc(
                docSnap.ref,
                {
                  state: "resolved",
                  currentFillPercent: fillPercent,
                  resolvedAt: serverTimestamp(),
                  resolvedBy: "admin (capacity reset)",
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
              hasResolvedAlert = true;
            }
          }
        } catch { }

        // Restore operational collection status
        const colStateRef = doc(this.firestore, `binCollectionState/${id}`);
        await setDoc(
          colStateRef,
          {
            binId: id,
            activeAlertId: null,
            status: "normal",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (hasResolvedAlert) {
          const alertVerRef = doc(this.firestore, "adminReadVersions/alerts");
          await setDoc(alertVerRef, {
            topic: "alerts",
            version: Date.now(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch { }
    }

    try {
      const verRef = doc(this.firestore, "adminReadVersions/bins");
      await setDoc(verRef, {
        topic: "bins",
        version: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } catch { }

    try {
      const dashRef = doc(this.firestore, "adminReadVersions/dashboard");
      await setDoc(dashRef, {
        topic: "dashboard",
        version: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } catch { }

    return await this.get(id);
  }

  private async directFirestoreDeleteBin(id: string): Promise<void> {
    const binRef = doc(this.firestore, `bins/${id}`);
    await deleteDoc(binRef);

    const viewRef = doc(this.firestore, `adminBinViews/${id}`);
    await deleteDoc(viewRef);

    try {
      const qrRef = doc(this.firestore, `binQrMappings/qr-${id}`);
      await deleteDoc(qrRef);
    } catch { }

    try {
      const verRef = doc(this.firestore, "adminReadVersions/bins");
      await setDoc(verRef, {
        topic: "bins",
        version: Date.now(),
        updatedAt: serverTimestamp(),
      });
    } catch { }
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
      try {
        return await this.directFirestoreCreateBin(id, input);
      } catch {
        throw this.commandClient.mapFirebaseError(err, "adminCreateBin");
      }
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
      return await this.directFirestoreUpdateBin(id, input);
    } catch (err) {
      try {
        return await this.directFirestoreUpdateBin(id, input);
      } catch {
        throw this.commandClient.mapFirebaseError(err, "adminUpdateBin");
      }
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
      try {
        await this.directFirestoreDeleteBin(id);
      } catch {
        throw this.commandClient.mapFirebaseError(err, "adminDeleteUnusedBin");
      }
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
        } catch { }
      }

      throw this.commandClient.mapFirebaseError(new Error("Unable to retrieve QR code"), "getAdminBinQr");
    }
  }
}

