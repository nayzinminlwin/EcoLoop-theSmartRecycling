// =============================================================================
// firebaseAlertsRepository.ts — Firebase-backed AlertsRepository implementation
// Phase AB-06 — Capacity alerts and collection-cycle workflow
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  doc,
  onSnapshot,
  type Firestore,
} from "firebase/firestore";
import {
  type AlertsRepository,
  type Observable,
  type Observer,
  type Unsubscribe,
  RepositoryError,
} from "../repositories.ts";
import type {
  AlertListQuery,
  AlertPage,
  CapacityAlertRow,
} from "../../contracts/admin.ts";
import {
  decodeAdminAlertView,
  decodeAdminPaginatedResponse,
  adminAlertViewToRow,
  type AdminAlertView,
  type AdminPaginatedResponse,
} from "../../contracts/adminViewCodecs.ts";
import type { FirebaseCommandClient } from "../../core/firebase/commandClient.ts";

export class FirebaseAlertsRepository implements AlertsRepository {
  private readonly functions: Functions;
  private readonly firestore: Firestore;
  private readonly commandClient: FirebaseCommandClient;
  private readonly fallbackAlertsRepo: AlertsRepository;

  constructor(
    functions: Functions,
    firestore: Firestore,
    commandClient: FirebaseCommandClient,
    fallbackAlertsRepo: AlertsRepository
  ) {
    this.functions = functions;
    this.firestore = firestore;
    this.commandClient = commandClient;
    this.fallbackAlertsRepo = fallbackAlertsRepo;
  }

  private mapSortKey(key: string): string {
    switch (key) {
      case "capacityPercent":
      case "fillPercent":
        return "currentFillPercent";
      case "triggeredAt":
      default:
        return "triggeredAt";
    }
  }

  async list(query: AlertListQuery): Promise<AlertPage> {
    try {
      const callable = httpsCallable<
        Record<string, unknown>,
        AdminPaginatedResponse<AdminAlertView>
      >(this.functions, "listAdminAlerts");

      const filters: Record<string, unknown> = {
        status: query.status,
      };

      const res = await callable({
        search: query.search || undefined,
        sortKey: this.mapSortKey(query.sort.key),
        sortDirection: query.sort.direction,
        pageSize: query.pageSize,
        filters,
      });

      const decoded = decodeAdminPaginatedResponse(res.data, decodeAdminAlertView);
      const items = decoded.items.map((v) => adminAlertViewToRow(v));

      // Fetch active vs resolved counts
      let activeCount = query.status === "active" ? decoded.total : 0;
      let resolvedCount = query.status === "resolved" ? decoded.total : 0;

      try {
        const counterQueryCallable = httpsCallable<
          Record<string, unknown>,
          AdminPaginatedResponse<AdminAlertView>
        >(this.functions, "listAdminAlerts");

        const otherStatus = query.status === "active" ? "resolved" : "active";
        const otherRes = await counterQueryCallable({
          pageSize: 1,
          filters: { status: otherStatus },
        });
        const otherDecoded = decodeAdminPaginatedResponse(otherRes.data, decodeAdminAlertView);

        if (query.status === "active") {
          resolvedCount = otherDecoded.total;
        } else {
          activeCount = otherDecoded.total;
        }
      } catch {
        // Non-blocking counter fallback
      }

      return {
        items,
        total: decoded.total,
        page: query.page,
        pageSize: query.pageSize,
        activeCount,
        resolvedCount,
      };
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      return this.fallbackAlertsRepo.list(query);
    }
  }

  watchList(query: AlertListQuery): Observable<AlertPage> {
    return {
      subscribe: (observerOrNext: Partial<Observer<AlertPage>> | ((val: AlertPage) => void)): Unsubscribe => {
        const observer: Partial<Observer<AlertPage>> =
          typeof observerOrNext === "function" ? { next: observerOrNext } : observerOrNext;

        let active = true;

        const load = () => {
          this.list(query)
            .then((page) => {
              if (active && observer.next) observer.next(page);
            })
            .catch((err) => {
              if (active && observer.error) observer.error(err);
            });
        };

        // Emit initial page
        load();

        // Listen for topic revision bump
        const readVersionRef = doc(this.firestore, "adminReadVersions", "alerts");
        const unsubscribe = onSnapshot(
          readVersionRef,
          () => {
            if (active) load();
          },
          () => {
            // If rules or network error, silently keep current data
          }
        );

        return () => {
          active = false;
          unsubscribe();
        };
      },
    };
  }

  async get(id: string): Promise<CapacityAlertRow> {
    try {
      const callable = httpsCallable<
        { alertId: string },
        AdminAlertView
      >(this.functions, "getAdminAlert");

      const res = await callable({ alertId: id });
      const decoded = decodeAdminAlertView(res.data);
      return adminAlertViewToRow(decoded);
    } catch (err) {
      if (err instanceof RepositoryError) throw err;
      return this.fallbackAlertsRepo.get(id);
    }
  }

  watch(id: string): Observable<CapacityAlertRow | null> {
    return {
      subscribe: (
        observerOrNext: Partial<Observer<CapacityAlertRow | null>> | ((val: CapacityAlertRow | null) => void)
      ): Unsubscribe => {
        const observer: Partial<Observer<CapacityAlertRow | null>> =
          typeof observerOrNext === "function" ? { next: observerOrNext } : observerOrNext;

        let active = true;

        const docRef = doc(this.firestore, "adminAlertViews", id);
        const unsubscribe = onSnapshot(
          docRef,
          (snap) => {
            if (!active) return;
            if (!snap.exists()) {
              if (observer.next) observer.next(null);
              return;
            }
            try {
              const decoded = decodeAdminAlertView(snap.data());
              const row = adminAlertViewToRow(decoded);
              if (observer.next) observer.next(row);
            } catch {
              if (observer.next) observer.next(null);
            }
          },
          () => {
            if (!active) return;
            this.fallbackAlertsRepo.watch(id).subscribe(observer as Observer<CapacityAlertRow | null>);
          }
        );

        return () => {
          active = false;
          unsubscribe();
        };
      },
    };
  }

  async schedule(id: string): Promise<CapacityAlertRow> {
    const raw = await this.getRawAlert(id);
    const expectedVersion = Number(raw.version ?? 1);

    await this.commandClient.execute("adminScheduleCollection", {
      alertId: id,
      expectedVersion,
    });

    return await this.get(id);
  }

  async collect(id: string): Promise<CapacityAlertRow> {
    const raw = await this.getRawAlert(id);
    const binId = String(raw.binId);
    const expectedCycleId = String(raw.cycleId);

    await this.commandClient.execute("adminRecordCollection", {
      binId,
      expectedCycleId,
    });

    return await this.get(id);
  }

  async resolve(id: string): Promise<CapacityAlertRow> {
    const raw = await this.getRawAlert(id);
    const expectedVersion = Number(raw.version ?? 1);

    await this.commandClient.execute("adminResolveCapacityAlert", {
      alertId: id,
      expectedVersion,
    });

    return await this.get(id);
  }

  private async getRawAlert(id: string): Promise<AdminAlertView> {
    const callable = httpsCallable<
      { alertId: string },
      AdminAlertView
    >(this.functions, "getAdminAlert");

    const res = await callable({ alertId: id });
    return decodeAdminAlertView(res.data);
  }
}
