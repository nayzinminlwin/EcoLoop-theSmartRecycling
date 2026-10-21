import { randomBytes } from "node:crypto";
import type { Firestore, DocumentData } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { DomainError } from "../../domain/errors.js";
import type { RewardRedemption, RewardStore, VoucherUseResult } from "../../application/rewards.js";
import { canUseDemoVoucher, hasReachedResidentRewardLimit } from "../../domain/reward_policy.js";

export class FirestoreRewardsStore implements RewardStore {
  constructor(private readonly firestore: Firestore) {}

  async redeem(input: Parameters<RewardStore["redeem"]>[0]): Promise<RewardRedemption> {
    return this.firestore.runTransaction(async (transaction) => {
      const requestRef = this.firestore.doc(`rewardRequests/${input.uid}:${input.requestId}`);
      const rewardRef = this.firestore.doc(`rewards/${input.rewardId}`);
      const walletRef = this.firestore.doc(`residents/${input.uid}/wallet/current`);
      const statsRef = this.firestore.doc(`residents/${input.uid}/stats/current`);
      const redemptionQuery = this.firestore.collection("redemptions")
        .where("residentId", "==", input.uid)
        .where("rewardId", "==", input.rewardId);
      const [requestSnap, rewardSnap, walletSnap, statsSnap, redemptions] = await Promise.all([
        transaction.get(requestRef),
        transaction.get(rewardRef),
        transaction.get(walletRef),
        transaction.get(statsRef),
        transaction.get(redemptionQuery),
      ]);

      if (requestSnap.exists) {
        const prior = requestSnap.data()!;
        if (prior.payloadFingerprint !== input.payloadFingerprint) {
          throw new DomainError("idempotency_conflict", "The request key was already used with different details");
        }
        return redemptionFromRequest(prior, true);
      }
      if (!rewardSnap.exists) throw new DomainError("reward_unavailable", "Reward offer does not exist");
      const reward = rewardSnap.data()!;
      const offerVersion = String(reward.offerVersion ?? "");
      const cost = integer(reward.pointsCost);
      const expiresAt = Date.parse(String(reward.catalogExpiresAt ?? reward.expiresAt ?? ""));
      if (reward.isActive !== true || offerVersion !== input.offerVersion || cost !== input.displayedCost ||
          !Number.isFinite(expiresAt) || expiresAt <= Date.parse(input.now)) {
        throw new DomainError("offer_changed", "The reward offer has changed or expired", { retryability: "after_refresh" });
      }
      const wallet = walletSnap.data();
      const balance = integer(wallet?.balance);
      if (balance < cost) throw new DomainError("insufficient_points", "Not enough points for this reward");
      const max = integer(reward.maxRedemptionsPerResident ?? reward.residentLimit ?? 1);
      if (reward.demoOnly !== true) throw new DomainError("reward_unavailable", "This reward is not available in the demo");
      if (hasReachedResidentRewardLimit(redemptions.size, max)) throw new DomainError("redemption_limit_reached", "This reward limit has been reached");
      if (!statsSnap.exists) throw new DomainError("reward_unavailable", "Resident reward statistics are unavailable");

      const redemptionRef = this.firestore.collection("redemptions").doc();
      const voucherRef = this.firestore.collection("vouchers").doc();
      const entryRef = this.firestore.collection("walletEntries").doc();
      const voucherCode = `DEMO-${randomBytes(8).toString("hex").toUpperCase()}`;
      const expiry = new Date(Date.parse(input.now) + 30 * 24 * 60 * 60 * 1000).toISOString();
      const nextBalance = balance - cost;
      const nextVersion = integer(wallet?.version) + 1;
      const redemption = {
        id: redemptionRef.id, residentId: input.uid, rewardId: input.rewardId,
        offerVersion, cost, title: String(reward.title ?? ""), merchant: String(reward.merchant ?? ""),
        terms: String(reward.terms ?? ""), voucherId: voucherRef.id, requestId: input.requestId,
        createdAt: input.now, expiresAt: expiry,
      };
      transaction.create(redemptionRef, redemption);
      transaction.create(voucherRef, {
        id: voucherRef.id, residentId: input.uid, redemptionId: redemptionRef.id,
        rewardId: input.rewardId, code: voucherCode, demo: true, status: "available",
        title: redemption.title, merchant: redemption.merchant, terms: redemption.terms,
        offerVersion, issuedAt: input.now, expiresAt: expiry,
      });
      transaction.create(entryRef, {
        id: entryRef.id, residentId: input.uid, type: "reward_redemption",
        pointsDelta: -cost, sourceType: "redemption", sourceId: redemptionRef.id,
        balanceAfter: nextBalance, walletVersion: nextVersion, createdAt: input.now,
      });
      transaction.update(walletRef, { balance: nextBalance, version: nextVersion, updatedAt: input.now });
      transaction.update(statsRef, { rewardRedemptionCount: FieldValue.increment(1), updatedAt: input.now });
      transaction.update(rewardRef, { redemptionCount: FieldValue.increment(1) });
      transaction.create(requestRef, {
        payloadFingerprint: input.payloadFingerprint, redemptionId: redemptionRef.id,
        voucherId: voucherRef.id, voucherCode, rewardId: input.rewardId,
        offerVersion, cost, balance: nextBalance, expiresAt: expiry,
      });
      return {
        redemptionId: redemptionRef.id, voucherId: voucherRef.id, voucherCode,
        rewardId: input.rewardId, offerVersion, cost, balance: nextBalance,
        expiresAt: expiry, issuedAt: input.now, redeemedAt: input.now,
        walletVersion: nextVersion, title: redemption.title, merchant: redemption.merchant,
        terms: redemption.terms, replayed: false,
      };
    });
  }

