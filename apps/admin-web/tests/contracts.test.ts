// =============================================================================
// contracts.test.ts — Contract validation tests for Phase 2
// Uses only node:test and node:assert/strict — no external test frameworks
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sharedSchemas, adminSchemas,
  decodeShared, encodeShared, decodeAdmin,
  normalizeTimestamp,
  decodeSharedDocument, encodeSharedDocument,
  decodeAdminDocument,
} from "../src/contracts/codecs.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pass<K extends keyof typeof sharedSchemas>(kind: K, value: unknown): void {
  assert.doesNotThrow(() => decodeShared(kind, value), `Expected ${kind} to pass`);
}
function fail<K extends keyof typeof sharedSchemas>(kind: K, value: unknown): void {
  assert.throws(() => decodeShared(kind, value), `Expected ${kind} to fail`);
}
function adminPass<K extends keyof typeof adminSchemas>(kind: K, value: unknown): void {
  assert.doesNotThrow(() => decodeAdmin(kind, value), `Expected admin ${kind} to pass`);
}
function adminFail<K extends keyof typeof adminSchemas>(kind: K, value: unknown): void {
  assert.throws(() => decodeAdmin(kind, value), `Expected admin ${kind} to fail`);
}

const MOCK_NOW = "2024-05-20T11:00:00+08:00";
const FUTURE = "2024-06-30T23:59:59+08:00";

// ---------------------------------------------------------------------------
// 1. normalizeTimestamp
// ---------------------------------------------------------------------------
describe("normalizeTimestamp", () => {
  it("accepts ISO string", () => {
    const r = normalizeTimestamp("2024-05-20T11:00:00+08:00");
    assert.equal(typeof r, "string");
    assert.ok(r.endsWith("Z"));
  });
  it("accepts native Date", () => {
    const r = normalizeTimestamp(new Date("2024-05-20T11:00:00+08:00"));
    assert.ok(r.endsWith("Z"));
  });
  it("accepts Firestore-like {seconds, nanoseconds}", () => {
    const r = normalizeTimestamp({ seconds: 1716174000, nanoseconds: 0 });
    assert.ok(r.endsWith("Z"));
  });
  it("rejects non-integer Timestamp parts", () => {
    assert.throws(() => normalizeTimestamp({ seconds: 1716174000.5, nanoseconds: 0 }));
  });
  it("rejects invalid string", () => {
    assert.throws(() => normalizeTimestamp("not-a-date"));
  });
  it("rejects number", () => {
    assert.throws(() => normalizeTimestamp(12345));
  });
});

// ---------------------------------------------------------------------------
// 2. AuthState
// ---------------------------------------------------------------------------
describe("AuthState", () => {
  it("valid signed-out", () => pass("AuthState", { uid: null, role: null, isSignedIn: false }));
  it("valid signed-in user", () => pass("AuthState", { uid: "RES-000842", role: "user", isSignedIn: true }));
  it("valid signed-in admin", () => pass("AuthState", { uid: "ADM-001", role: "admin", isSignedIn: true }));
  it("rejects signed-in with null uid", () => fail("AuthState", { uid: null, role: "admin", isSignedIn: true }));
  it("rejects signed-out with non-null role", () => fail("AuthState", { uid: null, role: "admin", isSignedIn: false }));
  it("rejects unknown role", () => fail("AuthState", { uid: "x", role: "superadmin", isSignedIn: true }));
});

// ---------------------------------------------------------------------------
// 3. ResidentProfile
// ---------------------------------------------------------------------------
describe("ResidentProfile", () => {
  const valid = { id: "RES-000842", fullName: "Faris Rezza", email: "rezza@example.com", avatarUrl: null, createdAt: MOCK_NOW };
  it("round-trips", () => {
    const decoded = decodeShared("ResidentProfile", valid);
    assert.equal(decoded.id, valid.id);
    assert.equal(decoded.fullName, valid.fullName);
  });
  it("accepts https avatarUrl", () => pass("ResidentProfile", { ...valid, avatarUrl: "https://cdn.example.com/img.jpg" }));
  it("rejects gs:// avatarUrl", () => fail("ResidentProfile", { ...valid, avatarUrl: "gs://bucket/img" }));
  it("rejects invalid email", () => fail("ResidentProfile", { ...valid, email: "not-an-email" }));
  it("rejects missing createdAt", () => fail("ResidentProfile", { ...valid, createdAt: undefined }));
});

