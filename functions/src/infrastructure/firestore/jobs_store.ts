import { createHash } from "node:crypto";
import type { DocumentData, DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import { DomainError } from "../../domain/errors.js";
import type { Instant } from "../../domain/types.js";

const MAX_ATTEMPTS = 3;
const LEASE_SECONDS = 90;
const ARTIFACT_ROOT = "vision-artifacts";

export interface WorkerIdentity {
  readonly subject: string;
  readonly issuer: string;
}

export interface JobClaim {
  readonly jobId: string;
  readonly batchId: string;
  readonly attemptId: string;
  readonly attemptNumber: number;
  readonly leaseExpiresAt: Instant;
  readonly deadlineAt: Instant;
  readonly source: {
    readonly assetId: string;
    readonly assetVersion: string;
    readonly contentSha256: string;
    readonly storagePath?: string;
    readonly storageGeneration?: string;
    readonly mimeType?: string;
  };
  readonly policyVersion: string;
  readonly configurationVersion: string;
  readonly artifactPrefix: string;
  readonly traceId: string;
  readonly state: "claimed" | "already_finalized";
}

export interface JobCheckpoint {
  readonly jobId: string;
  readonly attemptId: string;
  readonly stage: string;
  readonly outputReference: string;
  readonly state: "checkpointed";
}

export type ProgressPhase =
  | "queued"
  | "validating"
  | "detecting"
  | "additional_analysis"
  | "retrying"
  | "finalizing";

export interface JobProgress {
  readonly phase: ProgressPhase;
  readonly activity: string;
  readonly completedStages: readonly string[];
}

export interface JobReadResult {
  readonly jobId: string;
  readonly batchId: string;
  readonly state: string;
  readonly result: DocumentData | null;
  readonly attemptId: string | null;
}

export interface JobsStore {
  claim(jobId: string, identity: WorkerIdentity, now: Instant): Promise<JobClaim>;
  checkpoint(
    jobId: string,
    attemptId: string,
    identity: WorkerIdentity,
    stage: string,
    outputReference: string,
    now: Instant,
  ): Promise<JobCheckpoint>;
  progress(
    jobId: string,
    attemptId: string,
    identity: WorkerIdentity,
    progress: JobProgress,
    now: Instant,
  ): Promise<void>;
  renew(jobId: string, attemptId: string, identity: WorkerIdentity, now: Instant): Promise<JobClaim>;
  fail(jobId: string, attemptId: string, identity: WorkerIdentity, reason: string, now: Instant): Promise<JobReadResult>;
  readCurrentResult(jobId: string, identity: WorkerIdentity): Promise<JobReadResult>;
}

export class FirestoreJobsStore implements JobsStore {
  constructor(private readonly firestore: Firestore) {}

  claim(jobId: string, identity: WorkerIdentity, now: Instant): Promise<JobClaim> {
    return this.firestore.runTransaction(async (transaction) => {
      const jobRef = this.firestore.doc(`inferenceJobs/${jobId}`);
      const jobSnapshot = await transaction.get(jobRef);
      const job = requireJob(jobSnapshot.data(), jobId);
      const batchRef = this.firestore.doc(`deposits/${String(job.batchId)}`);
      const batchSnapshot = await transaction.get(batchRef);
      const resultRef = this.firestore.doc(`depositResults/result-${hash(String(job.batchId))}`);
      const resultSnapshot = await transaction.get(resultRef);
      if (resultSnapshot.exists && resultSnapshot.data()?.outcome !== "processing") {
        return claimFromJob(jobId, job, "already_finalized");
      }
      verifyIdentity(job, identity);
      const deadlineAt = String(job.deadlineAt);
      if (Date.parse(now) >= Date.parse(deadlineAt)) {
        throw new DomainError("session_expired", "The processing deadline has passed", { retryability: "never" });
      }
      const attemptCount = Number(job.attemptCount ?? 0);
      if (attemptCount >= MAX_ATTEMPTS) {
        throw new DomainError("processing_unavailable", "The processing attempt limit has been reached", { retryability: "never" });
      }
      const activeAttemptId = typeof job.activeAttemptId === "string" ? job.activeAttemptId : null;
      const activeLease = job.activeLeaseExpiresAt;
      if (activeAttemptId !== null && typeof activeLease === "string" && Date.parse(activeLease) > Date.parse(now)) {
        throw new DomainError("bin_busy", "This job is already leased by another execution", { retryability: "after_backoff" });
      }
      const attemptNumber = attemptCount + 1;
      const attemptId = `attempt-${hash(`${jobId}:${attemptNumber}`)}`;
      const leaseExpiresAt = addSeconds(now, LEASE_SECONDS);
      const artifactPrefix = `${ARTIFACT_ROOT}/${jobId}/${attemptId}/`;
      const attemptRef = this.firestore.doc(`inferenceJobs/${jobId}/attempts/${attemptId}`);
      const source = requireSource(job.source);
      const configurationVersion = String(job.configurationVersion ?? "demo-vision-v1");
      void batchSnapshot;
      transaction.create(attemptRef, {
        id: attemptId, attemptNumber, workerSubject: identity.subject, state: "claimed",
        claimedAt: now, leaseExpiresAt, source, policyVersion: String(job.policyVersion),
        configurationVersion, artifactPrefix,
      });
      transaction.update(jobRef, {
        state: "running", activeAttemptId: attemptId, activeLeaseExpiresAt: leaseExpiresAt,
        attemptCount: attemptNumber, lastStartedAt: now,
      });
      return {
        jobId, batchId: String(job.batchId), attemptId, attemptNumber, leaseExpiresAt,
        deadlineAt, source, policyVersion: String(job.policyVersion), configurationVersion,
        artifactPrefix, traceId: String(job.traceId), state: "claimed",
      };
    });
  }

  checkpoint(
    jobId: string,
    attemptId: string,
    identity: WorkerIdentity,
    stage: string,
    outputReference: string,
    now: Instant,
  ): Promise<JobCheckpoint> {
    return this.firestore.runTransaction(async (transaction) => {
      const jobRef = this.firestore.doc(`inferenceJobs/${jobId}`);
      const jobSnapshot = await transaction.get(jobRef);
      const job = requireJob(jobSnapshot.data(), jobId);
      const attemptRef = this.firestore.doc(`inferenceJobs/${jobId}/attempts/${attemptId}`);
      const attemptSnapshot = await transaction.get(attemptRef);
      const attempt = requireAttempt(attemptSnapshot.data(), attemptId);
      verifyIdentity(job, identity);
      verifyFence(job, attempt, now);
      if (!/^[a-z][a-z0-9_-]{1,31}$/.test(stage)) throw new DomainError("invalid_input", "Invalid checkpoint stage");
      if (!outputReference.startsWith(String(attempt.artifactPrefix))) {
        throw new DomainError("permission_denied", "Checkpoint output is outside the allowed artifact prefix");
      }

      transaction.set(attemptRef, {
        checkpoints: { [stage]: { outputReference, recordedAt: now } },
        updatedAt: now,
      }, { merge: true });
      transaction.update(jobRef, { lastStage: stage, updatedAt: now });
      return { jobId, attemptId, stage, outputReference, state: "checkpointed" };
    });
  }

  progress(
    jobId: string,
    attemptId: string,
    identity: WorkerIdentity,
    progress: JobProgress,
    now: Instant,
  ): Promise<void> {
    return this.firestore.runTransaction(async (transaction) => {
      const jobRef = this.firestore.doc(`inferenceJobs/${jobId}`);
      const jobSnapshot = await transaction.get(jobRef);
      const job = requireJob(jobSnapshot.data(), jobId);
      const attemptRef = this.firestore.doc(`inferenceJobs/${jobId}/attempts/${attemptId}`);
      const attemptSnapshot = await transaction.get(attemptRef);
      const attempt = requireAttempt(attemptSnapshot.data(), attemptId);
      verifyIdentity(job, identity);
      verifyFence(job, attempt, now);
      const sessionRef = this.firestore.doc(`depositSessions/${String(job.sessionId)}`);
      const sessionSnapshot = await transaction.get(sessionRef);
      const session = requireData(sessionSnapshot.data(), "The scan session no longer exists");
      const previous = session.progress;
      const revision = Number(previous?.revision ?? 0) + 1;
      const summary = {
        phase: progress.phase,
        activity: progress.activity.slice(0, 120),
        revision,
        attemptNumber: Number(attempt.attemptNumber ?? 0),
        completedStages: [...new Set(progress.completedStages)].slice(0, 5),
        submissionAt: String(previous?.submissionAt ?? session.submittedAt ?? now),
        stageStartedAt: now,
        updatedAt: now,
        deadlineAt: session.deadlineAt ?? job.deadlineAt ?? null,
      };
      transaction.update(sessionRef, { progress: summary, updatedAt: now });
      transaction.update(jobRef, {
        progress: summary,
        lastStage: progress.phase,
        updatedAt: now,
      });
    });
  }

  renew(jobId: string, attemptId: string, identity: WorkerIdentity, now: Instant): Promise<JobClaim> {
    return this.firestore.runTransaction(async (transaction) => {
      const jobRef = this.firestore.doc(`inferenceJobs/${jobId}`);
      const jobSnapshot = await transaction.get(jobRef);
      const job = requireJob(jobSnapshot.data(), jobId);
      const attemptRef = this.firestore.doc(`inferenceJobs/${jobId}/attempts/${attemptId}`);
      const attemptSnapshot = await transaction.get(attemptRef);
      const attempt = requireAttempt(attemptSnapshot.data(), attemptId);
      verifyIdentity(job, identity);
      verifyFence(job, attempt, now);
      const leaseExpiresAt = addSeconds(now, LEASE_SECONDS);
      transaction.update(attemptRef, { leaseExpiresAt, updatedAt: now });
      transaction.update(jobRef, { activeLeaseExpiresAt: leaseExpiresAt, updatedAt: now });
      return claimFromJob(
        jobId,
        { ...job, activeLeaseExpiresAt: leaseExpiresAt },
        "claimed",
        { ...attempt, leaseExpiresAt },
      );
    });
  }

  fail(jobId: string, attemptId: string, identity: WorkerIdentity, reason: string, now: Instant): Promise<JobReadResult> {
    return this.firestore.runTransaction(async (transaction) => {
      const jobRef = this.firestore.doc(`inferenceJobs/${jobId}`);
      const jobSnapshot = await transaction.get(jobRef);
      const job = requireJob(jobSnapshot.data(), jobId);
      const attemptRef = this.firestore.doc(`inferenceJobs/${jobId}/attempts/${attemptId}`);
      const attemptSnapshot = await transaction.get(attemptRef);
      const attempt = requireAttempt(attemptSnapshot.data(), attemptId);
      verifyIdentity(job, identity);
      verifyFence(job, attempt, now);
      const terminal = Date.parse(now) >= Date.parse(String(job.deadlineAt)) || Number(job.attemptCount) >= MAX_ATTEMPTS;
      const state = terminal ? "failed" : "retry_wait";
      transaction.update(attemptRef, { state: "failed", failureReason: reason.slice(0, 240), failedAt: now });
      transaction.update(jobRef, {
        state, activeAttemptId: null, activeLeaseExpiresAt: null, failureReason: reason.slice(0, 240), updatedAt: now,
      });
      return { jobId, batchId: String(job.batchId), state, result: null, attemptId };
    });
  }

  async readCurrentResult(jobId: string, identity: WorkerIdentity): Promise<JobReadResult> {
    const jobSnapshot = await this.firestore.doc(`inferenceJobs/${jobId}`).get();
    const job = requireJob(jobSnapshot.data(), jobId);
    verifyIdentity(job, identity);
    const resultSnapshot = await this.firestore.doc(`depositResults/result-${hash(String(job.batchId))}`).get();
    return {
      jobId, batchId: String(job.batchId), state: String(job.state),
      result: resultSnapshot.exists ? resultSnapshot.data() ?? null : null,
      attemptId: typeof job.activeAttemptId === "string" ? job.activeAttemptId : null,
    };
  }
}

function requireJob(value: DocumentData | undefined, jobId: string): DocumentData {
  if (value === undefined) throw new DomainError("invalid_input", `Job ${jobId} does not exist`);
  return value;
}

function requireData(value: DocumentData | undefined, message: string): DocumentData {
  if (value === undefined) throw new DomainError("invalid_input", message);
  return value;
}

function requireAttempt(value: DocumentData | undefined, attemptId: string): DocumentData {
  if (value === undefined) throw new DomainError("invalid_input", `Attempt ${attemptId} does not exist`);
  return value;
}

function requireSource(value: unknown): {
  assetId: string;
  assetVersion: string;
  contentSha256: string;
  storagePath?: string;
  storageGeneration?: string;
  mimeType?: string;
} {
  if (value === null || typeof value !== "object") throw new DomainError("invalid_input", "Job source is invalid");
  const source = value as Record<string, unknown>;
  if (typeof source.assetId !== "string" || typeof source.assetVersion !== "string" ||
      typeof source.contentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.contentSha256)) {
    throw new DomainError("invalid_input", "Job source identity is invalid");
  }
  if (source.storagePath !== undefined && (typeof source.storagePath !== "string" || !source.storagePath.startsWith("simulation-assets/"))) {
    throw new DomainError("invalid_input", "Job source storage path is invalid");
  }
  if (source.storageGeneration !== undefined && (typeof source.storageGeneration !== "string" || !/^\d+$/.test(source.storageGeneration))) {
    throw new DomainError("invalid_input", "Job source generation is invalid");
  }
  if (source.mimeType !== undefined && (source.mimeType !== "image/jpeg" && source.mimeType !== "image/png" && source.mimeType !== "image/webp")) {
    throw new DomainError("invalid_input", "Job source MIME type is invalid");
  }
  return {
    assetId: source.assetId,
    assetVersion: source.assetVersion,
    contentSha256: source.contentSha256,
    ...(source.storagePath === undefined ? {} : { storagePath: source.storagePath }),
    ...(source.storageGeneration === undefined ? {} : { storageGeneration: source.storageGeneration }),
    ...(source.mimeType === undefined ? {} : { mimeType: source.mimeType }),
  };
}

