import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FirestoreJobsStore, type WorkerIdentity } from "../../src/infrastructure/firestore/jobs_store.js";

const jobId = "job-authorization";
const identity: WorkerIdentity = { subject: "worker-service", issuer: "trusted-issuer" };

let app: ReturnType<typeof initializeApp>;
let firestore: Firestore;
let jobs: FirestoreJobsStore;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `authorization-${Date.now()}`);
  firestore = getFirestore(app);
  jobs = new FirestoreJobsStore(firestore);
});

beforeEach(async () => {
  await firestore.recursiveDelete(firestore.collection("inferenceJobs"));
  await firestore.recursiveDelete(firestore.collection("deposits"));
  await firestore.doc(`deposits/deposit-${jobId}`).set({ ownerId: "resident-auth", status: "processing" });
  await firestore.doc(`inferenceJobs/${jobId}`).set({
    id: jobId, batchId: `deposit-${jobId}`, state: "queued", attemptCount: 0,
    source: { assetId: "asset-auth", assetVersion: "v1", contentSha256: "a".repeat(64) },
    policyVersion: "policy-v1", deadlineAt: "2026-10-19T06:00:00.000Z",
    traceId: "trace-auth", workerSubject: identity.subject, workerIssuer: identity.issuer,
  });
});

afterAll(async () => {
  await deleteApp(app);
});

describe("worker authorization boundary", () => {
  it("rejects a forged worker subject before creating an attempt", async () => {
    await expect(jobs.claim(jobId, { subject: "forged-worker", issuer: identity.issuer }, "2026-10-19T05:00:00.000Z"))
      .rejects.toMatchObject({ code: "permission_denied" });
    expect((await firestore.collection(`inferenceJobs/${jobId}/attempts`).get()).size).toBe(0);
  });

  it("accepts only the committed worker identity and fences a second claim", async () => {
    await expect(jobs.claim(jobId, identity, "2026-10-19T05:00:00.000Z")).resolves.toMatchObject({ state: "claimed" });
    await expect(jobs.claim(jobId, identity, "2026-10-19T05:00:01.000Z"))
      .rejects.toMatchObject({ code: "bin_busy" });
  });
});
