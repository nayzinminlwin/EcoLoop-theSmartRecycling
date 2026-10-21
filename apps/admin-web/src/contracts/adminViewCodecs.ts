// =============================================================================
// adminViewCodecs.ts — Safe runtime codecs for Admin View DTOs
// Phase AB-03 — Decodes, validates, and normalizes server read projections
// =============================================================================

import type { SmartBin, Reward, DepositTransaction, ResidentProfile } from "./shared.ts";
import type {
  SmartBinRow,
  CapacityAlertRow,
  CapacityAlert,
  BinOperations,
  VerificationDetail,
  VerificationTicket,
} from "./admin.ts";

export interface AdminAlertView {
  readonly alertId: string;
  readonly binId: string;
  readonly locationName: string;
  readonly cycleId: string;
  readonly triggeringFillPercent: number;
  readonly currentFillPercent: number;
  readonly threshold: 75 | 80 | 85;
  readonly operationalSettingsVersion: number;
  readonly state: "pending" | "scheduled" | "collected" | "resolved";
  readonly version: number;
  readonly triggeredAt: string;
  readonly scheduledAt: string | null;
  readonly scheduledBy: string | null;
  readonly collectedAt?: string | null;
  readonly collectedBy?: string | null;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
  readonly collectionEventId: string | null;
}

export interface AdminBinView {
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
  readonly collectionState: "normal" | "warning" | "critical" | "collection_pending";
  readonly lastCollectionTime: string | null;
  readonly updatedAt: string;
}

export interface AdminBinDetailView {
  readonly bin: AdminBinView;
  readonly qrPayload: string;
  readonly totalCollections: number;
  readonly totalAcceptedItems: number;
  readonly activeAlertId: string | null;
}

export interface AdminRewardView {
  readonly rewardId: string;
  readonly title: string;
  readonly description: string;
  readonly merchantName: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly tag: string | null;
  readonly imageUrl: string | null;
  readonly pointsCost: number;
  readonly expiresAt: string;
  readonly isActive: boolean;
  readonly maxRedemptionsPerResident: number;
  readonly artKey: "art0" | "art1" | "art2" | "art3";
  readonly sortOrder: number;
  readonly isDemo: boolean;
  readonly terms: string | null;
  readonly version: number;
  readonly updatedAt: string;
}

export interface AdminRewardCategoryView {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly description: string | null;
  readonly sortOrder: number;
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

function normalizeTimestamp(value: unknown): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  if (value && typeof value === "object") {
    const rec = value as { _seconds?: number; seconds?: number; toDate?: () => Date };
    if (typeof rec.toDate === "function") {
      return rec.toDate().toISOString();
    }
    const secs = rec._seconds ?? rec.seconds;
    if (typeof secs === "number") {
      return new Date(secs * 1000).toISOString();
    }
  }
  return new Date().toISOString();
}

export function decodeAdminBinView(raw: unknown): AdminBinView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid AdminBinView: expected an object");
  }
  const obj = raw as Record<string, unknown>;

  if (!obj.binId || typeof obj.binId !== "string") {
    throw new Error("Invalid AdminBinView: missing or invalid binId");
  }
  if (!obj.locationName || typeof obj.locationName !== "string") {
    throw new Error("Invalid AdminBinView: missing or invalid locationName");
  }

  const validStates = ["normal", "warning", "critical", "collection_pending"] as const;
  const rawState = String(obj.collectionState ?? "normal");
  const collectionState = validStates.includes(rawState as (typeof validStates)[number])
    ? (rawState as (typeof validStates)[number])
    : "normal";

  return {
    binId: obj.binId,
    locationName: obj.locationName,
    locationDetail: String(obj.locationDetail ?? "Standard Facility"),
    capacitySpc: Math.max(50, Math.min(5000, Number(obj.capacitySpc ?? 1000))),
    occupiedSpc: Math.max(0, Number(obj.occupiedSpc ?? 0)),
    fillPercent: Math.max(0, Math.min(100, Number(obj.fillPercent ?? 0))),
    cycleId: String(obj.cycleId ?? `cycle-${obj.binId}-001`),
    enabled: obj.enabled !== false,
    logicalOnline: obj.logicalOnline !== false,
    version: Math.max(0, Number(obj.version ?? 1)),
    sharedPolicyVersion: String(obj.sharedPolicyVersion ?? "v1.0.0"),
    collectionState,
    lastCollectionTime: obj.lastCollectionTime ? normalizeTimestamp(obj.lastCollectionTime) : null,
    updatedAt: normalizeTimestamp(obj.updatedAt),
  };
}

