import { createHash } from "node:crypto";
import type { DocumentData, DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import { DomainError } from "../../domain/errors.js";
import { acceptedItemCountsFromLines, addAcceptedItemCounts } from "../../domain/material_counts.js";
import { calculateFinalization, initialPolicy, type PolicySnapshot } from "../../domain/policy.js";
import type { Instant, WorkerFindings } from "../../domain/types.js";
import type { WorkerIdentity } from "./jobs_store.js";

export interface FinalizeInspectionInput {
  readonly jobId: string;
  readonly attemptId: string;
  readonly identity: WorkerIdentity;
  readonly findings: WorkerFindings;
  readonly artifactReferences: readonly string[];
  readonly expectedDecisionVersion: number;
  readonly now: Instant;
}

export interface SettlementResult {
  readonly jobId: string;
  readonly batchId: string;
  readonly resultId: string;
  readonly outcome: string;
  readonly pointsAwarded: number | null;
  readonly spaceContributionSpc: number;
  readonly decisionVersion: number;
  readonly replayed: boolean;
}

export interface SettlementStore {
  finalizeInspection(input: FinalizeInspectionInput): Promise<SettlementResult>;
  finalizeExpiredJob(input: {
    readonly jobId: string;
    readonly now: Instant;
    readonly reason: "processing_deadline_elapsed" | "attempt_budget_exhausted";
  }): Promise<SettlementResult | null>;
  resolveReview(input: {
    readonly batchId: string;
    readonly decisionVersion: number;
    readonly findings: WorkerFindings;
    readonly now: Instant;
    readonly actorId: string;
  }): Promise<SettlementResult>;
}

export class FirestoreSettlementStore implements SettlementStore {
  constructor(private readonly firestore: Firestore) {}

  finalizeInspection(input: FinalizeInspectionInput): Promise<SettlementResult> {
    return this.firestore.runTransaction(async (transaction) => {
      const jobRef = this.firestore.doc(`inferenceJobs/${input.jobId}`);
      const jobSnapshot = await transaction.get(jobRef);
      const job = requireData(jobSnapshot.data(), "The inference job does not exist");
      const batchId = String(job.batchId);
      const batchRef = this.firestore.doc(`deposits/${batchId}`);
      const resultRef = this.firestore.doc(`depositResults/result-${hash(batchId)}`);
      const attemptRef = this.firestore.doc(`inferenceJobs/${input.jobId}/attempts/${input.attemptId}`);
      const sessionRef = this.firestore.doc(`depositSessions/${String(job.sessionId)}`);
      const batchSnapshot = await transaction.get(batchRef);
      const resultSnapshot = await transaction.get(resultRef);
      const attemptSnapshot = await transaction.get(attemptRef);
      const sessionSnapshot = await transaction.get(sessionRef);
      const session = requireData(sessionSnapshot.data(), "The deposit session does not exist");
      const reservationRef = this.firestore.doc(`binOperations/${String(session.binId)}`);
      const binRef = this.firestore.doc(`bins/${String(session.binId)}`);
      const cycleRef = this.firestore.doc(`binCycles/${String(job.cycleId)}`);
      const residentRef = this.firestore.doc(`residents/${String(job.ownerId)}`);
      const walletRef = this.firestore.doc(`residents/${String(job.ownerId)}/wallet/current`);
      const statsRef = this.firestore.doc(`residents/${String(job.ownerId)}/stats/current`);
      const reservationSnapshot = await transaction.get(reservationRef);
      const binSnapshot = await transaction.get(binRef);
      const cycleSnapshot = await transaction.get(cycleRef);
      const residentSnapshot = await transaction.get(residentRef);
      const walletSnapshot = await transaction.get(walletRef);
      const statsSnapshot = await transaction.get(statsRef);
      const policyRef = this.firestore.doc(`policies/${String(job.policyVersion)}`);
      const policySnapshot = await transaction.get(policyRef);

      if (resultSnapshot.exists && resultSnapshot.data()?.outcome !== "processing") {
        return resultResult(resultSnapshot.data(), input.jobId, batchId, true);
      }

      verifyWorker(input, job, attemptSnapshot.data(), batchSnapshot.data(), input.findings);
      if (Number(batchSnapshot.data()?.decisionVersion ?? 0) !== input.expectedDecisionVersion) {
        throw new DomainError("invalid_transition", "The inspection decision has changed", { retryability: "after_refresh" });
      }
      const policy = requirePolicy(policySnapshot.data());
      validateFindings(input.findings, policy);
      const deadlinePassed = Date.parse(input.now) >= Date.parse(String(job.deadlineAt));
      const plan = deadlinePassed
        ? { ...calculateFinalization(policy, "uncertain", input.findings.findings), status: "review" as const, pointsAwarded: null, reasonCodes: ["deadline_exceeded"] }
        : calculateFinalization(policy, input.findings.inventoryState, input.findings.findings);
      validateArtifacts(input.artifactReferences, input.jobId, input.attemptId);

      const decisionVersion = input.expectedDecisionVersion + 1;
      const outcome = plan.status;
      const wallet = walletSnapshot.data();
      const stats = statsSnapshot.data();
      const committedWalletVersion = plan.status === "verified"
        ? Number(wallet?.version ?? 0) + 1
        : Number(wallet?.version ?? 0);
      const committedWalletBalance = plan.status === "verified"
        ? Number(wallet?.balance ?? 0) + Number(plan.pointsAwarded ?? 0)
        : Number(wallet?.balance ?? 0);
      const committedVerifiedBatchCount = plan.status === "verified"
        ? Number(stats?.verifiedBatchCount ?? 0) + 1
        : Number(stats?.verifiedBatchCount ?? 0);
      const resultData = {
        id: resultRef.id, ownerId: String(job.ownerId), sessionId: String(job.sessionId),
        batchId, outcome, pointsAwarded: plan.pointsAwarded, spaceContributionSpc: plan.spaceContributionSpc,
        decisionVersion, policyVersion: policy.id,
        totalDetectedObjectCount: plan.totalDetectedObjectCount,
        acceptedItemCount: plan.acceptedCount,
        committedWalletVersion,
        committedWalletBalance,
        committedVerifiedBatchCount,
        explanation: plan.reasonCodes.join(",") || "Inspection completed.",
        lines: plan.lines, reasonCodes: plan.reasonCodes, traceId: String(job.traceId),
        createdAt: input.now, updatedAt: input.now,
      };
      const batchData = {
        status: outcome, totalDetectedObjectCount: plan.totalDetectedObjectCount,
        pointsAwarded: plan.pointsAwarded, spaceContributionSpc: plan.spaceContributionSpc,
        decisionVersion, lines: plan.lines, policyVersion: policy.id, updatedAt: input.now,
      };
      const capacityRef = this.firestore.doc(`capacityEntries/${batchId}-initial`);
      const notificationRef = this.firestore.doc(`notificationEvents/${batchId}-${decisionVersion}`);
      transaction.update(batchRef, batchData);
      transaction.set(resultRef, resultData);
      transaction.set(capacityRef, {
        id: capacityRef.id, binId: String(session.binId), cycleId: String(job.cycleId),
        batchId, deltaSpc: plan.spaceContributionSpc, kind: "initial",
        decisionVersion, createdAt: input.now,
      }, { merge: false });
      applyCapacity(transaction, binRef, cycleRef, binSnapshot.data(), cycleSnapshot.data(), String(job.cycleId), plan.spaceContributionSpc, input.now);
      if (plan.status === "review") {
        transaction.set(this.firestore.doc(`reviewTickets/${batchId}`), {
          id: batchId, batchId, sessionId: String(job.sessionId), ownerId: String(job.ownerId),
          reasonCodes: plan.reasonCodes, provisionalSpaceSpc: plan.spaceContributionSpc,
          heldPoints: null, decisionVersion, state: "open", createdAt: input.now,
        }, { merge: true });
      }
      transaction.set(notificationRef, {
        id: notificationRef.id, recipientUid: String(job.ownerId), batchId,
        outcome, pointsAwarded: plan.pointsAwarded, state: "pending", createdAt: input.now,
      }, { merge: true });
      if (plan.status === "verified" && plan.acceptedCount !== null && plan.acceptedCount > 0) {
        const wallet = requireData(walletSnapshot.data(), "Resident wallet does not exist");
        const stats = requireData(statsSnapshot.data(), "Resident stats do not exist");
        const acceptedItemCounts = acceptedItemCountsFromLines(plan.lines);
        const balance = Number(wallet.balance ?? 0);
        const nextVersion = Number(wallet.version ?? 0) + 1;
        if ((plan.pointsAwarded ?? 0) > 0) {
          transaction.update(walletRef, { balance: balance + plan.pointsAwarded!, version: nextVersion, updatedAt: input.now });
          transaction.create(this.firestore.doc(`walletEntries/${batchId}`), {
            id: batchId, residentId: String(job.ownerId), type: "deposit_credit",
            pointsDelta: plan.pointsAwarded, sourceType: "deposit", sourceId: batchId,
            balanceAfter: balance + plan.pointsAwarded!, walletVersion: nextVersion, createdAt: input.now,
          });
        }
        transaction.update(statsRef, {
          verifiedBatchCount: Number(stats.verifiedBatchCount ?? 0) + 1,
          acceptedItemCount: Number(stats.acceptedItemCount ?? 0) + Number(plan.acceptedCount ?? 0),
          acceptedItemCounts: addAcceptedItemCounts(stats.acceptedItemCounts, acceptedItemCounts),
          updatedAt: input.now,
        });
      }
      const reservation = reservationSnapshot.data() ?? {};
      if (reservation.ownerId === job.ownerId && reservation.sessionId === job.sessionId) {
        transaction.update(reservationRef, { phase: "available", ownerId: null, sessionId: null, expiresAt: null, updatedAt: input.now });
        transaction.update(sessionRef, { stage: plan.status === "review" ? "completed" : "completed", version: Number(session.version) + 1, updatedAt: input.now });
        if (residentSnapshot.exists && residentSnapshot.data()?.activeSessionId === job.sessionId) {
          transaction.update(residentRef, {
            activeSessionId: null,
            latestSubmittedDeposit: {
              sessionId: job.sessionId,
              batchId,
              resultId: resultRef.id,
              decisionVersion,
              updatedAt: input.now,
            },
            updatedAt: input.now,
          });
        } else if (residentSnapshot.exists) {
          transaction.set(residentRef, {
            latestSubmittedDeposit: {
              sessionId: job.sessionId,
              batchId,
              resultId: resultRef.id,
              decisionVersion,
              updatedAt: input.now,
            },
            updatedAt: input.now,
          }, { merge: true });
        }
      }
      transaction.update(jobRef, { state: "succeeded", activeAttemptId: null, activeLeaseExpiresAt: null, updatedAt: input.now });
      return { jobId: input.jobId, batchId, resultId: resultRef.id, outcome, pointsAwarded: plan.pointsAwarded, spaceContributionSpc: plan.spaceContributionSpc, decisionVersion, replayed: false };
    });
  }

  resolveReview(input: {
    readonly batchId: string;
    readonly decisionVersion: number;
    readonly findings: WorkerFindings;
    readonly now: Instant;
    readonly actorId: string;
  }): Promise<SettlementResult> {
    return this.firestore.runTransaction(async (transaction) => {
      const batchRef = this.firestore.doc(`deposits/${input.batchId}`);
      const resultRef = this.firestore.doc(`depositResults/result-${hash(input.batchId)}`);
      const ticketRef = this.firestore.doc(`reviewTickets/${input.batchId}`);
      const batchSnapshot = await transaction.get(batchRef);
      const resultSnapshot = await transaction.get(resultRef);
      const ticketSnapshot = await transaction.get(ticketRef);
      const batch = requireData(batchSnapshot.data(), "The deposit batch does not exist");
      const result = requireData(resultSnapshot.data(), "The deposit result does not exist");
      const ticket = requireData(ticketSnapshot.data(), "The review ticket does not exist");
      if (ticket.state !== "open" || Number(batch.decisionVersion) !== input.decisionVersion) {
        throw new DomainError("invalid_transition", "The review decision is no longer current");
      }
      const policySnapshot = await transaction.get(this.firestore.doc(`policies/${String(batch.policyVersion)}`));
      const policy = requirePolicy(policySnapshot.data());
      validateFindings(input.findings, policy);
      const plan = calculateFinalization(policy, input.findings.inventoryState, input.findings.findings);
      const nextVersion = input.decisionVersion + 1;
      const oldSpace = Number(batch.spaceContributionSpc ?? 0);
      const binRef = this.firestore.doc(`bins/${String(batch.binId)}`);
      const cycleRef = this.firestore.doc(`binCycles/${String(batch.cycleId)}`);
      const binSnapshot = await transaction.get(binRef);
      const cycleSnapshot = await transaction.get(cycleRef);
      const walletRef = this.firestore.doc(`residents/${String(batch.ownerId)}/wallet/current`);
      const walletSnapshot = await transaction.get(walletRef);
      const statsRef = this.firestore.doc(`residents/${String(batch.ownerId)}/stats/current`);
      const statsSnapshot = await transaction.get(statsRef);
      const bin = requireData(binSnapshot.data(), "The recycling bin does not exist");
      const delta = plan.spaceContributionSpc - oldSpace;
      const capacityRef = this.firestore.doc(`capacityEntries/${input.batchId}-review-${nextVersion}`);
      transaction.update(batchRef, { status: plan.status, pointsAwarded: plan.pointsAwarded, spaceContributionSpc: plan.spaceContributionSpc, lines: plan.lines, decisionVersion: nextVersion, updatedAt: input.now });
      const wallet = walletSnapshot.data();
      const stats = statsSnapshot.data();
      transaction.update(resultRef, {
        outcome: plan.status, pointsAwarded: plan.pointsAwarded,
        spaceContributionSpc: plan.spaceContributionSpc, decisionVersion: nextVersion,
        policyVersion: String(batch.policyVersion),
        totalDetectedObjectCount: plan.totalDetectedObjectCount,
        acceptedItemCount: plan.acceptedCount,
        committedWalletVersion: plan.status === "verified"
          ? Number(wallet?.version ?? 0) + 1
          : Number(wallet?.version ?? 0),
        committedWalletBalance: plan.status === "verified"
          ? Number(wallet?.balance ?? 0) + Number(plan.pointsAwarded ?? 0)
          : Number(wallet?.balance ?? 0),
        committedVerifiedBatchCount: plan.status === "verified"
          ? Number(stats?.verifiedBatchCount ?? 0) + 1
          : Number(stats?.verifiedBatchCount ?? 0),
        lines: plan.lines, updatedAt: input.now,
      });
      transaction.update(ticketRef, { state: "resolved", decisionVersion: nextVersion, resolvedBy: input.actorId, resolvedAt: input.now });
      transaction.create(capacityRef, { id: capacityRef.id, binId: String(batch.binId), cycleId: String(batch.cycleId), batchId: input.batchId, deltaSpc: delta, kind: "review_correction", decisionVersion: nextVersion, createdAt: input.now, historical: String(batch.cycleId) !== String(bin.cycleId) });
      applyCapacity(transaction, binRef, cycleRef, binSnapshot.data(), cycleSnapshot.data(), String(batch.cycleId), delta, input.now);
      if (plan.status === "verified" && plan.acceptedCount !== null && plan.acceptedCount > 0) {
        const stats = requireData(statsSnapshot.data(), "Resident stats do not exist");
        const acceptedItemCounts = acceptedItemCountsFromLines(plan.lines);
        transaction.update(statsRef, {
          verifiedBatchCount: Number(stats.verifiedBatchCount ?? 0) + 1,
          acceptedItemCount: Number(stats.acceptedItemCount ?? 0) + Number(plan.acceptedCount ?? 0),
          acceptedItemCounts: addAcceptedItemCounts(stats.acceptedItemCounts, acceptedItemCounts),
          updatedAt: input.now,
        });
      }
      if (plan.pointsAwarded !== null && plan.pointsAwarded > 0) {
        const wallet = requireData(walletSnapshot.data(), "Resident wallet does not exist");
        const nextWalletVersion = Number(wallet.version ?? 0) + 1;
        transaction.update(walletRef, { balance: Number(wallet.balance ?? 0) + plan.pointsAwarded, version: nextWalletVersion, updatedAt: input.now });
        transaction.create(this.firestore.doc(`walletEntries/${input.batchId}-review`), { residentId: batch.ownerId, type: "deposit_credit", pointsDelta: plan.pointsAwarded, sourceType: "deposit_review", sourceId: input.batchId, balanceAfter: Number(wallet.balance ?? 0) + plan.pointsAwarded, walletVersion: nextWalletVersion, createdAt: input.now });
      }
      transaction.set(this.firestore.doc(`notificationEvents/${input.batchId}-${nextVersion}`), {
        id: `${input.batchId}-${nextVersion}`, recipientUid: String(batch.ownerId), batchId: input.batchId,
        outcome: plan.status, pointsAwarded: plan.pointsAwarded, state: "pending", createdAt: input.now,
      }, { merge: true });
      return { jobId: String(result.jobId ?? ""), batchId: input.batchId, resultId: resultRef.id, outcome: plan.status, pointsAwarded: plan.pointsAwarded, spaceContributionSpc: plan.spaceContributionSpc, decisionVersion: nextVersion, replayed: false };
    });
  }

  finalizeExpiredJob(input: {
    readonly jobId: string;
    readonly now: Instant;
    readonly reason: "processing_deadline_elapsed" | "attempt_budget_exhausted";
  }): Promise<SettlementResult | null> {
    return this.firestore.runTransaction(async (transaction) => {
      const jobRef = this.firestore.doc(`inferenceJobs/${input.jobId}`);
      const job = requireData((await transaction.get(jobRef)).data(), "The inference job does not exist");
      const batchId = String(job.batchId);
      const batchRef = this.firestore.doc(`deposits/${batchId}`);
      const resultRef = this.firestore.doc(`depositResults/result-${hash(batchId)}`);
      const sessionRef = this.firestore.doc(`depositSessions/${String(job.sessionId)}`);
      const residentRef = this.firestore.doc(`residents/${String(job.ownerId)}`);
      const batch = requireData((await transaction.get(batchRef)).data(), "The deposit batch does not exist");
      const resultSnapshot = await transaction.get(resultRef);
      const sessionSnapshot = await transaction.get(sessionRef);
      const residentSnapshot = await transaction.get(residentRef);
      const session = sessionSnapshot.data();
      const reservationRef = session === undefined
        ? null
        : this.firestore.doc(`binOperations/${String(session.binId)}`);
      const reservationSnapshot = reservationRef === null
        ? null
        : await transaction.get(reservationRef);
      const existingResult = resultSnapshot.data();
      if (existingResult !== undefined && existingResult.outcome !== "processing") {
        return resultResult(existingResult, input.jobId, batchId, true);
      }
      const decisionVersion = Number(batch.decisionVersion ?? 0) + 1;
      transaction.update(jobRef, { state: "failed", activeAttemptId: null, activeLeaseExpiresAt: null, failureReason: input.reason, updatedAt: input.now });
      transaction.update(batchRef, {
        status: "review",
        pointsAwarded: null,
        spaceContributionSpc: 0,
        binLocation: String(session?.binLocation ?? session?.binId ?? batch.binId),
        totalDetectedObjectCount: null,
        lines: [],
        traceId: String(job.traceId),
        decisionVersion,
        updatedAt: input.now,
      });
      transaction.set(resultRef, {
        id: resultRef.id, ownerId: String(job.ownerId), sessionId: String(job.sessionId), batchId,
        outcome: "review", pointsAwarded: null, spaceContributionSpc: 0, decisionVersion,
        policyVersion: String(job.policyVersion), totalDetectedObjectCount: null, acceptedItemCount: null,
        explanation: input.reason, reasonCodes: [input.reason], traceId: String(job.traceId),
        createdAt: input.now, updatedAt: input.now,
      });
      transaction.set(this.firestore.doc(`reviewTickets/${batchId}`), {
        id: batchId, batchId, sessionId: String(job.sessionId), ownerId: String(job.ownerId),
        reasonCodes: [input.reason], provisionalSpaceSpc: 0, heldPoints: null,
        decisionVersion, state: "open", createdAt: input.now,
      }, { merge: true });
      transaction.set(this.firestore.doc(`notificationEvents/${batchId}-${decisionVersion}`), {
        id: `${batchId}-${decisionVersion}`, recipientUid: String(job.ownerId), batchId,
        outcome: "review", pointsAwarded: null, state: "pending", createdAt: input.now,
      }, { merge: true });
      const reservation = reservationSnapshot?.data();
      if (session !== undefined) {
        if (reservationRef !== null &&
            reservation?.ownerId === job.ownerId &&
            reservation?.sessionId === job.sessionId) {
          transaction.update(reservationRef, {
            phase: "available", ownerId: null, sessionId: null, expiresAt: null, updatedAt: input.now,
          });
        }
        transaction.update(sessionRef, {
          stage: "completed", version: Number(session.version ?? 0) + 1, updatedAt: input.now,
        });
        if (residentSnapshot.data()?.activeSessionId === job.sessionId) {
          transaction.update(residentRef, {
            activeSessionId: null,
            latestSubmittedDeposit: {
              sessionId: job.sessionId,
              batchId,
              resultId: resultRef.id,
              decisionVersion,
              updatedAt: input.now,
            },
            updatedAt: input.now,
          });
        } else if (residentSnapshot.exists) {
          transaction.set(residentRef, {
            latestSubmittedDeposit: {
              sessionId: job.sessionId,
              batchId,
              resultId: resultRef.id,
              decisionVersion,
              updatedAt: input.now,
            },
            updatedAt: input.now,
          }, { merge: true });
        }
      }
      return { jobId: input.jobId, batchId, resultId: resultRef.id, outcome: "review", pointsAwarded: null, spaceContributionSpc: 0, decisionVersion, replayed: false };
    });
  }
}

function verifyWorker(input: FinalizeInspectionInput, job: DocumentData, attempt: DocumentData | undefined, batch: DocumentData | undefined, findings: WorkerFindings): void {
  if (job.workerSubject !== input.identity.subject || job.workerIssuer !== input.identity.issuer) throw new DomainError("permission_denied", "Worker identity is not authorized");
  if (job.activeAttemptId !== input.attemptId || attempt?.state !== "claimed") throw new DomainError("invalid_transition", "The worker attempt is no longer active");
  if (typeof attempt.leaseExpiresAt !== "string" || Date.parse(attempt.leaseExpiresAt) <= Date.parse(input.now)) throw new DomainError("session_expired", "The worker lease has expired");
  if (String(findings.jobId) !== String(job.id) || String(findings.attemptId) !== input.attemptId) throw new DomainError("invalid_input", "Findings do not match the active job attempt");
  if (findings.image.assetId !== job.source.assetId || findings.image.assetVersion !== job.source.assetVersion || findings.image.contentSha256 !== job.source.contentSha256) throw new DomainError("invalid_input", "Findings source does not match the committed source");
  if (batch?.status !== "processing") throw new DomainError("invalid_transition", "The batch is not processing");
}

function validateArtifacts(references: readonly string[], jobId: string, attemptId: string): void {
  const prefix = `vision-artifacts/${jobId}/${attemptId}/`;
  if (references.length === 0 || references.some((reference) => !reference.startsWith(prefix))) {
    throw new DomainError("permission_denied", "Finalization artifacts are outside the active attempt scope");
  }
}

function requirePolicy(data: DocumentData | undefined): PolicySnapshot {
  if (data === undefined || typeof data.id !== "string" ||
      !Array.isArray(data.acceptedObjectClasses) ||
      typeof data.pointsPerItemByCategory !== "object" ||
      typeof data.spcPerItemByClass !== "object") {
    throw new DomainError("processing_unavailable", "The pinned recycling policy is missing or corrupt", {
      retryability: "after_backoff",
    });
  }
  return {
    ...initialPolicy(),
    id: data.id,
    acceptedObjectClasses: data.acceptedObjectClasses as PolicySnapshot["acceptedObjectClasses"],
    rewardCategoryByClass: data.rewardCategoryByClass ?? initialPolicy().rewardCategoryByClass,
    pointsPerItemByCategory: data.pointsPerItemByCategory,
    spcPerItemByClass: data.spcPerItemByClass,
    defaultSpcPerRecognizedItem: typeof data.defaultSpcPerRecognizedItem === "number"
      ? data.defaultSpcPerRecognizedItem : initialPolicy().defaultSpcPerRecognizedItem,
    unresolvedSpcPerCandidate: typeof data.unresolvedSpcPerCandidate === "number"
      ? data.unresolvedSpcPerCandidate : initialPolicy().unresolvedSpcPerCandidate,
    unreadableBatchSpc: typeof data.unreadableBatchSpc === "number"
      ? data.unreadableBatchSpc : initialPolicy().unreadableBatchSpc,
  };
}

function validateFindings(findings: WorkerFindings, policy: PolicySnapshot): void {
  if (findings.findings.length > 12) throw new DomainError("invalid_input", "The finding inventory exceeds the bounded object limit");
  if (findings.inventoryState === "empty" && findings.findings.length !== 0) {
    throw new DomainError("invalid_input", "An empty inventory cannot contain visible findings");
  }
  const ids = new Set<string>();
  for (const finding of findings.findings) {
    if (ids.has(finding.objectId)) throw new DomainError("invalid_input", "Finding object IDs must be unique");
    ids.add(finding.objectId);
    if (finding.evidence.modelIds.length < 1 || finding.evidence.modelIds.length > 8 ||
        finding.evidence.modelIds.some((modelId) => !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(modelId))) {
      throw new DomainError("invalid_input", "Finding model identity is invalid");
    }
    if (!Number.isFinite(finding.confidence) || finding.confidence < 0 || finding.confidence > 1) {
      throw new DomainError("invalid_input", "Finding confidence is outside the supported range");
    }
    if (finding.box !== null) {
      const values = [finding.box.x1, finding.box.y1, finding.box.x2, finding.box.y2];
      if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1) ||
          finding.box.x2 <= finding.box.x1 || finding.box.y2 <= finding.box.y1) {
        throw new DomainError("invalid_input", "Finding geometry is invalid");
      }
    }
    if (finding.eligibility === "eligible" && !policy.acceptedObjectClasses.includes(finding.resolution)) {
      throw new DomainError("invalid_input", "An unsupported class cannot be eligible");
    }
    if (finding.resolution === "unknown" && finding.eligibility !== "unresolved") {
      throw new DomainError("invalid_input", "Unknown findings must remain unresolved");
    }
  }
}

