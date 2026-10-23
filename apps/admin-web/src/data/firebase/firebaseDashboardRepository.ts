// =============================================================================
// firebaseDashboardRepository.ts — Firebase-backed DashboardRepository
// Phase AB-09 — Live metrics, cross-client convergence, and visibility pause/resume
// =============================================================================

import { httpsCallable, type Functions } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import type {
  DashboardRepository,
  Observable,
  Observer,
  Unsubscribe,
} from "../repositories.ts";
import type { DashboardSummary, SmartBinRow } from "../../contracts/admin.ts";
import {
  decodeAdminDashboardView,
  adminDashboardViewToSummary,
} from "../../contracts/adminViewCodecs.ts";
import type { FirebaseCommandClient } from "../../core/firebase/commandClient.ts";

function getMalaysiaDate(instant?: string | number | null): string {
  const d = typeof instant === "number" ? new Date(instant) : new Date(instant || Date.now());
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

function getSevenDayMalaysiaWindow(nowMs: number = Date.now()): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const targetMs = nowMs - i * 86400000;
    dates.push(getMalaysiaDate(targetMs));
  }
  return dates;
}

export class FirebaseDashboardRepository implements DashboardRepository {
  private readonly functions: Functions;
  private readonly firestore: Firestore;
  private readonly commandClient: FirebaseCommandClient;
  private readonly fallbackDashboardRepo: DashboardRepository;

  constructor(
    functions: Functions,
    firestore: Firestore,
    commandClient: FirebaseCommandClient,
    fallbackDashboardRepo: DashboardRepository
  ) {
    this.functions = functions;
    this.firestore = firestore;
    this.commandClient = commandClient;
    this.fallbackDashboardRepo = fallbackDashboardRepo;
  }

