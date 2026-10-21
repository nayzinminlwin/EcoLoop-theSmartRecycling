// =============================================================================
// admin_dashboard_store.ts — Transactional store for Admin Dashboard Projections
// Phase AB-09 — Analytics aggregation, 7-day activity window, and cross-client convergence
// =============================================================================

import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import {
  getMalaysiaDate,
  getSevenDayMalaysiaWindow,
  calculateMaterialMix,
  classifyAttentionBins,
  mapClassToMaterialType,
  type CanonicalMaterialType,
  type AttentionBinCandidate,
} from "../../domain/admin_dashboard.js";
import type { FirestoreAdminReadVersionsStore } from "./admin_read_versions_store.js";

export interface AdminDailyActivityRecord {
  readonly date: string;
  readonly depositsCount: number;
  readonly pointsAwarded: number;
}

export interface AdminMaterialMixRecord {
  readonly materialType: CanonicalMaterialType;
  readonly percentage: number;
  readonly itemCount: number;
  readonly weightKg?: number;
}

export interface AdminAttentionBinRecord {
  readonly binId: string;
  readonly locationName: string;
  readonly fillPercent: number;
  readonly collectionState: "normal" | "warning" | "critical" | "collection_pending";
}

export interface AdminDashboardViewRecord {
  readonly registeredBins: number;
  readonly activeAlerts: number;
  readonly pendingReviews: number;
  readonly verifiedDepositsToday: number;
  readonly pointsIssuedToday: number;
  readonly totalVerifiedDeposits: number;
  readonly totalPointsIssued: number;
  readonly totalWeightKg: number;
  readonly lastCalculatedAt: string;
  readonly dailyActivity: AdminDailyActivityRecord[];
  readonly materialMix: AdminMaterialMixRecord[];
  readonly attentionBins: AdminAttentionBinRecord[];
}

export class FirestoreAdminDashboardStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly readVersionsStore: FirestoreAdminReadVersionsStore
  ) {}

  /**
   * Retrieves the dashboard projection summary.
   * If missing or computed on a previous calendar day (Malaysia rollover), rebuilds it.
   */
  async getDashboard(nowMs: number = Date.now()): Promise<AdminDashboardViewRecord> {
    const summaryRef = this.firestore.doc("adminDashboardViews/summary");
    const snap = await summaryRef.get();

    if (snap.exists) {
      const data = snap.data() as AdminDashboardViewRecord;
      const lastCalcDate = data.lastCalculatedAt ? getMalaysiaDate(data.lastCalculatedAt) : null;
      const todayDate = getMalaysiaDate(nowMs);

      // If already computed today, return cached projection
      if (lastCalcDate === todayDate) {
        return data;
      }
    }

    // Otherwise, rebuild the projection dynamically
    return await this.rebuildDashboard(undefined, nowMs);
  }

  /**
   * Rebuilds the dashboard projection from canonical collections.
   */
  async rebuildDashboard(
    actorUid?: string,
    nowMs: number = Date.now()
  ): Promise<AdminDashboardViewRecord> {
    const todayMalaysia = getMalaysiaDate(nowMs);
    const windowDates = getSevenDayMalaysiaWindow(nowMs);

    // 1. Registered Bins & Candidates for Attention Bins
    const binsSnap = await this.firestore.collection("bins").get();
    let registeredBins = 0;
    const attentionCandidates: AttentionBinCandidate[] = [];

    // Also fetch collection states if stored in binCollectionState
    const colStatesSnap = await this.firestore.collection("binCollectionState").get();
    const collectionStatesMap = new Map<string, "normal" | "warning" | "critical" | "collection_pending">();
    colStatesSnap.forEach((doc) => {
      const data = doc.data();
      if (data.collectionState) {
        collectionStatesMap.set(doc.id, data.collectionState);
      }
    });

    // 2. Capacity Alerts
    const alertsSnap = await this.firestore.collection("capacityAlerts").get();
    let activeAlerts = 0;
    const binsWithActiveAlert = new Set<string>();

    alertsSnap.forEach((doc) => {
      const a = doc.data();
      const state = String(a.state ?? "active");
      if (state !== "resolved" && state !== "closed") {
        activeAlerts++;
        if (a.binId) binsWithActiveAlert.add(String(a.binId));
      }
    });

    binsSnap.forEach((doc) => {
      const b = doc.data();
      if (b.deleted === true) return;
      registeredBins++;

      const binId = String(b.id ?? doc.id);
      const capacitySpc = Number(b.capacitySpc ?? 1000);
      const occupiedSpc = Number(b.occupiedSpc ?? 0);
      const fillPercent = capacitySpc > 0 ? Math.min(100, Math.max(0, Math.round((occupiedSpc / capacitySpc) * 100))) : 0;
      const collectionState = collectionStatesMap.get(binId) ??
        (b.collectionState as "normal" | "warning" | "critical" | "collection_pending") ??
        (fillPercent >= 85 ? "critical" : fillPercent >= 75 ? "warning" : "normal");

      attentionCandidates.push({
        binId,
        locationName: String(b.locationName ?? "Unknown Location"),
        fillPercent,
        collectionState,
        enabled: b.enabled !== false,
        logicalOnline: b.logicalOnline !== false,
        hasActiveAlert: binsWithActiveAlert.has(binId),
      });
    });

    const attentionBins = classifyAttentionBins(attentionCandidates, 80, 10).map((c) => ({
      binId: c.binId,
      locationName: c.locationName,
      fillPercent: c.fillPercent,
      collectionState: c.collectionState,
    }));

    // 3. Review Tickets
    const ticketsSnap = await this.firestore.collection("reviewTickets").get();
    let pendingReviews = 0;
    ticketsSnap.forEach((doc) => {
      const t = doc.data();
      const state = String(t.state ?? "");
      if (state === "open" || state === "awaitingReview" || state === "awaiting_review") {
        pendingReviews++;
      }
    });

    // 4. Batches & Material Lines
    const batchesSnap = await this.firestore.collection("batches").get();
    let totalVerifiedDeposits = 0;
    let verifiedDepositsToday = 0;
    let totalPointsIssued = 0;
    let pointsIssuedToday = 0;

    const activityMap = new Map<string, { depositsCount: number; pointsAwarded: number }>();
    for (const d of windowDates) {
      activityMap.set(d, { depositsCount: 0, pointsAwarded: 0 });
    }

    const materialCounts: Record<CanonicalMaterialType, number> = {
      plastic: 0,
      aluminium: 0,
      paper: 0,
      glass: 0,
      unknown: 0,
    };

    batchesSnap.forEach((doc) => {
      const batch = doc.data();
      const status = String(batch.status ?? "");
      // Verified or settled batches are considered finalized deposits
      if (status !== "verified" && status !== "settled") return;

      const points = Number(batch.pointsAwarded ?? 0);
      const occurredAt = String(batch.occurredAt ?? batch.settledAt ?? batch.createdAt ?? new Date(nowMs).toISOString());
      const batchDate = getMalaysiaDate(occurredAt);

      totalVerifiedDeposits++;
      totalPointsIssued += points;

      if (batchDate === todayMalaysia) {
        verifiedDepositsToday++;
        pointsIssuedToday += points;
      }

      const dayActivity = activityMap.get(batchDate);
      if (dayActivity) {
        dayActivity.depositsCount++;
        dayActivity.pointsAwarded += points;
      }

      // Material Lines analysis
      if (Array.isArray(batch.lines)) {
        for (const line of batch.lines) {
          if (line.eligible !== false) {
            const rawClass = String(line.class ?? "");
            // Cardboard is excluded from verified impact
            if (rawClass.includes("cardboard")) continue;

            const matType = mapClassToMaterialType(rawClass);
            const count = Number(line.count ?? 1);
            materialCounts[matType] = (materialCounts[matType] ?? 0) + count;
          }
        }
      } else if (batch.materialType) {
        // Fallback for simple legacy batches
        const matType = mapClassToMaterialType(String(batch.materialType));
        const count = Number(batch.itemCount ?? 1);
        materialCounts[matType] = (materialCounts[matType] ?? 0) + count;
      }
    });

    const materialMixCalc = calculateMaterialMix(materialCounts);

    const dailyActivity: AdminDailyActivityRecord[] = windowDates.map((date) => {
      const act = activityMap.get(date) ?? { depositsCount: 0, pointsAwarded: 0 };
      return {
        date,
        depositsCount: act.depositsCount,
        pointsAwarded: act.pointsAwarded,
      };
    });

    const dashboardRecord: AdminDashboardViewRecord = {
      registeredBins,
      activeAlerts,
      pendingReviews,
      verifiedDepositsToday,
      pointsIssuedToday,
      totalVerifiedDeposits,
      totalPointsIssued,
      totalWeightKg: materialMixCalc.totalWeightKg,
      lastCalculatedAt: new Date(nowMs).toISOString(),
      dailyActivity,
      materialMix: materialMixCalc.items.map((m) => ({
        materialType: m.materialType,
        percentage: m.percentage,
        itemCount: m.itemCount,
        weightKg: m.weightKg,
      })),
      attentionBins,
    };

    // Save materialized projection
    await this.firestore.doc("adminDashboardViews/summary").set(dashboardRecord);

    // Bump read versions cache
    await this.readVersionsStore.bumpVersion("dashboard", actorUid ?? "system");

    // Audit log if manual actor rebuild
    if (actorUid) {
      const auditRef = this.firestore.collection("adminAuditEvents").doc();
      await auditRef.set({
        eventId: auditRef.id,
        timestamp: Timestamp.now(),
        actorUid,
        action: "rebuild_dashboard",
        entityType: "dashboard",
        entityId: "summary",
        details: {
          registeredBins,
          activeAlerts,
          totalVerifiedDeposits,
          totalPointsIssued,
        },
      });
    }

    return dashboardRecord;
  }
}