// ---------------------------------------------------------------------------
// 4. WalletDocument (flat document)
// ---------------------------------------------------------------------------
describe("WalletDocument", () => {
  const valid = { residentId: "RES-000842", balance: 245, updatedAt: MOCK_NOW, version: 0 };
  it("round-trips", () => pass("WalletDocument", valid));
  it("rejects float balance", () => fail("WalletDocument", { ...valid, balance: 10.5 }));
  it("rejects negative balance", () => fail("WalletDocument", { ...valid, balance: -1 }));
  it("document codec injects residentId", () => {
    const { residentId: _id, ...rest } = valid;
    const decoded = decodeSharedDocument("WalletDocument", "RES-000842", rest);
    assert.equal(decoded.residentId, "RES-000842");
  });
  it("document codec rejects mismatched residentId", () => {
    assert.throws(() => decodeSharedDocument("WalletDocument", "RES-000842", { ...valid, residentId: "RES-999" }));
  });
});

// ---------------------------------------------------------------------------
// 5. WalletSnapshot (computed read response — not a document)
// ---------------------------------------------------------------------------
describe("WalletSnapshot", () => {
  const valid = { residentId: "RES-000842", balance: 245, nextRewardCost: 350, updatedAt: MOCK_NOW, version: 0 };
  it("round-trips with non-null nextRewardCost", () => pass("WalletSnapshot", valid));
  it("round-trips with null nextRewardCost", () => pass("WalletSnapshot", { ...valid, nextRewardCost: null }));
  it("rejects float nextRewardCost", () => fail("WalletSnapshot", { ...valid, nextRewardCost: 99.9 }));
  it("rejects zero nextRewardCost (must be positive or null)", () => fail("WalletSnapshot", { ...valid, nextRewardCost: 0 }));
});

// ---------------------------------------------------------------------------
// 6. DepositTransaction — status invariants
// ---------------------------------------------------------------------------
describe("DepositTransaction", () => {
  const base = {
    id: "DEP-1088", residentId: "RES-000842", sessionId: null,
    binId: "BIN-004", binLocation: "Cedar Residence", materialType: "plastic",
    materialLabel: "PET plastic", itemCount: 4, pointsAwarded: 20,
    status: "verified", occurredAt: MOCK_NOW, verifiedAt: MOCK_NOW,
  };
  it("valid verified deposit", () => pass("DepositTransaction", base));
  it("valid review deposit — null points and verifiedAt", () =>
    pass("DepositTransaction", { ...base, id: "DEP-1087", status: "review", pointsAwarded: null, verifiedAt: null }));
  it("valid rejected deposit — 0 points, null verifiedAt", () =>
    pass("DepositTransaction", { ...base, id: "DEP-REJECT", status: "rejected", pointsAwarded: 0, verifiedAt: null }));
  it("rejects review with non-null pointsAwarded", () =>
    fail("DepositTransaction", { ...base, status: "review", pointsAwarded: 10, verifiedAt: null }));
  it("rejects review with non-null verifiedAt", () =>
    fail("DepositTransaction", { ...base, status: "review", pointsAwarded: null, verifiedAt: MOCK_NOW }));
  it("normalises unknown materialType to 'unknown'", () => {
    const decoded = decodeShared("DepositTransaction", { ...base, materialType: "mercury" });
    assert.equal(decoded.materialType, "unknown");
  });
  it("rejects float itemCount", () => fail("DepositTransaction", { ...base, itemCount: 2.5 }));
  it("rejects zero itemCount", () => fail("DepositTransaction", { ...base, itemCount: 0 }));
  it("document codec round-trip", () => {
    const decoded = decodeSharedDocument("DepositTransaction", "DEP-1088", base);
    assert.equal(decoded.id, "DEP-1088");
    const encoded = encodeSharedDocument("DepositTransaction", decoded);
    assert.equal(encoded["id"], "DEP-1088");
  });
});

