// =============================================================================
// admin_alerts_store.ts — Transactional store for smart bin capacity alert lifecycle
// Phase AB-06 — Capacity alerts and collection-cycle workflow
// =============================================================================

import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { AdminVerificationResult } from "./admin_accounts_store.js";
import { computePayloadFingerprint } from "../../domain/admin_crypto.js";
import {
  type ScheduleCollectionInput,
  type RecordCollectionInput,
  type ResolveCapacityAlertInput,
  computeAlertId,
  validateAlertId,
  validateExpectedVersion,
  validateExpectedCycleId,
  validateAlertTransition,
  computeNextCycleId,
  computeCollectionEventId,
  shouldTriggerAlert,
} from "../../domain/admin_alerts.js";
import type { FirestoreAdminOperationsStore } from "./admin_operations_store.js";
import type { FirestoreAdminProjectionsStore } from "./admin_projections_store.js";
import type { FirestoreAdminReadVersionsStore } from "./admin_read_versions_store.js";
import type { AdminCommandResponse } from "./admin_bins_store.js";

export class FirestoreAdminAlertsStore {
  private readonly firestore: Firestore;
  private readonly operationsStore: FirestoreAdminOperationsStore;
  private readonly projectionsStore: FirestoreAdminProjectionsStore;
  private readonly readVersionsStore: FirestoreAdminReadVersionsStore;

  constructor(
    firestore: Firestore,
    operationsStore: FirestoreAdminOperationsStore,
    projectionsStore: FirestoreAdminProjectionsStore,
    readVersionsStore: FirestoreAdminReadVersionsStore
  ) {
    this.firestore = firestore;
    this.operationsStore = operationsStore;
    this.projectionsStore = projectionsStore;
    this.readVersionsStore = readVersionsStore;
  }

