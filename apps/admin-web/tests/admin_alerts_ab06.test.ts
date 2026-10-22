// =============================================================================
// admin_alerts_ab06.test.ts — Unit tests for Phase AB-06 Capacity Alerts & Collection
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeAdminAlertView,
  adminAlertViewToRow,
  type AdminAlertView,
} from "../src/contracts/adminViewCodecs.ts";
import { FirebaseAlertsRepository } from "../src/data/firebase/firebaseAlertsRepository.ts";
import { createMockRepositories } from "../src/data/mockRepositories.ts";
import type { FirebaseCommandClient } from "../src/core/firebase/commandClient.ts";

describe("Phase AB-06 — Admin Alert View Codecs", () => {
  it("decodes a valid server AdminAlertView projection cleanly", () => {
    const raw = {
      alertId: "alert-bin-01-cycle-01",
      binId: "bin-01",
      locationName: "Cyberjaya Community Centre",
      cycleId: "cycle-01",
      triggeringFillPercent: 88,
      currentFillPercent: 85,
      threshold: 80,
      operationalSettingsVersion: 2,
      state: "pending",
      version: 1,
      triggeredAt: "2026-10-21T10:00:00.000Z",
      scheduledAt: null,
      scheduledBy: null,
      collectedAt: null,
      collectedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      collectionEventId: null,
    };

    const decoded = decodeAdminAlertView(raw);
    assert.equal(decoded.alertId, "alert-bin-01-cycle-01");
    assert.equal(decoded.binId, "bin-01");
    assert.equal(decoded.locationName, "Cyberjaya Community Centre");
    assert.equal(decoded.triggeringFillPercent, 88);
    assert.equal(decoded.currentFillPercent, 85);
    assert.equal(decoded.threshold, 80);
    assert.equal(decoded.state, "pending");
    assert.equal(decoded.version, 1);
  });

  it("clamps invalid percentages and normalizes Firestore timestamp objects", () => {
    const raw = {
      alertId: "alert-bin-clamp",
      binId: "bin-clamp",
      locationName: "Clamp Station",
      cycleId: "cycle-clamp",
      triggeringFillPercent: 125, // should clamp to 100
      currentFillPercent: -10, // should clamp to 0
      threshold: 90, // invalid threshold, should fallback to 85
      state: "unknown_state", // should fallback to pending
      triggeredAt: { _seconds: 1792476000, _nanoseconds: 0 },
    };

    const decoded = decodeAdminAlertView(raw);
    assert.equal(decoded.triggeringFillPercent, 100);
    assert.equal(decoded.currentFillPercent, 0);
    assert.equal(decoded.threshold, 85);
    assert.equal(decoded.state, "pending");
    assert.ok(decoded.triggeredAt.includes("Z") || decoded.triggeredAt.includes("T"));
  });

  it("maps AdminAlertView accurately to UI CapacityAlertRow across all lifecycle states", () => {
    const baseView: AdminAlertView = {
      alertId: "alert-bin-1-cycle-1",
      binId: "bin-1",
      locationName: "Main Square",
      cycleId: "cycle-1",
      triggeringFillPercent: 86,
      currentFillPercent: 86,
      threshold: 85,
      operationalSettingsVersion: 1,
      state: "pending",
      version: 1,
      triggeredAt: "2026-10-21T10:00:00.000Z",
      scheduledAt: null,
      scheduledBy: null,
      collectedAt: null,
      collectedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      collectionEventId: null,
    };

    // 1. Pending state
    const pendingRow = adminAlertViewToRow(baseView);
    assert.equal(pendingRow.alert.status, "active");
    assert.equal(pendingRow.operations.collectionStatus, "pending");
    assert.equal(pendingRow.bin.capacityPercent, 86);

    // 2. Scheduled state
    const scheduledRow = adminAlertViewToRow({ ...baseView, state: "scheduled", scheduledBy: "admin-1" });
    assert.equal(scheduledRow.alert.status, "active");
    assert.equal(scheduledRow.operations.collectionStatus, "scheduled");

    // 3. Collected state (awaiting resolution)
    const collectedRow = adminAlertViewToRow({
      ...baseView,
      state: "collected",
      currentFillPercent: 0,
      collectedBy: "admin-1",
    });
    assert.equal(collectedRow.alert.status, "active");
    assert.equal(collectedRow.operations.collectionStatus, "collected");
    assert.equal(collectedRow.bin.capacityPercent, 0);

    // 4. Resolved state
    const resolvedRow = adminAlertViewToRow({
      ...baseView,
      state: "resolved",
      resolvedAt: "2026-10-21T11:00:00.000Z",
      resolvedBy: "admin-1",
    });
    assert.equal(resolvedRow.alert.status, "resolved");
    assert.equal(resolvedRow.operations.collectionStatus, "collected");
  });
});

