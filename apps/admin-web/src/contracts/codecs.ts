// =============================================================================
// codecs.ts — Zod schemas and typed codec functions
// Phase 2 — SDK-free; no Firebase imports; runtime validation only
// Rules:
//   - Required nullable keys use .nullable(), not .optional()
//   - Integer counts/points/rates/version use z.number().int()
//   - Capacity 0–100; confidence 0–100
//   - Unknown shared material/status/outcome/voucher values normalize to "unknown"
//   - Unknown ScanStage/role/admin workflow values FAIL (not normalised)
//   - URL fields: null or https string only
//   - Timestamp: ISO string | Date | {seconds:int,nanoseconds:int}
// =============================================================================

import { z } from "zod";
import type { ISODateTime, SharedRecords, SharedDocumentRecords } from "./shared.ts";
import type { AdminRecords, AdminDocumentRecords } from "./admin.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise an ISO instant, native Date, or Firestore-like {seconds, nanoseconds} to UTC ISO ms. */
export function normalizeTimestamp(value: unknown): ISODateTime {
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) return value.toISOString();
    throw new Error("Invalid Date object");
  }
  if (
    value !== null && typeof value === "object" &&
    "seconds" in value && "nanoseconds" in value
  ) {
    const v = value as { seconds: unknown; nanoseconds: unknown };
    if (
      typeof v.seconds === "number" && Number.isInteger(v.seconds) &&
      typeof v.nanoseconds === "number" && Number.isInteger(v.nanoseconds)
    ) {
      const ms = v.seconds * 1000 + Math.floor(v.nanoseconds / 1_000_000);
      return new Date(ms).toISOString();
    }
    throw new Error("Firestore-like {seconds,nanoseconds} must have integer fields");
  }
  throw new Error(`Cannot normalise timestamp: ${typeof value}`);
}

const isoDateTimeSchema = z.unknown().transform((v, ctx) => {
  try {
    return normalizeTimestamp(v);
  } catch (e) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: String(e) });
    return z.NEVER;
  }
}) as z.ZodType<ISODateTime, z.ZodTypeDef, unknown>;

const nullableUrl = z.union([z.null(), z.string().url().startsWith("https://")]);

const nonnegInt: z.ZodType<number, z.ZodTypeDef, unknown> = z.number().int().nonnegative();
const posInt: z.ZodType<number, z.ZodTypeDef, unknown> = z.number().int().positive();
const pct0to100: z.ZodType<number, z.ZodTypeDef, unknown> = z.number().int().min(0).max(100);

// Normalising fallback for unknown shared enum values
function normalizeUnknown<T extends string>(known: readonly T[], fallback: "unknown") {
  return z.string().transform((v) => (known.includes(v as T) ? (v as T) : fallback));
}

// ---------------------------------------------------------------------------
// Shared primitive schemas
// ---------------------------------------------------------------------------
const knownMaterials = ["plastic", "aluminium", "paper", "glass"] as const;
const materialTypeSchema = normalizeUnknown(knownMaterials, "unknown") as z.ZodType<
  "plastic" | "aluminium" | "paper" | "glass" | "unknown", z.ZodTypeDef, unknown
>;

const knownDepositStatuses = ["verified", "review", "rejected"] as const;
const depositStatusSchema = normalizeUnknown(knownDepositStatuses, "unknown") as z.ZodType<
  "verified" | "review" | "rejected" | "unknown", z.ZodTypeDef, unknown
>;

const knownDepositOutcomes = ["verified", "review", "rejected"] as const;
const depositOutcomeSchema = normalizeUnknown(knownDepositOutcomes, "unknown") as z.ZodType<
  "verified" | "review" | "rejected" | "unknown", z.ZodTypeDef, unknown
>;

const knownVoucherStatuses = ["available", "used", "expired"] as const;
const voucherStatusSchema = normalizeUnknown(knownVoucherStatuses, "unknown") as z.ZodType<
  "available" | "used" | "expired" | "unknown", z.ZodTypeDef, unknown