  private async computeSummaryFromFirestore(): Promise<DashboardSummary | null> {
    try {
      if (!this.firestore || typeof this.firestore.type !== "string") {
        return null;
      }

      const nowMs = Date.now();
      const todayMalaysia = getMalaysiaDate(nowMs);
      const windowDates = getSevenDayMalaysiaWindow(nowMs);

      // 1. Registered Bins & Attention Bins
      const binMap = new Map<string, Record<string, unknown>>();
      try {
        const binsSnap = await getDocs(collection(this.firestore, "bins"));
        for (const d of binsSnap.docs) {
          binMap.set(d.id, { id: d.id, ...d.data() });
        }
      } catch { }
      try {
        const viewsSnap = await getDocs(collection(this.firestore, "adminBinViews"));
        for (const d of viewsSnap.docs) {
          const existing = binMap.get(d.id) ?? { id: d.id };
          const merged = { ...existing, ...d.data() };
          const existingFill = Number(existing.fillPercent) > 0 ? Number(existing.fillPercent) : Number(existing.capacityPercent) > 0 ? Number(existing.capacityPercent) : 0;
          if (existingFill > 0 && (!d.data().fillPercent || Number(d.data().fillPercent) === 0)) {
            merged.fillPercent = existingFill;
          }
          binMap.set(d.id, merged);
        }
      } catch { }
      const allBins = Array.from(binMap.values());

      const attentionBins: Array<{
        binId: string;
        locationName: string;
        fillPercent: number;
        collectionState: "normal" | "warning" | "critical" | "collection_pending";
        isOnline?: boolean;
      }> = [];

      for (const b of allBins) {
        const rawFill = Number(b.fillPercent) > 0 ? Number(b.fillPercent) : Number(b.capacityPercent) > 0 ? Number(b.capacityPercent) : 0;
        const fill = Math.max(0, Math.min(100, Math.round(rawFill)));
        const isEnabled = b.enabled !== false;
        const isLogicalOnline = b.logicalOnline !== false && b.isOnline !== false;
        const isOnline = isEnabled && isLogicalOnline;
        const colState = (b.collectionState as "normal" | "warning" | "critical" | "collection_pending") ||
          (fill >= 85 ? "critical" : fill >= 75 ? "warning" : "normal");

        if (fill >= 75 || colState === "critical" || colState === "warning" || !isOnline) {
          attentionBins.push({
            binId: String(b.binId ?? b.id),
            locationName: String(b.locationName ?? "Unknown Location"),
            fillPercent: fill,
            collectionState: colState,
            isOnline,
          });
        }
      }
      attentionBins.sort((a, b) => b.fillPercent - a.fillPercent);

      // 2. Alerts
      const alertMap = new Map<string, Record<string, unknown>>();
      try {
        const capSnap = await getDocs(collection(this.firestore, "capacityAlerts"));
        for (const d of capSnap.docs) {
          alertMap.set(d.id, { id: d.id, ...d.data() });
        }
      } catch { }
      try {
        const viewsSnap = await getDocs(collection(this.firestore, "adminAlertViews"));
        for (const d of viewsSnap.docs) {
          if (!alertMap.has(d.id)) {
            alertMap.set(d.id, { id: d.id, ...d.data() });
          }
        }
      } catch { }
      const activeAlerts = Array.from(alertMap.values()).filter((a) => {
        const state = a.state;
        if (state === "resolved" || state === "closed") return false;
        const binId = String(a.binId ?? "");
        const bin = binMap.get(binId);
        if (bin) {
          const rawFill = Number(bin.fillPercent) > 0 ? Number(bin.fillPercent) : Number(bin.capacityPercent) > 0 ? Number(bin.capacityPercent) : 0;
          const fill = Math.max(0, Math.min(100, Math.round(rawFill)));
          const threshold = Number(a.threshold ?? a.thresholdPercent ?? a.thresholdSnapshot ?? 85);
          if (fill < threshold) return false;
        }
        return true;
      }).length;

      // 3. Review Tickets
      let pendingReviews = 0;
      try {
        const ticketsDocs = (await getDocs(collection(this.firestore, "reviewTickets"))).docs;
        pendingReviews = ticketsDocs.filter((d) => {
          const state = d.data().state ?? d.data().status;
          return state === "open" || state === "awaiting_review" || state === "awaitingReview";
        }).length;
      } catch { }

      // 4. Deposits
      const depMap = new Map<string, Record<string, unknown>>();
      try {
        const depSnap = await getDocs(collection(this.firestore, "deposits"));
        for (const d of depSnap.docs) {
          depMap.set(d.id, { id: d.id, ...d.data() });
        }
      } catch { }
      try {
        const batchSnap = await getDocs(collection(this.firestore, "batches"));
        for (const d of batchSnap.docs) {
          if (!depMap.has(d.id)) {
            depMap.set(d.id, { id: d.id, ...d.data() });
          }
        }
      } catch { }
      const depDocs = Array.from(depMap.values());

      let totalVerifiedDeposits = 0;
      let verifiedDepositsToday = 0;
      let totalPointsIssued = 0;
      let pointsIssuedToday = 0;

      const activityMap = new Map<string, { depositsCount: number; pointsAwarded: number }>();
      for (const d of windowDates) {
        activityMap.set(d, { depositsCount: 0, pointsAwarded: 0 });
      }

      const materialCounts: Record<string, number> = {
        plastic: 0,
        aluminium: 0,
        paper: 0,
        glass: 0,
        unknown: 0,
      };

      const weightsPerItem: Record<string, number> = {
        plastic: 0.025,
        aluminium: 0.015,
        paper: 0.050,
        glass: 0.200,
        unknown: 0,
      };

      for (const d of depDocs) {
        const dep = d;
        const isVerified = dep.status === "verified" || dep.status === "settled";

        let points = Number(dep.pointsAwarded ?? 0);
        if (!points && Array.isArray(dep.lines)) {
          points = dep.lines.reduce((acc: number, l: Record<string, unknown>) => acc + Number(l.points ?? 0), 0);
        }

        const occurredAt = String(dep.createdAt ?? dep.occurredAt ?? new Date(nowMs).toISOString());
        const batchDate = getMalaysiaDate(occurredAt);

        if (isVerified) {
          totalVerifiedDeposits++;
          totalPointsIssued += points;

          if (batchDate === todayMalaysia) {
            verifiedDepositsToday++;
            pointsIssuedToday += points;
          }
        }

        if (activityMap.has(batchDate)) {
          const act = activityMap.get(batchDate)!;
          act.depositsCount++;
          act.pointsAwarded += points;
        }

        if (Array.isArray(dep.lines)) {
          for (const line of dep.lines) {
            const cls = String(line.class ?? "").toLowerCase();
            const cnt = Number(line.count ?? 1);
            if (cls.includes("plastic")) {
              materialCounts.plastic += cnt;
            } else if (cls.includes("aluminium") || cls.includes("can")) {
              materialCounts.aluminium += cnt;
            } else if (cls.includes("paper")) {
              materialCounts.paper += cnt;
            } else if (cls.includes("glass")) {
              materialCounts.glass += cnt;
            } else {
              materialCounts.unknown += cnt;
            }
          }
        }
      }

      const totalItems = Object.values(materialCounts).reduce((a, b) => a + b, 0);
      let calculatedWeight = 0;
      const materialMix: Array<{
        materialType: "plastic" | "aluminium" | "paper" | "glass" | "unknown";
        percentage: number;
        itemCount: number;
        weightKg: number;
      }> = [];

      for (const [matType, count] of Object.entries(materialCounts)) {
        if (matType === "unknown" && count === 0) continue;
        const percentage = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
        const weightKg = Math.round(count * (weightsPerItem[matType] || 0) * 1000) / 1000;
        calculatedWeight += weightKg;
        materialMix.push({
          materialType: matType as any,
          percentage,
          itemCount: count,
          weightKg,
        });
      }

      const totalWeightKg = Math.round(calculatedWeight * 1000) / 1000;

      const dailyActivity = windowDates.map((date) => {
        const act = activityMap.get(date) ?? { depositsCount: 0, pointsAwarded: 0 };
        return {
          date,
          depositsCount: act.depositsCount,
          pointsAwarded: act.pointsAwarded,
        };
      });

      // Sort Monday to Sunday
      dailyActivity.sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        const ia = isNaN(da.getTime()) ? 0 : (da.getDay() + 6) % 7;
        const ib = isNaN(db.getTime()) ? 0 : (db.getDay() + 6) % 7;
        return ia - ib;
      });

