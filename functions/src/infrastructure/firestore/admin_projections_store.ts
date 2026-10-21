// =============================================================================
// admin_projections_store.ts — Materialized projection builder and writer
// Phase AB-03 — Materialized view models for smart bins and reward catalog
// =============================================================================

import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Instant } from "../../domain/types.js";
import { tryTimestampToInstant } from "./codecs.js";
import { generatePrefixTokens } from "../../domain/admin_search.js";

export type CollectionState = "normal" | "warning" | "critical" | "collection_pending";

export interface AdminBinViewRecord {
  readonly binId: string;
  readonly locationName: string;
  readonly locationDetail: string;
  readonly capacitySpc: number;
  readonly occupiedSpc: number;
  readonly fillPercent: number;
  readonly cycleId: string;
  readonly enabled: boolean;
  readonly logicalOnline: boolean;
  readonly version: number;
  readonly sharedPolicyVersion: string;
  readonly collectionState: CollectionState;
  readonly lastCollectionTime: Instant | null;
  readonly updatedAt: Instant;
  readonly searchTokens?: string[];
}

export interface AdminRewardViewRecord {
  readonly rewardId: string;
  readonly title: string;
  readonly description: string;
  readonly merchantName: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly tag: string | null;
  readonly imageUrl: string | null;
  readonly pointsCost: number;
  readonly expiresAt: Instant;
  readonly isActive: boolean;
  readonly maxRedemptionsPerResident: number;
  readonly artKey: "art0" | "art1" | "art2" | "art3";
  readonly sortOrder: number;
  readonly isDemo: boolean;
  readonly terms: string | null;
  readonly version: number;
  readonly updatedAt: Instant;
  readonly searchTokens?: string[];
}

export interface AdminRewardCategoryViewRecord {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly description: string | null;
  readonly sortOrder: number;
}

export type AlertLifecycleStateRecord = "pending" | "scheduled" | "collected" | "resolved";

export interface AdminAlertViewRecord {
  readonly alertId: string;
  readonly binId: string;
  readonly locationName: string;
  readonly cycleId: string;
  readonly triggeringFillPercent: number;
  readonly currentFillPercent: number;
  readonly threshold: 75 | 80 | 85;
  readonly operationalSettingsVersion: number;
  readonly state: AlertLifecycleStateRecord;
  readonly version: number;
  readonly triggeredAt: Instant;
  readonly scheduledAt: Instant | null;
  readonly scheduledBy: string | null;
  readonly collectedAt?: Instant | null;
  readonly collectedBy?: string | null;
  readonly resolvedAt: Instant | null;
  readonly resolvedBy: string | null;
  readonly collectionEventId: string | null;
  readonly searchTokens?: string[];
}

export class FirestoreAdminProjectionsStore {
  private readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  projectBin(
    binDoc: Record<string, unknown>,
    opsDoc?: Record<string, unknown> | null
  ): AdminBinViewRecord {
    const binId = String(binDoc.id ?? binDoc.binId ?? "");
    const locationName = String(binDoc.locationName ?? "Unknown Location");
    const locationDetail = String(
      binDoc.locationDetail ?? binDoc.locationAddress ?? "Standard Facility"
    );

    const capacitySpc = Math.max(
      50,
      Math.min(5000, Number(binDoc.capacitySpc ?? 1000))
    );
    const occupiedSpc = Math.max(0, Number(binDoc.occupiedSpc ?? 0));
    const fillPercent = Math.min(
      100,
      Math.max(
        0,
        Math.round((occupiedSpc / capacitySpc) * 100)
      )
    );

    const rawOpsStatus = String(opsDoc?.collectionStatus ?? "");
    let collectionState: CollectionState = "normal";
    if (rawOpsStatus === "pending" || rawOpsStatus === "scheduled") {
      collectionState = "collection_pending";
    } else if (fillPercent >= 85) {
      collectionState = "critical";
    } else if (fillPercent >= 75) {
      collectionState = "warning";
    }

    const searchTokens = generatePrefixTokens([
      binId,
      locationName,
      locationDetail,
    ]);

    const updatedAt =
      tryTimestampToInstant(binDoc.updatedAt) ??
      new Date().toISOString();

    const lastCollectionTime =
      tryTimestampToInstant(opsDoc?.lastCollectionTime) ??
      null;

    return {
      binId,
      locationName,
      locationDetail,
      capacitySpc,
      occupiedSpc,
      fillPercent,
      cycleId: String(binDoc.cycleId ?? `cycle-${binId}-001`),
      enabled: binDoc.enabled !== false,
      logicalOnline: binDoc.logicalOnline !== false,
      version: Number(binDoc.version ?? 1),
      sharedPolicyVersion: String(binDoc.sharedPolicyVersion ?? "v1.0.0"),
      collectionState,
      lastCollectionTime,
      updatedAt,
      searchTokens,
    };
  }