>;

// Strict enums — unknown values must FAIL
const appRoleSchema = z.enum(["user", "admin"]);
const scanStageSchema = z.enum(["binFound", "ready", "itemDetected", "processing", "completed", "cancelled"]);

// ---------------------------------------------------------------------------
// Private typed Zod object schemas (built first, then assigned to registries)
// ---------------------------------------------------------------------------

// --- Shared ---
const AuthStateSchema = z.object({
  uid: z.string().nullable(),
  role: z.union([appRoleSchema, z.null()]),
  isSignedIn: z.boolean(),
}).superRefine((v, ctx) => {
  if (v.isSignedIn && (v.uid === null || v.role === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Signed-in AuthState requires uid and role" });
  }
  if (!v.isSignedIn && (v.uid !== null || v.role !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Signed-out AuthState must have null uid and role" });
  }
});

const ResidentProfileSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  avatarUrl: nullableUrl,
  createdAt: isoDateTimeSchema,
});

const WalletDocumentSchema = z.object({
  residentId: z.string().min(1),
  balance: nonnegInt,
  updatedAt: isoDateTimeSchema,
  version: nonnegInt,
});

const WalletSnapshotSchema = z.object({
  residentId: z.string().min(1),
  balance: nonnegInt,
  nextRewardCost: z.union([posInt, z.null()]),
  updatedAt: isoDateTimeSchema,
  version: nonnegInt,
});

const DepositTransactionSchema = z.object({
  id: z.string().min(1),
  residentId: z.string().min(1),
  sessionId: z.string().nullable(),
  binId: z.string().min(1),
  binLocation: z.string().min(1),
  materialType: materialTypeSchema,
  materialLabel: z.string().min(1),
  itemCount: posInt,
  pointsAwarded: z.union([nonnegInt, z.null()]),
  status: depositStatusSchema,
  occurredAt: isoDateTimeSchema,
  verifiedAt: z.union([isoDateTimeSchema, z.null()]),
}).superRefine((v, ctx) => {
  if (v.status === "review" && v.pointsAwarded !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "review deposits must have null pointsAwarded" });
  }
  if (v.status === "review" && v.verifiedAt !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "review deposits must have null verifiedAt" });
  }
  if (v.status === "rejected" && v.pointsAwarded !== 0 && v.pointsAwarded !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "rejected deposits must have 0 or null pointsAwarded" });
  }
  if (v.status === "rejected" && v.verifiedAt !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "rejected deposits must have null verifiedAt" });
  }
});

const DepositFilterSchema = z.object({
  from: z.union([isoDateTimeSchema, z.null()]),
  toExclusive: z.union([isoDateTimeSchema, z.null()]),
  status: z.union([depositStatusSchema, z.null()]),
}).superRefine((v, ctx) => {
  if (v.from !== null && v.toExclusive !== null && v.from >= v.toExclusive) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "from must be before toExclusive" });
  }
});

const RecyclingSummarySchema: z.ZodType<import("./shared.ts").RecyclingSummary, z.ZodTypeDef, unknown> = z.object({
  verifiedDepositCount: nonnegInt,
  verifiedWeightKg: z.number().finite().nonnegative(),
}) as z.ZodType<import("./shared.ts").RecyclingSummary, z.ZodTypeDef, unknown>;

const RecyclingMaterialSchema = z.object({
  id: z.string().min(1),
  type: materialTypeSchema,
  title: z.string().min(1),
  preparationTip: z.string(),
  iconKey: z.string().min(1),
  sortOrder: nonnegInt,
});

const RecyclingStepSchema = z.object({
  id: z.string().min(1),
  order: posInt,
  instruction: z.string().min(1),
});

const MaterialRateSchema = z.object({
  materialType: materialTypeSchema,
  displayName: z.string().min(1),
  pointsPerItem: nonnegInt,
  eligible: z.boolean(),
});

