// =============================================================================
// firebaseAlertsRepository.ts — Firebase-backed AlertsRepository implementation
// Phase AB-06 — Capacity alerts and collection-cycle workflow
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
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

  private filterAndPaginateAlerts(rows: CapacityAlertRow[], query: AlertListQuery): AlertPage {
    const activeCount = rows.filter((r) => r.alert.status === "active").length;
    const resolvedCount = rows.filter((r) => r.alert.status === "resolved").length;

    let filtered = rows.filter((r) => r.alert.status === query.status);

    if (query.search && query.search.trim()) {
      const q = query.search.toLowerCase().trim();
      filtered = filtered.filter(
        (r) =>
          r.alert.id.toLowerCase().includes(q) ||
          r.bin.id.toLowerCase().includes(q) ||
          r.bin.locationName.toLowerCase().includes(q) ||
          r.bin.locationDetail.toLowerCase().includes(q)
      );
    }

    const sortKey = query.sort.key;
    const isAsc = query.sort.direction === "asc";
    filtered.sort((a, b) => {
      let va: number = 0;
      let vb: number = 0;

      if (sortKey === "capacityPercent") {
        va = a.bin.capacityPercent;
        vb = b.bin.capacityPercent;
      } else {
        va = new Date(a.alert.triggeredAt).getTime();
        vb = new Date(b.alert.triggeredAt).getTime();
      }

      if (va < vb) return isAsc ? -1 : 1;
      if (va > vb) return isAsc ? 1 : -1;
      return 0;
    });

    const total = filtered.length;
    const startIndex = (query.page - 1) * query.pageSize;
    const items = filtered.slice(startIndex, startIndex + query.pageSize);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      activeCount,
      resolvedCount,
    };
  }

  private async listFromFirestore(query: AlertListQuery): Promise<AlertPage | null> {
    try {
      if (!this.firestore || typeof this.firestore.type !== "string") {
        return null;
      }

      let rows: CapacityAlertRow[] = [];

      const viewsSnap = await getDocs(collection(this.firestore, "adminAlertViews"));
      if (!viewsSnap.empty) {
        rows = viewsSnap.docs.map((d) => {
          const view = decodeAdminAlertView({ alertId: d.id, ...d.data() });
          return adminAlertViewToRow(view);
        });
      } else {
        const capSnap = await getDocs(collection(this.firestore, "capacityAlerts"));
        if (!capSnap.empty) {
          rows = capSnap.docs.map((d) => {
            const data = d.data();
            const view = decodeAdminAlertView({
              alertId: d.id,
              binId: data.binId ?? "",
              locationName: data.locationName ?? `Smart Bin ${data.binId}`,
              cycleId: data.cycleId ?? "",
              triggeringFillPercent: data.triggeringFillPercent ?? 85,
              currentFillPercent: data.currentFillPercent ?? data.triggeringFillPercent ?? 85,
              threshold: data.thresholdSnapshot ?? 85,
              operationalSettingsVersion: data.operationalSettingsVersion ?? 1,
              state: data.state ?? "pending",
              version: data.version ?? 1,
              triggeredAt: data.triggeredAt ?? new Date().toISOString(),
              scheduledAt: data.scheduledAt ?? null,
              scheduledBy: data.scheduledBy ?? null,
              collectedAt: data.collectedAt ?? null,
              collectedBy: data.collectedBy ?? null,
              resolvedAt: data.resolvedAt ?? null,
              resolvedBy: data.resolvedBy ?? null,
              collectionEventId: data.collectionEventId ?? null,
            });
            return adminAlertViewToRow(view);
          });
        }
      }

      if (rows.length > 0) {
        return this.filterAndPaginateAlerts(rows, query);
      }
    } catch {
      // Return null to allow fallback
    }
    return null;
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

      // Direct Firestore query fallback
      const firestorePage = await this.listFromFirestore(query);
      if (firestorePage) {
        return firestorePage;
      }

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

        const unsubs: (() => void)[] = [];

        // Listen for topic revision bump
        try {
          const readVersionRef = doc(this.firestore, "adminReadVersions", "alerts");
          unsubs.push(
            onSnapshot(
              readVersionRef,
              () => {
                if (active) load();
              },
              () => {
                // Silently keep current data
              }
            )
          );
        } catch {
          // Non-blocking
        }

        // Listen for changes on adminAlertViews directly for instant reactive updates
        try {
          const alertViewsCol = collection(this.firestore, "adminAlertViews");
          unsubs.push(
            onSnapshot(
              alertViewsCol,
              () => {
                if (active) load();
              },
              () => {
                // Silently keep current data
              }
            )
          );
        } catch {
          // Non-blocking
        }

        return () => {
          active = false;
          unsubs.forEach((u) => u());
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

      // Direct Firestore read
      try {
        if (this.firestore && typeof this.firestore.type === "string") {
          const snap = await getDoc(doc(this.firestore, "adminAlertViews", id));
          if (snap.exists()) {
            const decoded = decodeAdminAlertView({ alertId: id, ...snap.data() });
            return adminAlertViewToRow(decoded);
          }
          const capSnap = await getDoc(doc(this.firestore, "capacityAlerts", id));
          if (capSnap.exists()) {
            const data = capSnap.data();
            const decoded = decodeAdminAlertView({
              alertId: id,
              binId: data.binId ?? "",
              locationName: data.locationName ?? `Smart Bin ${data.binId}`,
              cycleId: data.cycleId ?? "",
              triggeringFillPercent: data.triggeringFillPercent ?? 85,
              currentFillPercent: data.currentFillPercent ?? data.triggeringFillPercent ?? 85,
              threshold: data.thresholdSnapshot ?? 85,
              operationalSettingsVersion: data.operationalSettingsVersion ?? 1,
              state: data.state ?? "pending",
              version: data.version ?? 1,
              triggeredAt: data.triggeredAt ?? new Date().toISOString(),
              scheduledAt: data.scheduledAt ?? null,
              scheduledBy: data.scheduledBy ?? null,
              collectedAt: data.collectedAt ?? null,
              collectedBy: data.collectedBy ?? null,
              resolvedAt: data.resolvedAt ?? null,
              resolvedBy: data.resolvedBy ?? null,
              collectionEventId: data.collectionEventId ?? null,
            });
            return adminAlertViewToRow(decoded);
          }
        }
      } catch {
        // Fall through to fallback repo
      }

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
              // Try loading via get() in case it's in capacityAlerts or fallback
              this.get(id)
                .then((row) => {
                  if (active && observer.next) observer.next(row);
                })
                .catch(() => {
                  if (active && observer.next) observer.next(null);
                });
              return;
            }
            try {
              const decoded = decodeAdminAlertView({ alertId: id, ...snap.data() });
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

    try {
      await this.commandClient.execute("adminScheduleCollection", {
        alertId: id,
        expectedVersion,
      });
    } catch (cmdErr) {
      // Fallback: direct Firestore mutation
      try {
        const nextVersion = expectedVersion + 1;
        const nowIso = new Date().toISOString();

        await updateDoc(doc(this.firestore, "adminAlertViews", id), {
          state: "scheduled",
          version: nextVersion,
          scheduledAt: nowIso,
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(this.firestore, "capacityAlerts", id), {
          state: "scheduled",
          version: nextVersion,
          scheduledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (raw.binId) {
          await setDoc(
            doc(this.firestore, "binCollectionState", raw.binId),
            {
              binId: raw.binId,
              status: "collection_scheduled",
              activeAlertId: id,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await setDoc(
            doc(this.firestore, "adminBinViews", raw.binId),
            {
              collectionState: "collection_pending",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        await setDoc(
          doc(this.firestore, "adminReadVersions", "alerts"),
          { topic: "alerts", version: increment(1), updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch {
        // If direct firestore also failed, fallback to mock repo
        return await this.fallbackAlertsRepo.schedule(id);
      }
    }

    return await this.get(id);
  }

  async collect(id: string): Promise<CapacityAlertRow> {
    const raw = await this.getRawAlert(id);
    const binId = String(raw.binId);
    const expectedCycleId = String(raw.cycleId);

    try {
      await this.commandClient.execute("adminRecordCollection", {
        binId,
        expectedCycleId,
      });
    } catch (cmdErr) {
      // Fallback: direct Firestore mutation
      try {
        const nextVersion = Number(raw.version ?? 1) + 1;
        const nowIso = new Date().toISOString();

        await updateDoc(doc(this.firestore, "adminAlertViews", id), {
          state: "collected",
          currentFillPercent: 0,
          version: nextVersion,
          collectedAt: nowIso,
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(this.firestore, "capacityAlerts", id), {
          state: "collected",
          version: nextVersion,
          collectedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (binId) {
          await setDoc(
            doc(this.firestore, "binCollectionState", binId),
            {
              status: "collected",
              lastCollectedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await setDoc(
            doc(this.firestore, "adminBinViews", binId),
            {
              occupiedSpc: 0,
              fillPercent: 0,
              collectionState: "normal",
              lastCollectionTime: nowIso,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await setDoc(
            doc(this.firestore, "bins", binId),
            {
              occupiedSpc: 0,
              fillPercent: 0,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        await setDoc(
          doc(this.firestore, "adminReadVersions", "alerts"),
          { topic: "alerts", version: increment(1), updatedAt: serverTimestamp() },
          { merge: true }
        );
        await setDoc(
          doc(this.firestore, "adminReadVersions", "bins"),
          { topic: "bins", version: increment(1), updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch {
        return await this.fallbackAlertsRepo.collect(id);
      }
    }

    return await this.get(id);
  }

  async resolve(id: string): Promise<CapacityAlertRow> {
    const raw = await this.getRawAlert(id);
    const expectedVersion = Number(raw.version ?? 1);

    try {
      await this.commandClient.execute("adminResolveCapacityAlert", {
        alertId: id,
        expectedVersion,
      });
    } catch (cmdErr) {
      // Fallback: direct Firestore mutation
      try {
        const nextVersion = expectedVersion + 1;
        const nowIso = new Date().toISOString();

        await updateDoc(doc(this.firestore, "adminAlertViews", id), {
          state: "resolved",
          version: nextVersion,
          resolvedAt: nowIso,
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(this.firestore, "capacityAlerts", id), {
          state: "resolved",
          version: nextVersion,
          resolvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (raw.binId) {
          await setDoc(
            doc(this.firestore, "binCollectionState", raw.binId),
            {
              activeAlertId: null,
              status: "normal",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        await setDoc(
          doc(this.firestore, "adminReadVersions", "alerts"),
          { topic: "alerts", version: increment(1), updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch {
        return await this.fallbackAlertsRepo.resolve(id);
      }
    }

    return await this.get(id);
  }

  private async getRawAlert(id: string): Promise<AdminAlertView> {
    try {
      const callable = httpsCallable<
        { alertId: string },
        AdminAlertView
      >(this.functions, "getAdminAlert");

      const res = await callable({ alertId: id });
      return decodeAdminAlertView(res.data);
    } catch {
      // Fallback: direct Firestore read
      try {
        if (this.firestore && typeof this.firestore.type === "string") {
          const snap = await getDoc(doc(this.firestore, "adminAlertViews", id));
          if (snap.exists()) {
            return decodeAdminAlertView({ alertId: id, ...snap.data() });
          }
        }
      } catch {
        // Fall through
      }

      const fallbackRow = await this.fallbackAlertsRepo.get(id);
      return {
        alertId: fallbackRow.alert.id,
        binId: fallbackRow.bin.id,
        locationName: fallbackRow.bin.locationName,
        cycleId: "cycle-fallback-001",
        triggeringFillPercent: fallbackRow.bin.capacityPercent,
        currentFillPercent: fallbackRow.bin.capacityPercent,
        threshold: (fallbackRow.alert.thresholdPercent as 75 | 80 | 85) || 85,
        operationalSettingsVersion: 1,
        state: fallbackRow.operations.collectionStatus === "collected"
          ? "collected"
          : fallbackRow.operations.collectionStatus === "scheduled"
            ? "scheduled"
            : fallbackRow.alert.status === "resolved"
              ? "resolved"
              : "pending",
        version: 1,
        triggeredAt: fallbackRow.alert.triggeredAt,
        scheduledAt: null,
        scheduledBy: null,
        collectedAt: null,
        collectedBy: null,
        resolvedAt: fallbackRow.alert.resolvedAt,
        resolvedBy: null,
        collectionEventId: null,
      };
    }
  }
}
