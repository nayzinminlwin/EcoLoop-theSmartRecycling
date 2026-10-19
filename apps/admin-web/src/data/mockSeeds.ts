// =============================================================================
// mockSeeds.ts — Exact initial state fixtures for stateful in-memory store
// Phase 3 — SDK-free; immutable factory returning fresh cloned state
// =============================================================================

import type {
  AuthState, ResidentProfile, WalletDocument, SmartBin, DepositTransaction, MaterialRate,
  RewardCategory, RewardDocument, ResidentVoucher, RewardRedemption
} from "../contracts/shared.ts";
import type {
  AdminLoginRequest, BinOperations, CapacityAlert, VerificationTicket,
  ProgramSettingsDocument, AdminIdentity, AdminSession, VerificationDecisionResult
} from "../contracts/admin.ts";

export const MOCK_NOW = "2024-05-20T11:00:00+08:00";
export const MOCK_LOGIN: AdminLoginRequest = {
  email: "admin@ecoloop.demo",
  password: "AdminDemo123!"
};

export interface MockSeedState {
  residents: ResidentProfile[];
  wallets: WalletDocument[];
  bins: SmartBin[];
  binOperations: BinOperations[];
  alerts: CapacityAlert[];
  deposits: DepositTransaction[];
  tickets: VerificationTicket[];
  categories: RewardCategory[];
  rewards: RewardDocument[];
  vouchers: ResidentVoucher[];
  redemptions: RewardRedemption[];
  programSettings: ProgramSettingsDocument;
  materialRates: MaterialRate[];
  admin: AdminIdentity;
  adminSession: AdminSession;
  authState: AuthState;
  decisionReceipts: Record<string, VerificationDecisionResult>;
}

const residentsSeed: ResidentProfile[] = [
  { id: "RES-000842", fullName: "Faris Rezza", email: "rezza@example.com", avatarUrl: null, createdAt: "2024-04-01T09:00:00+08:00" },
  { id: "RES-000843", fullName: "Aina Lim", email: "aina@example.com", avatarUrl: null, createdAt: "2024-04-02T09:00:00+08:00" }
];

const walletsSeed: WalletDocument[] = [
  { residentId: "RES-000842", balance: 245, updatedAt: MOCK_NOW, version: 0 },
  { residentId: "RES-000843", balance: 120, updatedAt: MOCK_NOW, version: 0 }
];

const binsSeed: SmartBin[] = [
  { id: "BIN-004", locationName: "Cedar Residence", locationDetail: "Ground Floor", capacityPercent: 65, acceptedMaterials: ["plastic", "aluminium"], isOnline: true, lastUpdatedAt: MOCK_NOW },
  { id: "BIN-002", locationName: "Maple Lobby", locationDetail: "Recycling Corner", capacityPercent: 34, acceptedMaterials: ["plastic", "aluminium", "paper"], isOnline: true, lastUpdatedAt: MOCK_NOW },
  { id: "BIN-007", locationName: "Town Square", locationDetail: "Recycling Corner", capacityPercent: 40, acceptedMaterials: ["paper", "plastic"], isOnline: true, lastUpdatedAt: MOCK_NOW },
  { id: "BIN-011", locationName: "Town Square", locationDetail: "West Entrance", capacityPercent: 78, acceptedMaterials: ["plastic", "aluminium"], isOnline: true, lastUpdatedAt: MOCK_NOW },
  { id: "BIN-008", locationName: "Maple Apartments", locationDetail: "Lobby", capacityPercent: 62, acceptedMaterials: ["paper", "glass"], isOnline: true, lastUpdatedAt: MOCK_NOW }
];

const binOperationsSeed: BinOperations[] = [
  { binId: "BIN-004", collectionStatus: "notScheduled" },
  { binId: "BIN-002", collectionStatus: "collected" },
  { binId: "BIN-007", collectionStatus: "notScheduled" },
  { binId: "BIN-011", collectionStatus: "notScheduled" },
  { binId: "BIN-008", collectionStatus: "scheduled" }
];

const plasticToday: DepositTransaction = {
  id: "DEP-1088", residentId: "RES-000842", sessionId: null,
  binId: "BIN-004", binLocation: "Cedar Residence", materialType: "plastic",
  materialLabel: "PET plastic", itemCount: 4, pointsAwarded: 20,
  status: "verified", occurredAt: "2024-05-20T10:42:00+08:00",
  verifiedAt: "2024-05-20T10:43:00+08:00"
};

