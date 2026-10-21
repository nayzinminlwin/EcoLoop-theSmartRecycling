// =============================================================================
// admin_alerts.test.ts — Unit tests for Capacity Alerts & Collection Cycles
// Phase AB-06 — Capacity alerts and collection-cycle workflow
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  computeAlertId,
  validateAlertId,
  validateExpectedVersion,
  validateAlertTransition,
  shouldTriggerAlert,
  computeNextCycleId,
  computeCollectionEventId,
} from "../../src/domain/admin_alerts.js";
import { FirestoreAdminAlertsStore } from "../../src/infrastructure/firestore/admin_alerts_store.js";
import { FirestoreAdminOperationsStore } from "../../src/infrastructure/firestore/admin_operations_store.js";
import { FirestoreAdminProjectionsStore } from "../../src/infrastructure/firestore/admin_projections_store.js";
import { FirestoreAdminReadVersionsStore } from "../../src/infrastructure/firestore/admin_read_versions_store.js";
import type { AdminVerificationResult } from "../../src/infrastructure/firestore/admin_accounts_store.js";

describe("Phase AB-06 — Domain State Machine & Validations", () => {
  it("computes deterministic alert ID marker: alert-${binId}-${cycleId}", () => {
    const id1 = computeAlertId("bin-demo-01", "bin-demo-01-cycle-001");
    const id2 = computeAlertId("BIN-DEMO-01", "bin-demo-01-cycle-001");
    expect(id1).toBe("alert-bin-demo-01-bin-demo-01-cycle-001");
    expect(id2).toBe("alert-bin-demo-01-bin-demo-01-cycle-001");
  });

  it("validates alertId format", () => {
    expect(() => validateAlertId("alert-bin1-cycle1")).not.toThrow();
    expect(() => validateAlertId("")).toThrow(/alertId is required/);
    expect(() => validateAlertId("invalid-id")).toThrow(/Invalid alertId format/);
  });

  it("validates expectedVersion is a non-negative integer", () => {
    expect(() => validateExpectedVersion(0)).not.toThrow();
    expect(() => validateExpectedVersion(5)).not.toThrow();
    expect(() => validateExpectedVersion(-1)).toThrow(/expectedVersion must be a non-negative integer/);
    expect(() => validateExpectedVersion(1.5)).toThrow(/expectedVersion must be a non-negative integer/);
  });

  it("enforces valid transitions in alert lifecycle: pending -> scheduled -> collected -> resolved", () => {
    expect(() => validateAlertTransition("pending", "scheduled")).not.toThrow();
    expect(() => validateAlertTransition("pending", "collected")).not.toThrow();
    expect(() => validateAlertTransition("scheduled", "collected")).not.toThrow();
    expect(() => validateAlertTransition("collected", "resolved")).not.toThrow();

    // Disallowed transitions
    expect(() => validateAlertTransition("pending", "resolved")).toThrow(/Invalid alert transition/);
    expect(() => validateAlertTransition("scheduled", "pending")).toThrow(/Invalid alert transition/);
    expect(() => validateAlertTransition("collected", "scheduled")).toThrow(/Invalid alert transition/);
    expect(() => validateAlertTransition("resolved", "pending")).toThrow(/Invalid alert transition/);
    expect(() => validateAlertTransition("resolved", "scheduled")).toThrow(/Invalid alert transition/);
    expect(() => validateAlertTransition("resolved", "collected")).toThrow(/Invalid alert transition/);
  });

  it("evaluates shouldTriggerAlert correctly across occupancy thresholds", () => {
    expect(shouldTriggerAlert(850, 1000, 85)).toBe(true);
    expect(shouldTriggerAlert(849, 1000, 85)).toBe(true); // round(84.9) = 85
    expect(shouldTriggerAlert(840, 1000, 85)).toBe(false); // round(84) = 84 < 85
    expect(shouldTriggerAlert(750, 1000, 75)).toBe(true);
    expect(shouldTriggerAlert(700, 1000, 75)).toBe(false);
    expect(shouldTriggerAlert(0, 1000, 75)).toBe(false);
    expect(shouldTriggerAlert(100, 0, 75)).toBe(false);
  });

  it("computes next cycle ID sequence cleanly", () => {
    expect(computeNextCycleId("bin-001", "bin-001-cycle-001")).toBe("bin-001-cycle-002");
    expect(computeNextCycleId("bin-001", "bin-001-cycle-009")).toBe("bin-001-cycle-010");
  });

  it("computes deterministic collection event ID", () => {
    const eventId = computeCollectionEventId("bin-01", "req-test-12345");
    expect(eventId).toBe("collection-bin-01-reqtest12345");
  });
});

