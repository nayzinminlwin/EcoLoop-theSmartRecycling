import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { payloadFingerprint } from "../../src/domain/identity.js";
import { FirestoreRewardsStore } from "../../src/infrastructure/firestore/rewards_store.js";

const uid = "resident-concurrency";
const rewardId = "reward-concurrency";
const now = "2026-10-19T00:00:00.000Z";

let app: ReturnType<typeof initializeApp>;
let firestore: Firestore;
let rewards: FirestoreRewardsStore;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `concurrency-${Date.now()}`);
  firestore = getFirestore(app);
  rewards = new FirestoreRewardsStore(firestore);
});

beforeEach(async () => {
  for (const collection of ["rewardRequests", "redemptions", "vouchers", "walletEntries", "rewards", "residents"]) {
    await firestore.recursiveDelete(firestore.collection(collection));
  }
  await firestore.doc(`rewards/${rewardId}`).set({
    id: rewardId, offerVersion: "v1", pointsCost: 12, isActive: true, demoOnly: true,
    maxRedemptionsPerResident: 2, catalogExpiresAt: "2027-12-31T00:00:00.000Z",
  });
  await firestore.doc(`residents/${uid}/wallet/current`).set({ residentId: uid, balance: 20, version: 0 });
  await firestore.doc(`residents/${uid}/stats/current`).set({ residentId: uid, rewardRedemptionCount: 0 });
});

afterAll(async () => {
  await deleteApp(app);
});

describe("concurrent reward accounting", () => {
  it("serializes distinct spends and never allows a negative wallet", async () => {
    const spend = (requestId: string) => rewards.redeem({
      uid, requestId,
      payloadFingerprint: payloadFingerprint({ rewardId, offerVersion: "v1", displayedCost: 12 }),
      rewardId, offerVersion: "v1", displayedCost: 12, now,
    });

    const results = await Promise.allSettled([spend("spend-a"), spend("spend-b")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await firestore.doc(`residents/${uid}/wallet/current`).get()).data()).toMatchObject({
      balance: 8, version: 1,
    });
    expect((await firestore.collection("walletEntries").get()).size).toBe(1);
  });

  it("rejects a reused request key with a different payload", async () => {
    await rewards.redeem({
      uid, requestId: "same-key",
      payloadFingerprint: payloadFingerprint({ rewardId, offerVersion: "v1", displayedCost: 12 }),
      rewardId, offerVersion: "v1", displayedCost: 12, now,
    });

    await expect(rewards.redeem({
      uid, requestId: "same-key",
      payloadFingerprint: payloadFingerprint({ rewardId, offerVersion: "v1", displayedCost: 13 }),
      rewardId, offerVersion: "v1", displayedCost: 13, now,
    })).rejects.toMatchObject({ code: "idempotency_conflict" });
    expect((await firestore.doc(`residents/${uid}/wallet/current`).get()).data()?.balance).toBe(8);
  });
});