export function decodeAdminBinDetailView(raw: unknown): AdminBinDetailView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid AdminBinDetailView: expected an object");
  }
  const obj = raw as Record<string, unknown>;
  return {
    bin: decodeAdminBinView(obj.bin ?? obj),
    qrPayload: String(obj.qrPayload ?? `ecoloop://bin/qr-${(obj.bin as Record<string, unknown>)?.binId ?? "unknown"}`),
    totalCollections: Math.max(0, Number(obj.totalCollections ?? 0)),
    totalAcceptedItems: Math.max(0, Number(obj.totalAcceptedItems ?? 0)),
    activeAlertId: obj.activeAlertId ? String(obj.activeAlertId) : null,
  };
}

export function decodeAdminRewardView(raw: unknown): AdminRewardView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid AdminRewardView: expected an object");
  }
  const obj = raw as Record<string, unknown>;

  if (!obj.rewardId || typeof obj.rewardId !== "string") {
    throw new Error("Invalid AdminRewardView: missing or invalid rewardId");
  }
  if (!obj.title || typeof obj.title !== "string") {
    throw new Error("Invalid AdminRewardView: missing or invalid title");
  }

  const validArtKeys = ["art0", "art1", "art2", "art3"] as const;
  const rawArt = String(obj.artKey ?? "art0");
  const artKey = validArtKeys.includes(rawArt as (typeof validArtKeys)[number])
    ? (rawArt as (typeof validArtKeys)[number])
    : "art0";

  return {
    rewardId: obj.rewardId,
    title: obj.title,
    description: String(obj.description ?? ""),
    merchantName: String(obj.merchantName ?? "EcoLoop Partner"),
    categoryId: String(obj.categoryId ?? "cat-general"),
    categoryName: String(obj.categoryName ?? "General"),
    tag: obj.tag ? String(obj.tag) : null,
    imageUrl: obj.imageUrl ? String(obj.imageUrl) : null,
    pointsCost: Math.max(1, Number(obj.pointsCost ?? 100)),
    expiresAt: normalizeTimestamp(obj.expiresAt),
    isActive: obj.isActive !== false,
    maxRedemptionsPerResident: Math.max(1, Number(obj.maxRedemptionsPerResident ?? 5)),
    artKey,
    sortOrder: Math.max(0, Number(obj.sortOrder ?? 0)),
    isDemo: Boolean(obj.isDemo),
    terms: obj.terms ? String(obj.terms) : null,
    version: Math.max(0, Number(obj.version ?? 1)),
    updatedAt: normalizeTimestamp(obj.updatedAt),
  };
}

export function decodeAdminRewardCategoryView(raw: unknown): AdminRewardCategoryView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid AdminRewardCategoryView: expected an object");
  }
  const obj = raw as Record<string, unknown>;
  return {
    categoryId: String(obj.categoryId ?? ""),
    categoryName: String(obj.categoryName ?? "General"),
    description: obj.description ? String(obj.description) : null,
    sortOrder: Math.max(0, Number(obj.sortOrder ?? 0)),
  };
}

export function decodeAdminPaginatedResponse<T>(
  raw: unknown,
  itemDecoder: (item: unknown) => T
): AdminPaginatedResponse<T> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid AdminPaginatedResponse: expected an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== "admin.v1") {
    throw new Error(`Unsupported schema version: ${String(obj.schemaVersion)}`);
  }

  const items = Array.isArray(obj.items) ? obj.items.map(itemDecoder) : [];
  return {
    schemaVersion: "admin.v1",
    items,
    total: Math.max(0, Number(obj.total ?? items.length)),
    hasMore: Boolean(obj.hasMore),
    nextCursor: obj.nextCursor ? String(obj.nextCursor) : null,
    readVersion: String(obj.readVersion ?? "1"),
    freshness: normalizeTimestamp(obj.freshness),
  };
}