const olderPlastic: DepositTransaction = {
  ...plasticToday, id: "DEP-1001", itemCount: 2, pointsAwarded: 10,
  occurredAt: "2024-05-15T09:00:00+08:00", verifiedAt: "2024-05-15T09:01:00+08:00"
};

const depositsSeed: DepositTransaction[] = [
  plasticToday,
  { ...plasticToday, id: "DEP-1086", binId: "BIN-002", binLocation: "Maple Lobby", materialType: "aluminium", materialLabel: "Aluminium", itemCount: 2, pointsAwarded: 16, occurredAt: "2024-05-18T16:16:00+08:00", verifiedAt: "2024-05-18T16:17:00+08:00" },
  olderPlastic,
  { ...olderPlastic, id: "DEP-1002", materialType: "paper", materialLabel: "Paper", itemCount: 2, pointsAwarded: 6, occurredAt: "2024-05-14T09:00:00+08:00", verifiedAt: "2024-05-14T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1003", materialType: "glass", materialLabel: "Glass", itemCount: 1, pointsAwarded: 10, occurredAt: "2024-05-13T09:00:00+08:00", verifiedAt: "2024-05-13T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1004", materialType: "plastic", materialLabel: "PET plastic", itemCount: 2, pointsAwarded: 10, occurredAt: "2024-05-12T09:00:00+08:00", verifiedAt: "2024-05-12T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1005", materialType: "aluminium", materialLabel: "Aluminium", itemCount: 2, pointsAwarded: 16, occurredAt: "2024-05-11T09:00:00+08:00", verifiedAt: "2024-05-11T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1006", materialType: "paper", materialLabel: "Paper", itemCount: 2, pointsAwarded: 6, occurredAt: "2024-05-10T09:00:00+08:00", verifiedAt: "2024-05-10T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1007", materialType: "glass", materialLabel: "Glass", itemCount: 1, pointsAwarded: 10, occurredAt: "2024-05-09T09:00:00+08:00", verifiedAt: "2024-05-09T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1008", materialType: "plastic", materialLabel: "PET plastic", itemCount: 2, pointsAwarded: 10, occurredAt: "2024-05-08T09:00:00+08:00", verifiedAt: "2024-05-08T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1009", materialType: "aluminium", materialLabel: "Aluminium", itemCount: 2, pointsAwarded: 16, occurredAt: "2024-05-07T09:00:00+08:00", verifiedAt: "2024-05-07T09:01:00+08:00" },
  { ...olderPlastic, id: "DEP-1010", materialType: "plastic", materialLabel: "PET plastic", itemCount: 4, pointsAwarded: 20, occurredAt: "2024-05-06T09:00:00+08:00", verifiedAt: "2024-05-06T09:01:00+08:00" },
  { ...plasticToday, id: "DEP-1087", binId: "BIN-007", binLocation: "Town Square", materialType: "paper", materialLabel: "Paper", itemCount: 4, pointsAwarded: null, status: "review", occurredAt: "2024-05-16T09:08:00+08:00", verifiedAt: null },
  { ...plasticToday, id: "DEP-1081", residentId: "RES-000843", materialLabel: "Mixed plastic container", itemCount: 2, pointsAwarded: null, status: "review", occurredAt: "2024-05-20T09:46:00+08:00", verifiedAt: null }
];

const ticketsSeed: VerificationTicket[] = [
  { id: "REV-1087", transactionId: "DEP-1087", predictedMaterialType: "paper", predictedMaterialLabel: "Paper / mixed packaging", confidencePercent: 62, captureDescription: "Flattened drink carton", captureImageUrl: null, flag: "uncertain", status: "awaitingReview", reviewedAt: null, reviewedByAdminId: null },
  { id: "REV-1081", transactionId: "DEP-1081", predictedMaterialType: "plastic", predictedMaterialLabel: "Mixed plastic container", confidencePercent: 48, captureDescription: "Container with possible food residue", captureImageUrl: null, flag: "possibleContaminant", status: "awaitingReview", reviewedAt: null, reviewedByAdminId: null }
];

