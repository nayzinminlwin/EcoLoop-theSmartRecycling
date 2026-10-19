import { createHash } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FirestoreJobsStore, type WorkerIdentity } from "../../src/infrastructure/firestore/jobs_store.js";

const jobId = "job-worker-test";
const batchId = "deposit-worker-test";
const identity: WorkerIdentity = { subject: "worker-service", issuer: "trusted-issuer" };
const start = "2026-10-19T03:00:00.000Z";

let firestore: Firestore;
let app: ReturnType<typeof initializeApp>;
let jobs: FirestoreJobsStore;

beforeAll(() => {
  app = initializeApp({ projectId: "demo-ecoloop" }, `jobs-${Date.now()}`);
  firestore = getFirestore(app);
  jobs = new FirestoreJobsStore(firestore);
});

beforeEach(async () => {
  await firestore.recursiveDelete(firestore.collection("inferenceJobs"));
  await firestore.recursiveDelete(firestore.collection("deposits"));
  await firestore.recursiveDelete(firestore.collection("depositResults"));
  await seedJob();
});

afterAll(async () => {
  await deleteApp(app);
});

describe("fenced worker gateway state", () => {
  it("claims once, fences duplicate delivery, checkpoints only inside the artifact prefix, and renews", async () => {
    const claim = await jobs.claim(jobId, identity, start);
    expect(claim).toMatchObject({
      jobId, batchId, attemptNumber: 1, state: "claimed",
      policyVersion: "policy-v1", configurationVersion: "inspection-v1",
    });
    await expect(jobs.claim(jobId, identity, start)).rejects.toMatchObject({ code: "bin_busy" });
    const checkpoint = await jobs.checkpoint(
      jobId, claim.attemptId, identity, "detector_a",
      `${claim.artifactPrefix}detector-a.json`, "2026-10-19T03:00:10.000Z",
    );
    expect(checkpoint.state).toBe("checkpointed");
    await expect(jobs.checkpoint(
      jobId, claim.attemptId, identity, "detector_b", "other-job/output.json", "2026-10-19T03:00:11.000Z",
    )).rejects.toMatchObject({ code: "permission_denied" });
    const renewed = await jobs.renew(jobId, claim.attemptId, identity, "2026-10-19T03:00:40.000Z");
    expect(Date.parse(renewed.leaseExpiresAt)).toBeGreaterThan(Date.parse(claim.leaseExpiresAt));
  });

  it("allows a bounded retry after an expired lease and never exceeds three attempts", async () => {
    const first = await jobs.claim(jobId, identity, start);
    await expect(jobs.checkpoint(
      jobId, first.attemptId, identity, "late", `${first.artifactPrefix}late.json`, "2026-10-19T03:01:31.000Z",
    )).rejects.toMatchObject({ code: "session_expired" });
    const second = await jobs.claim(jobId, identity, "2026-10-19T03:01:31.000Z");
    expect(second.attemptNumber).toBe(2);
    await jobs.fail(jobId, second.attemptId, identity, "provider_timeout", "2026-10-19T03:01:32.000Z");
    const third = await jobs.claim(jobId, identity, "2026-10-19T03:01:33.000Z");
    expect(third.attemptNumber).toBe(3);
    await jobs.fail(jobId, third.attemptId, identity, "provider_timeout", "2026-10-19T03:01:34.000Z");
    await expect(jobs.claim(jobId, identity, "2026-10-19T03:01:35.000Z"))
      .rejects.toMatchObject({ code: "processing_unavailable" });
  });

  it("rejects a forged worker identity and a claim after the processing deadline", async () => {
    await expect(jobs.claim(jobId, { subject: "forged", issuer: "trusted-issuer" }, start))
      .rejects.toMatchObject({ code: "permission_denied" });
    await firestore.doc(`inferenceJobs/${jobId}`).update({ deadlineAt: "2026-10-19T03:00:01.000Z" });
    await expect(jobs.claim(jobId, identity, "2026-10-19T03:00:02.000Z"))
      .rejects.toMatchObject({ code: "session_expired" });
  });

  it("returns the finalized projection without claiming another attempt", async () => {
    await firestore.doc(`depositResults/result-${hash(batchId)}`).set({
      outcome: "verified", pointsAwarded: 5, decisionVersion: 1,
    });
    const result = await jobs.readCurrentResult(jobId, identity);
    expect(result).toMatchObject({ jobId, batchId, state: "queued", result: { outcome: "verified" } });
    await expect(jobs.claim(jobId, identity, start)).resolves.toMatchObject({ state: "already_finalized" });
  });
});

async function seedJob(): Promise<void> {
  await firestore.doc(`deposits/${batchId}`).set({ id: batchId, ownerId: "resident", status: "processing" });
  await firestore.doc(`inferenceJobs/${jobId}`).set({
    id: jobId, batchId, state: "queued", attemptCount: 0,
    source: { assetId: "asset-1", assetVersion: "v1", contentSha256: "a".repeat(64) },
    policyVersion: "policy-v1", configurationVersion: "inspection-v1",
    deadlineAt: "2026-10-19T03:05:00.000Z", traceId: "trace-worker-test",
    workerSubject: identity.subject, workerIssuer: identity.issuer,
  });
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
