import type { DocumentData, Firestore } from "firebase-admin/firestore";
import type { Instant } from "../../domain/types.js";
import { DomainError } from "../../domain/errors.js";

const MAX_ATTEMPTS = 3;
const UNSUBMITTED_STAGES = new Set(["binFound", "ready", "itemDetected"]);

export interface MaintenanceSummary {
  readonly jobsRecovered: number;
  readonly jobsReferred: number;
  readonly reservationsExpired: number;
  readonly remindersCreated: number;
  readonly vouchersExpired: number;
  readonly artifactsPurged: number;
}

export interface CollectionResult {
  readonly eventId: string;
  readonly binId: string;
  readonly previousCycleId: string;
  readonly cycleId: string;
  readonly actorId: string;
  readonly environment: string;
}

interface StorageFileLike {
  delete(options: { readonly ignoreNotFound: boolean }): Promise<unknown>;
}

interface StorageBucketLike {
  file(path: string, options: { readonly generation: string }): StorageFileLike;
}

export interface MaintenanceStore {
  reconcileJobs(now: Instant, limit?: number): Promise<MaintenanceSummary>;
  expireAbandonedReservations(now: Instant, limit?: number): Promise<number>;
  recordCollection(input: {
    readonly binId: string;
    readonly expectedCycleId: string;
    readonly actorId: string;
    readonly environment: string;
    readonly runId: string;
    readonly now: Instant;
  }): Promise<CollectionResult>;
  runDaily(now: Instant, limit?: number): Promise<Pick<MaintenanceSummary, "remindersCreated" | "vouchersExpired" | "artifactsPurged">>;
  inspect(input: { readonly batchId?: string; readonly residentId?: string; readonly now: Instant }): Promise<Record<string, unknown>>;
}

export class FirestoreMaintenanceStore implements MaintenanceStore {
  constructor(private readonly firestore: Firestore, private readonly bucket?: StorageBucketLike) {}

  async reconcileJobs(now: Instant, limit = 50): Promise<MaintenanceSummary> {
    validateLimit(limit, "Job reconciliation");
    const snapshot = await this.firestore.collection("inferenceJobs")
      .where("state", "in", ["running", "retry_wait", "queued"])
      .limit(limit)
      .get();
    let jobsRecovered = 0;
    let jobsReferred = 0;
    for (const document of snapshot.docs) {
      const result = await this.reconcileJob(document.id, document.data(), now);
      jobsRecovered += result === "retry_wait" ? 1 : 0;
      jobsReferred += result === "review" ? 1 : 0;
    }
    return { jobsRecovered, jobsReferred, reservationsExpired: 0, remindersCreated: 0, vouchersExpired: 0, artifactsPurged: 0 };
  }

  async runDaily(now: Instant, limit = 50): Promise<Pick<MaintenanceSummary, "remindersCreated" | "vouchersExpired" | "artifactsPurged">> {
    validateLimit(limit, "Daily maintenance");
    const remindersCreated = await this.createVoucherReminders(now, limit);
    const vouchersExpired = await this.expireVouchers(now, limit);
    const artifactsPurged = await this.purgeDiagnostics(now, limit);
    return { remindersCreated, vouchersExpired, artifactsPurged };
  }

  async inspect(input: { readonly batchId?: string; readonly residentId?: string; readonly now: Instant }): Promise<Record<string, unknown>> {
    if (input.batchId === undefined && input.residentId === undefined) {
      throw new DomainError("invalid_input", "Inspect requires batchId or residentId");
    }
    const result: Record<string, unknown> = { inspectedAt: input.now, mode: "readonly" };
    if (input.batchId !== undefined) {
      const [batch, job, outcome, review] = await Promise.all([
        this.firestore.doc(`deposits/${input.batchId}`).get(),
        this.firestore.collection("inferenceJobs").where("batchId", "==", input.batchId).limit(1).get(),
        this.firestore.doc(`depositResults/result-${hash(input.batchId)}`).get(),
        this.firestore.doc(`reviewTickets/${input.batchId}`).get(),
      ]);
      result.batch = batch.exists ? batch.data() : null;
      result.job = job.empty ? null : job.docs[0]?.data() ?? null;
      result.result = outcome.exists ? outcome.data() : null;
      result.review = review.exists ? review.data() : null;
    }
    if (input.residentId !== undefined) {
      const [profile, vouchers] = await Promise.all([
        this.firestore.doc(`residents/${input.residentId}`).get(),
        this.firestore.collection("vouchers").where("residentId", "==", input.residentId).limit(50).get(),
      ]);
      result.resident = profile.exists ? profile.data() : null;
      result.vouchers = vouchers.docs.map((document) => document.data());
    }
    return result;
  }

