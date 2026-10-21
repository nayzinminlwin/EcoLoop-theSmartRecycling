// =============================================================================
// admin.ts — Admin-only wire-model contracts
// Phase 2 — Strictly additive; NEVER modifies shared resident interfaces
// =============================================================================

import type {
  ISODateTime, MaterialType, SmartBin, DepositTransaction, ResidentProfile,
  WalletSnapshot, MaterialRate, RecyclingSummary, RewardDocument
} from "./shared.ts";

// Re-export RewardDocument so callers can import it from here without
// reaching into shared.ts for admin Reward-input scenarios.
export type { RewardDocument };

// ---------------------------------------------------------------------------
// Enum-like union types
// ---------------------------------------------------------------------------
export type CollectionStatus = "notScheduled" | "pending" | "scheduled" | "collected";
export type AlertStatus = "active" | "resolved";
export type VerificationStatus = "awaitingReview" | "approved" | "rejected";
export type VerificationFlag = "uncertain" | "possibleContaminant";
export type CapacityBand = "normal" | "warning" | "critical";
export type PageSize = 5 | 10 | 20;
export type SortDirection = "asc" | "desc";

// ---------------------------------------------------------------------------
// Generic list query / pagination
// ---------------------------------------------------------------------------
export interface SortSpec<K extends string> { key: K; direction: SortDirection; }
export interface ListQuery<K extends string> {
  search: string; page: number; pageSize: PageSize; sort: SortSpec<K>;
}
export interface Page<T> { items: T[]; total: number; page: number; pageSize: PageSize; }

// ---------------------------------------------------------------------------
// Smart bin fleet
// ---------------------------------------------------------------------------
export interface BinOperations { binId: string; collectionStatus: CollectionStatus; }
export interface SmartBinRow { bin: SmartBin; operations: BinOperations; }

// ---------------------------------------------------------------------------
// Capacity alerts
// ---------------------------------------------------------------------------
export interface CapacityAlert {
  id: string; binId: string; status: AlertStatus; thresholdPercent: number;
  triggeredAt: ISODateTime; resolvedAt: ISODateTime | null;
}
export interface CapacityAlertRow {
  alert: CapacityAlert; bin: SmartBin; operations: BinOperations;
}
export interface AlertPage extends Page<CapacityAlertRow> {
  activeCount: number; resolvedCount: number;
}

// ---------------------------------------------------------------------------
// Deposit verification
// ---------------------------------------------------------------------------
export interface VerificationTicket {
  id: string; transactionId: string; predictedMaterialType: MaterialType;
  predictedMaterialLabel: string; confidencePercent: number;
  captureDescription: string; captureImageUrl: string | null;
  flag: VerificationFlag; status: VerificationStatus;
  reviewedAt: ISODateTime | null; reviewedByAdminId: string | null;
}
export interface VerificationDetail {
  ticket: VerificationTicket; transaction: DepositTransaction;
  resident: ResidentProfile; bin: SmartBin;
}
export interface VerificationDecisionResult {
  detail: VerificationDetail; wallet: WalletSnapshot;
}

// ---------------------------------------------------------------------------
// Admin identity / session / auth
// ---------------------------------------------------------------------------
export interface AdminIdentity { id: string; fullName: string; email: string; }
export interface AdminSession {
  id: string; adminId: string; isSignedIn: boolean; startedAt: ISODateTime;
}
export interface AdminLoginRequest { email: string; password: string; }

// ---------------------------------------------------------------------------
// Program settings
// ---------------------------------------------------------------------------
export interface AdminSettings {
  id: "global";
  version?: number;
  policyVersion?: string;
  capacityAlertThreshold: 75 | 80 | 85;
  acceptedMaterials: MaterialType[];
  acceptedClasses?: string[];
  materialRates: MaterialRate[];
  updatedAt: ISODateTime;
}
export interface ProgramSettingsDocument {
  id: "global";
  version?: number;
  policyVersion?: string;
  capacityAlertThreshold: 75 | 80 | 85;
  acceptedMaterials: MaterialType[];
  acceptedClasses?: string[];
  updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Dashboard analytics (read projections — not stored wholesale)
// ---------------------------------------------------------------------------
export interface DailyActivity { date: string; verifiedDepositCount: number; }
export interface MaterialMixEntry {
  materialType: MaterialType; displayName: string; weightKg: number;
}
export interface DashboardSummary {
  registeredBins: number; activeAlerts: number; verifiedDeposits: number;
  ecoPointsIssued: number; totalWeightKg: number;
  activity: DailyActivity[]; materialMix: MaterialMixEntry[];
  attentionBins: SmartBinRow[]; updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Resident read projection (admin side only)
// ---------------------------------------------------------------------------
export interface ResidentSnapshot {
  profile: ResidentProfile; wallet: WalletSnapshot;
  deposits: DepositTransaction[]; summary: RecyclingSummary;
}

// ---------------------------------------------------------------------------
// Input / mutation types
// ---------------------------------------------------------------------------
export type BinInput = Omit<SmartBin, "id" | "lastUpdatedAt"> & {
  capacitySpc?: number;
  expectedVersion?: number;
};
export type RewardInput = Omit<RewardDocument, "id"> & {
  expectedVersion?: number;
  terms?: string | null;
  isDemo?: boolean;
};
export type SettingsInput = Pick<
  AdminSettings,
  "capacityAlertThreshold" | "acceptedMaterials" | "materialRates"
> & {
  expectedVersion?: number;
  acceptedClasses?: string[];
};

// ---------------------------------------------------------------------------
// List query specialisations
// ---------------------------------------------------------------------------
export type BinSortKey = "id" | "locationName" | "capacityPercent" | "lastUpdatedAt";
export interface BinListQuery extends ListQuery<BinSortKey> {
  capacityBand: CapacityBand | "all";
  collectionStatus: CollectionStatus | "all";
  online: "all" | "online" | "offline";
}
export type AlertSortKey = "triggeredAt" | "capacityPercent";
export interface AlertListQuery extends ListQuery<AlertSortKey> { status: AlertStatus; }
export type VerificationSortKey = "occurredAt" | "confidencePercent";
export interface VerificationListQuery extends ListQuery<VerificationSortKey> {
  status: VerificationStatus;
}
export type RewardSortKey = "title" | "pointsCost" | "expiresAt";
export interface RewardListQuery extends ListQuery<RewardSortKey> {
  categoryId: string | null; publication: "all" | "active" | "draft";
}

// ---------------------------------------------------------------------------
// Admin record registry (document-storable subset)
// ---------------------------------------------------------------------------
export interface AdminRecords {
  BinOperations: BinOperations;
  CapacityAlert: CapacityAlert;
  VerificationTicket: VerificationTicket;
  AdminIdentity: AdminIdentity;
  AdminSession: AdminSession;
  AdminLoginRequest: AdminLoginRequest;
  AdminSettings: AdminSettings;
  ProgramSettingsDocument: ProgramSettingsDocument;
}
export type AdminDocumentRecords = Pick<AdminRecords,
  "BinOperations" | "CapacityAlert" | "VerificationTicket" |
  "AdminIdentity" | "ProgramSettingsDocument">;
