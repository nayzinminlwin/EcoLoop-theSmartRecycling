import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FirestoreSettlementStore } from "../../src/infrastructure/firestore/settlement_store.js";
import type { WorkerFinding, WorkerFindings } from "../../src/domain/types.js";
import type { WorkerIdentity } from "../../src/infrastructure/firestore/jobs_store.js";

const jobId = "job-settlement-test";
const batchId = "deposit-settlement-test";
const sessionId = "session-settlement-test";
const attemptId = "attempt-settlement-test";
const uid = "resident-settlement";
const binId = "bin-settlement";
const identity: WorkerIdentity = { subject: "worker-service", issuer: "trusted-issuer" };
const now = "2026-10-19T04:00:00.000Z";

let firestore: Firestore;
let app: ReturnType<typeof initializeApp>;
let settlements: FirestoreSettlementStore;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `settlement-${Date.now()}`);
  firestore = getFirestore(app, "ecoloop-db");
  settlements = new FirestoreSettlementStore(firestore);
});

beforeEach(async () => {
  for (const collection of ["inferenceJobs", "deposits", "depositResults", "depositSessions", "binOperations", "bins", "binCycles", "residents", "policies", "capacityEntries", "walletEntries", "reviewTickets", "notificationEvents"]) {
    await firestore.recursiveDelete(firestore.collection(collection));
  }
  await firestore.doc(`inferenceJobs/${jobId}`).set({
    id: jobId, batchId, sessionId, ownerId: uid, state: "running", activeAttemptId: attemptId,
    deadlineAt: "2026-10-19T04:05:00.000Z", traceId: "trace-settlement-test",
    workerSubject: identity.subject, workerIssuer: identity.issuer,
    source: { assetId: "asset-1", assetVersion: "v1", contentSha256: "a".repeat(64) },
    policyVersion: "policy-v1", cycleId: "cycle-1",
  });
  await firestore.doc(`inferenceJobs/${jobId}/attempts/${attemptId}`).set({
    id: attemptId, state: "claimed", leaseExpiresAt: "2026-10-19T04:01:30.000Z",
  });
  await firestore.doc(`deposits/${batchId}`).set({
    id: batchId, ownerId: uid, sessionId, binId, cycleId: "cycle-1",
    status: "processing", decisionVersion: 0, spaceContributionSpc: 0,
  });
  await firestore.doc(`depositResults/result-${hash(batchId)}`).set({
    id: `result-${hash(batchId)}`, ownerId: uid, batchId, outcome: "processing", decisionVersion: 0,
  });
  await firestore.doc(`depositSessions/${sessionId}`).set({
    id: sessionId, ownerId: uid, binId, stage: "processing", version: 3,
  });
  await firestore.doc(`binOperations/${binId}`).set({
    binId, ownerId: uid, sessionId, phase: "processing",
  });
  await firestore.doc(`bins/${binId}`).set({ id: binId, cycleId: "cycle-1", capacitySpc: 100, occupiedSpc: 10 });
  await firestore.doc("binCycles/cycle-1").set({ id: "cycle-1", binId, openingOccupiedSpc: 10, capacitySpc: 100, contributionTotalSpc: 0 });
  await firestore.doc(`residents/${uid}`).set({ activeSessionId: sessionId });
  await firestore.doc(`residents/${uid}/wallet/current`).set({ residentId: uid, balance: 37, version: 0 });
  await firestore.doc(`residents/${uid}/stats/current`).set({ residentId: uid, verifiedBatchCount: 0, acceptedItemCount: 0 });
  await firestore.doc("policies/policy-v1").set({
    id: "policy-v1", version: "policy-v1",
    acceptedObjectClasses: ["plastic_bottle", "aluminium_can", "glass_bottle", "paper_item", "paper_bag"],
    rewardCategoryByClass: {
      plastic_bottle: "plastic", aluminium_can: "aluminium", glass_bottle: "glass",
      paper_item: "paper", paper_bag: "paper", cardboard_item: "paper",
    },
    pointsPerItemByCategory: { plastic: 5, aluminium: 8, paper: 3, glass: 10 },
    spcPerItemByClass: { plastic_bottle: 10, aluminium_can: 6, paper_bag: 8, cardboard_item: 15 },
    defaultSpcPerRecognizedItem: 10, unresolvedSpcPerCandidate: 10, unreadableBatchSpc: 50,
  });
});

afterAll(async () => {
  await deleteApp(app);
});

