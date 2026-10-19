// =============================================================================
// shared.ts — SDK-free JSON wire-model contracts
// Phase 2 — Aligned 1:1 with the Flutter resident domain types
// DO NOT add, remove, rename, or re-type any field declared here.
// =============================================================================

// ---------------------------------------------------------------------------
// Primitive aliases
// ---------------------------------------------------------------------------
export type ISODateTime = string;
export type AppRole = "user" | "admin";
export type MaterialType = "plastic" | "aluminium" | "paper" | "glass" | "unknown";
export type DepositStatus = "verified" | "review" | "rejected" | "unknown";
export type ScanStage = "binFound" | "ready" | "itemDetected" | "processing" | "completed" | "cancelled";
export type DepositOutcome = "verified" | "review" | "rejected" | "unknown";
export type VoucherStatus = "available" | "used" | "expired" | "unknown";

// ---------------------------------------------------------------------------
// Auth / session
// ---------------------------------------------------------------------------
export interface AuthState {
  uid: string | null; role: AppRole | null; isSignedIn: boolean;
}

// ---------------------------------------------------------------------------
// Resident profile & wallet
// ---------------------------------------------------------------------------
export interface ResidentProfile {
  id: string; fullName: string; email: string; avatarUrl: string | null; createdAt: ISODateTime;
}
export interface WalletDocument {
  residentId: string; balance: number; updatedAt: ISODateTime; version: number;
}
export interface WalletSnapshot {
  residentId: string; balance: number; nextRewardCost: number | null;
  updatedAt: ISODateTime; version: number;
}

// ---------------------------------------------------------------------------
// Deposits / transactions
// ---------------------------------------------------------------------------
export interface DepositTransaction {
  id: string; residentId: string; sessionId: string | null;
  binId: string; binLocation: string; materialType: MaterialType;
  materialLabel: string; itemCount: number; pointsAwarded: number | null;
  status: DepositStatus; occurredAt: ISODateTime; verifiedAt: ISODateTime | null;
}
export interface DepositFilter {
  from: ISODateTime | null; toExclusive: ISODateTime | null;
  status: DepositStatus | null;
}
export interface RecyclingSummary {
  verifiedDepositCount: number; verifiedWeightKg: number;
}

// ---------------------------------------------------------------------------
// Recycling guide
// ---------------------------------------------------------------------------
export interface RecyclingMaterial {
  id: string; type: MaterialType; title: string;
  preparationTip: string; iconKey: string; sortOrder: number;
}
export interface RecyclingStep {
  id: string; order: number; instruction: string;
}
export interface MaterialRate {
  materialType: MaterialType; displayName: string; pointsPerItem: number;
  eligible: boolean;
}
export interface RecyclingGuide {
  id: string; heroTitle: string; heroDescription: string;
  materials: RecyclingMaterial[]; toDo: string[]; toAvoid: string[];
  steps: RecyclingStep[]; rates: MaterialRate[]; pointsDisclaimer: string;
}
export interface RecyclingGuideContent {
  id: string; heroTitle: string; heroDescription: string;
  toDo: string[]; toAvoid: string[]; pointsDisclaimer: string;
}

// ---------------------------------------------------------------------------
// Smart bins / scan
// ---------------------------------------------------------------------------
export interface SmartBin {
  id: string; locationName: string; locationDetail: string;
  capacityPercent: number; acceptedMaterials: MaterialType[];
  isOnline: boolean; lastUpdatedAt: ISODateTime;
}
export interface ScanInstructions {
  id: string; scannerTitle: string; scannerDescription: string; binFoundTitle: string;
  readyTitle: string; readyDescription: string; itemDetectedTitle: string;
  itemDetectedDescription: string; processingTitle: string;
  processingDescription: string; verifiedTitle: string; reviewTitle: string;
  rejectedTitle: string; pointsTimingNotice: string;
}
export interface DepositSession {
  id: string; residentId: string; binId: string; stage: ScanStage;
  createdAt: ISODateTime; updatedAt: ISODateTime;
  creationRequestId: string; resultId: string | null;
}
export interface DepositResult {
  id: string; sessionId: string; transactionId: string;
  outcome: DepositOutcome; materialType: MaterialType; materialLabel: string;
  itemCount: number; pointsAwarded: number | null;
  classifiedAt: ISODateTime; explanation: string;
}