export function adminBinViewToRow(view: AdminBinView): SmartBinRow {
  const isOnline = view.enabled && view.logicalOnline;
  const bin: SmartBin = {
    id: view.binId,
    locationName: view.locationName,
    locationDetail: view.locationDetail,
    capacityPercent: view.fillPercent,
    acceptedMaterials: ["plastic", "aluminium"],
    isOnline,
    lastUpdatedAt: view.updatedAt,
  };

  return {
    bin,
    operations: {
      binId: view.binId,
      collectionStatus: view.collectionState === "collection_pending" ? "pending" : "notScheduled",
    },
  };
}

export function adminRewardViewToReward(view: AdminRewardView): Reward {
  return {
    id: view.rewardId,
    title: view.title,
    description: view.description,
    merchantName: view.merchantName,
    categoryId: view.categoryId,
    tag: view.tag ?? null,
    imageUrl: view.imageUrl ?? "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
    pointsCost: view.pointsCost,
    expiresAt: view.expiresAt,
    isActive: view.isActive,
    maxRedemptionsPerResident: view.maxRedemptionsPerResident,
    residentRedemptionCount: 0,
    artKey: view.artKey,
    sortOrder: view.sortOrder,
  };
}

export function decodeAdminAlertView(raw: unknown): AdminAlertView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid AdminAlertView: expected an object");
  }
  const obj = raw as Record<string, unknown>;

  if (!obj.alertId || typeof obj.alertId !== "string") {
    throw new Error("Invalid AdminAlertView: missing or invalid alertId");
  }
  if (!obj.binId || typeof obj.binId !== "string") {
    throw new Error("Invalid AdminAlertView: missing or invalid binId");
  }

  const rawThreshold = Number(obj.threshold ?? 85);
  const threshold: 75 | 80 | 85 = (rawThreshold === 75 || rawThreshold === 80 || rawThreshold === 85)
    ? rawThreshold
    : 85;

  return {
    alertId: obj.alertId,
    binId: obj.binId,
    locationName: String(obj.locationName ?? "Unknown Location"),
    cycleId: String(obj.cycleId ?? ""),
    triggeringFillPercent: Math.max(0, Math.min(100, Number(obj.triggeringFillPercent ?? threshold))),
    currentFillPercent: Math.max(0, Math.min(100, Number(obj.currentFillPercent ?? threshold))),
    threshold,
    operationalSettingsVersion: Math.max(1, Number(obj.operationalSettingsVersion ?? 1)),
    state: (obj.state === "scheduled" || obj.state === "collected" || obj.state === "resolved")
      ? obj.state
      : "pending",
    version: Math.max(1, Number(obj.version ?? 1)),
    triggeredAt: normalizeTimestamp(obj.triggeredAt),
    scheduledAt: obj.scheduledAt ? normalizeTimestamp(obj.scheduledAt) : null,
    scheduledBy: obj.scheduledBy ? String(obj.scheduledBy) : null,
    collectedAt: obj.collectedAt ? normalizeTimestamp(obj.collectedAt) : null,
    collectedBy: obj.collectedBy ? String(obj.collectedBy) : null,
    resolvedAt: obj.resolvedAt ? normalizeTimestamp(obj.resolvedAt) : null,
    resolvedBy: obj.resolvedBy ? String(obj.resolvedBy) : null,
    collectionEventId: obj.collectionEventId ? String(obj.collectionEventId) : null,
  };
}