describe("Phase AB-06 — Transactional Alert Store & Operations", () => {
  const caller: AdminVerificationResult = {
    uid: "admin-tester",
    email: "admin@ecoloop.test",
    displayName: "Admin Tester",
    enabled: true,
    role: "admin",
  };

  function createMockAlertStore(initialDocs: Record<string, unknown> = {}) {
    const docs = { ...initialDocs };
    const auditEvents: unknown[] = [];

    const mockFirestore = {
      doc: (path: string) => ({
        id: path.split("/").pop()!,
        get: async () => ({
          exists: Boolean(docs[path]),
          data: () => docs[path] as Record<string, unknown>,
          id: path.split("/").pop()!,
        }),
        set: async (data: unknown, options?: { merge?: boolean }) => {
          if (options?.merge && docs[path]) {
            docs[path] = { ...(docs[path] as Record<string, unknown>), ...(data as Record<string, unknown>) };
          } else {
            docs[path] = data;
          }
        },
        update: async (data: Record<string, unknown>) => {
          docs[path] = { ...((docs[path] as Record<string, unknown>) ?? {}), ...data };
        },
        delete: async () => {
          delete docs[path];
        },
      }),
      collection: (colPath: string) => ({
        where: (field: string, op: string, val: unknown) => ({
          where: (field2: string, op2: string, val2: unknown) => ({
            limit: () => ({
              get: async () => {
                const matches = Object.entries(docs)
                  .filter(([k, v]) => k.startsWith(`${colPath}/`))
                  .filter(([_, v]) => (v as any)[field] === val && (v as any)[field2] === val2)
                  .map(([k, v]) => ({
                    id: k.split("/").pop()!,
                    data: () => v,
                    ref: mockFirestore.doc(k),
                  }));
                return { empty: matches.length === 0, docs: matches };
              },
            }),
          }),
        }),
        get: async () => {
          const matches = Object.entries(docs)
            .filter(([k]) => k.startsWith(`${colPath}/`))
            .map(([k, v]) => ({
              id: k.split("/").pop()!,
              data: () => v,
              ref: mockFirestore.doc(k),
            }));
          return { empty: matches.length === 0, docs: matches };
        },
      }),
      runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: any) => ref.get(),
          set: (ref: any, data: any, options?: any) => {
            if (ref.id && ref.id.includes("-") && data.action) {
              auditEvents.push(data);
            }
            ref.set(data, options);
          },
          update: (ref: any, data: any) => ref.update(data),
          delete: (ref: any) => ref.delete(),
        };
        return await updateFunction(tx);
      },
    };

    const operationsStore = new FirestoreAdminOperationsStore(mockFirestore as any);
    const readVersionsStore = new FirestoreAdminReadVersionsStore(mockFirestore as any);
    const projectionsStore = new FirestoreAdminProjectionsStore(mockFirestore as any);
    const store = new FirestoreAdminAlertsStore(
      mockFirestore as any,
      operationsStore,
      projectionsStore,
      readVersionsStore
    );

    return { store, docs, auditEvents, mockFirestore };
  }

  it("schedules collection on pending alert and updates views and versions", async () => {
    const alertId = "alert-bin-1-cycle-1";
    const { store, docs } = createMockAlertStore({
      [`capacityAlerts/${alertId}`]: {
        id: alertId,
        binId: "bin-1",
        cycleId: "cycle-1",
        state: "pending",
        version: 1,
        triggeringFillPercent: 88,
        thresholdSnapshot: 85,
      },
      "binCollectionState/bin-1": {
        binId: "bin-1",
        status: "alert_pending",
        activeAlertId: alertId,
      },
    });

    const res = await store.scheduleCollection(
      caller,
      { alertId, expectedVersion: 1 },
      "req-sched-01",
      "trace-sched-01",
      "2026-10-21T11:00:00.000Z"
    );

    expect(res.status).toBe("committed");
    expect(res.data.operationState).toBe("applied");

    const alertDoc = docs[`capacityAlerts/${alertId}`] as any;
    expect(alertDoc.state).toBe("scheduled");
    expect(alertDoc.version).toBe(2);
    expect(alertDoc.scheduledBy).toBe("admin-tester");

    const colState = docs["binCollectionState/bin-1"] as any;
    expect(colState.status).toBe("collection_scheduled");

    const alertView = docs[`adminAlertViews/${alertId}`] as any;
    expect(alertView.state).toBe("scheduled");
    expect(alertView.version).toBe(2);
  });

  it("rejects schedule collection when expectedVersion does not match (concurrency conflict)", async () => {
    const alertId = "alert-bin-1-cycle-1";
    const { store } = createMockAlertStore({
      [`capacityAlerts/${alertId}`]: {
        id: alertId,
        binId: "bin-1",
        cycleId: "cycle-1",
        state: "pending",
        version: 2,
      },
    });

    await expect(
      store.scheduleCollection(
        caller,
        { alertId, expectedVersion: 1 },
        "req-sched-conflict",
        "trace-conflict",
        "2026-10-21T11:00:00.000Z"
      )
    ).rejects.toThrow(/Concurrency conflict/);
  });

  it("records collection: closes old cycle, opens 0% cycle, creates collectionEvent, resets bin occupancy, and updates alert to collected", async () => {
    const binId = "bin-1";
    const cycleId = "bin-1-cycle-001";
    const alertId = computeAlertId(binId, cycleId);

    const { store, docs, auditEvents } = createMockAlertStore({
      [`bins/${binId}`]: {
        id: binId,
        capacitySpc: 1000,
        occupiedSpc: 880,
        capacityPercent: 88,
        cycleId,
        version: 3,
      },
      [`binOperations/${binId}`]: {
        binId,
        ownerId: null,
        sessionId: null,
      },
      [`capacityAlerts/${alertId}`]: {
        id: alertId,
        binId,
        cycleId,
        state: "scheduled",
        version: 2,
      },
      [`binCycles/${cycleId}`]: {
        id: cycleId,
        binId,
        status: "open",
        openingOccupiedSpc: 0,
      },
    });

    const res = await store.recordCollection(
      caller,
      { binId, expectedCycleId: cycleId, notes: "Collected by truck team alpha" },
      "req-col-01",
      "trace-col-01",
      "2026-10-21T11:05:00.000Z"
    );

    expect(res.status).toBe("committed");

    // 1. Bin is reset to 0 occupancy and new cycle opened
    const bin = docs[`bins/${binId}`] as any;
    expect(bin.occupiedSpc).toBe(0);
    expect(bin.capacityPercent).toBe(0);
    expect(bin.cycleId).toBe("bin-1-cycle-002");
    expect(bin.version).toBe(4);

    // 2. Old cycle is closed
    const oldCycle = docs[`binCycles/${cycleId}`] as any;
    expect(oldCycle.status).toBe("closed");
    expect(oldCycle.finalOccupiedSpc).toBe(880);

    // 3. New cycle is created with 0 opening occupied spc
    const newCycle = docs["binCycles/bin-1-cycle-002"] as any;
    expect(newCycle.status).toBe("open");
    expect(newCycle.openingOccupiedSpc).toBe(0);
    expect(newCycle.capacitySpc).toBe(1000);

    // 4. Collection event is created
    const event = docs["collectionEvents/collection-bin-1-reqcol01"] as any;
    expect(event.collectedSpc).toBe(880);
    expect(event.collectorId).toBe("admin-tester");
    expect(event.previousCycleId).toBe(cycleId);
    expect(event.cycleId).toBe("bin-1-cycle-002");

    // 5. Alert state advanced to collected
    const alert = docs[`capacityAlerts/${alertId}`] as any;
    expect(alert.state).toBe("collected");
    expect(alert.version).toBe(3);
    expect(alert.collectedBy).toBe("admin-tester");
    expect(alert.collectionEventId).toBe("collection-bin-1-reqcol01");

    // 6. Bin collection state updated
    const colState = docs[`binCollectionState/${binId}`] as any;
    expect(colState.status).toBe("normal");
    expect(colState.currentCycleId).toBe("bin-1-cycle-002");
    expect(colState.activeAlertId).toBeNull();
  });

  it("rejects collection when cycle has changed (stale expectedCycleId)", async () => {
    const { store } = createMockAlertStore({
      "bins/bin-1": {
        id: "bin-1",
        cycleId: "bin-1-cycle-002",
      },
    });

    await expect(
      store.recordCollection(
        caller,
        { binId: "bin-1", expectedCycleId: "bin-1-cycle-001" },
        "req-stale-cycle",
        "trace-stale",
        "2026-10-21T11:00:00.000Z"
      )
    ).rejects.toThrow(/Bin collection cycle has changed/);
  });

  it("rejects collection when bin has active resident session", async () => {
    const { store } = createMockAlertStore({
      "bins/bin-1": {
        id: "bin-1",
        cycleId: "bin-1-cycle-001",
      },
      "binOperations/bin-1": {
        binId: "bin-1",
        ownerId: "resident-busy-123",
        sessionId: "sess-busy-123",
      },
    });

    await expect(
      store.recordCollection(
        caller,
        { binId: "bin-1", expectedCycleId: "bin-1-cycle-001" },
        "req-busy",
        "trace-busy",
        "2026-10-21T11:00:00.000Z"
      )
    ).rejects.toThrow(/while a deposit session is active/);
  });

  it("resolves collected alert: transitions to resolved without altering bin occupancy", async () => {
    const alertId = "alert-bin-1-bin-1-cycle-001";
    const { store, docs } = createMockAlertStore({
      [`capacityAlerts/${alertId}`]: {
        id: alertId,
        binId: "bin-1",
        cycleId: "bin-1-cycle-001",
        state: "collected",
        version: 3,
      },
      "bins/bin-1": {
        id: "bin-1",
        occupiedSpc: 150, // new cycle occupancy
        capacityPercent: 15,
        cycleId: "bin-1-cycle-002",
      },
    });

    const res = await store.resolveCapacityAlert(
      caller,
      { alertId, expectedVersion: 3 },
      "req-res-01",
      "trace-res-01",
      "2026-10-21T11:10:00.000Z"
    );

    expect(res.status).toBe("committed");

    const alert = docs[`capacityAlerts/${alertId}`] as any;
    expect(alert.state).toBe("resolved");
    expect(alert.version).toBe(4);
    expect(alert.resolvedBy).toBe("admin-tester");

    // Bin occupancy in the new cycle is completely unmutated
    const bin = docs["bins/bin-1"] as any;
    expect(bin.occupiedSpc).toBe(150);
    expect(bin.cycleId).toBe("bin-1-cycle-002");
  });

  it("rejects resolution of an alert that is not yet collected", async () => {
    const alertId = "alert-bin-1-cycle-1";
    const { store } = createMockAlertStore({
      [`capacityAlerts/${alertId}`]: {
        id: alertId,
        binId: "bin-1",
        cycleId: "cycle-1",
        state: "scheduled",
        version: 2,
      },
    });

    await expect(
      store.resolveCapacityAlert(
        caller,
        { alertId, expectedVersion: 2 },
        "req-res-invalid",
        "trace-invalid",
        "2026-10-21T11:00:00.000Z"
      )
    ).rejects.toThrow(/Only collected alerts can be resolved/);
  });

  it("evaluates occupancy against threshold and latches alert per bin + cycle", async () => {
    const { store, docs } = createMockAlertStore({
      "adminSettings/global": {
        capacityAlertThreshold: 80,
        version: 2,
      },
    });

    // 1. First trigger at 82% crosses 80% threshold
    const res1 = await store.evaluateBinCapacityAndAlert(
      "bin-alpha",
      820,
      1000,
      "cycle-alpha-1",
      "Alpha Station"
    );
    expect(res1.alertTriggered).toBe(true);
    expect(res1.alertId).toBe("alert-bin-alpha-cycle-alpha-1");

    const alertDoc = docs["capacityAlerts/alert-bin-alpha-cycle-alpha-1"] as any;
    expect(alertDoc.state).toBe("pending");
    expect(alertDoc.triggeringFillPercent).toBe(82);
    expect(alertDoc.thresholdSnapshot).toBe(80);

    // 2. Later correction drops occupancy to 70% (below 80% threshold).
    // Alert remains latched! Does not delete or unlatch.
    const res2 = await store.evaluateBinCapacityAndAlert(
      "bin-alpha",
      700,
      1000,
      "cycle-alpha-1",
      "Alpha Station"
    );
    expect(res2.alertTriggered).toBe(false); // already latched
    expect(res2.alertId).toBe("alert-bin-alpha-cycle-alpha-1");

    const latchedAlert = docs["capacityAlerts/alert-bin-alpha-cycle-alpha-1"] as any;
    expect(latchedAlert.state).toBe("pending");
    expect(latchedAlert.triggeringFillPercent).toBe(82); // preserves historical snapshot
    expect(latchedAlert.currentFillPercent).toBe(70); // updates current fill
  });

  it("reconciles threshold intent for active bins without duplicating alerts or rewriting history", async () => {
    const { store, docs } = createMockAlertStore({
      "adminIntents/intent-reconcile-01": {
        action: "reconcileThreshold",
        threshold: 75,
        status: "pending",
      },
      "bins/bin-existing-high": {
        id: "bin-existing-high",
        capacitySpc: 1000,
        occupiedSpc: 780, // 78% (above 75%, below 80%)
        cycleId: "cycle-high-01",
        locationName: "High Station",
      },
      "bins/bin-existing-low": {
        id: "bin-existing-low",
        capacitySpc: 1000,
        occupiedSpc: 500, // 50%
        cycleId: "cycle-low-01",
        locationName: "Low Station",
      },
    });

    const res = await store.reconcileThresholdIntents();
    expect(res.reconciledCount).toBe(1);

    // Intent is marked completed
    const intent = docs["adminIntents/intent-reconcile-01"] as any;
    expect(intent.status).toBe("completed");

    // bin-existing-high gets an alert created
    const alertId = computeAlertId("bin-existing-high", "cycle-high-01");
    expect(docs[`capacityAlerts/${alertId}`]).toBeDefined();

    // bin-existing-low does not get an alert
    const lowAlertId = computeAlertId("bin-existing-low", "cycle-low-01");
    expect(docs[`capacityAlerts/${lowAlertId}`]).toBeUndefined();
  });
});