  /**
   * Schedule collection for an active capacity alert.
   * State transition: pending -> scheduled
   */
  async scheduleCollection(
    caller: AdminVerificationResult,
    input: ScheduleCollectionInput,
    requestId: string,
    traceId: string,
    nowInstant: string
  ): Promise<AdminCommandResponse> {
    validateAlertId(input.alertId);
    validateExpectedVersion(input.expectedVersion);

    // 1. Idempotency check
    const payloadFingerprint = computePayloadFingerprint(
      input as unknown as Record<string, unknown>
    );
    const existing = await this.operationsStore.getReceipt(
      caller.uid,
      "adminScheduleCollection",
      requestId
    );
    if (existing) {
      return existing as unknown as AdminCommandResponse;
    }

    const { alertId, expectedVersion } = input;

    let binId = "";
    const nextVersion = expectedVersion + 1;

    // 2. Transaction
    await this.firestore.runTransaction(async (transaction) => {
      const alertRef = this.firestore.doc(`capacityAlerts/${alertId}`);
      const alertSnap = await transaction.get(alertRef);
      if (!alertSnap.exists) {
        throw new HttpsError("not-found", `Capacity alert "${alertId}" does not exist.`);
      }

      const alertData = alertSnap.data()!;
      const currentVersion = Number(alertData.version ?? 1);
      if (currentVersion !== expectedVersion) {
        throw new HttpsError(
          "failed-precondition",
          `Concurrency conflict: alert is version ${currentVersion}, expected ${expectedVersion}.`
        );
      }

      const currentState = String(alertData.state ?? "pending");
      validateAlertTransition(currentState as any, "scheduled");

      binId = String(alertData.binId);

      // Update alert record
      transaction.update(alertRef, {
        state: "scheduled",
        version: nextVersion,
        scheduledBy: caller.uid,
        scheduledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update bin collection state summary
      const binCollectionStateRef = this.firestore.doc(`binCollectionState/${binId}`);
      transaction.set(
        binCollectionStateRef,
        {
          binId,
          status: "collection_scheduled",
          activeAlertId: alertId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Update alert view projection
      const alertViewRef = this.firestore.doc(`adminAlertViews/${alertId}`);
      transaction.set(
        alertViewRef,
        {
          state: "scheduled",
          version: nextVersion,
          scheduledBy: caller.uid,
          scheduledAt: nowInstant,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Update bin view projection
      const binViewRef = this.firestore.doc(`adminBinViews/${binId}`);
      transaction.set(
        binViewRef,
        {
          collectionState: "collection_pending",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Record audit event
      const auditRef = this.firestore.doc(`adminAuditEvents/${randomUUID()}`);
      transaction.set(auditRef, {
        schemaVersion: "admin.v1",
        actorUid: caller.uid,
        action: "adminScheduleCollection",
        resourceType: "capacityAlert",
        resourceId: alertId,
        details: { binId, previousState: currentState, newState: "scheduled" },
        traceId,
        occurredAt: FieldValue.serverTimestamp(),
      });
    });

    // Record idempotent receipt
    await this.operationsStore.recordReceipt(
      caller.uid,
      "adminScheduleCollection",
      requestId,
      payloadFingerprint,
      traceId,
      {
        resourceId: alertId,
        version: nextVersion,
        binId,
        state: "scheduled",
      }
    );

    // Invalidate read projections
    await Promise.all([
      this.readVersionsStore.bumpVersion("alerts"),
      this.readVersionsStore.bumpVersion("bins"),
      this.readVersionsStore.bumpVersion("dashboard"),
    ]);

    return {
      schemaVersion: "admin.v1",
      operation: "adminScheduleCollection",
      requestId,
      traceId,
      status: "committed",
      data: {
        resourceId: alertId,
        version: expectedVersion + 1,
        operationState: "applied",
        committedAt: nowInstant,
      },
    };
  }

  /**
   * Record collection of a smart bin.
   * Transactionally closes the old cycle, creates a new zero-opening cycle,
   * resets occupancy to 0, transitions the alert to "collected", and writes a collectionEvent.
   */
  async recordCollection(
    caller: AdminVerificationResult,
    input: RecordCollectionInput,
    requestId: string,
    traceId: string,
    nowInstant: string
  ): Promise<AdminCommandResponse> {
    const { binId, expectedCycleId, notes } = input;
    if (!binId || typeof binId !== "string") {
      throw new HttpsError("invalid-argument", "binId is required.");
    }
    validateExpectedCycleId(expectedCycleId);

    // 1. Idempotency check
    const payloadFingerprint = computePayloadFingerprint(
      input as unknown as Record<string, unknown>
    );
    const existing = await this.operationsStore.getReceipt(
      caller.uid,
      "adminRecordCollection",
      requestId
    );
    if (existing) {
      return existing as unknown as AdminCommandResponse;
    }

    const eventId = computeCollectionEventId(binId, requestId);
    let assignedNewCycleId = "";
    let nextBinVersion = 1;

    // 2. Transaction
    await this.firestore.runTransaction(async (transaction) => {
      // 2a. Read bin
      const binRef = this.firestore.doc(`bins/${binId}`);
      const binSnap = await transaction.get(binRef);
      if (!binSnap.exists) {
        throw new HttpsError("not-found", `Smart bin "${binId}" does not exist.`);
      }

      const binData = binSnap.data()!;
      const currentCycleId = String(binData.cycleId ?? "");
      if (currentCycleId !== expectedCycleId) {
        throw new HttpsError(
          "failed-precondition",
          `Bin collection cycle has changed: current is "${currentCycleId}", expected "${expectedCycleId}".`
        );
      }

      // 2b. Verify no active reservation / session
      const opsRef = this.firestore.doc(`binOperations/${binId}`);
      const opsSnap = await transaction.get(opsRef);
      if (opsSnap.exists) {
        const opsData = opsSnap.data()!;
        if (opsData.ownerId !== null && opsData.ownerId !== undefined) {
          throw new HttpsError(
            "failed-precondition",
            "Cannot collect a smart bin while a deposit session is active."
          );
        }
      }

      // 2c. Close old cycle
      const oldCycleRef = this.firestore.doc(`binCycles/${expectedCycleId}`);
      transaction.set(
        oldCycleRef,
        {
          endedAt: FieldValue.serverTimestamp(),
          finalOccupiedSpc: Number(binData.occupiedSpc ?? 0),
          status: "closed",
        },
        { merge: true }
      );

      // 2d. Create new zero-opening cycle
      const nextCycleId = computeNextCycleId(binId, expectedCycleId);
      assignedNewCycleId = nextCycleId;
      const newCycleRef = this.firestore.doc(`binCycles/${nextCycleId}`);
      transaction.set(newCycleRef, {
        id: nextCycleId,
        binId,
        openingOccupiedSpc: 0,
        capacitySpc: Number(binData.capacitySpc ?? 1000),
        contributionTotalSpc: 0,
        startedAt: FieldValue.serverTimestamp(),
        endedAt: null,
        status: "open",
        collectionEventId: eventId,
      });

      // 2e. Create collection event
      const eventRef = this.firestore.doc(`collectionEvents/${eventId}`);
      transaction.set(eventRef, {
        id: eventId,
        binId,
        previousCycleId: expectedCycleId,
        cycleId: nextCycleId,
        collectorId: caller.uid,
        collectedSpc: Number(binData.occupiedSpc ?? 0),
        notes: notes ?? null,
        occurredAt: FieldValue.serverTimestamp(),
      });

      // 2f. Reset bin occupancy to 0 and advance cycle
      const nextBinVersion = Number(binData.version ?? 1) + 1;
      transaction.update(binRef, {
        occupiedSpc: 0,
        capacityPercent: 0,
        cycleId: nextCycleId,
        version: nextBinVersion,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2g. Join alert's collected transition if alert exists for this bin + cycle
      const alertId = computeAlertId(binId, expectedCycleId);
      const alertRef = this.firestore.doc(`capacityAlerts/${alertId}`);
      const alertSnap = await transaction.get(alertRef);

      if (alertSnap.exists) {
        const alertData = alertSnap.data()!;
        const alertVersion = Number(alertData.version ?? 1) + 1;
        transaction.update(alertRef, {
          state: "collected",
          version: alertVersion,
          collectedBy: caller.uid,
          collectedAt: FieldValue.serverTimestamp(),
          collectionEventId: eventId,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update alert view projection
        const alertViewRef = this.firestore.doc(`adminAlertViews/${alertId}`);
        transaction.set(
          alertViewRef,
          {
            state: "collected",
            currentFillPercent: 0,
            version: alertVersion,
            collectedBy: caller.uid,
            collectedAt: nowInstant,
            collectionEventId: eventId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      // 2h. Update bin collection state
      const binCollectionStateRef = this.firestore.doc(`binCollectionState/${binId}`);
      transaction.set(
        binCollectionStateRef,
        {
          binId,
          currentCycleId: nextCycleId,
          status: "normal",
          activeAlertId: null,
          lastCollectedAt: FieldValue.serverTimestamp(),
          lastCollectedBy: caller.uid,
          lastCollectionEventId: eventId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 2i. Update bin view projection
      const binViewRef = this.firestore.doc(`adminBinViews/${binId}`);
      transaction.set(
        binViewRef,
        {
          occupiedSpc: 0,
          fillPercent: 0,
          cycleId: nextCycleId,
          collectionState: "normal",
          lastCollectionTime: nowInstant,
          version: nextBinVersion,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 2j. Record audit event
      const auditRef = this.firestore.doc(`adminAuditEvents/${randomUUID()}`);
      transaction.set(auditRef, {
        schemaVersion: "admin.v1",
        actorUid: caller.uid,
        action: "adminRecordCollection",
        resourceType: "smartBin",
        resourceId: binId,
        details: {
          previousCycleId: expectedCycleId,
          newCycleId: nextCycleId,
          collectedSpc: Number(binData.occupiedSpc ?? 0),
          collectionEventId: eventId,
        },
        traceId,
        occurredAt: FieldValue.serverTimestamp(),
      });

    });

    // Record idempotent receipt
    await this.operationsStore.recordReceipt(
      caller.uid,
      "adminRecordCollection",
      requestId,
      payloadFingerprint,
      traceId,
      {
        resourceId: binId,
        version: nextBinVersion,
        previousCycleId: expectedCycleId,
        newCycleId: assignedNewCycleId,
        collectionEventId: eventId,
      }
    );

    // Invalidate read versions
    await Promise.all([
      this.readVersionsStore.bumpVersion("bins"),
      this.readVersionsStore.bumpVersion("alerts"),
      this.readVersionsStore.bumpVersion("dashboard"),
    ]);

    return {
      schemaVersion: "admin.v1",
      operation: "adminRecordCollection",
      requestId,
      traceId,
      status: "committed",
      data: {
        resourceId: binId,
        version: nextBinVersion,
        operationState: "applied",
        committedAt: nowInstant,
        newCycleId: assignedNewCycleId,
        collectionEventId: eventId,
      },
    };
  }

  /**
   * Resolve an already collected capacity alert.
   * State transition: collected -> resolved
   * Resolves only that specific alert without touching occupancy or the new active cycle.
   */
  async resolveCapacityAlert(
    caller: AdminVerificationResult,
    input: ResolveCapacityAlertInput,
    requestId: string,
    traceId: string,
    nowInstant: string
  ): Promise<AdminCommandResponse> {
    validateAlertId(input.alertId);
    validateExpectedVersion(input.expectedVersion);

    // 1. Idempotency check
    const payloadFingerprint = computePayloadFingerprint(
      input as unknown as Record<string, unknown>
    );
    const existing = await this.operationsStore.getReceipt(
      caller.uid,
      "adminResolveCapacityAlert",
      requestId
    );
    if (existing) {
      return existing as unknown as AdminCommandResponse;
    }

    const { alertId, expectedVersion } = input;

    // 2. Transaction
    await this.firestore.runTransaction(async (transaction) => {
      const alertRef = this.firestore.doc(`capacityAlerts/${alertId}`);
      const alertSnap = await transaction.get(alertRef);
      if (!alertSnap.exists) {
        throw new HttpsError("not-found", `Capacity alert "${alertId}" does not exist.`);
      }

      const alertData = alertSnap.data()!;
      const currentVersion = Number(alertData.version ?? 1);
      if (currentVersion !== expectedVersion) {
        throw new HttpsError(
          "failed-precondition",
          `Concurrency conflict: alert is version ${currentVersion}, expected ${expectedVersion}.`
        );
      }

      const currentState = String(alertData.state ?? "pending");
      if (currentState !== "collected") {
        throw new HttpsError(
          "failed-precondition",
          `Only collected alerts can be resolved. Current state is "${currentState}".`
        );
      }

      const binId = String(alertData.binId);
      const nextVersion = currentVersion + 1;

      // Update alert record
      transaction.update(alertRef, {
        state: "resolved",
        version: nextVersion,
        resolvedBy: caller.uid,
        resolvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update alert view projection
      const alertViewRef = this.firestore.doc(`adminAlertViews/${alertId}`);
      transaction.set(
        alertViewRef,
        {
          state: "resolved",
          version: nextVersion,
          resolvedBy: caller.uid,
          resolvedAt: nowInstant,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Clean activeAlertId from binCollectionState if matching
      const binCollectionStateRef = this.firestore.doc(`binCollectionState/${binId}`);
      const stateSnap = await transaction.get(binCollectionStateRef);
      if (stateSnap.exists && stateSnap.data()?.activeAlertId === alertId) {
        transaction.update(binCollectionStateRef, {
          activeAlertId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Record audit event
      const auditRef = this.firestore.doc(`adminAuditEvents/${randomUUID()}`);
      transaction.set(auditRef, {
        schemaVersion: "admin.v1",
        actorUid: caller.uid,
        action: "adminResolveCapacityAlert",
        resourceType: "capacityAlert",
        resourceId: alertId,
        details: { binId, previousState: "collected", newState: "resolved" },
        traceId,
        occurredAt: FieldValue.serverTimestamp(),
      });
    });

    // Record idempotent receipt
    await this.operationsStore.recordReceipt(
      caller.uid,
      "adminResolveCapacityAlert",
      requestId,
      payloadFingerprint,
      traceId,
      {
        resourceId: alertId,
        version: expectedVersion + 1,
        state: "resolved",
      }
    );

    // Invalidate read projections
    await Promise.all([
      this.readVersionsStore.bumpVersion("alerts"),
      this.readVersionsStore.bumpVersion("dashboard"),
    ]);

    return {
      schemaVersion: "admin.v1",
      operation: "adminResolveCapacityAlert",
      requestId,
      traceId,
      status: "committed",
      data: {
        resourceId: alertId,
        version: expectedVersion + 1,
        operationState: "applied",
        committedAt: nowInstant,
      },
    };
  }

  /**
   * Helper to evaluate a smart bin's occupancy against the configured threshold.
   * Can be called inside an ongoing transaction or standalone.
   * If occupancy meets or exceeds threshold, latches exactly one alert per bin + cycle.
   */
  async evaluateBinCapacityAndAlert(
    binId: string,
    occupiedSpc: number,
    capacitySpc: number,
    cycleId: string,
    locationName: string,
    externalTransaction?: FirebaseFirestore.Transaction,
    overrideThreshold?: 75 | 80 | 85
  ): Promise<{ alertTriggered: boolean; alertId: string | null }> {
    const runInTx = async (transaction: FirebaseFirestore.Transaction) => {
      // 1. Read global operational settings
      const settingsRef = this.firestore.doc("adminSettings/global");
      const settingsSnap = await transaction.get(settingsRef);
      const settingsData = settingsSnap.data() ?? {};
      const threshold =
        overrideThreshold ??
        ((Number(settingsData.capacityAlertThreshold ?? 85) || 85) as 75 | 80 | 85);
      const operationalSettingsVersion = Number(settingsData.version ?? 1);

      const alertId = computeAlertId(binId, cycleId);
      const alertRef = this.firestore.doc(`capacityAlerts/${alertId}`);
      const alertSnap = await transaction.get(alertRef);

      const rawFillPercent = Math.round((Math.max(0, occupiedSpc) / capacitySpc) * 100);

      // If alert already exists, keep it latched; update currentFillPercent
      if (alertSnap.exists) {
        transaction.update(alertRef, {
          currentFillPercent: rawFillPercent,
          updatedAt: FieldValue.serverTimestamp(),
        });
        const alertViewRef = this.firestore.doc(`adminAlertViews/${alertId}`);
        transaction.set(
          alertViewRef,
          {
            currentFillPercent: rawFillPercent,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return { alertTriggered: false, alertId };
      }

      // Check if threshold is crossed
      if (shouldTriggerAlert(occupiedSpc, capacitySpc, threshold)) {
        // Create new alert
        const nowIso = new Date().toISOString();
        transaction.set(alertRef, {
          id: alertId,
          binId,
          locationName,
          cycleId,
          thresholdSnapshot: threshold,
          operationalSettingsVersion,
          triggeringOccupiedSpc: occupiedSpc,
          triggeringCapacitySpc: capacitySpc,
          triggeringFillPercent: rawFillPercent,
          currentFillPercent: rawFillPercent,
          state: "pending",
          version: 1,
          triggeredAt: FieldValue.serverTimestamp(),
          scheduledAt: null,
          scheduledBy: null,
          collectedAt: null,
          collectedBy: null,
          resolvedAt: null,
          resolvedBy: null,
          collectionEventId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Write projection
        const alertView = this.projectionsStore.projectAlert({
          id: alertId,
          binId,
          locationName,
          cycleId,
          thresholdSnapshot: threshold,
          operationalSettingsVersion,
          triggeringFillPercent: rawFillPercent,
          currentFillPercent: rawFillPercent,
          state: "pending",
          version: 1,
          triggeredAt: nowIso,
        });

        const alertViewRef = this.firestore.doc(`adminAlertViews/${alertId}`);
        transaction.set(alertViewRef, {
          ...alertView,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update bin collection state
        const binCollectionStateRef = this.firestore.doc(`binCollectionState/${binId}`);
        transaction.set(
          binCollectionStateRef,
          {
            binId,
            currentCycleId: cycleId,
            status: "alert_pending",
            activeAlertId: alertId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // Update bin projection to warning/critical
        const binViewRef = this.firestore.doc(`adminBinViews/${binId}`);
        transaction.set(
          binViewRef,
          {
            collectionState: "collection_pending",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { alertTriggered: true, alertId };
      }

      return { alertTriggered: false, alertId: null };
    };

    if (externalTransaction) {
      return runInTx(externalTransaction);
    } else {
      return this.firestore.runTransaction(runInTx);
    }
  }

  /**
   * Consumes AB-05 threshold-reconciliation intents (`adminIntents/intent-reconcile-*`).
   * Evaluates all active bins against the current threshold.
   * Does NOT rewrite historical alerts, old thresholds, or historical cycles.
   */
  async reconcileThresholdIntents(): Promise<{ reconciledCount: number }> {
    const intentsSnap = await this.firestore
      .collection("adminIntents")
      .where("action", "==", "reconcileThreshold")
      .where("status", "==", "pending")
      .limit(10)
      .get();

    if (intentsSnap.empty) {
      return { reconciledCount: 0 };
    }

    let reconciledCount = 0;

    for (const intentDoc of intentsSnap.docs) {
      const intentData = intentDoc.data();
      const threshold = (Number(intentData.threshold ?? 85) || 85) as 75 | 80 | 85;

      // Scan all bins
      const binsSnap = await this.firestore.collection("bins").get();
      for (const binDoc of binsSnap.docs) {
        const bin = binDoc.data();
        const binId = binDoc.id;
        const capacitySpc = Number(bin.capacitySpc ?? 1000);
        const occupiedSpc = Number(bin.occupiedSpc ?? 0);
        const cycleId = String(bin.cycleId ?? `cycle-${binId}-001`);
        const locationName = String(bin.locationName ?? "Unknown Location");

        if (capacitySpc > 0 && (occupiedSpc / capacitySpc) * 100 >= threshold) {
          const alertId = computeAlertId(binId, cycleId);
          const alertRef = this.firestore.doc(`capacityAlerts/${alertId}`);
          const alertSnap = await alertRef.get();

          // Only create alert if none exists for this bin + cycle
          if (!alertSnap.exists) {
            await this.evaluateBinCapacityAndAlert(
              binId,
              occupiedSpc,
              capacitySpc,
              cycleId,
              locationName,
              undefined,
              threshold
            );
          }
        }
      }

      await intentDoc.ref.update({
        status: "completed",
        completedAt: FieldValue.serverTimestamp(),
      });

      reconciledCount += 1;
    }

    if (reconciledCount > 0) {
      await Promise.all([
        this.readVersionsStore.bumpVersion("alerts"),
        this.readVersionsStore.bumpVersion("bins"),
        this.readVersionsStore.bumpVersion("dashboard"),
      ]);
    }

    return { reconciledCount };
  }
}