export function adminAlertViewToRow(
  view: AdminAlertView,
  binDoc?: Partial<SmartBin>
): CapacityAlertRow {
  const isResolved = view.state === "resolved";
  const alertStatus: "active" | "resolved" = isResolved ? "resolved" : "active";

  let collectionStatus: "notScheduled" | "pending" | "scheduled" | "collected" = "pending";
  if (view.state === "scheduled") {
    collectionStatus = "scheduled";
  } else if (view.state === "collected" || view.state === "resolved") {
    collectionStatus = "collected";
  }

  const alert: CapacityAlert = {
    id: view.alertId,
    binId: view.binId,
    status: alertStatus,
    thresholdPercent: view.threshold,
    triggeredAt: view.triggeredAt,
    resolvedAt: view.resolvedAt,
  };

  const bin: SmartBin = {
    id: view.binId,
    locationName: binDoc?.locationName ?? view.locationName,
    locationDetail: binDoc?.locationDetail ?? "Standard Facility",
    capacityPercent: binDoc?.capacityPercent ?? view.currentFillPercent,
    acceptedMaterials: binDoc?.acceptedMaterials ?? ["plastic", "aluminium"],
    isOnline: binDoc?.isOnline ?? true,
    lastUpdatedAt: binDoc?.lastUpdatedAt ?? view.triggeredAt,
  };

  const operations: BinOperations = {
    binId: view.binId,
    collectionStatus,
  };

  return { alert, bin, operations };
}