  private async createVoucherReminders(now: Instant, limit: number): Promise<number> {
    const windowEnd = new Date(Date.parse(now) + 4 * 24 * 60 * 60 * 1000).toISOString();
    const windowStart = new Date(Date.parse(now) + 2 * 24 * 60 * 60 * 1000).toISOString();
    const snapshot = await this.firestore.collection("vouchers")
      .where("status", "==", "available").where("expiresAt", ">=", windowStart).where("expiresAt", "<=", windowEnd)
      .limit(limit).get();
    let created = 0;
    for (const document of snapshot.docs) {
      const voucher = document.data();
      const reminderId = `voucher-expiry-${document.id}`;
      const reminderRef = this.firestore.doc(`rewardReminders/${reminderId}`);
      const eventRef = this.firestore.doc(`notificationEvents/${reminderId}`);
      const createdForVoucher = await this.firestore.runTransaction(async (transaction) => {
        const [currentVoucher, reminder, event, preferences] = await Promise.all([
          transaction.get(document.ref),
          transaction.get(reminderRef),
          transaction.get(eventRef),
          transaction.get(this.firestore.doc(`residents/${String(voucher.residentId)}/preferences/current`)),
        ]);
        const current = currentVoucher.data() ?? {};
        if (!currentVoucher.exists || current.status !== "available" ||
            !isWithinReminderWindow(String(current.expiresAt), now) ||
            reminder.exists || event.exists || preferences.data()?.rewardReminders !== true) return false;
        transaction.create(reminderRef, {
          id: reminderId, voucherId: document.id, residentId: String(current.residentId),
          expiresAt: String(current.expiresAt), createdAt: now,
        });
        transaction.create(eventRef, {
          id: reminderId, recipientUid: String(current.residentId), batchId: document.id,
          targetType: "voucher", targetId: document.id, kind: "voucher_reminder",
          outcome: "voucher_expiry_reminder", pointsAwarded: null, state: "pending", createdAt: now,
        });
        return true;
      });
      if (createdForVoucher) created += 1;
    }
    return created;
  }