  async writeBinView(view: AdminBinViewRecord): Promise<void> {
    const docRef = this.firestore.doc(`adminBinViews/${view.binId}`);
    await docRef.set({
      ...view,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  projectReward(
    rewardDoc: Record<string, unknown>,
    categoryName = "General"
  ): AdminRewardViewRecord {
    const rewardId = String(rewardDoc.id ?? rewardDoc.rewardId ?? "");
    const title = String(rewardDoc.title ?? rewardDoc.name ?? "Reward Offer");
    const description = String(rewardDoc.description ?? "EcoLoop reward redemption voucher");
    const merchantName = String(rewardDoc.merchantName ?? rewardDoc.merchant ?? "EcoLoop Partner");
    const categoryId = String(rewardDoc.categoryId ?? "cat-general");

    const validArtKeys = ["art0", "art1", "art2", "art3"] as const;
    const rawArt = String(rewardDoc.artKey ?? "art0");
    const artKey = validArtKeys.includes(rawArt as (typeof validArtKeys)[number])
      ? (rawArt as (typeof validArtKeys)[number])
      : "art0";

    const searchTokens = generatePrefixTokens([
      rewardId,
      title,
      merchantName,
      description,
    ]);

    return {
      rewardId,
      title,
      description,
      merchantName,
      categoryId,
      categoryName,
      tag: rewardDoc.tag ? String(rewardDoc.tag) : null,
      imageUrl: rewardDoc.imageUrl ? String(rewardDoc.imageUrl) : null,
      pointsCost: Math.max(1, Number(rewardDoc.pointsCost ?? rewardDoc.cost ?? 100)),
      expiresAt:
        tryTimestampToInstant(rewardDoc.expiresAt) ??
        new Date(Date.now() + 90 * 86400000).toISOString(),
      isActive: rewardDoc.isActive !== false,
      maxRedemptionsPerResident: Math.max(
        1,
        Number(rewardDoc.maxRedemptionsPerResident ?? 5)
      ),
      artKey,
      sortOrder: Math.max(0, Number(rewardDoc.sortOrder ?? 0)),
      isDemo: Boolean(rewardDoc.isDemo),
      terms: rewardDoc.terms ? String(rewardDoc.terms) : null,
      version: Number(rewardDoc.version ?? 1),
      updatedAt:
        tryTimestampToInstant(rewardDoc.updatedAt) ??
        new Date().toISOString(),
      searchTokens,
    };
  }

  async writeRewardView(view: AdminRewardViewRecord): Promise<void> {
    const docRef = this.firestore.doc(`adminRewardViews/${view.rewardId}`);
    await docRef.set({
      ...view,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async writeRewardCategoryView(view: AdminRewardCategoryViewRecord): Promise<void> {
    const docRef = this.firestore.doc(`adminRewardCategoryViews/${view.categoryId}`);
    await docRef.set(view);
  }

  projectAlert(
    alertDoc: Record<string, unknown>,
    currentBinOccupancy?: { occupiedSpc: number; capacitySpc: number }
  ): AdminAlertViewRecord {
    const alertId = String(alertDoc.id ?? alertDoc.alertId ?? "");
    const binId = String(alertDoc.binId ?? "");
    const locationName = String(alertDoc.locationName ?? "Unknown Location");
    const cycleId = String(alertDoc.cycleId ?? "");
    const threshold = Number(alertDoc.thresholdSnapshot ?? alertDoc.threshold ?? 85) as 75 | 80 | 85;
    const operationalSettingsVersion = Number(alertDoc.operationalSettingsVersion ?? 1);
    const triggeringFillPercent = Number(alertDoc.triggeringFillPercent ?? threshold);

    let currentFillPercent = Number(alertDoc.currentFillPercent ?? triggeringFillPercent);
    if (currentBinOccupancy && currentBinOccupancy.capacitySpc > 0) {
      currentFillPercent = Math.min(
        100,
        Math.max(
          0,
          Math.round((currentBinOccupancy.occupiedSpc / currentBinOccupancy.capacitySpc) * 100)
        )
      );
    }

    const state = (alertDoc.state ?? "pending") as AlertLifecycleStateRecord;
    const version = Number(alertDoc.version ?? 1);
    const triggeredAt =
      tryTimestampToInstant(alertDoc.triggeredAt) ?? new Date().toISOString();
    const scheduledAt = tryTimestampToInstant(alertDoc.scheduledAt) ?? null;
    const scheduledBy = alertDoc.scheduledBy ? String(alertDoc.scheduledBy) : null;
    const collectedAt = tryTimestampToInstant(alertDoc.collectedAt) ?? null;
    const collectedBy = alertDoc.collectedBy ? String(alertDoc.collectedBy) : null;
    const resolvedAt = tryTimestampToInstant(alertDoc.resolvedAt) ?? null;
    const resolvedBy = alertDoc.resolvedBy ? String(alertDoc.resolvedBy) : null;
    const collectionEventId = alertDoc.collectionEventId
      ? String(alertDoc.collectionEventId)
      : null;

    const searchTokens = generatePrefixTokens([alertId, binId, locationName]);

    return {
      alertId,
      binId,
      locationName,
      cycleId,
      triggeringFillPercent,
      currentFillPercent,
      threshold,
      operationalSettingsVersion,
      state,
      version,
      triggeredAt,
      scheduledAt,
      scheduledBy,
      collectedAt,
      collectedBy,
      resolvedAt,
      resolvedBy,
      collectionEventId,
      searchTokens,
    };
  }

  async writeAlertView(view: AdminAlertViewRecord): Promise<void> {
    const docRef = this.firestore.doc(`adminAlertViews/${view.alertId}`);
    await docRef.set({
      ...view,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

