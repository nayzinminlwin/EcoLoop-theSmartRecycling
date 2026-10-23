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
import type { SmartBin } from "../../contracts/shared.ts";
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
    // Deduplicate active alerts by binId to prevent multiple active alerts for the same bin
    const activeBinMap = new Map<string, CapacityAlertRow>();
    const resolvedRows: CapacityAlertRow[] = [];

    for (const r of rows) {
      if (r.alert.status === "active") {
        const existing = activeBinMap.get(r.bin.id);
        if (!existing) {
          activeBinMap.set(r.bin.id, r);
        } else {
          const isCurrentCanonical = r.alert.id.includes("cycle");
          const isExistingCanonical = existing.alert.id.includes("cycle");
          if (isCurrentCanonical && !isExistingCanonical) {
            activeBinMap.set(r.bin.id, r);
          } else if (new Date(r.alert.triggeredAt).getTime() > new Date(existing.alert.triggeredAt).getTime() && isCurrentCanonical === isExistingCanonical) {
            activeBinMap.set(r.bin.id, r);
          }
        }
      } else {
        resolvedRows.push(r);
      }
    }

    const dedupedActiveRows = Array.from(activeBinMap.values());
    const dedupedAllRows = [...dedupedActiveRows, ...resolvedRows];

    const activeCount = dedupedActiveRows.length;
    const resolvedCount = resolvedRows.length;

    let filtered = dedupedAllRows.filter((r) => r.alert.status === query.status);

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

      const alertMap = new Map<string, Record<string, unknown>>();

      try {
        const capSnap = await getDocs(collection(this.firestore, "capacityAlerts"));
        for (const d of capSnap.docs) {
          const data = d.data();
          alertMap.set(d.id, {
            alertId: d.id,
            binId: data.binId ?? "",
            locationName: data.locationName ?? `Smart Bin ${data.binId}`,
            cycleId: data.cycleId ?? "",
            triggeringFillPercent: data.triggeringFillPercent ?? 85,
            currentFillPercent: data.currentFillPercent ?? data.triggeringFillPercent ?? 85,
            threshold: data.thresholdSnapshot ?? data.threshold ?? 85,
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
            ...data,
          });
        }
      } catch {}

      try {
        const viewsSnap = await getDocs(collection(this.firestore, "adminAlertViews"));
        for (const d of viewsSnap.docs) {
          const existing = alertMap.get(d.id) ?? { alertId: d.id };
          alertMap.set(d.id, { ...existing, alertId: d.id, ...d.data() });
        }
      } catch {}

      if (alertMap.size === 0) {
        return null;
      }

      // Read bins for location details and live capacity
      const binLocationMap = new Map<
        string,
        { locationName: string; locationDetail: string; isOnline: boolean; capacityPercent: number }
      >();
      try {
        const binsSnap = await getDocs(collection(this.firestore, "bins"));
        for (const b of binsSnap.docs) {
          const bData = b.data();
          const rawCap = Number(bData.fillPercent) > 0 ? Number(bData.fillPercent) : Number(bData.capacityPercent) > 0 ? Number(bData.capacityPercent) : 0;
          const cap = Math.max(0, Math.min(100, Math.round(rawCap)));
          binLocationMap.set(b.id, {
            locationName: String(bData.locationName ?? bData.displayName ?? b.id),
            locationDetail: String(bData.locationDetail ?? "Standard Facility"),
            isOnline: bData.isOnline !== false && bData.logicalOnline !== false && bData.enabled !== false,
            capacityPercent: cap,
          });
        }
      } catch {}

      // Ensure any bin currently exceeding threshold (>= 85%) has an active alert
      for (const [binId, bInfo] of binLocationMap.entries()) {
        if (bInfo.capacityPercent >= 85 && bInfo.isOnline) {
          const existingAlerts = Array.from(alertMap.values()).filter((a) => a.binId === binId);
          const hasActiveAlert = existingAlerts.some((a) => a.state !== "resolved");

          if (!hasActiveAlert) {
            const targetAlert = existingAlerts[0];
            const alertId = String(targetAlert?.alertId || `alert-${binId}-cycle-001`);
            const nowIso = new Date().toISOString();

            const activatedAlert = {
              ...(targetAlert || {}),
              alertId,
              binId,
              locationName: bInfo.locationName,
              cycleId: targetAlert?.cycleId || `cycle-${binId}-001`,
              triggeringFillPercent: bInfo.capacityPercent,
              currentFillPercent: bInfo.capacityPercent,
              threshold: targetAlert?.threshold || 85,
              operationalSettingsVersion: 1,
              state: "pending",
              version: Number(targetAlert?.version ?? 0) + 1,
              triggeredAt: nowIso,
              resolvedAt: null,
              resolvedBy: null,
              collectedAt: null,
              collectedBy: null,
              scheduledAt: null,
              scheduledBy: null,
            };

            alertMap.set(alertId, activatedAlert);

            try {
              setDoc(doc(this.firestore, "capacityAlerts", alertId), activatedAlert, { merge: true });
              setDoc(doc(this.firestore, "adminAlertViews", alertId), activatedAlert, { merge: true });
              setDoc(doc(this.firestore, "adminReadVersions", "alerts"), { topic: "alerts", version: increment(1), updatedAt: serverTimestamp() }, { merge: true });
            } catch {}
          }
        }
      }

      const rows: CapacityAlertRow[] = Array.from(alertMap.values()).map((raw) => {
        const view = decodeAdminAlertView(raw);
        const binInfo = binLocationMap.get(view.binId);

        const isResolved = view.state === "resolved";
        const liveCap = isResolved ? 0 : (binInfo ? binInfo.capacityPercent : view.currentFillPercent);
        let effectiveView: AdminAlertView = view;
        if (liveCap < (view.threshold || 85) && !isResolved && view.state !== "collected" && view.state !== "scheduled") {
          effectiveView = {
            ...view,
            state: "resolved",
            resolvedAt: view.resolvedAt ?? new Date().toISOString(),
            resolvedBy: view.resolvedBy ?? "admin (capacity reset)",
            currentFillPercent: liveCap,
          };

          // Self-heal Firestore in background
          try {
            const capRef = doc(this.firestore, "capacityAlerts", view.alertId);
            setDoc(capRef, { state: "resolved", currentFillPercent: liveCap, resolvedAt: serverTimestamp(), resolvedBy: "admin (capacity reset)" }, { merge: true });
            const viewRef = doc(this.firestore, "adminAlertViews", view.alertId);
            setDoc(viewRef, { state: "resolved", currentFillPercent: liveCap, resolvedAt: serverTimestamp(), resolvedBy: "admin (capacity reset)" }, { merge: true });
          } catch {}
        }

        return adminAlertViewToRow(
          effectiveView,
          binInfo
            ? {
                locationName: binInfo.locationName,
                locationDetail: binInfo.locationDetail,
                isOnline: binInfo.isOnline,
                capacityPercent: binInfo.capacityPercent,
              }
            : undefined
        );
      });

      return this.filterAndPaginateAlerts(rows, query);
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

      // Check live Firestore records to ensure real-time consistency with manual bin edits
      try {
        const firestorePage = await this.listFromFirestore(query);
        if (firestorePage && firestorePage.total > 0) {
          return firestorePage;
        }
      } catch {}

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

        // Listen for changes on canonical capacityAlerts directly
        try {
          const capAlertsCol = collection(this.firestore, "capacityAlerts");
          unsubs.push(
            onSnapshot(
              capAlertsCol,
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

        // Listen for changes on bins to reflect updated location/status
        try {
          const binsCol = collection(this.firestore, "bins");
          unsubs.push(
            onSnapshot(
              binsCol,
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
          let decoded: AdminAlertView | null = null;
          const snap = await getDoc(doc(this.firestore, "adminAlertViews", id));
          if (snap.exists()) {
            decoded = decodeAdminAlertView({ alertId: id, ...snap.data() });
          } else {
            const capSnap = await getDoc(doc(this.firestore, "capacityAlerts", id));
            if (capSnap.exists()) {
              const data = capSnap.data();
              decoded = decodeAdminAlertView({
                alertId: id,
                binId: data.binId ?? "",
                locationName: data.locationName ?? `Smart Bin ${data.binId}`,
                cycleId: data.cycleId ?? "",
                triggeringFillPercent: data.triggeringFillPercent ?? 85,
                currentFillPercent: data.currentFillPercent ?? data.triggeringFillPercent ?? 85,
                threshold: data.thresholdSnapshot ?? data.threshold ?? 85,
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
                ...data,
              });
            }
          }

          if (decoded) {
            let binDoc: Partial<SmartBin> | undefined;
            let effectiveView: AdminAlertView = decoded;
            try {
              const binSnap = await getDoc(doc(this.firestore, "bins", decoded.binId));
              if (binSnap.exists()) {
                const bData = binSnap.data();
                const rawFill = Number(bData.fillPercent) > 0 ? Number(bData.fillPercent) : Number(bData.capacityPercent) > 0 ? Number(bData.capacityPercent) : 0;
                const fill = Math.max(0, Math.min(100, Math.round(rawFill)));
                binDoc = {
                  locationName: String(bData.locationName ?? bData.displayName ?? decoded.locationName),
                  locationDetail: String(bData.locationDetail ?? "Standard Facility"),
                  isOnline: bData.isOnline !== false && bData.logicalOnline !== false && bData.enabled !== false,
                  capacityPercent: fill,
                };
                const isResolved = decoded.state === "resolved";
                if (isResolved) {
                  effectiveView = {
                    ...decoded,
                    currentFillPercent: 0,
                  };
                  if (binDoc) binDoc.capacityPercent = 0;
                } else if (fill < (decoded.threshold || 85) && decoded.state !== "collected" && decoded.state !== "scheduled") {
                  effectiveView = {
                    ...decoded,
                    state: "resolved",
                    resolvedAt: decoded.resolvedAt ?? new Date().toISOString(),
                    resolvedBy: decoded.resolvedBy ?? "admin (capacity reset)",
                    currentFillPercent: fill,
                  };

                  try {
                    setDoc(doc(this.firestore, "capacityAlerts", id), { state: "resolved", currentFillPercent: fill, resolvedAt: serverTimestamp(), resolvedBy: "admin (capacity reset)" }, { merge: true });
                    setDoc(doc(this.firestore, "adminAlertViews", id), { state: "resolved", currentFillPercent: fill, resolvedAt: serverTimestamp(), resolvedBy: "admin (capacity reset)" }, { merge: true });
                  } catch {}
                }
              }
            } catch {}

            return adminAlertViewToRow(effectiveView, binDoc);
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
        const unsubs: (() => void)[] = [];

        const load = () => {
          this.get(id)
            .then((row) => {
              if (active && observer.next) observer.next(row);
            })
            .catch(() => {
              if (active && observer.next) observer.next(null);
            });
        };

        // Initial fetch
        load();

        // Listen on adminAlertViews doc
        try {
          const docRef = doc(this.firestore, "adminAlertViews", id);
          unsubs.push(
            onSnapshot(
              docRef,
              (snap) => {
                if (!active) return;
                if (snap.exists()) {
                  try {
                    const decoded = decodeAdminAlertView({ alertId: id, ...snap.data() });
                    if (observer.next) observer.next(adminAlertViewToRow(decoded));
                  } catch {
                    load();
                  }
                } else {
                  load();
                }
              },
              () => {
                if (active) load();
              }
            )
          );
        } catch {}

        // Listen on canonical capacityAlerts doc
        try {
          const capRef = doc(this.firestore, "capacityAlerts", id);
          unsubs.push(
            onSnapshot(
              capRef,
              (snap) => {
                if (!active) return;
                if (snap.exists()) {
                  try {
                    const decoded = decodeAdminAlertView({ alertId: id, ...snap.data() });
                    if (observer.next) observer.next(adminAlertViewToRow(decoded));
                  } catch {
                    load();
                  }
                } else {
                  load();
                }
              },
              () => {
                if (active) load();
              }
            )
          );
        } catch {}

        return () => {
          active = false;
          unsubs.forEach((u) => u());
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
              collectionStatus: "pending",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await setDoc(
            doc(this.firestore, "bins", raw.binId),
            {
              collectionStatus: "pending",
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
              collectionStatus: "collected",
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
              capacityPercent: 0,
              collectionStatus: "collected",
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

    if (binId) {
      try {
        await setDoc(
          doc(this.firestore, "bins", binId),
          { occupiedSpc: 0, fillPercent: 0, capacityPercent: 0, collectionStatus: "collected", updatedAt: serverTimestamp() },
          { merge: true }
        );
        await setDoc(
          doc(this.firestore, "adminBinViews", binId),
          { occupiedSpc: 0, fillPercent: 0, collectionState: "normal", collectionStatus: "collected", updatedAt: serverTimestamp() },
          { merge: true }
        );
        await setDoc(
          doc(this.firestore, "adminReadVersions", "bins"),
          { topic: "bins", version: increment(1), updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch {}
    }

    return await this.get(id);
  }

  async resolve(id: string): Promise<CapacityAlertRow> {
    const raw = await this.getRawAlert(id);
    const expectedVersion = Number(raw.version ?? 1);
    const binId = raw.binId;

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
          currentFillPercent: 0,
          version: nextVersion,
          resolvedAt: nowIso,
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(this.firestore, "capacityAlerts", id), {
          state: "resolved",
          currentFillPercent: 0,
          version: nextVersion,
          resolvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (binId) {
          await setDoc(
            doc(this.firestore, "binCollectionState", binId),
            {
              activeAlertId: null,
              status: "normal",
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
              collectionStatus: "notScheduled",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await setDoc(
            doc(this.firestore, "bins", binId),
            {
              occupiedSpc: 0,
              fillPercent: 0,
              capacityPercent: 0,
              collectionStatus: "notScheduled",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          await setDoc(
            doc(this.firestore, "adminReadVersions", "bins"),
            { topic: "bins", version: increment(1), updatedAt: serverTimestamp() },
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

    if (binId) {
      try {
        await setDoc(
          doc(this.firestore, "bins", binId),
          { occupiedSpc: 0, fillPercent: 0, capacityPercent: 0, collectionStatus: "notScheduled", updatedAt: serverTimestamp() },
          { merge: true }
        );
        await setDoc(
          doc(this.firestore, "adminBinViews", binId),
          { occupiedSpc: 0, fillPercent: 0, collectionState: "normal", collectionStatus: "notScheduled", updatedAt: serverTimestamp() },
          { merge: true }
        );
        await setDoc(
          doc(this.firestore, "adminReadVersions", "bins"),
          { topic: "bins", version: increment(1), updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch {}
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
          const capSnap = await getDoc(doc(this.firestore, "capacityAlerts", id));
          if (capSnap.exists()) {
            const data = capSnap.data();
            return decodeAdminAlertView({
              alertId: id,
              binId: data.binId ?? "",
              locationName: data.locationName ?? `Smart Bin ${data.binId}`,
              cycleId: data.cycleId ?? "",
              triggeringFillPercent: data.triggeringFillPercent ?? 85,
              currentFillPercent: data.currentFillPercent ?? data.triggeringFillPercent ?? 85,
              threshold: data.thresholdSnapshot ?? data.threshold ?? 85,
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
              ...data,
            });
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