describe("Phase AB-06 — FirebaseAlertsRepository", () => {
  const executedCommands: Array<{ operation: string; payload: unknown }> = [];

  const fakeCommandClient: FirebaseCommandClient = {
    generateRequestId: () => "req-test-alerts-001",
    execute: async <T extends Record<string, unknown>, R = Record<string, unknown>>(
      operation: string,
      payload: T
    ) => {
      executedCommands.push({ operation, payload });
      return {
        schemaVersion: "admin.v1",
        operation,
        requestId: "req-test-alerts-001",
        traceId: "trace-test-alerts-001",
        status: "committed",
        data: {
          resourceId: "alert-test-001",
          version: Number((payload as any).expectedVersion ?? 1) + 1,
          operationState: "applied",
          committedAt: new Date().toISOString(),
        } as unknown as R,
      };
    },
    recover: async () => {
      throw new Error("Not implemented");
    },
    mapFirebaseError: (err: unknown, _op: string) => {
      throw err;
    },
  } as unknown as FirebaseCommandClient;

  let currentAlert: AdminAlertView = {
    alertId: "alert-bin-test-cycle-001",
    binId: "bin-test",
    locationName: "Test Facility",
    cycleId: "cycle-001",
    triggeringFillPercent: 90,
    currentFillPercent: 90,
    threshold: 85,
    operationalSettingsVersion: 1,
    state: "pending",
    version: 1,
    triggeredAt: "2026-10-21T09:00:00.000Z",
    scheduledAt: null,
    scheduledBy: null,
    collectedAt: null,
    collectedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    collectionEventId: null,
  };

  const fakeFunctions = {
    customDomain: null,
  } as any;

  // We test the command invocation behavior
  it("schedules collection via commandClient with expectedVersion", async () => {
    executedCommands.length = 0;
    const fallback = createMockRepositories();

    const repo = new FirebaseAlertsRepository(
      fakeFunctions,
      {} as any,
      fakeCommandClient,
      fallback.repositories.alerts
    );

    // Mock getRawAlert / get
    (repo as any).getRawAlert = async () => currentAlert;
    (repo as any).get = async () => adminAlertViewToRow(currentAlert);

    await repo.schedule("alert-bin-test-cycle-001");

    assert.equal(executedCommands.length, 1);
    assert.equal(executedCommands[0].operation, "adminScheduleCollection");
    assert.deepEqual(executedCommands[0].payload, {
      alertId: "alert-bin-test-cycle-001",
      expectedVersion: 1,
    });
  });

  it("records collection via commandClient with binId and expectedCycleId", async () => {
    executedCommands.length = 0;
    const fallback = createMockRepositories();

    const repo = new FirebaseAlertsRepository(
      fakeFunctions,
      {} as any,
      fakeCommandClient,
      fallback.repositories.alerts
    );

    (repo as any).getRawAlert = async () => ({
      ...currentAlert,
      state: "scheduled",
      version: 2,
    });
    (repo as any).get = async () => adminAlertViewToRow({
      ...currentAlert,
      state: "collected",
      currentFillPercent: 0,
      version: 3,
    });

    await repo.collect("alert-bin-test-cycle-001");

    assert.equal(executedCommands.length, 1);
    assert.equal(executedCommands[0].operation, "adminRecordCollection");
    assert.deepEqual(executedCommands[0].payload, {
      binId: "bin-test",
      expectedCycleId: "cycle-001",
    });
  });

  it("resolves capacity alert via commandClient with expectedVersion", async () => {
    executedCommands.length = 0;
    const fallback = createMockRepositories();

    const repo = new FirebaseAlertsRepository(
      fakeFunctions,
      {} as any,
      fakeCommandClient,
      fallback.repositories.alerts
    );

    (repo as any).getRawAlert = async () => ({
      ...currentAlert,
      state: "collected",
      version: 3,
    });
    (repo as any).get = async () => adminAlertViewToRow({
      ...currentAlert,
      state: "resolved",
      version: 4,
    });

    await repo.resolve("alert-bin-test-cycle-001");

    assert.equal(executedCommands.length, 1);
    assert.equal(executedCommands[0].operation, "adminResolveCapacityAlert");
    assert.deepEqual(executedCommands[0].payload, {
      alertId: "alert-bin-test-cycle-001",
      expectedVersion: 3,
    });
  });
});