const RecyclingGuideContentSchema = z.object({
  id: z.string().min(1),
  heroTitle: z.string().min(1),
  heroDescription: z.string(),
  toDo: z.array(z.string()),
  toAvoid: z.array(z.string()),
  pointsDisclaimer: z.string(),
});

const RecyclingGuideSchema = z.object({
  id: z.string().min(1),
  heroTitle: z.string().min(1),
  heroDescription: z.string(),
  materials: z.array(RecyclingMaterialSchema),
  toDo: z.array(z.string()),
  toAvoid: z.array(z.string()),
  steps: z.array(RecyclingStepSchema),
  rates: z.array(MaterialRateSchema),
  pointsDisclaimer: z.string(),
});

const SmartBinSchema = z.object({
  id: z.string().min(1),
  locationName: z.string().min(1),
  locationDetail: z.string(),
  capacityPercent: pct0to100,
  acceptedMaterials: z.array(materialTypeSchema),
  isOnline: z.boolean(),
  lastUpdatedAt: isoDateTimeSchema,
});

const ScanInstructionsSchema = z.object({
  id: z.string().min(1),
  scannerTitle: z.string(),
  scannerDescription: z.string(),
  binFoundTitle: z.string(),
  readyTitle: z.string(),
  readyDescription: z.string(),
  itemDetectedTitle: z.string(),
  itemDetectedDescription: z.string(),
  processingTitle: z.string(),
  processingDescription: z.string(),
  verifiedTitle: z.string(),
  reviewTitle: z.string(),
  rejectedTitle: z.string(),
  pointsTimingNotice: z.string(),
});

const DepositSessionSchema = z.object({
  id: z.string().min(1),
  residentId: z.string().min(1),
  binId: z.string().min(1),
  stage: scanStageSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  creationRequestId: z.string().min(1),
  resultId: z.string().nullable(),
});

const DepositResultSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  transactionId: z.string().min(1),
  outcome: depositOutcomeSchema,
  materialType: materialTypeSchema,
  materialLabel: z.string().min(1),
  itemCount: posInt,
  pointsAwarded: z.union([nonnegInt, z.null()]),
  classifiedAt: isoDateTimeSchema,
  explanation: z.string(),
});

const RewardCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  sortOrder: nonnegInt,
});

const RewardDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  merchantName: z.string().min(1),
  categoryId: z.string().min(1),
  tag: z.string().nullable(),
  imageUrl: nullableUrl,
  pointsCost: posInt,
  expiresAt: isoDateTimeSchema,
  isActive: z.boolean(),
  maxRedemptionsPerResident: posInt,
  artKey: z.string().min(1),
  sortOrder: nonnegInt,
});

const RewardSchema = RewardDocumentSchema.extend({
  residentRedemptionCount: nonnegInt,
});

const ResidentVoucherSchema = z.object({
  id: z.string().min(1),
  residentId: z.string().min(1),
  rewardId: z.string().nullable(),
  title: z.string().min(1),
  merchantName: z.string().min(1),
  code: z.string().min(1),
  terms: z.string(),
  issuedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  status: voucherStatusSchema,
  remainingUses: nonnegInt,
  usedAt: z.union([isoDateTimeSchema, z.null()]),
});

const RewardRedemptionSchema = z.object({
  id: z.string().min(1),
  residentId: z.string().min(1),
  rewardId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  pointsSpent: posInt,
  redeemedAt: isoDateTimeSchema,
  voucherId: z.string().min(1),
  walletBalanceAfter: nonnegInt,
  walletVersion: nonnegInt,
});

const RewardRedemptionReceiptSchema = z.object({
  redemption: RewardRedemptionSchema,
  voucher: ResidentVoucherSchema,
  wallet: WalletSnapshotSchema,
});

const ProfileUpdateRequestSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  avatarUrl: nullableUrl,
});

const AccountSecurityInfoSchema = z.object({
  residentId: z.string().min(1),
  passwordUpdatedAt: isoDateTimeSchema,
  isProtected: z.boolean(),
});

const PasswordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