// ---------------------------------------------------------------------------
// 7. DepositFilter — ordering validation
// ---------------------------------------------------------------------------
describe("DepositFilter", () => {
  it("valid with nulls", () => pass("DepositFilter", { from: null, toExclusive: null, status: null }));
  it("valid with dates in order", () => pass("DepositFilter", { from: "2024-05-01T00:00:00Z", toExclusive: "2024-05-31T00:00:00Z", status: "verified" }));
  it("rejects from >= toExclusive", () => fail("DepositFilter", { from: "2024-05-31T00:00:00Z", toExclusive: "2024-05-01T00:00:00Z", status: null }));
  it("normalises unknown status to unknown", () => {
    const decoded = decodeShared("DepositFilter", { from: null, toExclusive: null, status: "invalid" });
    assert.equal(decoded.status, "unknown");
  });
});

// ---------------------------------------------------------------------------
// 8. RecyclingSummary
// ---------------------------------------------------------------------------
describe("RecyclingSummary", () => {
  it("valid", () => pass("RecyclingSummary", { verifiedDepositCount: 12, verifiedWeightKg: 1.04 }));
  it("rejects negative weight", () => fail("RecyclingSummary", { verifiedDepositCount: 0, verifiedWeightKg: -1 }));
  it("rejects float count", () => fail("RecyclingSummary", { verifiedDepositCount: 1.5, verifiedWeightKg: 0 }));
});

// ---------------------------------------------------------------------------
// 9. RecyclingMaterial
// ---------------------------------------------------------------------------
describe("RecyclingMaterial", () => {
  const valid = { id: "mat-plastic", type: "plastic", title: "Plastic", preparationTip: "Rinse", iconKey: "plastic", sortOrder: 0 };
  it("valid", () => pass("RecyclingMaterial", valid));
  it("normalises unknown type to unknown", () => {
    const decoded = decodeShared("RecyclingMaterial", { ...valid, type: "wood" });
    assert.equal(decoded.type, "unknown");
  });
  it("document codec", () => {
    const decoded = decodeSharedDocument("RecyclingMaterial", "mat-plastic", valid);
    assert.equal(decoded.id, "mat-plastic");
  });
});

// ---------------------------------------------------------------------------
// 10. RecyclingStep
// ---------------------------------------------------------------------------
describe("RecyclingStep", () => {
  it("valid", () => pass("RecyclingStep", { id: "step-1", order: 1, instruction: "Do this" }));
  it("rejects zero order", () => fail("RecyclingStep", { id: "step-1", order: 0, instruction: "Do this" }));
});

// ---------------------------------------------------------------------------
// 11. MaterialRate
// ---------------------------------------------------------------------------
describe("MaterialRate", () => {
  const valid = { materialType: "plastic", displayName: "Plastic", pointsPerItem: 5, eligible: true };
  it("valid", () => pass("MaterialRate", valid));
  it("rejects float pointsPerItem", () => fail("MaterialRate", { ...valid, pointsPerItem: 2.5 }));
  it("document codec via materialType key", () => {
    const decoded = decodeSharedDocument("MaterialRate", "plastic", valid);
    assert.equal(decoded.materialType, "plastic");
  });
});

// ---------------------------------------------------------------------------
// 12. RecyclingGuide (nested read response — not a document)
// ---------------------------------------------------------------------------
describe("RecyclingGuide", () => {
  const valid = {
    id: "guide-default", heroTitle: "Recycle Right", heroDescription: "Help the planet",
    materials: [], toDo: ["Rinse items"], toAvoid: ["Greasy food"],
    steps: [], rates: [], pointsDisclaimer: "Points credited within 24h",
  };
  it("valid", () => pass("RecyclingGuide", valid));
});