  async useVoucher(input: Parameters<RewardStore["useVoucher"]>[0]): Promise<VoucherUseResult> {
    return this.firestore.runTransaction(async (transaction) => {
      const requestRef = this.firestore.doc(`voucherRequests/${input.uid}:${input.requestId}`);
      const voucherRef = this.firestore.doc(`vouchers/${input.voucherId}`);
      const usageRef = this.firestore.doc(`vouchers/${input.voucherId}/usage/${input.requestId}`);
      const [requestSnap, voucherSnap, usageSnap] = await Promise.all([
        transaction.get(requestRef), transaction.get(voucherRef), transaction.get(usageRef),
      ]);
      if (requestSnap.exists) {
        const prior = requestSnap.data()!;
        if (prior.payloadFingerprint !== input.payloadFingerprint) {
          throw new DomainError("idempotency_conflict", "The request key was already used with different details");
        }
        return { voucherId: input.voucherId, usedAt: String(prior.usedAt), replayed: true };
      }
      if (!voucherSnap.exists) throw new DomainError("reward_unavailable", "Voucher does not exist");
      const voucher = voucherSnap.data()!;
      if (voucher.residentId !== input.uid) throw new DomainError("permission_denied", "Voucher belongs to another resident");
      if (voucher.demo !== true) throw new DomainError("reward_unavailable", "Only demo vouchers can be simulated");
      if (voucher.status !== "available" || usageSnap.exists) throw new DomainError("voucher_used", "Voucher has already been used");
      if (!canUseDemoVoucher({
        demo: voucher.demo,
        status: String(voucher.status),
        expiresAt: String(voucher.expiresAt),
        now: input.now,
      })) throw new DomainError("voucher_expired", "Voucher has expired");
      transaction.create(usageRef, { id: usageRef.id, voucherId: input.voucherId, residentId: input.uid, usedAt: input.now, requestId: input.requestId });
      transaction.update(voucherRef, { status: "used", usedAt: input.now, updatedAt: input.now });
      transaction.create(requestRef, { payloadFingerprint: input.payloadFingerprint, voucherId: input.voucherId, usedAt: input.now });
      return { voucherId: input.voucherId, usedAt: input.now, replayed: false };
    });
  }

  async recover(uid: string, requestId: string): Promise<RewardRedemption | VoucherUseResult | null> {
    const rewardRequest = await this.firestore.doc(`rewardRequests/${uid}:${requestId}`).get();
    if (rewardRequest.exists) return redemptionFromRequest(rewardRequest.data()!, true);
    const voucherRequest = await this.firestore.doc(`voucherRequests/${uid}:${requestId}`).get();
    if (voucherRequest.exists) {
      const data = voucherRequest.data()!;
      return {
        voucherId: String(data.voucherId),
        usedAt: String(data.usedAt),
        replayed: true,
      };
    }
    return null;
  }
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function redemptionFromRequest(data: DocumentData, replayed: boolean): RewardRedemption {
  return {
    redemptionId: String(data.redemptionId), voucherId: String(data.voucherId),
    voucherCode: String(data.voucherCode), rewardId: String(data.rewardId),
    offerVersion: String(data.offerVersion), cost: integer(data.cost),
    balance: integer(data.balance), expiresAt: String(data.expiresAt), replayed,
    ...(typeof data.issuedAt === "string" ? { issuedAt: data.issuedAt } : {}),
    ...(typeof data.redeemedAt === "string" ? { redeemedAt: data.redeemedAt } : {}),
    ...(typeof data.walletVersion === "number" ? { walletVersion: data.walletVersion } : {}),
    ...(typeof data.title === "string" ? { title: data.title } : {}),
    ...(typeof data.merchant === "string" ? { merchant: data.merchant } : {}),
    ...(typeof data.terms === "string" ? { terms: data.terms } : {}),
  };
}