function verifyIdentity(job: DocumentData, identity: WorkerIdentity): void {
  if (identity.subject.trim() === "" || identity.issuer.trim() === "" ||
      typeof job.workerIssuer !== "string" || typeof job.workerSubject !== "string" ||
      job.workerIssuer !== identity.issuer || job.workerSubject !== identity.subject) {
    throw new DomainError("permission_denied", "Worker identity is not authorized for this job");
  }
}

function verifyFence(job: DocumentData, attempt: DocumentData, now: Instant): void {
  if (job.activeAttemptId !== attempt.id || attempt.state !== "claimed") {
    throw new DomainError("invalid_transition", "The worker attempt is no longer active", { retryability: "after_refresh" });
  }
  if (typeof attempt.leaseExpiresAt !== "string" || Date.parse(attempt.leaseExpiresAt) <= Date.parse(now)) {
    throw new DomainError("session_expired", "The worker lease has expired", { retryability: "after_refresh" });
  }
  if (Date.parse(now) >= Date.parse(String(job.deadlineAt))) {
    throw new DomainError("session_expired", "The processing deadline has passed");
  }
}

function claimFromJob(
  jobId: string,
  job: DocumentData,
  state: "claimed" | "already_finalized",
  attempt?: DocumentData,
): JobClaim {
  const source = requireSource(job.source);
  const attemptId = attempt?.id ?? String(job.activeAttemptId ?? "");
  return {
    jobId, batchId: String(job.batchId), attemptId, attemptNumber: Number(attempt?.attemptNumber ?? job.attemptCount ?? 0),
    leaseExpiresAt: String(attempt?.leaseExpiresAt ?? job.activeLeaseExpiresAt ?? job.deadlineAt),
    deadlineAt: String(job.deadlineAt), source, policyVersion: String(job.policyVersion),
    configurationVersion: String(job.configurationVersion ?? "demo-vision-v1"),
    artifactPrefix: String(attempt?.artifactPrefix ?? `${ARTIFACT_ROOT}/${jobId}/${attemptId}/`),
    traceId: String(job.traceId), state,
  };
}

function addSeconds(value: Instant, seconds: number): Instant {
  return new Date(Date.parse(value) + seconds * 1000).toISOString();
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function updateDocument(transaction: Transaction, reference: DocumentReference, value: DocumentData): void {
  transaction.update(reference, value);
}
