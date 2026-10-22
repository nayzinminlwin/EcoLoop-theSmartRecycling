// =============================================================================
// admin_queries_store.ts — Bounded queries, cursor pagination, and count aggregation
// Phase AB-03 — Query execution over admin materialized projections
// =============================================================================

import { createHash } from "node:crypto";
import type { Firestore, Query, DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type {
  AdminBinViewRecord,
  AdminRewardViewRecord,
  AdminRewardCategoryViewRecord,
  AdminAlertViewRecord,
  AdminReviewViewRecord,
  AdminReviewDetailViewRecord,
} from "./admin_projections_store.js";
import { normalizeSearchString } from "../../domain/admin_search.js";

export interface QueryPaginationInput {
  readonly search?: string;
  readonly filters?: Record<string, unknown>;
  readonly sortKey?: string;
  readonly sortDirection?: "asc" | "desc";
  readonly pageSize?: number;
  readonly cursor?: string | null;
}

export interface AdminPaginatedResponse<T> {
  readonly schemaVersion: "admin.v1";
  readonly items: T[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
  readonly readVersion: string;
  readonly freshness: string;
}

export interface AdminBinDetailViewRecord {
  readonly bin: AdminBinViewRecord;
  readonly qrPayload: string;
  readonly totalCollections: number;
  readonly totalAcceptedItems: number;
  readonly activeAlertId: string | null;
}

const SUPPORTED_BIN_SORTS = new Set(["locationName", "fillPercent", "capacitySpc", "updatedAt", "binId", "collectionState"]);
const SUPPORTED_BIN_FILTERS = new Set(["collectionState", "enabled", "logicalOnline"]);

const SUPPORTED_REWARD_SORTS = new Set(["sortOrder", "pointsCost", "title", "updatedAt", "rewardId", "expiresAt"]);
const SUPPORTED_REWARD_FILTERS = new Set(["categoryId", "isActive"]);

const SUPPORTED_ALERT_SORTS = new Set(["triggeredAt", "currentFillPercent", "triggeringFillPercent", "alertId", "version"]);
const SUPPORTED_ALERT_FILTERS = new Set(["state", "status", "binId", "threshold"]);

const SUPPORTED_REVIEW_SORTS = new Set(["occurredAt", "batchId", "ticketId", "decisionVersion", "state", "outcome"]);
const SUPPORTED_REVIEW_FILTERS = new Set(["state", "outcome", "binId"]);

export function encodeCursor(values: unknown[]): string {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

export function decodeCursor(cursorStr: string): unknown[] {
  try {
    const json = Buffer.from(cursorStr, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new HttpsError("invalid-argument", `Malformed pagination cursor: ${cursorStr}`);
  }
}

export class FirestoreAdminQueriesStore {
  private readonly firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
  }

  async listBins(input: QueryPaginationInput, readVersion = "1"): Promise<AdminPaginatedResponse<AdminBinViewRecord>> {
    const sortField = input.sortKey ?? "locationName";
    if (!SUPPORTED_BIN_SORTS.has(sortField)) {
      throw new HttpsError("invalid-argument", `Unsupported bin sort key: ${sortField}`);
    }

    if (input.filters) {
      for (const key of Object.keys(input.filters)) {
        if (!SUPPORTED_BIN_FILTERS.has(key)) {
          throw new HttpsError("invalid-argument", `Unsupported bin filter: ${key}`);
        }
      }
    }

    const direction = input.sortDirection === "desc" ? "desc" : "asc";
    const pageSize = Math.max(1, Math.min(100, Number(input.pageSize ?? 10)));

    let query: Query<DocumentData> = this.firestore.collection("adminBinViews");

    // Apply filters
    if (input.filters) {
      for (const [key, val] of Object.entries(input.filters)) {
        if (val !== undefined && val !== null && val !== "") {
          query = query.where(key, "==", val);
        }
      }
    }

    // Apply token prefix search
    if (input.search) {
      const searchPrefix = normalizeSearchString(input.search);
      if (searchPrefix.length >= 2) {
        query = query.where("searchTokens", "array-contains", searchPrefix);
      }
    }

    // Get total count matching current filters
    const countSnap = await query.count().get();
    const total = countSnap.data().count;

    // Apply order and tiebreaker
    query = query.orderBy(sortField, direction).orderBy("__name__", direction);

    // Apply cursor
    if (input.cursor) {
      const cursorValues = decodeCursor(input.cursor);
      query = query.startAfter(...cursorValues);
    }

    // Query pageSize + 1 to detect hasMore
    query = query.limit(pageSize + 1);
    const snap = await query.get();

    const hasMore = snap.docs.length > pageSize;
    const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const items: AdminBinViewRecord[] = pageDocs.map((doc) => {
      const data = doc.data();
      const { searchTokens: _, ...clean } = data;
      return clean as AdminBinViewRecord;
    });

    let nextCursor: string | null = null;
    const lastDoc = pageDocs[pageDocs.length - 1];
    if (hasMore && lastDoc) {
      const lastVal = lastDoc.get(sortField);
      nextCursor = encodeCursor([lastVal, lastDoc.id]);
    }

    return {
      schemaVersion: "admin.v1",
      items,
      total,
      hasMore,
      nextCursor,
      readVersion,
      freshness: new Date().toISOString(),
    };
  }

  async getBin(binId: string): Promise<AdminBinDetailViewRecord | null> {
    const docRef = this.firestore.doc(`adminBinViews/${binId}`);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const binData = snap.data()!;
    const { searchTokens: _, ...cleanBin } = binData;

    // Join with qrMappings and alert if available
    const qrSnap = await this.firestore.doc(`binQrMappings/qr-${binId}`).get();
    const qrPayload = qrSnap.exists
      ? String(qrSnap.data()?.qrPayload ?? `ecoloop://bin/qr-${binId}`)
      : `ecoloop://bin/qr-${binId}`;

    return {
      bin: cleanBin as AdminBinViewRecord,
      qrPayload,
      totalCollections: Number(binData.totalCollections ?? 0),
      totalAcceptedItems: Number(binData.totalAcceptedItems ?? 0),
      activeAlertId: binData.activeAlertId ? String(binData.activeAlertId) : null,
    };
  }

  async listRewards(input: QueryPaginationInput, readVersion = "1"): Promise<AdminPaginatedResponse<AdminRewardViewRecord>> {
    const sortField = input.sortKey ?? "sortOrder";
    if (!SUPPORTED_REWARD_SORTS.has(sortField)) {
      throw new HttpsError("invalid-argument", `Unsupported reward sort key: ${sortField}`);
    }

    if (input.filters) {
      for (const key of Object.keys(input.filters)) {
        if (!SUPPORTED_REWARD_FILTERS.has(key)) {
          throw new HttpsError("invalid-argument", `Unsupported reward filter: ${key}`);
        }
      }
    }

    const direction = input.sortDirection === "desc" ? "desc" : "asc";
    const pageSize = Math.max(1, Math.min(100, Number(input.pageSize ?? 10)));

    let query: Query<DocumentData> = this.firestore.collection("adminRewardViews");

    // Apply filters
    if (input.filters) {
      for (const [key, val] of Object.entries(input.filters)) {
        if (val !== undefined && val !== null && val !== "") {
          query = query.where(key, "==", val);
        }
      }
    }

    // Apply token prefix search
    if (input.search) {
      const searchPrefix = normalizeSearchString(input.search);
      if (searchPrefix.length >= 2) {
        query = query.where("searchTokens", "array-contains", searchPrefix);
      }
    }

    // Count
    const countSnap = await query.count().get();
    const total = countSnap.data().count;

    // Order
    query = query.orderBy(sortField, direction).orderBy("__name__", direction);

    // Cursor
    if (input.cursor) {
      const cursorValues = decodeCursor(input.cursor);
      query = query.startAfter(...cursorValues);
    }

    query = query.limit(pageSize + 1);
    const snap = await query.get();

    const hasMore = snap.docs.length > pageSize;
    const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const items: AdminRewardViewRecord[] = pageDocs.map((doc) => {
      const data = doc.data();
      const { searchTokens: _, ...clean } = data;
      return clean as AdminRewardViewRecord;
    });

    let nextCursor: string | null = null;
    const lastDoc = pageDocs[pageDocs.length - 1];
    if (hasMore && lastDoc) {
      const lastVal = lastDoc.get(sortField);
      nextCursor = encodeCursor([lastVal, lastDoc.id]);
    }

    return {
      schemaVersion: "admin.v1",
      items,
      total,
      hasMore,
      nextCursor,
      readVersion,
      freshness: new Date().toISOString(),
    };
  }

  async getReward(rewardId: string): Promise<AdminRewardViewRecord | null> {
    const docRef = this.firestore.doc(`adminRewardViews/${rewardId}`);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const data = snap.data()!;
    const { searchTokens: _, ...clean } = data;
    return clean as AdminRewardViewRecord;
  }

  async getRewardCategories(): Promise<AdminRewardCategoryViewRecord[]> {
    const snap = await this.firestore
      .collection("adminRewardCategoryViews")
      .orderBy("sortOrder", "asc")
      .get();

    return snap.docs.map((doc) => doc.data() as AdminRewardCategoryViewRecord);
  }

  async listAlerts(
    input: QueryPaginationInput,
    readVersion = "1"
  ): Promise<AdminPaginatedResponse<AdminAlertViewRecord>> {
    const sortField = input.sortKey ?? "triggeredAt";
    if (!SUPPORTED_ALERT_SORTS.has(sortField)) {
      throw new HttpsError("invalid-argument", `Unsupported alert sort key: ${sortField}`);
    }

    if (input.filters) {
      for (const key of Object.keys(input.filters)) {
        if (!SUPPORTED_ALERT_FILTERS.has(key)) {
          throw new HttpsError("invalid-argument", `Unsupported alert filter: ${key}`);
        }
      }
    }

    const direction = input.sortDirection === "asc" ? "asc" : "desc";
    const pageSize = Math.max(1, Math.min(100, Number(input.pageSize ?? 10)));

    let query: Query<DocumentData> = this.firestore.collection("adminAlertViews");

    // Apply filters
    if (input.filters) {
      for (const [key, val] of Object.entries(input.filters)) {
        if (val !== undefined && val !== null && val !== "") {
          if (key === "status") {
            if (val === "active") {
              query = query.where("state", "in", ["pending", "scheduled", "collected"]);
            } else if (val === "resolved") {
              query = query.where("state", "==", "resolved");
            }
          } else {
            query = query.where(key, "==", val);
          }
        }
      }
    }

    // Apply token prefix search
    if (input.search) {
      const searchPrefix = normalizeSearchString(input.search);
      if (searchPrefix.length >= 2) {
        query = query.where("searchTokens", "array-contains", searchPrefix);
      }
    }

    // Total count matching filters
    const countSnap = await query.count().get();
    const total = countSnap.data().count;

    // Apply order and tiebreaker
    query = query.orderBy(sortField, direction).orderBy("__name__", direction);

    // Apply cursor
    if (input.cursor) {
      const cursorValues = decodeCursor(input.cursor);
      query = query.startAfter(...cursorValues);
    }

    // Query pageSize + 1
    query = query.limit(pageSize + 1);
    const snap = await query.get();

    const hasMore = snap.docs.length > pageSize;
    const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const items: AdminAlertViewRecord[] = pageDocs.map((doc) => {
      const data = doc.data();
      const { searchTokens: _, ...clean } = data;
      return clean as AdminAlertViewRecord;
    });

    let nextCursor: string | null = null;
    const lastDoc = pageDocs[pageDocs.length - 1];
    if (hasMore && lastDoc) {
      const lastVal = lastDoc.get(sortField);
      nextCursor = encodeCursor([lastVal, lastDoc.id]);
    }

    return {
      schemaVersion: "admin.v1",
      items,
      total,
      hasMore,
      nextCursor,
      readVersion,
      freshness: new Date().toISOString(),
    };
  }

  async getAlert(alertId: string): Promise<AdminAlertViewRecord | null> {
    const docRef = this.firestore.doc(`adminAlertViews/${alertId}`);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const data = snap.data()!;
    const { searchTokens: _, ...clean } = data;
    return clean as AdminAlertViewRecord;
  }

  async listReviews(input: QueryPaginationInput): Promise<AdminPaginatedResponse<AdminReviewViewRecord>> {
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 10));
    const sortField = input.sortKey && SUPPORTED_REVIEW_SORTS.has(input.sortKey) ? input.sortKey : "occurredAt";
    const direction = input.sortDirection === "asc" ? "asc" : "desc";

    let query: Query<DocumentData> = this.firestore.collection("adminReviewViews");

    const readVersionDoc = await this.firestore.doc("adminReadVersions/reviews").get();
    const readVersion = readVersionDoc.exists ? String(readVersionDoc.data()?.version ?? "1") : "1";

    if (input.filters) {
      for (const [key, val] of Object.entries(input.filters)) {
        if (SUPPORTED_REVIEW_FILTERS.has(key) && val !== undefined && val !== null && val !== "") {
          query = query.where(key, "==", val);
        }
      }
    }

    if (input.search && input.search.trim().length > 0) {
      const normalized = normalizeSearchString(input.search);
      if (normalized.length > 0) {
        query = query.where("searchTokens", "array-contains", normalized);
      }
    }

    const countSnap = await query.count().get();
    const total = countSnap.data().count;

    query = query.orderBy(sortField, direction).orderBy("__name__", direction);

    if (input.cursor) {
      const cursorValues = decodeCursor(input.cursor);
      query = query.startAfter(...cursorValues);
    }

    query = query.limit(pageSize + 1);
    const snap = await query.get();

    const hasMore = snap.docs.length > pageSize;
    const pageDocs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;

    const items: AdminReviewViewRecord[] = pageDocs.map((doc) => {
      const data = doc.data();
      const { searchTokens: _, ...clean } = data;
      return clean as AdminReviewViewRecord;
    });

    let nextCursor: string | null = null;
    const lastDoc = pageDocs[pageDocs.length - 1];
    if (hasMore && lastDoc) {
      const lastVal = lastDoc.get(sortField);
      nextCursor = encodeCursor([lastVal, lastDoc.id]);
    }

    return {
      schemaVersion: "admin.v1",
      items,
      total,
      hasMore,
      nextCursor,
      readVersion,
      freshness: new Date().toISOString(),
    };
  }

  async getReview(ticketId: string): Promise<AdminReviewDetailViewRecord | null> {
    const ticketDoc = await this.firestore.doc(`reviewTickets/${ticketId}`).get();
    if (!ticketDoc.exists) {
      const viewSnap = await this.firestore.doc(`adminReviewViews/${ticketId}`).get();
      if (!viewSnap.exists) return null;
    }

    const ticketData = ticketDoc.data() ?? {};
    const batchId = String(ticketData.batchId ?? ticketId);
    const batchHash = createHash("sha256").update(batchId).digest("hex");

    const [batchSnap, resultSnap] = await Promise.all([
      this.firestore.doc(`deposits/${batchId}`).get(),
      this.firestore.doc(`depositResults/result-${batchHash}`).get(),
    ]);

    const batchData = batchSnap.exists ? batchSnap.data()! : {};
    const resultData = resultSnap?.exists ? resultSnap.data()! : {};

    const binId = String(ticketData.binId ?? batchData.binId ?? "");
    let locationName = "Smart Bin " + binId;
    if (binId) {
      const binSnap = await this.firestore.doc(`bins/${binId}`).get();
      if (binSnap.exists) {
        locationName = String(binSnap.data()?.locationName ?? locationName);
      }
    }

    const rawState = String(ticketData.state ?? "open");
    const state: "awaiting_review" | "resolved" = rawState === "resolved" ? "resolved" : "awaiting_review";
    const outcome = String(ticketData.finalOutcome ?? batchData.status ?? "review") as "processing" | "review" | "verified" | "rejected" | "empty";
    const decisionVersion = Number(ticketData.decisionVersion ?? batchData.decisionVersion ?? 0);
    const ownerId = String(ticketData.ownerId ?? batchData.ownerId ?? "");
    const residentAlias = ownerId ? `Resident •••${ownerId.slice(-4)}` : "Resident Unknown";
    const reviewerUid = ticketData.resolvedBy ? String(ticketData.resolvedBy) : null;
    const reviewerAlias = reviewerUid ? `Admin •••${reviewerUid.slice(-4)}` : null;

    let materialSummary: string | null = null;
    if (Array.isArray(batchData.lines)) {
      materialSummary = batchData.lines
        .map((l: { class?: string; count?: number }) => `${l.count ?? 1}x ${l.class ?? "item"}`)
        .join(", ");
    }

    const occurredAt = ticketData.createdAt?.toDate ? ticketData.createdAt.toDate().toISOString() : String(ticketData.createdAt ?? new Date().toISOString());
    const resolvedAt = ticketData.resolvedAt?.toDate ? ticketData.resolvedAt.toDate().toISOString() : (ticketData.resolvedAt ? String(ticketData.resolvedAt) : null);

    const reviewView: AdminReviewViewRecord = {
      ticketId,
      batchId,
      binId,
      locationName,
      occurredAt,
      state,
      outcome,
      decisionVersion,
      residentAlias,
      totalCount: batchData.totalDetectedObjectCount !== undefined ? Number(batchData.totalDetectedObjectCount) : null,
      materialSummary,
      reviewerAlias,
      resolvedAt,
    };

    const findings: AdminReviewDetailViewRecord["findings"] = [];
    if (Array.isArray(batchData.lines)) {
      let idx = 1;
      for (const line of batchData.lines) {
        const count = Number(line.count ?? 1);
        for (let c = 0; c < count; c++) {
          findings.push({
            objectId: `obj-${idx++}`,
            detectedClass: String(line.class ?? "unknown"),
            confidence: 0.9,
            boundingBox: null,
            resolvedClass: String(line.class ?? "unknown"),
            decision: line.eligible ? "accept" : "exclude",
            note: line.eligible ? "Eligible under active policy" : "Excluded class",
          });
        }
      }
    }

    const assetId = String(ticketData.assetId ?? batchData.assetId ?? "");
    const assetVersion = String(ticketData.assetVersion ?? batchData.assetVersion ?? "");
    const previewUrl = (assetId && assetVersion)
      ? `https://firebasestorage.googleapis.com/v0/b/ecoloop-thesmartrecycling.firebasestorage.app/o/simulation-assets%2F${encodeURIComponent(assetId)}%2F${encodeURIComponent(assetVersion)}%2Fsource.jpg?alt=media`
      : null;

    return {
      review: reviewView,
      sessionId: String(ticketData.sessionId ?? batchData.sessionId ?? ""),
      resultId: resultSnap?.id ?? `result-${batchId}`,
      pinnedPolicyId: String(batchData.policyVersion ?? "policy-v1"),
      pinnedPolicyVersion: 1,
      provisionalSpaceSpc: Number(ticketData.provisionalSpaceSpc ?? batchData.spaceContributionSpc ?? 0),
      heldPoints: ticketData.heldPoints !== undefined ? ticketData.heldPoints : (outcome === "verified" ? Number(batchData.pointsAwarded ?? 0) : null),
      finalSpaceSpc: batchData.spaceContributionSpc !== undefined ? Number(batchData.spaceContributionSpc) : null,
      awardedPoints: batchData.pointsAwarded !== undefined ? Number(batchData.pointsAwarded) : null,
      inventoryState: (batchData.inventoryState ?? (outcome === "empty" ? "empty" : outcome === "rejected" ? "unreadable" : "resolved")) as any,
      findings,
      source: {
        type: "simulated_bin_capture",
        assetId: assetId || null,
        modelVersion: assetVersion || null,
      },
      evidence: {
        previewAvailable: Boolean(previewUrl),
        previewUrl,
        failureReason: previewUrl ? null : (ticketData.reasonCodes?.join(", ") ?? null),
      },
      explanation: ticketData.resolutionReason ? String(ticketData.resolutionReason) : (batchData.explanation ?? null),
      history: [
        {
          actor: "System",
          action: "Referred for review",
          timestamp: occurredAt,
          note: ticketData.reasonCodes?.join(", ") ?? null,
        },
        ...(ticketData.resolvedAt ? [{
          actor: reviewerAlias ?? "Admin",
          action: "Resolved review",
          timestamp: resolvedAt ?? new Date().toISOString(),
          note: ticketData.resolutionReason ? String(ticketData.resolutionReason) : null,
        }] : []),
      ],
    };
  }
}

