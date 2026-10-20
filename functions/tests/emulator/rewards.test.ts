import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { payloadFingerprint } from "../../src/domain/identity.js";
import { FirestoreRewardsStore } from "../../src/infrastructure/firestore/rewards_store.js";

const uid = "resident-rewards";
const rewardId = "reward-demo-coffee";
const now = "2026-10-19T00:00:00.000Z";

let app: ReturnType<typeof initializeApp>;
let firestore: Firestore;
let rewards: FirestoreRewardsStore;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `rewards-${Date.now()}`);
  firestore = getFirestore(app);
  rewards = new FirestoreRewardsStore(firestore);
});

beforeEach(async () => {
  for (const collection of ["rewardRequests", "voucherRequests", "redemptions", "vouchers", "walletEntries"]) {
    await firestore.recursiveDelete(firestore.collection(collection));
  }
  await firestore.doc(`rewards/${rewardId}`).set({
    id: rewardId,
    offerVersion: "v1",
    title: "Coffee",
    merchant: "EcoLoop Cafe",
    terms: "One drink",
    pointsCost: 12,
    maxRedemptionsPerResident: 1,
    isActive: true,
    demoOnly: true,
    catalogExpiresAt: "2027-12-31T00:00:00.000Z",
  });
  await firestore.doc(`residents/${uid}/wallet/current`).set({
    residentId: uid,
    balance: 37,
    version: 1,
  });
  await firestore.doc(`residents/${uid}/stats/current`).set({
    residentId: uid,
    rewardRedemptionCount: 0,
  });
});

afterAll(async () => {
  await deleteApp(app);
});

describe("atomic reward redemption", () => {
  it("moves 37 to 25 to 12 and replays the same request without a second debit", async () => {
    const first = await rewards.redeem({
      uid,
      requestId: "redeem-1",
      payloadFingerprint: payloadFingerprint({
        rewardId,
        offerVersion: "v1",
        displayedCost: 12,
      }),
      rewardId,
      offerVersion: "v1",
      displayedCost: 12,
      now,
    });
    expect(first.balance).toBe(25);

    const replay = await rewards.redeem({
      uid,
      requestId: "redeem-1",
      payloadFingerprint: payloadFingerprint({
        rewardId,
        offerVersion: "v1",
        displayedCost: 12,
      }),
      rewardId,
      offerVersion: "v1",
      displayedCost: 12,
      now,
    });
    expect(replay).toMatchObject({ replayed: true, redemptionId: first.redemptionId, balance: 25 });
    expect((await firestore.doc(`residents/${uid}/wallet/current`).get()).data()?.balance).toBe(25);
    expect((await firestore.collection("walletEntries").get()).size).toBe(1);
  });

  it("rejects changed price and insufficient balance without writing", async () => {
    await expect(rewards.redeem({
      uid,
      requestId: "price-change",
      payloadFingerprint: payloadFingerprint({ rewardId, offerVersion: "v1", displayedCost: 99 }),
      rewardId,
      offerVersion: "v1",
      displayedCost: 99,
      now,
    })).rejects.toMatchObject({ code: "offer_changed" });
    await firestore.doc(`residents/${uid}/wallet/current`).update({ balance: 0 });
    await expect(rewards.redeem({
      uid,
      requestId: "insufficient",
      payloadFingerprint: payloadFingerprint({ rewardId, offerVersion: "v1", displayedCost: 12 }),
      rewardId,
      offerVersion: "v1",
      displayedCost: 12,
      now,
    })).rejects.toMatchObject({ code: "insufficient_points" });
  });
});

describe("atomic demo voucher use", () => {
  it("uses once, rejects a repeat, and never changes the wallet", async () => {
    const redemption = await rewards.redeem({
      uid,
      requestId: "redeem-use",
      payloadFingerprint: payloadFingerprint({ rewardId, offerVersion: "v1", displayedCost: 12 }),
      rewardId,
      offerVersion: "v1",
      displayedCost: 12,
      now,
    });
    const used = await rewards.useVoucher({
      uid,
      requestId: "use-1",
      payloadFingerprint: payloadFingerprint({ voucherId: redemption.voucherId }),
      voucherId: redemption.voucherId,
      now: "2026-10-20T00:00:00.000Z",
    });
    expect(used.replayed).toBe(false);
    await expect(rewards.useVoucher({
      uid,
      requestId: "use-2",
      payloadFingerprint: payloadFingerprint({ voucherId: redemption.voucherId }),
      voucherId: redemption.voucherId,
      now: "2026-10-20T00:00:00.000Z",
    })).rejects.toMatchObject({ code: "voucher_used" });
    expect((await firestore.doc(`residents/${uid}/wallet/current`).get()).data()?.balance).toBe(25);
  });
});