const NotificationPreferencesSchema = z.object({
  residentId: z.string().min(1),
  recyclingUpdates: z.boolean(),
  pointsCredits: z.boolean(),
  rewardReminders: z.boolean(),
  updatedAt: isoDateTimeSchema,
});

const DemoSessionSchema = z.object({
  id: z.string().min(1),
  residentId: z.string().min(1),
  isSignedIn: z.boolean(),
  startedAt: isoDateTimeSchema,
});

// ---------------------------------------------------------------------------
// Admin private schemas
// ---------------------------------------------------------------------------
const collectionStatusSchema = z.enum(["notScheduled", "pending", "scheduled", "collected"]);
const alertStatusSchema = z.enum(["active", "resolved"]);
const verificationStatusSchema = z.enum(["awaitingReview", "approved", "rejected"]);
const verificationFlagSchema = z.enum(["uncertain", "possibleContaminant"]);

const BinOperationsSchema = z.object({
  binId: z.string().min(1),
  collectionStatus: collectionStatusSchema,
});

const CapacityAlertSchema = z.object({
  id: z.string().min(1),
  binId: z.string().min(1),
  status: alertStatusSchema,
  thresholdPercent: pct0to100,
  triggeredAt: isoDateTimeSchema,
  resolvedAt: z.union([isoDateTimeSchema, z.null()]),
});

const VerificationTicketSchema = z.object({
  id: z.string().min(1),
  transactionId: z.string().min(1),
  predictedMaterialType: materialTypeSchema,
  predictedMaterialLabel: z.string().min(1),
  confidencePercent: pct0to100,
  captureDescription: z.string(),
  captureImageUrl: nullableUrl,
  flag: verificationFlagSchema,
  status: verificationStatusSchema,
  reviewedAt: z.union([isoDateTimeSchema, z.null()]),
  reviewedByAdminId: z.string().nullable(),
});

const AdminIdentitySchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
});

const AdminSessionSchema = z.object({
  id: z.string().min(1),
  adminId: z.string().min(1),
  isSignedIn: z.boolean(),
  startedAt: isoDateTimeSchema,
});

const AdminLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ProgramSettingsDocumentSchema = z.object({
  id: z.literal("global"),
  capacityAlertThreshold: z.union([z.literal(75), z.literal(80), z.literal(85)]),
  acceptedMaterials: z.array(materialTypeSchema).min(1),
  updatedAt: isoDateTimeSchema,
});

const AdminSettingsSchema = ProgramSettingsDocumentSchema.extend({
  materialRates: z.array(MaterialRateSchema).min(1),
});

// ---------------------------------------------------------------------------
// Public schema registries
// ---------------------------------------------------------------------------
export const sharedSchemas: {
  [K in keyof SharedRecords]: z.ZodType<SharedRecords[K], z.ZodTypeDef, unknown>
} = {
  AuthState: AuthStateSchema,
  ResidentProfile: ResidentProfileSchema,
  WalletDocument: WalletDocumentSchema,
  WalletSnapshot: WalletSnapshotSchema,
  DepositTransaction: DepositTransactionSchema,
  DepositFilter: DepositFilterSchema,
  RecyclingSummary: RecyclingSummarySchema,
  RecyclingMaterial: RecyclingMaterialSchema,
  RecyclingStep: RecyclingStepSchema,
  MaterialRate: MaterialRateSchema,
  RecyclingGuide: RecyclingGuideSchema,
  RecyclingGuideContent: RecyclingGuideContentSchema,
  SmartBin: SmartBinSchema,
  ScanInstructions: ScanInstructionsSchema,
  DepositSession: DepositSessionSchema,
  DepositResult: DepositResultSchema,
  RewardCategory: RewardCategorySchema,
  Reward: RewardSchema,
  RewardDocument: RewardDocumentSchema,
  ResidentVoucher: ResidentVoucherSchema,
  RewardRedemption: RewardRedemptionSchema,
  RewardRedemptionReceipt: RewardRedemptionReceiptSchema,
  ProfileUpdateRequest: ProfileUpdateRequestSchema,
  AccountSecurityInfo: AccountSecurityInfoSchema,
  PasswordChangeRequest: PasswordChangeRequestSchema,
  NotificationPreferences: NotificationPreferencesSchema,
  DemoSession: DemoSessionSchema,
};

