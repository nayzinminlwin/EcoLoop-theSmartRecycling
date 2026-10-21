// =============================================================================
// firebaseBinRepository.ts — Firebase-backed BinsRepository implementation
// Phase AB-03 — list, watchList, get, watch with cursor pagination & read models
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  doc,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
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
} from "../../contracts/admin.ts";
import {
  decodeAdminBinView,
  decodeAdminBinDetailView,
  decodeAdminPaginatedResponse,
  adminBinViewToRow,
  type AdminBinView,
  type AdminPaginatedResponse,
} from "../../contracts/adminViewCodecs.ts";
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

  async list(query: BinListQuery): Promise<Page<SmartBinRow>> {
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
      const rows = decoded.items.map(adminBinViewToRow);

      return {
        items: rows,
        total: decoded.total,
        page: query.page,
        pageSize: query.pageSize,
      };
    } catch {
      // Fallback to local baseline mock repository if cloud functions not yet deployed
      return await this.fallbackBinsRepo.list(query);
    }
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

        // Listen to topic revision bump
        const versionDocRef = doc(this.firestore, "adminReadVersions/bins");
        const unsubscribeSnapshot = onSnapshot(
          versionDocRef,
          () => {
            if (isSubscribed) load();
          },
          () => {
            // If rules or network error, silently keep current data
          }
        );

        return () => {
          isSubscribed = false;
          unsubscribeSnapshot();
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
      return await this.fallbackBinsRepo.get(id);
    }
  }

  watch(id: string): Observable<SmartBinRow | null> {
    return {
      subscribe: (observer: Observer<SmartBinRow | null>): Unsubscribe => {
        let isSubscribed = true;
        const binDocRef = doc(this.firestore, `adminBinViews/${id}`);

        const unsubscribe = onSnapshot(
          binDocRef,
          (snap) => {
            if (!isSubscribed) return;
            if (!snap.exists()) {
              observer.next(null);
              return;
            }
            try {
              const view = decodeAdminBinView({ binId: snap.id, ...snap.data() });
              observer.next(adminBinViewToRow(view));
            } catch {
              observer.next(null);
            }
          },
          () => {
            if (!isSubscribed) return;
            // Fallback to repository watch
            this.fallbackBinsRepo.watch(id).subscribe(observer);
          }
        );

        return () => {
          isSubscribed = false;
          unsubscribe();
        };
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
    } catch (err) {
      throw this.commandClient.mapFirebaseError(err, "getAdminBinQr");
    }
  }
}

