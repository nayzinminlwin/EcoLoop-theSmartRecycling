import { createHash } from "node:crypto";
import type { DocumentData, DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import { DomainError } from "../../domain/errors.js";
import { createOperationIdentity, type OperationIdentity } from "../../domain/identity.js";
import type { Instant } from "../../domain/types.js";

const PROCESSING_SECONDS = 300;

export interface InspectionCommandIdentity {
  readonly uid: string;
  readonly requestId: string;
}

export interface InspectionSubmission {
  readonly batchId: string;
  readonly jobId: string;
  readonly resultId: string;
  readonly sessionId: string;
  readonly ownerId: string;
  readonly assetId: string;
  readonly assetVersion: string;
  readonly assetContentSha256: string;
  readonly policyVersion: string;
  readonly cycleId: string;
  readonly submittedAt: Instant;
  readonly deadlineAt: Instant;
  readonly traceId: string;
  readonly dispatchState: "pending";
  readonly operationState: "applied" | "replayed";
}

export interface InspectionStore {
  submitInspection(
    identity: InspectionCommandIdentity,
    sessionId: string,
    assetId: string,
    assetVersion: string,
    expectedVersion: number,
    now: Instant,
    traceId: string,
  ): Promise<InspectionSubmission>;
  recoverOperation(uid: string, operationRequestId: string): Promise<InspectionSubmission | null>;
}

export class FirestoreInspectionStore implements InspectionStore {
  constructor(private readonly firestore: Firestore) {}

  async submitInspection(
    identity: InspectionCommandIdentity,
    sessionId: string,
    assetId: string,
    assetVersion: string,
    expectedVersion: number,
    now: Instant,
    traceId: string,
  ): Promise<InspectionSubmission> {
    const payload = { sessionId, assetId, assetVersion, expectedVersion };
    const operation = createOperationIdentity(identity.uid, "submitInspection", identity.requestId, payload);
    const operationRef = this.operationRef(identity.uid, identity.requestId);
    const existing = await operationRef.get();
    if (existing.exists) return this.replayOperation(existing.data(), operation);

    const result = await this.firestore.runTransaction(async (transaction) => {
      const operationSnapshot = await transaction.get(operationRef);
      if (operationSnapshot.exists) return this.replayOperation(operationSnapshot.data(), operation);

      const sessionRef = this.firestore.doc(`depositSessions/${sessionId}`);
      const assetRef = this.firestore.doc(`simulationAssets/${assetId}`);
      const pointerRef = this.firestore.doc("policyPointers/active");
      const processingRef = this.firestore.doc("processingAvailability/global");
      const sessionSnapshot = await transaction.get(sessionRef);
      const session = requireData(sessionSnapshot.data(), "The scan session no longer exists");
      const actualReservationRef = this.firestore.doc(`binOperations/${String(session.binId)}`);
      const reservationSnapshot = await transaction.get(actualReservationRef);
      const assetSnapshot = await transaction.get(assetRef);
      const pointerSnapshot = await transaction.get(pointerRef);
      const policyId = pointerSnapshot.data()?.policyId;
      const policyRef = this.firestore.doc(`policies/${String(policyId ?? "")}`);
      const policySnapshot = await transaction.get(policyRef);
      const binRef = this.firestore.doc(`bins/${String(session.binId)}`);
      const binSnapshot = await transaction.get(binRef);
      const processingSnapshot = await transaction.get(processingRef);
      const existingBatchRef = session.batchId === null || session.batchId === undefined
        ? null
        : this.firestore.doc(`deposits/${String(session.batchId)}`);
      const existingBatchSnapshot = existingBatchRef === null ? null : await transaction.get(existingBatchRef);

      if (session.ownerId !== identity.uid) throw new DomainError("permission_denied", "This scan session belongs to another resident");
      if (session.batchId !== null && session.batchId !== undefined) {
        throw new DomainError("already_submitted", "This scan session has already been submitted");
      }
      if (session.stage !== "itemDetected") throw new DomainError("invalid_transition", "Only an itemDetected session can be submitted");
      if (session.version !== expectedVersion) {
        throw new DomainError("invalid_transition", "The scan session changed; refresh before submitting", {
          retryability: "after_refresh", details: { conflictVersion: Number(session.version) },
        });
      }
      if (existingBatchSnapshot?.exists) {
        throw new DomainError("already_submitted", "This scan session has already been submitted");
      }
      const reservation = reservationSnapshot.data();
      if (!reservationSnapshot.exists || reservation?.ownerId !== identity.uid || reservation?.sessionId !== sessionId ||
          reservation.phase !== "itemDetected" || isExpired(reservation.expiresAt, now)) {
        throw new DomainError("session_expired", "The scan reservation is no longer active", { retryability: "after_refresh" });
      }
      if (!assetSnapshot.exists || assetSnapshot.data()?.enabled !== true ||
          assetSnapshot.data()?.version !== assetVersion ||
          session.draftAssetId !== assetId || session.draftAssetVersion !== assetVersion) {
        throw new DomainError("asset_version_changed", "The selected image is not the current draft", { retryability: "after_refresh" });
      }
      if (processingSnapshot.exists && processingSnapshot.data()?.enabled === false) {
        throw new DomainError("processing_unavailable", "Image processing is temporarily unavailable", { retryability: "after_backoff" });
      }
      if (!pointerSnapshot.exists || typeof policyId !== "string" || !policySnapshot.exists) {
        throw new DomainError("processing_unavailable", "No active recycling policy is available", { retryability: "after_backoff" });
      }
      const bin = requireData(binSnapshot.data(), "The recycling bin no longer exists");
      if (typeof bin.cycleId !== "string") throw new DomainError("bin_unavailable", "The bin has no active collection cycle");

      const batchId = `deposit-${hash(`${identity.uid}:${sessionId}`)}`;
      const jobId = `job-${hash(batchId)}`;
      const resultId = `result-${hash(batchId)}`;
      const deadlineAt = addSeconds(now, PROCESSING_SECONDS);
      const asset = assetSnapshot.data()!;
      const policy = policySnapshot.data()!;
      const batchRef = this.firestore.doc(`deposits/${batchId}`);
      const jobRef = this.firestore.doc(`inferenceJobs/${jobId}`);
      const resultRef = this.firestore.doc(`depositResults/${resultId}`);
      const updatedSession = {
        ...session,
        stage: "processing",
        version: Number(session.version) + 1,
        batchId,
        jobId,
        resultId,
        submittedAt: now,
        updatedAt: now,
      };
      transaction.create(batchRef, {
        id: batchId, ownerId: identity.uid, sessionId, binId: session.binId, cycleId: bin.cycleId,
        assetId, assetVersion, assetContentSha256: asset.contentSha256, policyVersion: policy.id ?? policy.version,
        status: "processing", totalDetectedObjectCount: null, pointsAwarded: null,
        spaceContributionSpc: 0, decisionVersion: 0, createdAt: now,
      });
      transaction.create(jobRef, {
        id: jobId, batchId, sessionId, ownerId: identity.uid, source: {
          assetId, assetVersion, contentSha256: asset.contentSha256,
        },
        policyVersion: policy.id ?? policy.version, cycleId: bin.cycleId, state: "queued",
        submittedAt: now, deadlineAt, dispatchState: "pending", traceId,
        attemptCount: 0, createdAt: now,
      });
      transaction.create(resultRef, {
        id: resultId, ownerId: identity.uid, sessionId, batchId, outcome: "processing",
        pointsAwarded: null, spaceContributionSpc: 0, decisionVersion: 0,
        explanation: "Your image is being checked.", createdAt: now,
      });
      updateDocument(transaction, sessionRef, updatedSession);
      transaction.update(actualReservationRef, {
        phase: "processing", simulatedAccess: "closed", updatedAt: now,
      });
      transaction.create(operationRef, {
        ownerId: identity.uid, operation: "submitInspection", requestId: identity.requestId,
        payloadFingerprint: operation.payloadFingerprint, sessionId, batchId, jobId, resultId,
        assetId, assetVersion, assetContentSha256: String(asset.contentSha256),
        policyVersion: String(policy.id ?? policy.version), cycleId: String(bin.cycleId),
        submittedAt: now, deadlineAt, traceId, createdAt: now,
      });
      return submission({
        batchId, jobId, resultId, sessionId, ownerId: identity.uid, assetId, assetVersion,
        assetContentSha256: String(asset.contentSha256), policyVersion: String(policy.id ?? policy.version),
        cycleId: String(bin.cycleId), submittedAt: now, deadlineAt, traceId, dispatchState: "pending",
      }, "applied");
    });
    return result;
  }

  async recoverOperation(uid: string, operationRequestId: string): Promise<InspectionSubmission | null> {
    const snapshot = await this.operationRef(uid, operationRequestId).get();
    if (!snapshot.exists || snapshot.data()?.ownerId !== uid || snapshot.data()?.operation !== "submitInspection") return null;
    return this.replayOperation(snapshot.data(), null);
  }

  private operationRef(uid: string, requestId: string): DocumentReference {
    return this.firestore.doc(`residents/${uid}/inspectionOperations/${hash(requestId)}`);
  }

  private replayOperation(data: DocumentData | undefined, operation: OperationIdentity | null): InspectionSubmission {
    const value = requireData(data, "Stored submission operation is invalid");
    if (operation !== null && value.payloadFingerprint !== operation.payloadFingerprint) {
      throw new DomainError("idempotency_conflict", "The request ID was already used with a different payload");
    }
    return submission({
      batchId: String(value.batchId), jobId: String(value.jobId), resultId: String(value.resultId),
      sessionId: String(value.sessionId), ownerId: String(value.ownerId), assetId: String(value.assetId ?? ""),
      assetVersion: String(value.assetVersion ?? ""), assetContentSha256: String(value.assetContentSha256 ?? ""),
      policyVersion: String(value.policyVersion ?? ""), cycleId: String(value.cycleId ?? ""),
      submittedAt: String(value.submittedAt ?? value.createdAt), deadlineAt: String(value.deadlineAt ?? ""),
      traceId: String(value.traceId), dispatchState: "pending",
    }, "replayed");
  }
}

function submission(value: Omit<InspectionSubmission, "operationState">, operationState: InspectionSubmission["operationState"]): InspectionSubmission {
  return { ...value, operationState };
}

function requireData(value: DocumentData | undefined, message: string): DocumentData {
  if (value === undefined) throw new DomainError("invalid_input", message);
  return value;
}

function updateDocument(transaction: Transaction, reference: DocumentReference, value: DocumentData): void {
  transaction.update(reference, value);
}

function addSeconds(value: Instant, seconds: number): Instant {
  return new Date(Date.parse(value) + seconds * 1000).toISOString();
}

function isExpired(value: unknown, now: Instant): boolean {
  return typeof value !== "string" || Date.parse(value) <= Date.parse(now);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
