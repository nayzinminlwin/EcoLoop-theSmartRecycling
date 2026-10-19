import { createOperationIdentity } from "../domain/identity.js";
import { DomainError } from "../domain/errors.js";
import type { Instant } from "../domain/types.js";

export interface RewardIdentity {
  readonly uid: string;
}

export interface RewardStore {
  redeem(input: {
    readonly uid: string;
    readonly requestId: string;
    readonly payloadFingerprint: string;
    readonly rewardId: string;
    readonly offerVersion: string;
    readonly displayedCost: number;
    readonly now: Instant;
  }): Promise<RewardRedemption>;
  useVoucher(input: {
    readonly uid: string;
    readonly requestId: string;
    readonly payloadFingerprint: string;
    readonly voucherId: string;
    readonly now: Instant;
  }): Promise<VoucherUseResult>;
  recover(uid: string, requestId: string): Promise<RewardRedemption | VoucherUseResult | null>;
}

export interface RewardRedemption {
  readonly redemptionId: string;
  readonly voucherId: string;
  readonly voucherCode: string;
  readonly rewardId: string;
  readonly offerVersion: string;
  readonly cost: number;
  readonly balance: number;
  readonly expiresAt: Instant;
  readonly issuedAt?: Instant;
  readonly redeemedAt?: Instant;
  readonly walletVersion?: number;
  readonly title?: string;
  readonly merchant?: string;
  readonly terms?: string;
  readonly replayed: boolean;
}

export interface VoucherUseResult {
  readonly voucherId: string;
  readonly usedAt: Instant;
  readonly replayed: boolean;
}

export async function redeemReward(
  store: RewardStore,
  identity: RewardIdentity,
  requestId: string,
  input: Record<string, unknown>,
  now: Instant,
): Promise<RewardRedemption> {
  const rewardId = requireString(input.rewardId, "rewardId");
  const offerVersion = requireString(input.offerVersion, "offerVersion");
  const displayedCost = requireInteger(input.displayedCost, "displayedCost");
  const operation = createOperationIdentity(identity.uid, "redeemReward", requestId, {
    rewardId,
    offerVersion,
    displayedCost,
  });
  return store.redeem({
    uid: identity.uid,
    requestId,
    payloadFingerprint: operation.payloadFingerprint,
    rewardId,
    offerVersion,
    displayedCost,
    now,
  });
}

export async function useDemoVoucher(
  store: RewardStore,
  identity: RewardIdentity,
  requestId: string,
  input: Record<string, unknown>,
  now: Instant,
): Promise<VoucherUseResult> {
  const voucherId = requireString(input.voucherId, "voucherId");
  const operation = createOperationIdentity(identity.uid, "useDemoVoucher", requestId, { voucherId });
  return store.useVoucher({
    uid: identity.uid,
    requestId,
    payloadFingerprint: operation.payloadFingerprint,
    voucherId,
    now,
  });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError("invalid_input", `${field} is required`);
  }
  return value.trim();
}

function requireInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new DomainError("invalid_input", `${field} must be a non-negative integer`);
  }
  return value;
}