const categoriesSeed: RewardCategory[] = [
  { id: "food", label: "Food", sortOrder: 0 },
  { id: "shopping", label: "Shopping", sortOrder: 1 }
];

const rewardBase: Omit<RewardDocument, "id" | "title" | "pointsCost"> = {
  description: "Illustrative demo reward",
  merchantName: "Demo merchant",
  categoryId: "food",
  tag: null,
  imageUrl: null,
  expiresAt: "2024-06-30T23:59:59+08:00",
  isActive: true,
  maxRedemptionsPerResident: 1,
  artKey: "art0",
  sortOrder: 0
};

const rewardsSeed: RewardDocument[] = [
  { ...rewardBase, id: "RWD-SNACK", title: "Vending snack", pointsCost: 100, tag: "Popular" },
  { ...rewardBase, id: "RWD-CAFE", title: "RM5 café voucher", pointsCost: 200, tag: "Food & drink", artKey: "art1", sortOrder: 1 },
  { ...rewardBase, id: "RWD-MEAL", title: "Meal voucher", pointsCost: 350, tag: "Dining", artKey: "art2", sortOrder: 2 },
  { ...rewardBase, id: "RWD-SHOP", title: "RM10 shopping voucher", pointsCost: 500, categoryId: "shopping", tag: "Shopping", artKey: "art3", sortOrder: 3 },
  { ...rewardBase, id: "RWD-TOTE", title: "Township tote bag", pointsCost: 350, categoryId: "shopping", isActive: false, artKey: "art2", sortOrder: 4 }
];

const vouchersSeed: ResidentVoucher[] = [
  { id: "VCH-WELCOME", residentId: "RES-000842", rewardId: null, title: "RM3 Welcome voucher", merchantName: "Demo merchant", code: "ECO-WELCOME-842", terms: "One redemption at the demo merchant.", issuedAt: "2024-05-01T09:00:00+08:00", expiresAt: "2024-05-31T23:59:59+08:00", status: "available", remainingUses: 1, usedAt: null }
];

const programSettingsSeed: ProgramSettingsDocument = {
  id: "global",
  capacityAlertThreshold: 80,
  acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
  updatedAt: MOCK_NOW
};

const materialRatesSeed: MaterialRate[] = [
  { materialType: "plastic", displayName: "Plastic", pointsPerItem: 5, eligible: true },
  { materialType: "aluminium", displayName: "Aluminium", pointsPerItem: 8, eligible: true },
  { materialType: "paper", displayName: "Paper", pointsPerItem: 3, eligible: true },
  { materialType: "glass", displayName: "Glass", pointsPerItem: 10, eligible: true }
];

const adminSeed: AdminIdentity = { id: "ADM-001", fullName: "Jamie Lee", email: "admin@ecoloop.demo" };
const adminSessionSeed: AdminSession = { id: "ADMIN-DEMO-001", adminId: "ADM-001", isSignedIn: false, startedAt: MOCK_NOW };
const authStateSeed: AuthState = { uid: null, role: null, isSignedIn: false };

export function createSeedState(): MockSeedState {
  return {
    residents: JSON.parse(JSON.stringify(residentsSeed)),
    wallets: JSON.parse(JSON.stringify(walletsSeed)),
    bins: JSON.parse(JSON.stringify(binsSeed)),
    binOperations: JSON.parse(JSON.stringify(binOperationsSeed)),
    alerts: [],
    deposits: JSON.parse(JSON.stringify(depositsSeed)),
    tickets: JSON.parse(JSON.stringify(ticketsSeed)),
    categories: JSON.parse(JSON.stringify(categoriesSeed)),
    rewards: JSON.parse(JSON.stringify(rewardsSeed)),
    vouchers: JSON.parse(JSON.stringify(vouchersSeed)),
    redemptions: [],
    programSettings: JSON.parse(JSON.stringify(programSettingsSeed)),
    materialRates: JSON.parse(JSON.stringify(materialRatesSeed)),
    admin: JSON.parse(JSON.stringify(adminSeed)),
    adminSession: JSON.parse(JSON.stringify(adminSessionSeed)),
    authState: JSON.parse(JSON.stringify(authStateSeed)),
    decisionReceipts: {}
  };
}
