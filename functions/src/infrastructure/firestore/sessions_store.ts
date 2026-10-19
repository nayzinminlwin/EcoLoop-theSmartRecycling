import { createHash } from "node:crypto";
import type { DocumentData, DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import { DomainError } from "../../domain/errors.js";
import { createOperationIdentity, type OperationIdentity } from "../../domain/identity.js";
import type { BinSnapshot, DepositSession, Instant, SessionStage } from "../../domain/types.js";
import type { StructuredLogger } from "../logger.js";

const unsubmittedStages = new Set<SessionStage>(["binFound", "ready", "itemDetected"]);
const RESERVATION_SECONDS = 600;

export interface SessionCommandIdentity {
  readonly uid: string;
  readonly requestId: string;
}

export interface SessionCommandResult {
  readonly session: DepositSession;
  readonly bin: BinSnapshot | null;
  readonly operationState: "applied" | "replayed";
}

export interface SessionsStore {
  scanBinQr(identity: SessionCommandIdentity, qrPayload: string, now: Instant): Promise<SessionCommandResult>;
  confirmSession(identity: SessionCommandIdentity, sessionId: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult>;
  reportFinishPressed(identity: SessionCommandIdentity, sessionId: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult>;
  saveImageSelection(identity: SessionCommandIdentity, sessionId: string, assetId: string, assetVersion: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult>;
  renewSession(identity: SessionCommandIdentity, sessionId: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult>;
  cancelSession(identity: SessionCommandIdentity, sessionId: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult>;
  recoverOperation(identity: SessionCommandIdentity, operationRequestId: string): Promise<SessionCommandResult | null>;
}

export class FirestoreSessionsStore implements SessionsStore {
  constructor(private readonly firestore: Firestore, private readonly logger?: StructuredLogger) {}

  scanBinQr(identity: SessionCommandIdentity, qrPayload: string, now: Instant): Promise<SessionCommandResult> {
    return this.runOperation(identity, "scanBinQr", { qrPayload }, now, (transaction, operation) =>
      this.scan(transaction, identity.uid, operation, qrPayload, now));
  }

  async confirmSession(identity: SessionCommandIdentity, sessionId: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult> {
    const result = await this.runOperation(identity, "confirmSession", { sessionId, expectedVersion }, now, (transaction, operation) =>
      this.transition(transaction, identity.uid, operation, sessionId, expectedVersion, "binFound", "ready", now));
    return rejectExpiredResult(result);
  }

  async reportFinishPressed(identity: SessionCommandIdentity, sessionId: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult> {
    const result = await this.runOperation(identity, "reportFinishPressed", { sessionId, expectedVersion }, now, (transaction, operation) =>
      this.transition(transaction, identity.uid, operation, sessionId, expectedVersion, "ready", "itemDetected", now));
    return rejectExpiredResult(result);
  }

  saveImageSelection(
    identity: SessionCommandIdentity,
    sessionId: string,
    assetId: string,
    assetVersion: string,
    expectedVersion: number,
    now: Instant,
  ): Promise<SessionCommandResult> {
    return this.runOperation(identity, "saveImageSelection", { sessionId, assetId, assetVersion, expectedVersion }, now,
      async (transaction, operation) => {
        const sessionRef = this.firestore.doc(`depositSessions/${sessionId}`);
        const assetRef = this.firestore.doc(`simulationAssets/${assetId}`);
        const session = await transaction.get(sessionRef);
        const asset = await transaction.get(assetRef);
        const current = requireSession(session.data(), sessionId);
        const reservationRef = this.firestore.doc(`binOperations/${current.binId}`);
        const reservation = (await transaction.get(reservationRef)).data() ?? {};
        assertOwner(current, identity.uid);
        assertVersion(current, expectedVersion);
        assertUnsubmitted(current);
        if (current.stage !== "itemDetected") throw new DomainError("invalid_transition", "Image selection requires the itemDetected stage");
        if (reservation.sessionId !== sessionId || reservation.ownerId !== identity.uid || isExpired(reservation.expiresAt, now)) {
          throw new DomainError("session_expired", "The scan reservation is no longer active", { retryability: "after_refresh" });
        }
        if (!asset.exists || asset.data()?.enabled !== true || asset.data()?.version !== assetVersion) {
          throw new DomainError("asset_version_changed", "The selected image is unavailable or has changed", { retryability: "after_refresh" });
        }
        const updated = updateSession(current, now, {
          draftAssetId: assetId,
          draftAssetVersion: assetVersion,
          version: current.version + 1,
        });
        updateDocument(transaction, sessionRef, updated);
        return this.result(updated, null, operation, "applied");
      });
  }

  async renewSession(identity: SessionCommandIdentity, sessionId: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult> {
    const result = await this.runOperation(identity, "renewSession", { sessionId, expectedVersion }, now, async (transaction, operation) => {
      const sessionRef = this.firestore.doc(`depositSessions/${sessionId}`);
      const sessionSnapshot = await transaction.get(sessionRef);
      const current = requireSession(sessionSnapshot.data(), sessionId);
      const reservationRef = this.firestore.doc(`binOperations/${current.binId}`);
      assertOwner(current, identity.uid);
      assertVersion(current, expectedVersion);
      assertUnsubmitted(current);
      const reservationSnapshot = await transaction.get(reservationRef);
      const reservation = reservationSnapshot.data() ?? {};
      if (!reservationSnapshot.exists || reservation?.sessionId !== sessionId || reservation?.ownerId !== identity.uid) {
        throw new DomainError("session_expired", "The scan reservation is no longer active", { retryability: "after_refresh" });
      }
      if (isExpired(reservation.expiresAt, now)) {
        const expired = updateSession(current, now, { stage: "cancelled", terminationReason: "reservation_expired", version: current.version + 1 });
        this.expire(transaction, sessionRef, reservationRef, current, now);
        return this.result(expired, null, operation, "applied");
      }
      const expiresAt = addSeconds(now, RESERVATION_SECONDS);
      transaction.update(reservationRef, { expiresAt, version: (reservation.version ?? 0) + 1, updatedAt: now });
      const updated = updateSession(current, now, { version: current.version + 1, reservationExpiresAt: expiresAt });
      updateDocument(transaction, sessionRef, updated);
      return this.result(updated, null, operation, "applied");
    });
    return rejectExpiredResult(result);
  }

  cancelSession(identity: SessionCommandIdentity, sessionId: string, expectedVersion: number, now: Instant): Promise<SessionCommandResult> {
    return this.runOperation(identity, "cancelSession", { sessionId, expectedVersion }, now, async (transaction, operation) => {
      const sessionRef = this.firestore.doc(`depositSessions/${sessionId}`);
      const sessionSnapshot = await transaction.get(sessionRef);
      const current = requireSession(sessionSnapshot.data(), sessionId);
      assertOwner(current, identity.uid);
      assertVersion(current, expectedVersion);
      assertUnsubmitted(current);
      const reservationRef = this.firestore.doc(`binOperations/${current.binId}`);
      const residentRef = this.firestore.doc(`residents/${identity.uid}`);
      const reservationSnapshot = await transaction.get(reservationRef);
      const residentSnapshot = await transaction.get(residentRef);
      const updated = updateSession(current, now, { stage: "cancelled", terminationReason: "resident_cancelled", version: current.version + 1 });
      updateDocument(transaction, sessionRef, updated);
      if (reservationSnapshot.exists && reservationSnapshot.data()?.sessionId === sessionId) {
        transaction.update(reservationRef, { phase: "available", ownerId: null, sessionId: null, expiresAt: null, version: (reservationSnapshot.data()?.version ?? 0) + 1, updatedAt: now });
      }
      if (residentSnapshot.exists && residentSnapshot.data()?.activeSessionId === sessionId) {
        transaction.update(residentRef, { activeSessionId: null, updatedAt: now });
      }
      return this.result(updated, null, operation, "applied");
    });
  }

  async recoverOperation(identity: SessionCommandIdentity, operationRequestId: string): Promise<SessionCommandResult | null> {
    const operationRef = this.operationRef(identity.uid, operationRequestId);
    const operation = await operationRef.get();
    if (!operation.exists || operation.data()?.ownerId !== identity.uid) return null;
    const data = operation.data()!;
    const session = await this.firestore.doc(`depositSessions/${data.sessionId}`).get();
    return this.result(requireSession(session.data(), data.sessionId), null, data, "replayed");
  }

  private async runOperation(
    identity: SessionCommandIdentity,
    name: string,
    payload: Record<string, unknown>,
    now: Instant,
    callback: (transaction: Transaction, operation: OperationIdentity) => Promise<SessionCommandResult>,
  ): Promise<SessionCommandResult> {
    const operation = createOperationIdentity(identity.uid, name, identity.requestId, payload);
    const operationRef = this.operationRef(identity.uid, identity.requestId);
    const existing = await operationRef.get();
    if (existing.exists) {
      if (existing.data()?.payloadFingerprint !== operation.payloadFingerprint) {
        throw new DomainError("idempotency_conflict", "The request ID was already used with a different payload");
      }
      const sessionId = existing.data()?.sessionId;
      if (typeof sessionId !== "string") throw new DomainError("internal", "Stored operation is missing its session reference");
      const session = await this.firestore.doc(`depositSessions/${sessionId}`).get();
      return this.result(requireSession(session.data(), sessionId), null, operation, "replayed");
    }
    const result = await this.firestore.runTransaction(async (transaction) => {
      const inside = await transaction.get(operationRef);
      if (inside.exists) {
        const sessionId = inside.data()?.sessionId;
        if (inside.data()?.payloadFingerprint !== operation.payloadFingerprint || typeof sessionId !== "string") {
          throw new DomainError("idempotency_conflict", "The request ID was already used with a different payload");
        }
        const session = await transaction.get(this.firestore.doc(`depositSessions/${sessionId}`));
        return this.result(requireSession(session.data(), sessionId), null, operation, "replayed");
      }
      const result = await callback(transaction, operation);
      transaction.create(operationRef, {
        ownerId: identity.uid,
        operation: name,
        requestId: identity.requestId,
        payloadFingerprint: operation.payloadFingerprint,
        sessionId: result.session.id,
        createdAt: now,
      });
      return result;
    });
    this.logger?.log("INFO", name === "scanBinQr" ? "scan.reservation_committed" : "scan.session_transition_committed", {
      requestId: identity.requestId,
      sessionId: result.session.id,
      stage: result.session.stage,
      operationState: result.operationState,
    });
    return result;
  }

  private async scan(transaction: Transaction, uid: string, operation: OperationIdentity, qrPayload: string, now: Instant): Promise<SessionCommandResult> {
    const residentRef = this.firestore.doc(`residents/${uid}`);
    const residentSnapshot = await transaction.get(residentRef);
    const resident = residentSnapshot.data();
    const activeSessionId = resident?.activeSessionId;
    if (typeof activeSessionId === "string") {
      const activeSnapshot = await transaction.get(this.firestore.doc(`depositSessions/${activeSessionId}`));
      if (activeSnapshot.exists) {
        const active = requireSession(activeSnapshot.data(), activeSessionId);
        if (isExpired(active.reservationExpiresAt, now) && unsubmittedStages.has(active.stage)) {
          this.expire(transaction, this.firestore.doc(`depositSessions/${active.id}`), this.firestore.doc(`binOperations/${active.binId}`), active, now);
        } else {
          const mapping = await transaction.get(this.firestore.doc(`binQrMappings/${qrPayload.split("/").pop() ?? ""}`));
          if (mapping.data()?.binId !== active.binId) throw new DomainError("active_session_exists", "Finish or cancel the existing scan before starting another");
          return this.result(active, null, operation, "applied");
        }
      }
    }
    const qrId = qrPayload.startsWith("ecoloop://bin/") ? qrPayload.slice("ecoloop://bin/".length) : "";
    const mappingSnapshot = await transaction.get(this.firestore.doc(`binQrMappings/${qrId}`));
    if (!mappingSnapshot.exists || mappingSnapshot.data()?.enabled !== true || typeof mappingSnapshot.data()?.binId !== "string") {
      throw new DomainError("invalid_qr", "This QR code is not registered", { retryability: "never" });
    }
    const binId = mappingSnapshot.data()!.binId as string;
    const binRef = this.firestore.doc(`bins/${binId}`);
    const reservationRef = this.firestore.doc(`binOperations/${binId}`);
    const binSnapshot = await transaction.get(binRef);
    const reservationSnapshot = await transaction.get(reservationRef);
    const bin = binSnapshot.data();
    if (!binSnapshot.exists || bin?.enabled !== true || bin?.isOnline !== true) throw new DomainError("bin_unavailable", "This bin is unavailable");
    if (typeof bin.capacitySpc !== "number" || typeof bin.occupiedSpc !== "number" || bin.occupiedSpc >= bin.capacitySpc) throw new DomainError("bin_full", "This bin is full");
    const reservation = reservationSnapshot.data() ?? {};
    if (reservationSnapshot.exists && reservation?.phase !== "available") {
      if (isExpired(reservation.expiresAt, now) && unsubmittedStages.has(reservation.phase as SessionStage)) {
        transaction.update(reservationRef, { phase: "available", ownerId: null, sessionId: null, expiresAt: null, updatedAt: now });
      } else {
        throw new DomainError("bin_busy", "This bin is already reserved");
      }
    }
    const sessionId = `session-${hash(`${uid}:${operation.requestId}`)}`;
    const sessionRef = this.firestore.doc(`depositSessions/${sessionId}`);
    const expiresAt = addSeconds(now, RESERVATION_SECONDS);
    const session: Record<string, unknown> = {
      id: sessionId, ownerId: uid, binId, stage: "binFound", version: 0,
      createdAt: now, updatedAt: now, reservationExpiresAt: expiresAt,
      draftAssetId: null, draftAssetVersion: null, batchId: null,
      creationRequestId: operation.requestId,
    };
    transaction.create(sessionRef, session);
    transaction.set(reservationRef, {
      binId, ownerId: uid, sessionId, phase: "binFound", simulatedAccess: "open",
      expiresAt, version: 0, updatedAt: now,
    }, { merge: true });
    transaction.set(residentRef, { activeSessionId: sessionId, updatedAt: now }, { merge: true });
    return this.result(session, toBinSnapshot(binId, bin), operation, "applied");
  }

  private async transition(
    transaction: Transaction, uid: string, operation: OperationIdentity, sessionId: string, expectedVersion: number,
    from: SessionStage, to: SessionStage, now: Instant,
  ): Promise<SessionCommandResult> {
    const sessionRef = this.firestore.doc(`depositSessions/${sessionId}`);
    const snapshot = await transaction.get(sessionRef);
    const current = requireSession(snapshot.data(), sessionId);
    const reservationRef = this.firestore.doc(`binOperations/${current.binId}`);
    const reservationSnapshot = await transaction.get(reservationRef);
    assertOwner(current, uid);
    assertVersion(current, expectedVersion);
    assertUnsubmitted(current);
    const reservation = reservationSnapshot.data() ?? {};
    if (!reservationSnapshot.exists || reservation.sessionId !== sessionId || reservation.ownerId !== uid) {
      throw new DomainError("session_expired", "The scan reservation is no longer active", { retryability: "after_refresh" });
    }
    if (isExpired(reservation.expiresAt, now)) {
      this.expire(transaction, sessionRef, reservationRef, current, now);
      return this.result(updateSession(current, now, {
        stage: "cancelled", terminationReason: "reservation_expired", version: current.version + 1,
      }), null, operation, "applied");
    }
    if (current.stage !== from) throw new DomainError("invalid_transition", `Session must be ${from} before it can become ${to}`);
    const updated = updateSession(current, now, { stage: to, version: current.version + 1 });
    updateDocument(transaction, sessionRef, updated);
    transaction.update(reservationRef, { phase: to, simulatedAccess: to === "itemDetected" ? "closed" : "open", updatedAt: now });
    return this.result(updated, null, operation, "applied");
  }

  private expire(transaction: Transaction, sessionRef: DocumentReference, reservationRef: DocumentReference, session: DepositSession, now: Instant): void {
    updateDocument(transaction, sessionRef, updateSession(session, now, { stage: "cancelled", terminationReason: "reservation_expired", version: session.version + 1 }));
    transaction.set(reservationRef, { phase: "available", ownerId: null, sessionId: null, expiresAt: null, updatedAt: now }, { merge: true });
    transaction.set(this.firestore.doc(`residents/${session.ownerId}`), { activeSessionId: null, updatedAt: now }, { merge: true });
  }

  private operationRef(uid: string, requestId: string) {
    return this.firestore.doc(`residents/${uid}/sessionOperations/${hash(requestId)}`);
  }

  private result(session: DepositSession | Record<string, unknown>, bin: BinSnapshot | null, _operation: unknown, operationState: "applied" | "replayed"): SessionCommandResult {
    return { session: requireSession(session, String(session.id)), bin, operationState };
  }
}

function requireSession(value: Record<string, unknown> | DepositSession | undefined, id: string): DepositSession {
  const data = value as Record<string, unknown> | undefined;
  if (data === undefined || data.ownerId === undefined || data.binId === undefined || typeof data.stage !== "string" || typeof data.version !== "number") {
    throw new DomainError("session_expired", "The scan session no longer exists", { retryability: "after_refresh" });
  }
  return data as unknown as DepositSession;
}

function assertOwner(session: DepositSession, uid: string): void {
  if (session.ownerId !== uid) throw new DomainError("permission_denied", "This scan session belongs to another resident");
}

function assertVersion(session: DepositSession, expectedVersion: number): void {
  if (session.version !== expectedVersion) throw new DomainError("invalid_transition", "The scan session changed; refresh before retrying", { retryability: "after_refresh", details: { conflictVersion: session.version } });
}

function assertUnsubmitted(session: DepositSession): void {
  if (!unsubmittedStages.has(session.stage)) throw new DomainError("already_submitted", "This scan session has already been submitted");
}

function rejectExpiredResult(result: SessionCommandResult): SessionCommandResult {
  if (result.session.stage === "cancelled" && (result.session as DepositSession & { terminationReason?: string }).terminationReason === "reservation_expired") {
    throw new DomainError("session_expired", "The scan reservation has expired", { retryability: "after_refresh" });
  }
  return result;
}

function updateSession(session: DepositSession, now: Instant, fields: Record<string, unknown>): Record<string, unknown> {
  return { ...session, ...fields, updatedAt: now };
}

function isExpired(value: unknown, now: Instant): boolean {
  return typeof value === "string" && Date.parse(value) <= Date.parse(now);
}

function addSeconds(value: Instant, seconds: number): Instant {
  return new Date(Date.parse(value) + seconds * 1000).toISOString();
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function toBinSnapshot(id: string, value: Record<string, unknown>): BinSnapshot {
  const capacitySpc = Number(value.capacitySpc);
  const occupiedSpc = Number(value.occupiedSpc);
  return {
    id, capacitySpc, occupiedSpc,
    capacityPercent: Math.max(0, Math.min(100, Math.floor((occupiedSpc / capacitySpc) * 100))),
    cycleId: String(value.cycleId),
    isOnline: value.isOnline === true,
    enabled: value.enabled === true,
  };
}

function updateDocument(transaction: Transaction, reference: DocumentReference, value: Record<string, unknown>): void {
  transaction.update(reference, value as DocumentData);
}