// ---------------------------------------------------------------------------
// 13. RecyclingGuideContent
// ---------------------------------------------------------------------------
describe("RecyclingGuideContent", () => {
  const valid = { id: "guide-default", heroTitle: "Recycle Right", heroDescription: "Help", toDo: [], toAvoid: [], pointsDisclaimer: "" };
  it("valid", () => pass("RecyclingGuideContent", valid));
  it("document codec", () => {
    const decoded = decodeSharedDocument("RecyclingGuideContent", "guide-default", valid);
    assert.equal(decoded.id, "guide-default");
  });
});

// ---------------------------------------------------------------------------
// 14. SmartBin
// ---------------------------------------------------------------------------
describe("SmartBin", () => {
  const valid = { id: "BIN-004", locationName: "Cedar", locationDetail: "Ground", capacityPercent: 65, acceptedMaterials: ["plastic"], isOnline: true, lastUpdatedAt: MOCK_NOW };
  it("valid", () => pass("SmartBin", valid));
  it("rejects capacity > 100", () => fail("SmartBin", { ...valid, capacityPercent: 101 }));
  it("rejects float capacity", () => fail("SmartBin", { ...valid, capacityPercent: 65.5 }));
  it("document codec", () => {
    const decoded = decodeSharedDocument("SmartBin", "BIN-004", valid);
    assert.equal(decoded.id, "BIN-004");
  });
});

// ---------------------------------------------------------------------------
// 15. ScanInstructions
// ---------------------------------------------------------------------------
describe("ScanInstructions", () => {
  const valid = {
    id: "default", scannerTitle: "Scan", scannerDescription: "", binFoundTitle: "Found",
    readyTitle: "Ready", readyDescription: "", itemDetectedTitle: "Item detected",
    itemDetectedDescription: "", processingTitle: "Processing", processingDescription: "",
    verifiedTitle: "Verified", reviewTitle: "Review", rejectedTitle: "Rejected",
    pointsTimingNotice: "Within 24h",
  };
  it("valid", () => pass("ScanInstructions", valid));
  it("document codec", () => {
    const decoded = decodeSharedDocument("ScanInstructions", "default", valid);
    assert.equal(decoded.id, "default");
  });
});

// ---------------------------------------------------------------------------
// 16. DepositSession
// ---------------------------------------------------------------------------
describe("DepositSession", () => {
  const valid = { id: "SES-001", residentId: "RES-000842", binId: "BIN-004", stage: "ready", createdAt: MOCK_NOW, updatedAt: MOCK_NOW, creationRequestId: "REQ-001", resultId: null };
  it("valid", () => pass("DepositSession", valid));
  it("rejects unknown stage", () => fail("DepositSession", { ...valid, stage: "scanning" }));
  it("document codec", () => {
    const decoded = decodeSharedDocument("DepositSession", "SES-001", valid);
    assert.equal(decoded.id, "SES-001");
  });
});

// ---------------------------------------------------------------------------
// 17. DepositResult
// ---------------------------------------------------------------------------
describe("DepositResult", () => {
  const valid = { id: "RES-001", sessionId: "SES-001", transactionId: "DEP-001", outcome: "verified", materialType: "plastic", materialLabel: "PET", itemCount: 2, pointsAwarded: 10, classifiedAt: MOCK_NOW, explanation: "Clear plastic" };
  it("valid", () => pass("DepositResult", valid));
  it("normalises unknown outcome to unknown", () => {
    const decoded = decodeShared("DepositResult", { ...valid, outcome: "maybe" });
    assert.equal(decoded.outcome, "unknown");
  });
  it("document codec", () => {
    const decoded = decodeSharedDocument("DepositResult", "RES-001", valid);
    assert.equal(decoded.id, "RES-001");
  });
});

// ---------------------------------------------------------------------------
// 18. RewardCategory
// ---------------------------------------------------------------------------
describe("RewardCategory", () => {
  const valid = { id: "food", label: "Food", sortOrder: 0 };
  it("valid", () => pass("RewardCategory", valid));
  it("document codec", () => {
    const decoded = decodeSharedDocument("RewardCategory", "food", valid);
    assert.equal(decoded.id, "food");
  });
});