// ---------------------------------------------------------------------------
// Rewards & vouchers
// ---------------------------------------------------------------------------
export interface RewardCategory {
  id: string; label: string; sortOrder: number;
}
export interface Reward {
  id: string; title: string; description: string; merchantName: string;
  categoryId: string; tag: string | null; imageUrl: string | null; pointsCost: number;
  expiresAt: ISODateTime; isActive: boolean;
  maxRedemptionsPerResident: number; residentRedemptionCount: number;
  artKey: string; sortOrder: number;
}
export type RewardDocument = Omit<Reward, "residentRedemptionCount">;
export interface ResidentVoucher {
  id: string; residentId: string; rewardId: string | null; title: string;
  merchantName: string; code: string; terms: string;
  issuedAt: ISODateTime; expiresAt: ISODateTime; status: VoucherStatus;
  remainingUses: number; usedAt: ISODateTime | null;
}
export interface RewardRedemption {
  id: string; residentId: string; rewardId: string; idempotencyKey: string;
  pointsSpent: number; redeemedAt: ISODateTime;
  voucherId: string; walletBalanceAfter: number; walletVersion: number;
}
export interface RewardRedemptionReceipt {
  redemption: RewardRedemption;
  voucher: ResidentVoucher; wallet: WalletSnapshot;
}

// ---------------------------------------------------------------------------
// Account / security / notifications
// ---------------------------------------------------------------------------
export interface ProfileUpdateRequest { fullName: string; email: string; avatarUrl: string | null; }
export interface AccountSecurityInfo {
  residentId: string; passwordUpdatedAt: ISODateTime; isProtected: boolean;
}
export interface PasswordChangeRequest { currentPassword: string; newPassword: string; }
export interface NotificationPreferences {
  residentId: string; recyclingUpdates: boolean; pointsCredits: boolean;
  rewardReminders: boolean; updatedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Demo session (resident-side mock only)
// ---------------------------------------------------------------------------
export interface DemoSession {
  id: string; residentId: string; isSignedIn: boolean; startedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// Registry — full set of all 27 shared records
// ---------------------------------------------------------------------------
export interface SharedRecords {
  AuthState: AuthState;
  ResidentProfile: ResidentProfile;
  WalletDocument: WalletDocument;
  WalletSnapshot: WalletSnapshot;
  DepositTransaction: DepositTransaction;
  DepositFilter: DepositFilter;
  RecyclingSummary: RecyclingSummary;
  RecyclingMaterial: RecyclingMaterial;
  RecyclingStep: RecyclingStep;
  MaterialRate: MaterialRate;
  RecyclingGuide: RecyclingGuide;
  RecyclingGuideContent: RecyclingGuideContent;
  SmartBin: SmartBin;
  ScanInstructions: ScanInstructions;
  DepositSession: DepositSession;
  DepositResult: DepositResult;
  RewardCategory: RewardCategory;
  Reward: Reward;
  RewardDocument: RewardDocument;
  ResidentVoucher: ResidentVoucher;
  RewardRedemption: RewardRedemption;
  RewardRedemptionReceipt: RewardRedemptionReceipt;
  ProfileUpdateRequest: ProfileUpdateRequest;
  AccountSecurityInfo: AccountSecurityInfo;
  PasswordChangeRequest: PasswordChangeRequest;
  NotificationPreferences: NotificationPreferences;
  DemoSession: DemoSession;
}

// ---------------------------------------------------------------------------
// Document allowlist — flat Firestore-storable records only
// (excludes computed read responses, auth tokens, session objects)
// ---------------------------------------------------------------------------
export type SharedDocumentRecords = Pick<SharedRecords,
  "ResidentProfile" | "WalletDocument" | "DepositTransaction" |
  "RecyclingMaterial" | "RecyclingStep" | "MaterialRate" | "RecyclingGuideContent" |
  "SmartBin" | "ScanInstructions" | "DepositSession" | "DepositResult" |
  "RewardCategory" | "RewardDocument" | "ResidentVoucher" | "RewardRedemption" |
  "AccountSecurityInfo" | "NotificationPreferences">;