export const adminSchemas: {
  [K in keyof AdminRecords]: z.ZodType<AdminRecords[K], z.ZodTypeDef, unknown>
} = {
  BinOperations: BinOperationsSchema,
  CapacityAlert: CapacityAlertSchema,
  VerificationTicket: VerificationTicketSchema,
  AdminIdentity: AdminIdentitySchema,
  AdminSession: AdminSessionSchema,
  AdminLoginRequest: AdminLoginRequestSchema,
  AdminSettings: AdminSettingsSchema,
  ProgramSettingsDocument: ProgramSettingsDocumentSchema,
};

// ---------------------------------------------------------------------------
// ID field mapping for document codecs
// ---------------------------------------------------------------------------
function idFieldFor(kind: string): string {
  if (kind === "WalletDocument" || kind === "NotificationPreferences" || kind === "AccountSecurityInfo") return "residentId";
  if (kind === "MaterialRate") return "materialType";
  if (kind === "BinOperations") return "binId";
  return "id";
}

// ---------------------------------------------------------------------------
// Generic decode / encode helpers
// ---------------------------------------------------------------------------
export function decodeShared<K extends keyof SharedRecords>(
  kind: K,
  value: unknown
): SharedRecords[K] {
  const result = sharedSchemas[kind].safeParse(value);
  if (!result.success) throw new Error(`decodeShared(${kind}): ${result.error.message}`);
  return result.data;
}

export function encodeShared<K extends keyof SharedRecords>(
  _kind: K,
  value: SharedRecords[K]
): string {
  return JSON.stringify(value);
}

export function decodeAdmin<K extends keyof AdminRecords>(
  kind: K,
  value: unknown
): AdminRecords[K] {
  const result = adminSchemas[kind].safeParse(value);
  if (!result.success) throw new Error(`decodeAdmin(${kind}): ${result.error.message}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Document codecs — inject/verify document ID, normalise instant fields
// ---------------------------------------------------------------------------
export function decodeSharedDocument<K extends keyof SharedDocumentRecords>(
  kind: K,
  documentId: string,
  value: unknown
): SharedDocumentRecords[K] {
  if (typeof value !== "object" || value === null) {
    throw new Error(`decodeSharedDocument(${kind}): expected object`);
  }
  const field = idFieldFor(kind);
  const raw = value as Record<string, unknown>;
  if (raw[field] !== undefined && raw[field] !== documentId) {
    throw new Error(`decodeSharedDocument(${kind}): embedded ${field} "${raw[field]}" mismatches documentId "${documentId}"`);
  }
  const patched = { ...raw, [field]: documentId };
  return decodeShared(kind as keyof SharedRecords, patched) as SharedDocumentRecords[K];
}

export function encodeSharedDocument<K extends keyof SharedDocumentRecords>(
  _kind: K,
  value: SharedDocumentRecords[K]
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function decodeAdminDocument<K extends keyof AdminDocumentRecords>(
  kind: K,
  documentId: string,
  value: unknown
): AdminDocumentRecords[K] {
  if (typeof value !== "object" || value === null) {
    throw new Error(`decodeAdminDocument(${kind}): expected object`);
  }
  const field = idFieldFor(kind);
  const raw = value as Record<string, unknown>;
  if (raw[field] !== undefined && raw[field] !== documentId) {
    throw new Error(`decodeAdminDocument(${kind}): embedded ${field} "${raw[field]}" mismatches documentId "${documentId}"`);
  }
  const patched = { ...raw, [field]: documentId };
  return decodeAdmin(kind as keyof AdminRecords, patched) as AdminDocumentRecords[K];
}

export function encodeAdminDocument<K extends keyof AdminDocumentRecords>(
  _kind: K,
  value: AdminDocumentRecords[K]
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
