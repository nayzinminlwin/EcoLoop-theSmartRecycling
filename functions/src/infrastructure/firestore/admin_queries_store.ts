// =============================================================================
// admin_queries_store.ts — Bounded queries, cursor pagination, and count aggregation
// Phase AB-03 — Query execution over admin materialized projections
// =============================================================================

import type { Firestore, Query, DocumentData } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { AdminBinViewRecord, AdminRewardViewRecord, AdminRewardCategoryViewRecord } from "./admin_projections_store.js";
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

const SUPPORTED_BIN_SORTS = new Set(["locationName", "fillPercent", "capacitySpc", "updatedAt", "binId"]);
const SUPPORTED_BIN_FILTERS = new Set(["collectionState", "enabled"]);

const SUPPORTED_REWARD_SORTS = new Set(["sortOrder", "pointsCost", "title", "updatedAt", "rewardId"]);
const SUPPORTED_REWARD_FILTERS = new Set(["categoryId", "isActive"]);

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

    const direction = input.sortDirection === "desc" ? "desc" : "asc";
    const pageSize = Math.max(1, Math.min(100, Number(input.pageSize ?? 10)));

    let query: Query<DocumentData> = this.firestore.collection("adminBinViews");

    // Apply filters
    if (input.filters) {
      for (const [key, val] of Object.entries(input.filters)) {
        if (!SUPPORTED_BIN_FILTERS.has(key)) {
          throw new HttpsError("invalid-argument", `Unsupported bin filter: ${key}`);
        }
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

    const direction = input.sortDirection === "desc" ? "desc" : "asc";
    const pageSize = Math.max(1, Math.min(100, Number(input.pageSize ?? 10)));

    let query: Query<DocumentData> = this.firestore.collection("adminRewardViews");

    // Apply filters
    if (input.filters) {
      for (const [key, val] of Object.entries(input.filters)) {
        if (!SUPPORTED_REWARD_FILTERS.has(key)) {
          throw new HttpsError("invalid-argument", `Unsupported reward filter: ${key}`);
        }
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
}