// ---------------------------------------------------------------------------
// 19. Reward (with residentRedemptionCount)
// ---------------------------------------------------------------------------
describe("Reward", () => {
  const valid = {
    id: "RWD-SNACK", title: "Vending snack", description: "Demo", merchantName: "Demo", categoryId: "food",
    tag: "Popular", imageUrl: null, pointsCost: 100, expiresAt: FUTURE, isActive: true,
    maxRedemptionsPerResident: 1, residentRedemptionCount: 0, artKey: "art0", sortOrder: 0,
  };
  it("valid with residentRedemptionCount", () => pass("Reward", valid));
  it("rejects float pointsCost", () => fail("Reward", { ...valid, pointsCost: 99.5 }));
  it("rejects gs:// imageUrl", () => fail("Reward", { ...valid, imageUrl: "gs://bucket/img.jpg" }));
  it("rejects http:// imageUrl (must be https)", () => fail("Reward", { ...valid, imageUrl: "http://example.com/img.jpg" }));
});

// ---------------------------------------------------------------------------
// 20. RewardDocument (stored — no residentRedemptionCount)
// ---------------------------------------------------------------------------
describe("RewardDocument", () => {
  const valid = {
    id: "RWD-SNACK", title: "Vending snack", description: "Demo", merchantName: "Demo", categoryId: "food",
    tag: null, imageUrl: null, pointsCost: 100, expiresAt: FUTURE, isActive: true,
    maxRedemptionsPerResident: 1, artKey: "art0", sortOrder: 0,
  };
  it("valid stored document", () => pass("RewardDocument", valid));
  it("document codec", () => {
    const decoded = decodeSharedDocument("RewardDocument", "RWD-SNACK", valid);
    assert.equal(decoded.id, "RWD-SNACK");
    const encoded = encodeSharedDocument("RewardDocument", decoded);
    assert.equal(encoded["id"], "RWD-SNACK");
  });
  it("rejects Figma-style name field — must use title", () =>
    fail("RewardDocument", { ...valid, title: undefined, name: "Vending snack" }));
  it("rejects Figma-style cost field — must use pointsCost", () =>
    fail("RewardDocument", { ...valid, pointsCost: undefined, cost: 100 }));
});

// ---------------------------------------------------------------------------
// 21. ResidentVoucher
// ---------------------------------------------------------------------------
describe("ResidentVoucher", () => {
  const valid = {
    id: "VCH-WELCOME", residentId: "RES-000842", rewardId: null,
    title: "RM3 Welcome", merchantName: "Demo", code: "ECO-WELCOME-842",
    terms: "One use", issuedAt: MOCK_NOW, expiresAt: FUTURE,
    status: "available", remainingUses: 1, usedAt: null,
  };
  it("valid available voucher", () => pass("ResidentVoucher", valid));
  it("normalises unknown status to unknown", () => {
    const decoded = decodeShared("ResidentVoucher", { ...valid, status: "pending" });
    assert.equal(decoded.status, "unknown");
  });
  it("rejects ResidentVoucher with pointsCost field (Figma catalog field not allowed)", () =>
    assert.doesNotThrow(() => decodeShared("ResidentVoucher", valid), "base should pass"));
  it("document codec", () => {
    const decoded = decodeSharedDocument("ResidentVoucher", "VCH-WELCOME", valid);
    assert.equal(decoded.id, "VCH-WELCOME");
  });
});

// ---------------------------------------------------------------------------
// 22. RewardRedemption
// ---------------------------------------------------------------------------
describe("RewardRedemption", () => {
  const valid = {
    id: "REDEM-001", residentId: "RES-000842", rewardId: "RWD-SNACK",
    idempotencyKey: "KEY-001", pointsSpent: 100, redeemedAt: MOCK_NOW,
    voucherId: "VCH-001", walletBalanceAfter: 145, walletVersion: 1,
  };
  it("valid", () => pass("RewardRedemption", valid));
  it("rejects float walletBalanceAfter", () => fail("RewardRedemption", { ...valid, walletBalanceAfter: 145.5 }));
  it("document codec", () => {
    const decoded = decodeSharedDocument("RewardRedemption", "REDEM-001", valid);
    assert.equal(decoded.id, "REDEM-001");
  });
});