function applyCapacity(
  transaction: Transaction,
  binRef: DocumentReference,
  cycleRef: DocumentReference,
  binData: DocumentData | undefined,
  cycleData: DocumentData | undefined,
  cycleId: string,
  delta: number,
  now: Instant,
): void {
  if (cycleData === undefined || binData === undefined) {
    throw new DomainError("processing_unavailable", "The settlement cycle or bin record is missing", {
      retryability: "after_backoff",
    });
  }
  const contribution = Number(cycleData.contributionTotalSpc ?? 0) + delta;
  transaction.update(cycleRef, { contributionTotalSpc: contribution, updatedAt: now });
  if (String(binData.cycleId) === cycleId) {
    const capacity = Number(binData.capacitySpc);
    const occupied = Number(binData.occupiedSpc ?? 0) + delta;
    transaction.update(binRef, {
      occupiedSpc: occupied,
      capacityPercent: capacity > 0 ? Math.max(0, Math.min(100, Math.floor(occupied * 100 / capacity))) : 0,
      availability: occupied >= capacity ? "full" : "available",
      updatedAt: now,
    });
  }
}

function resultResult(data: DocumentData | undefined, jobId: string, batchId: string, replayed: boolean): SettlementResult {
  const value = requireData(data, "The stored result is invalid");
  return { jobId, batchId, resultId: String(value.id ?? `result-${hash(batchId)}`), outcome: String(value.outcome), pointsAwarded: value.pointsAwarded === null ? null : Number(value.pointsAwarded), spaceContributionSpc: Number(value.spaceContributionSpc ?? 0), decisionVersion: Number(value.decisionVersion ?? 0), replayed };
}

function requireData(value: DocumentData | undefined, message: string): DocumentData {
  if (value === undefined) throw new DomainError("invalid_input", message);
  return value;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
