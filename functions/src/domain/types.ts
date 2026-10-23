export type Instant = string;
export type Identifier = string;
export type SchemaVersion = "backend.v1";

export type CanonicalClass =
  | "plastic_bottle"
  | "aluminium_can"
  | "glass_bottle"
  | "paper_item"
  | "paper_bag"
  | "cardboard_item"
  | "other"
  | "unknown";

export type RewardCategory = "plastic" | "aluminium" | "paper" | "glass";
export type Eligibility = "eligible" | "excluded" | "unresolved";
export type InventoryState = "resolved" | "empty" | "unreadable" | "uncertain";
export type BatchStatus =
  | "processing"
  | "review"
  | "verified"
  | "rejected"
  | "empty"
  | "failed";

export type SessionStage =
  | "binFound"
  | "ready"
  | "itemDetected"
  | "processing"
  | "completed"
  | "cancelled"
  | "expired";

export type VoucherState = "available" | "used" | "expired";

export interface ImageBox {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ResidentSnapshot {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface WalletSnapshot {
  readonly residentId: string;
  readonly balance: number;
  readonly version: number;
  readonly updatedAt: Instant;
}

export interface BinSnapshot {
  readonly id: Identifier;
  readonly capacitySpc: number;
  readonly occupiedSpc: number;
  readonly capacityPercent: number;
  readonly cycleId: Identifier;
  readonly isOnline: boolean;
  readonly enabled: boolean;
}

export interface AssetSnapshot {
  readonly id: Identifier;
  readonly version: string;
  readonly contentSha256: string;
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
  readonly width: number;
  readonly height: number;
  readonly enabled: boolean;
}

export interface DepositSession {
  readonly id: Identifier;
  readonly ownerId: string;
  readonly binId: Identifier;
  readonly stage: SessionStage;
  readonly version: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly draftAssetId: Identifier | null;
  readonly draftAssetVersion: string | null;
  readonly batchId: Identifier | null;
  readonly reservationExpiresAt?: Instant;
}

export interface ReceiptLine {
  readonly lineId: Identifier;
  readonly class: CanonicalClass;
  readonly eligible: boolean;
  readonly count: number;
  readonly pointsPerItem: number;
  readonly spacePerItem: number;
  readonly points: number;
  readonly spaceSpc: number;
}

export interface DepositBatch {
  readonly id: Identifier;
  readonly ownerId: string;
  readonly sessionId: Identifier;
  readonly assetId: Identifier;
  readonly policyVersion: Identifier;
  readonly status: BatchStatus;
  readonly totalDetectedObjectCount: number | null;
  readonly pointsAwarded: number | null;
  readonly spaceContributionSpc: number;
  readonly decisionVersion: number;
  readonly lines: readonly ReceiptLine[];
}

export interface DepositReceipt {
  readonly id: Identifier;
  readonly batchId: Identifier;
  readonly outcome: Exclude<BatchStatus, "failed">;
  readonly pointsAwarded: number | null;
  readonly spaceContributionSpc: number;
  readonly decisionVersion: number;
  readonly explanation: string;
}

export interface FindingEvidence {
  readonly modelIds: readonly Identifier[];
  readonly rawLabel: string;
  readonly specialistLabels?: readonly string[];
}

export interface WorkerFinding {
  readonly objectId: Identifier;
  readonly resolution: CanonicalClass;
  readonly eligibility: Eligibility;
  readonly box: ImageBox | null;
  readonly evidence: FindingEvidence;
  readonly confidence: number;
  readonly reasonCode?: "matched" | "fallback" | "unsupported_label" | "ambiguous" | "false_detection";
}

export interface WorkerFindings {
  readonly schemaVersion: SchemaVersion;
  readonly source: "worker";
  readonly jobId: Identifier;
  readonly attemptId: Identifier;
  readonly image: {
    readonly assetId: Identifier;
    readonly assetVersion: string;
    readonly contentSha256: string;
    readonly width: number;
    readonly height: number;
  };
  readonly findings: readonly WorkerFinding[];
  readonly inventoryState: InventoryState;
  readonly diagnosticReferences?: readonly Identifier[];
}

export interface RewardCatalogItem {
  readonly id: Identifier;
  readonly offerVersion: string;
  readonly pointsCost: number;
  readonly maxRedemptionsPerResident: number;
  readonly isActive: boolean;
}

export interface VoucherSnapshot {
  readonly id: Identifier;
  readonly residentId: string;
  readonly rewardId: Identifier;
  readonly state: VoucherState;
  readonly remainingUses: 0 | 1;
  readonly issuedAt: Instant;
  readonly expiresAt: Instant;
  readonly usedAt: Instant | null;
}