export function encodeCursor(values: unknown[]): string {
  if (typeof btoa === "function") {
    return btoa(JSON.stringify(values)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

export function decodeCursor(cursorStr: string): unknown[] {
  try {
    let base64 = cursorStr.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const json = typeof atob === "function"
      ? atob(base64)
      : Buffer.from(cursorStr, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new Error(`Malformed pagination cursor: ${cursorStr}`);
  }
}

export interface AdminReviewView {
  readonly ticketId: string;
  readonly batchId: string;
  readonly binId: string;
  readonly locationName: string;
  readonly occurredAt: string;
  readonly state: "awaiting_review" | "resolved";
  readonly outcome: "processing" | "review" | "verified" | "rejected" | "empty";
  readonly decisionVersion: number;
  readonly residentAlias: string;
  readonly totalCount: number | null;
  readonly materialSummary: string | null;
  readonly reason?: string | null;
  readonly reviewerAlias?: string | null;
  readonly resolvedAt?: string | null;
}

export interface AdminReviewDetailView {
  readonly review: AdminReviewView;
  readonly sessionId: string;
  readonly resultId: string;
  readonly pinnedPolicyId: string;
  readonly pinnedPolicyVersion: number;
  readonly provisionalSpaceSpc: number;
  readonly heldPoints: number | null;
  readonly finalSpaceSpc: number | null;
  readonly awardedPoints: number | null;
  readonly inventoryState: "resolved" | "empty" | "unreadable" | "uncertain";
  readonly findings: Array<{
    readonly objectId: string;
    readonly detectedClass: string;
    readonly confidence: number | null;
    readonly boundingBox: { x1: number; y1: number; x2: number; y2: number } | null;
    readonly resolvedClass: string | null;
    readonly decision: "accept" | "exclude" | null;
    readonly note: string | null;
  }>;
  readonly source: {
    readonly type: "simulated_bin_capture" | "physical_camera";
    readonly assetId?: string | null;
    readonly pipelineRunId?: string | null;
    readonly modelVersion?: string | null;
  };
  readonly evidence: {
    readonly previewAvailable: boolean;
    readonly previewUrl?: string | null;
    readonly failureReason?: string | null;
  };
  readonly explanation: string | null;
  readonly history: Array<{
    readonly actor: string;
    readonly action: string;
    readonly timestamp: string;
    readonly note?: string | null;
  }>;
}

export interface ObjectResolutionDecisionInput {
  readonly objectId: string;
  readonly resolvedClass: string;
  readonly decision: "accept" | "exclude";
  readonly note?: string;
}

export interface ReviewResolutionPreview {
  readonly outcome: "verified" | "rejected" | "empty";
  readonly pointsAwarded: number;
  readonly spaceContributionSpc: number;
  readonly spaceDeltaSpc: number;
  readonly acceptedCount: number;
  readonly totalCount: number | null;
  readonly lines: Array<{
    readonly class: string;
    readonly eligible: boolean;
    readonly count: number;
    readonly points: number;
    readonly spaceSpc: number;
  }>;
}

export interface ResolveReviewInput {
  readonly ticketId: string;
  readonly expectedDecisionVersion: number;
  readonly inventoryState: "resolved" | "empty" | "unreadable" | "uncertain";
  readonly objects: ObjectResolutionDecisionInput[];
  readonly explanation: string;
}

export function decodeAdminReviewView(raw: unknown): AdminReviewView {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid review view payload: expected object");
  }
  const obj = raw as Record<string, unknown>;

  const ticketId = String(obj.ticketId ?? obj.id ?? "");
  if (!ticketId) throw new Error("Missing ticketId in review view");

  const batchId = String(obj.batchId ?? "");
  const binId = String(obj.binId ?? "");
  const locationName = String(obj.locationName ?? `Smart Bin ${binId}`);

  let occurredAt = String(obj.occurredAt ?? new Date().toISOString());
  if (obj.occurredAt && typeof obj.occurredAt === "object" && "_seconds" in (obj.occurredAt as Record<string, unknown>)) {
    const ts = obj.occurredAt as { _seconds: number; _nanoseconds?: number };
    occurredAt = new Date(ts._seconds * 1000).toISOString();
  }

  let resolvedAt: string | null = null;
  if (obj.resolvedAt) {
    if (typeof obj.resolvedAt === "object" && "_seconds" in (obj.resolvedAt as Record<string, unknown>)) {
      const ts = obj.resolvedAt as { _seconds: number; _nanoseconds?: number };
      resolvedAt = new Date(ts._seconds * 1000).toISOString();
    } else {
      resolvedAt = String(obj.resolvedAt);
    }
  }

  const rawState = String(obj.state ?? "awaiting_review");
  const state = rawState === "resolved" ? "resolved" : "awaiting_review";

  const rawOutcome = String(obj.outcome ?? "review");
  const outcome = (["processing", "review", "verified", "rejected", "empty"].includes(rawOutcome)
    ? rawOutcome
    : "review") as AdminReviewView["outcome"];

  const decisionVersion = Math.max(0, Number(obj.decisionVersion ?? 0));
  const residentAlias = String(obj.residentAlias ?? "Resident •••000");
  const totalCount = obj.totalCount !== undefined && obj.totalCount !== null ? Number(obj.totalCount) : null;
  const materialSummary = obj.materialSummary ? String(obj.materialSummary) : null;
  const reviewerAlias = obj.reviewerAlias ? String(obj.reviewerAlias) : null;

  return {
    ticketId,
    batchId,
    binId,
    locationName,
    occurredAt,
    state,
    outcome,
    decisionVersion,
    residentAlias,
    totalCount,
    materialSummary,
    reviewerAlias,
    resolvedAt,
  };
}

export function decodeAdminReviewDetailView(raw: unknown): AdminReviewDetailView {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid review detail payload: expected object");
  }
  const obj = raw as Record<string, unknown>;

  const review = decodeAdminReviewView(obj.review ?? obj);
  const sessionId = String(obj.sessionId ?? "");
  const resultId = String(obj.resultId ?? "");
  const pinnedPolicyId = String(obj.pinnedPolicyId ?? "policy-v1");
  const pinnedPolicyVersion = Math.max(1, Number(obj.pinnedPolicyVersion ?? 1));
  const provisionalSpaceSpc = Math.max(0, Number(obj.provisionalSpaceSpc ?? 0));
  const heldPoints = obj.heldPoints !== undefined && obj.heldPoints !== null ? Number(obj.heldPoints) : null;
  const finalSpaceSpc = obj.finalSpaceSpc !== undefined && obj.finalSpaceSpc !== null ? Number(obj.finalSpaceSpc) : null;
  const awardedPoints = obj.awardedPoints !== undefined && obj.awardedPoints !== null ? Number(obj.awardedPoints) : null;
  const inventoryState = (obj.inventoryState ?? "uncertain") as AdminReviewDetailView["inventoryState"];

  const findings: AdminReviewDetailView["findings"] = [];
  if (Array.isArray(obj.findings)) {
    for (const f of obj.findings) {
      if (f && typeof f === "object") {
        findings.push({
          objectId: String(f.objectId ?? `obj-${findings.length + 1}`),
          detectedClass: String(f.detectedClass ?? "unknown"),
          confidence: f.confidence !== undefined && f.confidence !== null ? Number(f.confidence) : null,
          boundingBox: f.boundingBox ?? null,
          resolvedClass: f.resolvedClass ? String(f.resolvedClass) : null,
          decision: f.decision === "accept" || f.decision === "exclude" ? f.decision : null,
          note: f.note ? String(f.note) : null,
        });
      }
    }
  }

  const rawSource = (obj.source ?? {}) as Record<string, unknown>;
  const source: AdminReviewDetailView["source"] = {
    type: rawSource.type === "physical_camera" ? "physical_camera" : "simulated_bin_capture",
    assetId: rawSource.assetId ? String(rawSource.assetId) : null,
    pipelineRunId: rawSource.pipelineRunId ? String(rawSource.pipelineRunId) : null,
    modelVersion: rawSource.modelVersion ? String(rawSource.modelVersion) : null,
  };

  const rawEvidence = (obj.evidence ?? {}) as Record<string, unknown>;
  const evidence: AdminReviewDetailView["evidence"] = {
    previewAvailable: Boolean(rawEvidence.previewAvailable),
    previewUrl: rawEvidence.previewUrl ? String(rawEvidence.previewUrl) : null,
    failureReason: rawEvidence.failureReason ? String(rawEvidence.failureReason) : null,
  };

  const explanation = obj.explanation ? String(obj.explanation) : null;

  const history: AdminReviewDetailView["history"] = [];
  if (Array.isArray(obj.history)) {
    for (const h of obj.history) {
      if (h && typeof h === "object") {
        history.push({
          actor: String(h.actor ?? "System"),
          action: String(h.action ?? "Updated"),
          timestamp: String(h.timestamp ?? review.occurredAt),
          note: h.note ? String(h.note) : null,
        });
      }
    }
  }

  return {
    review,
    sessionId,
    resultId,
    pinnedPolicyId,
    pinnedPolicyVersion,
    provisionalSpaceSpc,
    heldPoints,
    finalSpaceSpc,
    awardedPoints,
    inventoryState,
    findings,
    source,
    evidence,
    explanation,
    history,
  };
}

export function adminReviewDetailToVerificationDetail(view: AdminReviewDetailView): VerificationDetail {
  const r = view.review;
  const isApproved = r.outcome === "verified";
  const isRejected = r.outcome === "rejected" || r.outcome === "empty";
  const status = isApproved ? "approved" : isRejected ? "rejected" : "awaitingReview";

  const ticket: VerificationTicket = {
    id: r.ticketId,
    transactionId: r.batchId,
    predictedMaterialType: "plastic",
    predictedMaterialLabel: r.materialSummary ?? "Mixed Batch",
    confidencePercent: 90,
    captureDescription: `Batch ${r.batchId} (${r.totalCount ?? 0} items)`,
    captureImageUrl: view.evidence.previewUrl ?? null,
    flag: "uncertain",
    status,
    reviewedAt: r.resolvedAt ?? null,
    reviewedByAdminId: r.reviewerAlias ?? null,
  };

  let txStatus: import("./shared.ts").DepositStatus = "review";
  if (r.outcome === "verified") txStatus = "verified";
  else if (r.outcome === "rejected" || r.outcome === "empty") txStatus = "rejected";

  const transaction: DepositTransaction = {
    id: r.batchId,
    residentId: r.residentAlias,
    sessionId: view.sessionId ?? null,
    binId: r.binId,
    binLocation: r.locationName,
    materialType: "plastic",
    materialLabel: r.materialSummary ?? "Mixed Batch",
    itemCount: r.totalCount ?? 1,
    pointsAwarded: view.awardedPoints ?? 0,
    status: txStatus,
    occurredAt: r.occurredAt,
    verifiedAt: r.resolvedAt ?? null,
  };

  const resident: ResidentProfile = {
    id: r.residentAlias,
    fullName: r.residentAlias,
    email: `${r.residentAlias.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
    avatarUrl: null,
    createdAt: r.occurredAt,
  };

  const bin: SmartBin = {
    id: r.binId,
    locationName: r.locationName,
    locationDetail: "Smart Recycling Chamber",
    capacityPercent: 50,
    acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
    isOnline: true,
    lastUpdatedAt: r.occurredAt,
  };

  return { ticket, transaction, resident, bin };
}