      const dashboardRecord = {
        registeredBins: allBins.length,
        activeAlerts,
        pendingReviews,
        verifiedDepositsToday,
        pointsIssuedToday,
        totalVerifiedDeposits,
        totalPointsIssued,
        totalWeightKg,
        lastCalculatedAt: new Date(nowMs).toISOString(),
        dailyActivity,
        materialMix,
        attentionBins,
      };

      // Materialize projection for faster subsequent reads
      try {
        await setDoc(doc(this.firestore, "adminDashboardViews", "summary"), dashboardRecord);
      } catch {
        // Non-blocking
      }

      const decoded = decodeAdminDashboardView(dashboardRecord);
      return adminDashboardViewToSummary(decoded);
    } catch {
      return null;
    }
  }

  private async enrichWithLiveFleetData(summary: DashboardSummary): Promise<void> {
    if (!this.firestore || typeof this.firestore.type !== "string") return;
    try {
      const binMap = new Map<string, Record<string, unknown>>();
      try {
        const binsSnap = await getDocs(collection(this.firestore, "bins"));
        for (const d of binsSnap.docs) {
          binMap.set(d.id, { id: d.id, ...d.data() });
        }
      } catch { }
      try {
        const viewsSnap = await getDocs(collection(this.firestore, "adminBinViews"));
        for (const d of viewsSnap.docs) {
          const existing = binMap.get(d.id) ?? { id: d.id };
          const merged = { ...existing, ...d.data() };
          const existingFill = Number(existing.fillPercent) > 0 ? Number(existing.fillPercent) : Number(existing.capacityPercent) > 0 ? Number(existing.capacityPercent) : 0;
          if (existingFill > 0 && (!d.data().fillPercent || Number(d.data().fillPercent) === 0)) {
            merged.fillPercent = existingFill;
          }
          binMap.set(d.id, merged);
        }
      } catch { }
      const allBins = Array.from(binMap.values());
      if (allBins.length === 0) return;

      const attentionBins: SmartBinRow[] = [];
      let alertCount = 0;

      for (const b of allBins) {
        const binId = String(b.binId ?? b.id);
        const rawFill = Number(b.fillPercent) > 0 ? Number(b.fillPercent) : Number(b.capacityPercent) > 0 ? Number(b.capacityPercent) : 0;
        const fill = Math.max(0, Math.min(100, Math.round(rawFill)));
        const isEnabled = b.enabled !== false;
        const isLogicalOnline = b.logicalOnline !== false && b.isOnline !== false;
        const isOnline = isEnabled && isLogicalOnline;
        const colState = (b.collectionState as "normal" | "warning" | "critical" | "collection_pending") ||
          (fill >= 85 ? "critical" : fill >= 75 ? "warning" : "normal");

        if (fill >= 85 || colState === "critical") {
          alertCount++;
        }

        const needsAttention = fill >= 75 || colState === "critical" || colState === "warning" || !isOnline;
        if (needsAttention) {
          const band = fill >= 85 ? "critical" : fill >= 75 ? "warning" : "normal";
          attentionBins.push({
            bin: {
              id: binId,
              locationName: String(b.locationName ?? "Unknown Location"),
              locationDetail: String(b.locationDetail ?? "Smart Recycling Chamber"),
              capacityPercent: fill,
              acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
              isOnline,
              lastUpdatedAt: typeof b.updatedAt === "string" ? b.updatedAt : new Date().toISOString(),
            },
            operations: {
              binId,
              collectionStatus:
                b.collectionStatus === "collected" || b.collectionState === "collected"
                  ? "collected"
                  : b.collectionStatus === "pending" || b.collectionStatus === "scheduled" || b.collectionState === "collection_pending"
                    ? "pending"
                    : "notScheduled",
            },
          });
        }
      }

      attentionBins.sort((a, b) => {
        // Priority 1: Critical (>= 85%) or collection pending
        const aCrit = a.bin.capacityPercent >= 85 || a.operations.collectionStatus === "pending";
        const bCrit = b.bin.capacityPercent >= 85 || b.operations.collectionStatus === "pending";
        if (aCrit !== bCrit) return aCrit ? -1 : 1;

        // Priority 2: Warning (>= 75%)
        const aWarn = a.bin.capacityPercent >= 75;
        const bWarn = b.bin.capacityPercent >= 75;
        if (aWarn !== bWarn) return aWarn ? -1 : 1;

        // Priority 3: Offline / disabled
        const aOffline = !a.bin.isOnline;
        const bOffline = !b.bin.isOnline;
        if (aOffline !== bOffline) return aOffline ? -1 : 1;

        // Then by fill percentage descending
        const fillDiff = b.bin.capacityPercent - a.bin.capacityPercent;
        if (fillDiff !== 0) return fillDiff;

        return a.bin.id.localeCompare(b.bin.id);
      });

      summary.attentionBins = attentionBins;
      summary.registeredBins = allBins.length;
      if (alertCount > 0) {
        summary.activeAlerts = Math.max(summary.activeAlerts, alertCount);
      }
    } catch {
      // Non-blocking
    }
  }

  async getSummary(): Promise<DashboardSummary> {
    try {
      const callable = httpsCallable<Record<string, unknown>, unknown>(
        this.functions,
        "getAdminDashboard"
      );
      const res = await callable({});
      const decoded = decodeAdminDashboardView(res.data);
      const summary = adminDashboardViewToSummary(decoded);
      await this.enrichWithLiveFleetData(summary);
      return summary;
    } catch {
      // 1. Direct dynamic computation from live collections first
      const computed = await this.computeSummaryFromFirestore();
      if (computed) {
        return computed;
      }

      // 2. Direct Firestore read on adminDashboardViews/summary
      try {
        if (this.firestore && typeof this.firestore.type === "string") {
          const snap = await getDoc(doc(this.firestore, "adminDashboardViews", "summary"));
          if (snap.exists()) {
            const decoded = decodeAdminDashboardView(snap.data());
            const summary = adminDashboardViewToSummary(decoded);
            await this.enrichWithLiveFleetData(summary);
            return summary;
          }
        }
      } catch {
        // Fall through
      }

      // 3. Fallback repository
      return await this.fallbackDashboardRepo.getSummary();
    }
  }

  watchSummary(): Observable<DashboardSummary> {
    return {
      subscribe: (observer: Observer<DashboardSummary>): Unsubscribe => {
        let isSubscribed = true;
        let isTabHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        let pendingRefresh = false;

        const load = () => {
          if (!isSubscribed) return;
          if (isTabHidden) {
            pendingRefresh = true;
            return;
          }

          pendingRefresh = false;
          this.getSummary()
            .then((summary) => {
              if (isSubscribed) observer.next(summary);
            })
            .catch((err) => {
              if (isSubscribed) {
                observer.error(this.commandClient.mapFirebaseError(err, "getAdminDashboard").failure);
              }
            });
        };

        // Initial fetch
        load();

        const unsubs: (() => void)[] = [];

        // Realtime invalidation listener on adminReadVersions/dashboard
        try {
          const versionDocRef = doc(this.firestore, "adminReadVersions/dashboard");
          unsubs.push(
            onSnapshot(
              versionDocRef,
              () => {
                if (isSubscribed) load();
              },
              () => {
                // Silently maintain current data on connection drops
              }
            )
          );
        } catch {
          // Non-blocking
        }

        // Realtime listener on adminDashboardViews/summary
        try {
          const summaryDocRef = doc(this.firestore, "adminDashboardViews/summary");
          unsubs.push(
            onSnapshot(
              summaryDocRef,
              () => {
                if (isSubscribed) load();
              },
              () => {
                // Silently maintain current data on connection drops
              }
            )
          );
        } catch {
          // Non-blocking
        }

        // Realtime listener on adminBinViews to reflect bin status/occupancy changes
        try {
          const binViewsCol = collection(this.firestore, "adminBinViews");
          unsubs.push(
            onSnapshot(
              binViewsCol,
              () => {
                if (isSubscribed) load();
              },
              () => {
                // Silently maintain current data
              }
            )
          );
        } catch {
          // Non-blocking
        }

        // Realtime listener on bins to reflect raw bin collection updates
        try {
          const binsCol = collection(this.firestore, "bins");
          unsubs.push(
            onSnapshot(
              binsCol,
              () => {
                if (isSubscribed) load();
              },
              () => {
                // Silently maintain current data
              }
            )
          );
        } catch {
          // Non-blocking
        }

        // Realtime listener on deposits to reflect verified transactions and points
        try {
          const depCol = collection(this.firestore, "deposits");
          unsubs.push(
            onSnapshot(
              depCol,
              () => {
                if (isSubscribed) load();
              },
              () => {
                // Silently maintain current data
              }
            )
          );
        } catch {
          // Non-blocking
        }

        // Realtime listener on capacityAlerts to reflect fleet alert state changes
        try {
          const alertsCol = collection(this.firestore, "capacityAlerts");
          unsubs.push(
            onSnapshot(
              alertsCol,
              () => {
                if (isSubscribed) load();
              },
              () => {
                // Silently maintain current data
              }
            )
          );
        } catch {
          // Non-blocking
        }

        // Visibility handling: pause while hidden, revalidate on foreground
        const handleVisibilityChange = () => {
          if (typeof document === "undefined") return;
          isTabHidden = document.visibilityState === "hidden";
          if (!isTabHidden && pendingRefresh) {
            load();
          }
        };

        if (typeof document !== "undefined") {
          document.addEventListener("visibilitychange", handleVisibilityChange);
        }

        return () => {
          isSubscribed = false;
          unsubs.forEach((u) => u());
          if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
          }
        };
      },
    };
  }
}