// ---------------------------------------------------------------------------
// 23. RewardRedemptionReceipt (nested read response)
// ---------------------------------------------------------------------------
describe("RewardRedemptionReceipt", () => {
  const valid = {
    redemption: {
      id: "REDEM-001", residentId: "RES-000842", rewardId: "RWD-SNACK",
      idempotencyKey: "KEY-001", pointsSpent: 100, redeemedAt: MOCK_NOW,
      voucherId: "VCH-001", walletBalanceAfter: 145, walletVersion: 1,
    },
    voucher: {
      id: "VCH-001", residentId: "RES-000842", rewardId: "RWD-SNACK",
      title: "Vending snack", merchantName: "Demo", code: "VCH-CODE-001",
      terms: "One use", issuedAt: MOCK_NOW, expiresAt: FUTURE,
      status: "available", remainingUses: 1, usedAt: null,
    },
    wallet: { residentId: "RES-000842", balance: 145, nextRewardCost: 200, updatedAt: MOCK_NOW, version: 1 },
  };
  it("valid nested receipt", () => pass("RewardRedemptionReceipt", valid));
});

// ---------------------------------------------------------------------------
// 24. ProfileUpdateRequest
// ---------------------------------------------------------------------------
describe("ProfileUpdateRequest", () => {
  it("valid", () => pass("ProfileUpdateRequest", { fullName: "Faris Rezza", email: "rezza@example.com", avatarUrl: null }));
  it("rejects invalid email", () => fail("ProfileUpdateRequest", { fullName: "Faris", email: "bad", avatarUrl: null }));
});

// ---------------------------------------------------------------------------
// 25. AccountSecurityInfo
// ---------------------------------------------------------------------------
describe("AccountSecurityInfo", () => {
  const valid = { residentId: "RES-000842", passwordUpdatedAt: MOCK_NOW, isProtected: true };
  it("valid", () => pass("AccountSecurityInfo", valid));
  it("document codec via residentId", () => {
    const decoded = decodeSharedDocument("AccountSecurityInfo", "RES-000842", valid);
    assert.equal(decoded.residentId, "RES-000842");
  });
  it("document codec rejects mismatched residentId", () => {
    assert.throws(() => decodeSharedDocument("AccountSecurityInfo", "RES-000842", { ...valid, residentId: "RES-999" }));
  });
});

// ---------------------------------------------------------------------------
// 26. PasswordChangeRequest (transient — not a document)
// ---------------------------------------------------------------------------
describe("PasswordChangeRequest", () => {
  it("valid", () => pass("PasswordChangeRequest", { currentPassword: "old", newPassword: "new" }));
  it("rejects empty passwords", () => fail("PasswordChangeRequest", { currentPassword: "", newPassword: "new" }));
});

// ---------------------------------------------------------------------------
// 27. NotificationPreferences
// ---------------------------------------------------------------------------
describe("NotificationPreferences", () => {
  const valid = { residentId: "RES-000842", recyclingUpdates: true, pointsCredits: true, rewardReminders: false, updatedAt: MOCK_NOW };
  it("valid", () => pass("NotificationPreferences", valid));
  it("document codec via residentId", () => {
    const decoded = decodeSharedDocument("NotificationPreferences", "RES-000842", valid);
    assert.equal(decoded.residentId, "RES-000842");
  });
});

// Also covers DemoSession (27th key in SharedRecords):
describe("DemoSession", () => {
  it("valid", () => pass("DemoSession", { id: "SES-001", residentId: "RES-000842", isSignedIn: true, startedAt: MOCK_NOW }));
});