  private async expireVouchers(now: Instant, limit: number): Promise<number> {
    const snapshot = await this.firestore.collection("vouchers")
      .where("status", "==", "available").where("expiresAt", "<=", now).limit(limit).get();
    let expired = 0;
    for (const document of snapshot.docs) {
      const changed = await this.firestore.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(document.ref);
        const current = currentSnapshot.data() ?? {};
        if (!currentSnapshot.exists || current.status !== "available" ||
            Date.parse(String(current.expiresAt)) > Date.parse(now)) return false;
        transaction.update(document.ref, { status: "expired", expiredAt: now, updatedAt: now });
        return true;
      });
      if (changed) expired += 1;
    }
    return expired;
  }

  private async purgeDiagnostics(now: Instant, limit: number): Promise<number> {
    const snapshot = await this.firestore.collection("diagnosticArtifacts")
      .where("state", "==", "eligible").where("purgeAfterAt", "<=", now).limit(limit).get();
    let purged = 0;
    for (const document of snapshot.docs) {
      const data = document.data();
      const path = String(data.storagePath ?? "");
      const generation = String(data.generation ?? "");
      if (!/^inspection-evidence\/[^/]+\/[^/]+\/[^/]+\/.+$/.test(path) || !/^\d+$/.test(generation)) continue;
      const deleted = await this.deleteGeneration(path, generation);
      await document.ref.set({
        state: deleted ? "purged" : "purge_pending",
        ...(deleted ? { purgedAt: now } : { lastPurgeError: "storage_delete_failed" }),
      }, { merge: true });
      if (deleted) purged += 1;
    }
    return purged;
  }

  private async deleteGeneration(path: string, generation: string): Promise<boolean> {
    if (this.bucket === undefined) return false;
    try {
      await this.bucket.file(path, { generation }).delete({ ignoreNotFound: true });
      return true;
    } catch {
      return false;
    }
  }

  async expireAbandonedReservations(now: Instant, limit = 50): Promise<number> {
    validateLimit(limit, "Reservation expiry");
    const snapshot = await this.firestore.collection("depositSessions")
      .where("stage", "in", [...UNSUBMITTED_STAGES])
      .limit(limit)
      .get();
    let expired = 0;
    for (const document of snapshot.docs) {
      const didExpire = await this.expireSession(document.id, document.data(), now);
      if (didExpire) expired += 1;
    }

    return expired;
  }

  recordCollection(input: {
    readonly binId: string;
    readonly expectedCycleId: string;
    readonly actorId: string;
    readonly environment: string;
    readonly runId: string;
    readonly now: Instant;
  }): Promise<CollectionResult> {
    if (input.environment !== "emulator" && input.environment !== "live") {
      throw new DomainError("invalid_input", "Collection environment must be emulator or live");
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(input.runId)) {
      throw new DomainError("invalid_input", "Collection runId is invalid");
    }
    return this.firestore.runTransaction(async (transaction) => {
      const binRef = this.firestore.doc(`bins/${input.binId}`);
      const binSnapshot = await transaction.get(binRef);
      const bin = requireData(binSnapshot.data(), `Bin ${input.binId} does not exist`);
      if (String(bin.cycleId) !== input.expectedCycleId) {
        throw new DomainError("invalid_transition", "The bin collection cycle has changed");
      }
      const reservationRef = this.firestore.doc(`binOperations/${input.binId}`);
      const reservationSnapshot = await transaction.get(reservationRef);
      const reservation = reservationSnapshot.data() ?? {};
      if (reservation.ownerId !== null && reservation.ownerId !== undefined) {
        throw new DomainError("bin_busy", "Cannot collect a bin with an active reservation");
      }
      const previousCycleId = input.expectedCycleId;
      const cycleId = `${input.binId}-cycle-${hash(`${input.runId}:${input.now}`).slice(0, 12)}`;
      const eventId = `collection-${input.binId}-${hash(input.runId).slice(0, 16)}`;
      const eventRef = this.firestore.doc(`collectionEvents/${eventId}`);
      const eventSnapshot = await transaction.get(eventRef);
      if (eventSnapshot.exists) {
        const existing = eventSnapshot.data() ?? {};
        if (existing.binId !== input.binId || existing.previousCycleId !== previousCycleId) {
          throw new DomainError("idempotency_conflict", "Collection run identity conflicts with the existing event");
        }
        return {
          eventId, binId: input.binId, previousCycleId,
          cycleId: String(existing.cycleId), actorId: String(existing.actorId),
          environment: String(existing.environment),
        };
      }
      transaction.create(eventRef, {
        id: eventId, runId: input.runId, actorId: input.actorId, environment: input.environment,
        binId: input.binId, previousCycleId, cycleId, occurredAt: input.now,
      });
      transaction.create(this.firestore.doc(`binCycles/${cycleId}`), {
        id: cycleId, binId: input.binId, openingOccupiedSpc: 0, capacitySpc: Number(bin.capacitySpc),
        startedAt: input.now, collectionEventId: eventId,
      });
      transaction.update(binRef, {
        cycleId, occupiedSpc: 0, capacityPercent: 0, updatedAt: input.now,
      });
      return { eventId, binId: input.binId, previousCycleId, cycleId, actorId: input.actorId, environment: input.environment };
    });
  }

  private async reconcileJob(jobId: string, job: DocumentData, now: Instant): Promise<"none" | "retry_wait" | "review"> {
    const deadlinePassed = Date.parse(String(job.deadlineAt)) <= Date.parse(now);
    const leaseExpired = typeof job.activeLeaseExpiresAt !== "string" ||
      Date.parse(job.activeLeaseExpiresAt) <= Date.parse(now);
    if (!deadlinePassed && !leaseExpired && job.state === "running") return "none";
    const terminal = deadlinePassed || Number(job.attemptCount ?? 0) >= MAX_ATTEMPTS;
    const jobRef = this.firestore.doc(`inferenceJobs/${jobId}`);
    return this.firestore.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(jobRef);
      const current = currentSnapshot.data() ?? {};
      if (current.state !== job.state || current.activeAttemptId !== job.activeAttemptId) return "none";
      if (!terminal) {
        transaction.update(jobRef, {
          state: "retry_wait", activeAttemptId: null, activeLeaseExpiresAt: null,
          recoveryReason: "stale_attempt_lease", updatedAt: now,
        });
        return "retry_wait";
      }
      const batchId = String(current.batchId ?? "");
      const resultRef = this.firestore.doc(`depositResults/result-${hash(batchId)}`);
      const batchRef = this.firestore.doc(`deposits/${batchId}`);
      const resultSnapshot = await transaction.get(resultRef);
      if (resultSnapshot.exists && resultSnapshot.data()?.outcome !== "processing") {
        transaction.update(jobRef, { state: "completed", activeAttemptId: null, activeLeaseExpiresAt: null, updatedAt: now });
        return "none";
      }
      const decisionVersion = Number(resultSnapshot.data()?.decisionVersion ?? 0) + 1;
      transaction.update(jobRef, {
        state: "failed", activeAttemptId: null, activeLeaseExpiresAt: null,
        failureReason: deadlinePassed ? "processing_deadline_elapsed" : "attempt_budget_exhausted",
        updatedAt: now,
      });
      transaction.update(batchRef, {
        status: "review", pointsAwarded: null, decisionVersion, updatedAt: now,
      });
      transaction.set(resultRef, {
        id: resultRef.id, ownerId: String(current.ownerId), batchId, outcome: "review",
        pointsAwarded: null, decisionVersion, reasonCodes: [
          deadlinePassed ? "processing_deadline_elapsed" : "attempt_budget_exhausted",
        ], updatedAt: now,
      }, { merge: true });
      transaction.set(this.firestore.doc(`reviewTickets/${batchId}`), {
        id: batchId, batchId, ownerId: String(current.ownerId), decisionVersion,
        state: "open", reasonCodes: [deadlinePassed ? "processing_deadline_elapsed" : "attempt_budget_exhausted"],
        createdAt: now,
      }, { merge: true });
      transaction.set(this.firestore.doc(`notificationEvents/${batchId}-${decisionVersion}`), {
        id: `${batchId}-${decisionVersion}`, recipientUid: String(current.ownerId), batchId,
        outcome: "review", pointsAwarded: null, decisionVersion, state: "pending", createdAt: now,
      }, { merge: true });
      return "review";
    });
  }

  private expireSession(sessionId: string, session: DocumentData, now: Instant): Promise<boolean> {
    const reservationRef = this.firestore.doc(`binOperations/${String(session.binId)}`);
    const sessionRef = this.firestore.doc(`depositSessions/${sessionId}`);
    return this.firestore.runTransaction(async (transaction) => {
      const [currentSessionSnapshot, reservationSnapshot] = await Promise.all([
        transaction.get(sessionRef), transaction.get(reservationRef),
      ]);
      const current = currentSessionSnapshot.data() ?? {};
      const reservation = reservationSnapshot.data() ?? {};
      if (!UNSUBMITTED_STAGES.has(String(current.stage)) ||
          reservation.sessionId !== sessionId ||
          reservation.ownerId !== current.ownerId ||
          typeof reservation.expiresAt !== "string" ||
          Date.parse(reservation.expiresAt) > Date.parse(now)) return false;
      transaction.update(sessionRef, {
        stage: "cancelled", terminationReason: "reservation_expired",
        version: Number(current.version ?? 0) + 1, updatedAt: now,
      });
      transaction.update(reservationRef, {
        phase: "available", ownerId: null, sessionId: null, expiresAt: null, updatedAt: now,
      });
      transaction.set(this.firestore.doc(`residents/${String(current.ownerId)}`), {
        activeSessionId: null, updatedAt: now,
      }, { merge: true });
      return true;
    });
  }
}

function isWithinReminderWindow(expiresAt: string, now: string): boolean {
  const remaining = Date.parse(expiresAt) - Date.parse(now);
  return remaining >= 2 * 24 * 60 * 60 * 1000 && remaining <= 4 * 24 * 60 * 60 * 1000;
}

function validateLimit(limit: number, label: string): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new DomainError("invalid_input", `${label} limit must be between 1 and 100`);
  }
}

function requireData(value: DocumentData | undefined, message: string): DocumentData {
  if (value === undefined) throw new DomainError("invalid_input", message);
  return value;
}

function hash(value: string): string {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return (result >>> 0).toString(16).padStart(8, "0");
}