describe("atomic inspection settlement", () => {
  it("adds ten points to a nonzero wallet and credits once", async () => {
    const completed = await settlements.finalizeInspection(input(resolvedFindings([
      finding("plastic_bottle"), finding("plastic_bottle"),
    ])));
    const replay = await settlements.finalizeInspection(input(resolvedFindings([
      finding("plastic_bottle"),
    ])));

    expect(completed).toMatchObject({ outcome: "verified", pointsAwarded: 10, spaceContributionSpc: 20, decisionVersion: 1 });
    expect(replay.replayed).toBe(true);
    expect((await firestore.collection("walletEntries").get()).size).toBe(1);
    expect((await firestore.collection("capacityEntries").get()).size).toBe(1);
    expect((await firestore.doc(`residents/${uid}/wallet/current`).get()).data()).toMatchObject({ balance: 47, version: 1 });
    expect((await firestore.doc(`residents/${uid}/stats/current`).get()).data()).toMatchObject({ verifiedBatchCount: 1, acceptedItemCount: 2 });
    expect((await firestore.doc(`bins/${binId}`).get()).data()).toMatchObject({ occupiedSpc: 30 });
    expect((await firestore.doc("binCycles/cycle-1").get()).data()).toMatchObject({ contributionTotalSpc: 20 });
    expect((await firestore.doc(`binOperations/${binId}`).get()).data()).toMatchObject({ phase: "available", ownerId: null, sessionId: null });
    expect((await firestore.doc(`depositSessions/${sessionId}`).get()).data()?.stage).toBe("completed");
    expect((await firestore.doc(`residents/${uid}`).get()).data()?.activeSessionId).toBeNull();
  });

  it("records excluded, empty, and unreadable semantics without positive credit", async () => {
    const excluded = await settlements.finalizeInspection(input(resolvedFindings([finding("cardboard_item", "excluded")])));
    expect(excluded).toMatchObject({ outcome: "rejected", pointsAwarded: 0, spaceContributionSpc: 15 });
    await resetForSecondScenario();
    const empty = await settlements.finalizeInspection(input({ ...emptyFindings(), jobId }));
    expect(empty).toMatchObject({ outcome: "empty", pointsAwarded: 0, spaceContributionSpc: 0 });
    await resetForSecondScenario();
    const unreadable = await settlements.finalizeInspection(input({ ...emptyFindings(), inventoryState: "unreadable", jobId }));
    expect(unreadable).toMatchObject({ outcome: "review", pointsAwarded: null, spaceContributionSpc: 50 });
    expect((await firestore.collection("walletEntries").get()).size).toBe(0);
  });

  it("fences an old attempt and corrects provisional review space by -2", async () => {
    await expect(settlements.finalizeInspection(input(resolvedFindings([finding("plastic_bottle")]), "attempt-old")))
      .rejects.toMatchObject({ code: "invalid_transition" });
    const review = await settlements.finalizeInspection(input({
      ...resolvedFindings([finding("plastic_bottle"), finding("plastic_bottle"), finding("unknown", "unresolved")]),
      jobId,
    }));
    expect(review).toMatchObject({ outcome: "review", spaceContributionSpc: 30 });
    expect((await firestore.doc(`residents/${uid}/wallet/current`).get()).data()).toMatchObject({ balance: 37, version: 0 });
    expect((await firestore.doc(`residents/${uid}/stats/current`).get()).data()).toMatchObject({ verifiedBatchCount: 0, acceptedItemCount: 0 });
    expect((await firestore.collection("walletEntries").get()).size).toBe(0);
    const corrected = await settlements.resolveReview({
      batchId, decisionVersion: 1,
      findings: resolvedFindings([finding("plastic_bottle"), finding("plastic_bottle"), finding("paper_bag")]),
      now, actorId: "operator-test",
    });
    expect(corrected).toMatchObject({ outcome: "verified", pointsAwarded: 13, spaceContributionSpc: 28, decisionVersion: 2 });
    expect((await firestore.collection("capacityEntries").get()).docs.map((doc) => doc.data().deltaSpc)).toEqual([30, -2]);
  });
});

function input(findings: WorkerFindings, overrideAttemptId = attemptId) {
  return {
    jobId, attemptId: overrideAttemptId, identity, findings,
    artifactReferences: [`vision-artifacts/${jobId}/${attemptId}/findings.json`],
    expectedDecisionVersion: 0, now,
  };
}

function resolvedFindings(findings: readonly WorkerFinding[]): WorkerFindings {
  return { schemaVersion: "backend.v1", source: "worker", jobId, attemptId, image: { assetId: "asset-1", assetVersion: "v1", contentSha256: "a".repeat(64), width: 100, height: 100 }, findings, inventoryState: "resolved" };
}

function emptyFindings(): WorkerFindings {
  return { ...resolvedFindings([]), inventoryState: "empty" };
}

function finding(resolution: WorkerFinding["resolution"], eligibility: WorkerFinding["eligibility"] = "eligible"): WorkerFinding {
  return {
    objectId: `${resolution}-${Math.random()}`,
    resolution,
    eligibility,
    box: { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.4 },
    evidence: { modelIds: ["waste-detection-0momv/6"], rawLabel: resolution },
    confidence: 0.9,
  };
}

async function resetForSecondScenario(): Promise<void> {
  await firestore.doc(`inferenceJobs/${jobId}`).update({ activeAttemptId: attemptId, state: "running" });
  await firestore.doc(`inferenceJobs/${jobId}/attempts/${attemptId}`).set({ id: attemptId, state: "claimed", leaseExpiresAt: "2026-10-19T04:01:30.000Z" });
  await firestore.doc(`deposits/${batchId}`).update({ status: "processing", decisionVersion: 0, spaceContributionSpc: 0 });
  await firestore.doc(`depositResults/result-${hash(batchId)}`).set({ id: `result-${hash(batchId)}`, outcome: "processing", decisionVersion: 0 });
  await firestore.doc(`depositSessions/${sessionId}`).update({ stage: "processing", version: 3 });
  await firestore.doc(`binOperations/${binId}`).set({ binId, ownerId: uid, sessionId, phase: "processing" });
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
