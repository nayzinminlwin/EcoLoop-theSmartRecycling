import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FirestoreMaintenanceStore } from "../../src/infrastructure/firestore/maintenance_store.js";
import { FirestoreSettlementStore } from "../../src/infrastructure/firestore/settlement_store.js";

const now = "2026-10-19T05:00:00.000Z";
const jobId = "job-reconciliation";
const batchId = "batch-reconciliation";

let app: ReturnType<typeof initializeApp>;
let firestore: Firestore;
let maintenance: FirestoreMaintenanceStore;
let settlement: FirestoreSettlementStore;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `reconciliation-${Date.now()}`);
  firestore = getFirestore(app);
  maintenance = new FirestoreMaintenanceStore(firestore);
  settlement = new FirestoreSettlementStore(firestore);
});

beforeEach(async () => {
  for (const collection of ["inferenceJobs", "deposits", "depositResults", "depositSessions", "binOperations", "residents"]) {
    await firestore.recursiveDelete(firestore.collection(collection));
  }
});

afterAll(async () => {
  await deleteApp(app);
});

describe("reconciliation and recovery", () => {
  it("holds a deadline-expired job without crediting or refunding points", async () => {
    await firestore.doc(`inferenceJobs/${jobId}`).set({
      id: jobId, batchId, ownerId: "resident-reconciliation", sessionId: "session-reconciliation",
      state: "running", attemptCount: 1, deadlineAt: "2026-10-19T04:00:00.000Z",
    });
    await firestore.doc(`deposits/${batchId}`).set({
      id: batchId, ownerId: "resident-reconciliation", decisionVersion: 0, status: "processing",
    });
    const summary = await maintenance.reconcileJobs(now, 10, settlement);

    expect(summary).toMatchObject({ jobsReferred: 1, jobsRecovered: 0 });
    expect((await firestore.doc(`inferenceJobs/${jobId}`).get()).data()).toMatchObject({
      state: "failed", failureReason: "processing_deadline_elapsed",
    });
    expect((await firestore.doc(`deposits/${batchId}`).get()).data()).toMatchObject({
      status: "review", pointsAwarded: null,
    });
    expect((await firestore.collection("walletEntries").get()).size).toBe(0);
  });

  it("releases only the matching stale reservation", async () => {
    await firestore.doc("depositSessions/session-expired").set({
      id: "session-expired", ownerId: "resident-reconciliation", binId: "bin-reconciliation",
      stage: "ready", version: 2,
    });
    await firestore.doc("binOperations/bin-reconciliation").set({
      ownerId: "resident-reconciliation", sessionId: "session-expired",
      phase: "reserved", expiresAt: "2026-10-19T04:00:00.000Z",
    });
    await firestore.doc("residents/resident-reconciliation").set({ activeSessionId: "session-expired" });

    expect(await maintenance.expireAbandonedReservations(now)).toBe(1);
    expect((await firestore.doc("depositSessions/session-expired").get()).data()).toMatchObject({
      stage: "cancelled", terminationReason: "reservation_expired",
    });
    expect((await firestore.doc("binOperations/bin-reconciliation").get()).data()).toMatchObject({
      phase: "available", ownerId: null, sessionId: null,
    });
    expect((await firestore.doc("residents/resident-reconciliation").get()).data()?.activeSessionId).toBeNull();
  });
});