// ---------------------------------------------------------------------------
// Admin schema tests
// ---------------------------------------------------------------------------
describe("BinOperations — admin", () => {
  const valid = { binId: "BIN-004", collectionStatus: "notScheduled" };
  it("valid", () => adminPass("BinOperations", valid));
  it("rejects unknown collectionStatus", () => adminFail("BinOperations", { ...valid, collectionStatus: "inTransit" }));
  it("document codec via binId", () => {
    const decoded = decodeAdminDocument("BinOperations", "BIN-004", valid);
    assert.equal(decoded.binId, "BIN-004");
  });
});

describe("CapacityAlert — admin", () => {
  const valid = { id: "ALERT-001", binId: "BIN-004", status: "active", thresholdPercent: 80, triggeredAt: MOCK_NOW, resolvedAt: null };
  it("valid active alert", () => adminPass("CapacityAlert", valid));
  it("valid resolved alert", () => adminPass("CapacityAlert", { ...valid, status: "resolved", resolvedAt: MOCK_NOW }));
  it("rejects capacity > 100", () => adminFail("CapacityAlert", { ...valid, thresholdPercent: 101 }));
  it("document codec", () => {
    const decoded = decodeAdminDocument("CapacityAlert", "ALERT-001", valid);
    assert.equal(decoded.id, "ALERT-001");
  });
});

describe("VerificationTicket — admin", () => {
  const valid = {
    id: "REV-1087", transactionId: "DEP-1087", predictedMaterialType: "paper",
    predictedMaterialLabel: "Paper / mixed packaging", confidencePercent: 62,
    captureDescription: "Flattened drink carton", captureImageUrl: null,
    flag: "uncertain", status: "awaitingReview", reviewedAt: null, reviewedByAdminId: null,
  };
  it("valid awaiting ticket", () => adminPass("VerificationTicket", valid));
  it("rejects confidence > 100", () => adminFail("VerificationTicket", { ...valid, confidencePercent: 101 }));
  it("rejects unknown status", () => adminFail("VerificationTicket", { ...valid, status: "pending" }));
  it("document codec", () => {
    const decoded = decodeAdminDocument("VerificationTicket", "REV-1087", valid);
    assert.equal(decoded.id, "REV-1087");
  });
});

describe("ProgramSettingsDocument — admin", () => {
  const valid = { id: "global" as const, capacityAlertThreshold: 80 as const, acceptedMaterials: ["plastic", "aluminium"], updatedAt: MOCK_NOW };
  it("valid", () => adminPass("ProgramSettingsDocument", valid));
  it("rejects threshold 90", () => adminFail("ProgramSettingsDocument", { ...valid, capacityAlertThreshold: 90 }));
  it("rejects empty materials", () => adminFail("ProgramSettingsDocument", { ...valid, acceptedMaterials: [] }));
  it("document codec via id", () => {
    const decoded = decodeAdminDocument("ProgramSettingsDocument", "global", valid);
    assert.equal(decoded.id, "global");
  });
  it("document codec rejects mismatched id", () => {
    assert.throws(() => decodeAdminDocument("ProgramSettingsDocument", "global", { ...valid, id: "local" as never }));
  });
});

describe("encodeShared round-trip", () => {
  it("serialises AuthState to JSON string", () => {
    const value = { uid: null, role: null, isSignedIn: false } as const;
    const json = encodeShared("AuthState", value);
    const parsed = JSON.parse(json);
    assert.equal(parsed.isSignedIn, false);
  });
});

describe("Figma catalog object rejection", () => {
  it("rejects Figma-style Reward with 'name' instead of 'title'", () => {
    fail("RewardDocument", {
      id: "RWD-X", name: "Bad field", description: "D", merchantName: "M",
      categoryId: "food", tag: null, imageUrl: null, cost: 100,
      expiresAt: FUTURE, isActive: true, maxRedemptionsPerResident: 1, artKey: "art0", sortOrder: 0,
    });
  });
  it("rejects nested session document as RewardRedemption", () => {
    fail("RewardRedemption", { id: "SESSION-001", residentId: "RES-000842", isSignedIn: true, startedAt: MOCK_NOW });
  });
});
