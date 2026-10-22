// =============================================================================
// admin_bins.test.ts — Unit tests for Admin Bin Management & QR Generation
// Phase AB-04 — Creation, updates, deletion restrictions, and QR export
// =============================================================================

import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import {
  validateBinId,
  validateCapacitySpc,
  validateLocationName,
  validateLocationDetail,
  computeQrId,
  computeQrPayload,
  computeInitialCycleId,
} from "../../src/domain/admin_bins.js";
import { FirestoreAdminBinsStore } from "../../src/infrastructure/firestore/admin_bins_store.js";
import { FirestoreAdminOperationsStore } from "../../src/infrastructure/firestore/admin_operations_store.js";
import { FirestoreAdminProjectionsStore } from "../../src/infrastructure/firestore/admin_projections_store.js";
import { FirestoreAdminReadVersionsStore } from "../../src/infrastructure/firestore/admin_read_versions_store.js";
import type { AdminVerificationResult } from "../../src/infrastructure/firestore/admin_accounts_store.js";

describe("Phase AB-04 — Admin Bin Domain Invariants & Validation", () => {
  it("validates bin identifiers matching allowed pattern", () => {
    expect(() => validateBinId("BIN-001")).not.toThrow();
    expect(() => validateBinId("bin.123_test:alpha")).not.toThrow();
    expect(() => validateBinId("")).toThrow(/Invalid bin ID/);
    expect(() => validateBinId("-invalid-prefix")).toThrow(/Invalid bin ID/);
    expect(() => validateBinId("invalid spaces in id")).toThrow(/Invalid bin ID/);
  });

  it("validates positive integer capacity within 50 to 5000 spc", () => {
    expect(() => validateCapacitySpc(50)).not.toThrow();
    expect(() => validateCapacitySpc(1000)).not.toThrow();
    expect(() => validateCapacitySpc(5000)).not.toThrow();

    expect(() => validateCapacitySpc(49)).toThrow(/Invalid capacitySpc/);
    expect(() => validateCapacitySpc(5001)).toThrow(/Invalid capacitySpc/);
    expect(() => validateCapacitySpc(100.5)).toThrow(/Invalid capacitySpc/);
    expect(() => validateCapacitySpc(NaN)).toThrow(/Invalid capacitySpc/);
  });

  it("validates locationName length constraints (2 to 100 chars)", () => {
    expect(() => validateLocationName("Lobby A")).not.toThrow();
    expect(() => validateLocationName("")).toThrow(/Location name must be between/);
    expect(() => validateLocationName("A")).toThrow(/Location name must be between/);
    expect(() => validateLocationName("A".repeat(101))).toThrow(/Location name must be between/);
  });

  it("validates locationDetail length constraints (2 to 160 chars)", () => {
    expect(() => validateLocationDetail("Floor 1 Recycling Station")).not.toThrow();
    expect(() => validateLocationDetail("")).toThrow(/Location detail must be between/);
    expect(() => validateLocationDetail("B")).toThrow(/Location detail must be between/);
    expect(() => validateLocationDetail("B".repeat(161))).toThrow(/Location detail must be between/);
  });

  it("computes registered hardware QR payload and initial cycle ID", () => {
    const binId = "BIN-777";
    const qrId = computeQrId(binId);
    expect(qrId).toBe("qr-BIN-777");

    const payload = computeQrPayload(qrId);
    expect(payload).toBe("ecoloop://bin/qr-BIN-777");

    const cycleId = computeInitialCycleId(binId);
    expect(cycleId).toBe("BIN-777-cycle-001");
  });
});

describe("Phase AB-04 — FirestoreAdminBinsStore Lifecycle & Safety Fencing", () => {
  const caller: AdminVerificationResult = {
    uid: "admin-tester",
    email: "tester@ecoloop.test",
    displayName: "Admin Tester",
    enabled: true,
    role: "admin",
  };

  function createMockStore(initialDocs: Record<string, unknown> = {}) {
    const docs = { ...initialDocs };
    const writtenAuditEvents: unknown[] = [];

    const mockFirestore = {
      doc: (path: string) => ({
        get: async () => ({
          exists: Boolean(docs[path]),
          data: () => docs[path] as Record<string, unknown>,
          id: path.split("/").pop()!,
        }),
        set: async (data: unknown) => {
          docs[path] = data;
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
          where: () => ({
            limit: () => ({
              get: async () => ({
                empty: true,
                docs: [],
              }),
            }),
          }),
          limit: (n: number) => ({
            get: async () => {
              const matches = Object.entries(docs).filter(([k, v]) => {
                if (!k.startsWith(`${colPath}/`)) return false;
                const rec = v as Record<string, unknown>;
                return rec[field] === val;
              });
              return {
                empty: matches.length === 0,
                docs: matches.slice(0, n).map(([_, v]) => ({
                  data: () => v as Record<string, unknown>,
                })),
              };
            },
          }),
        }),
      }),
      runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: any) => ref.get(),
          set: (ref: any, data: any) => {
            if (ref.id && ref.id.includes("-")) {
              writtenAuditEvents.push(data);
            }
            ref.set(data);
          },
          update: (ref: any, data: any) => ref.update(data),
          delete: (ref: any) => ref.delete(),
        };
        return await updateFunction(tx);
      },
    } as unknown as Firestore;

    const operationsStore = new FirestoreAdminOperationsStore(mockFirestore);
    const projectionsStore = new FirestoreAdminProjectionsStore(mockFirestore);
    const readVersionsStore = new FirestoreAdminReadVersionsStore(mockFirestore);

    const binsStore = new FirestoreAdminBinsStore(
      mockFirestore,
      operationsStore,
      projectionsStore,
      readVersionsStore
    );

    return { binsStore, docs, writtenAuditEvents };
  }

  it("creates bin, initial zero-opening cycle, operations state, and QR mapping coherently", async () => {
    const { binsStore, docs } = createMockStore();

    const response = await binsStore.createBin(
      caller,
      {
        binId: "BIN-999",
        locationName: "Solar Plaza",
        locationDetail: "Building B Level 2",
        capacitySpc: 1200,
      },
      "req-create-1",
      "trace-1",
      new Date().toISOString()
    );

    expect(response.status).toBe("committed");
    expect(response.data.resourceId).toBe("BIN-999");
    expect(response.data.version).toBe(1);

    // Verify canonical bin
    const binDoc = docs["bins/BIN-999"] as Record<string, unknown>;
    expect(binDoc).toBeDefined();
    expect(binDoc.capacitySpc).toBe(1200);
    expect(binDoc.occupiedSpc).toBe(0);
    expect(binDoc.cycleId).toBe("BIN-999-cycle-001");
    expect(binDoc.enabled).toBe(true);

    // Verify cycle record
    const cycleDoc = docs["binCycles/BIN-999-cycle-001"] as Record<string, unknown>;
    expect(cycleDoc).toBeDefined();
    expect(cycleDoc.openingOccupiedSpc).toBe(0);
    expect(cycleDoc.capacitySpc).toBe(1200);

    // Verify bin operations record
    const opsDoc = docs["binOperations/BIN-999"] as Record<string, unknown>;
    expect(opsDoc).toBeDefined();
    expect(opsDoc.phase).toBe("available");
    expect(opsDoc.sessionId).toBeNull();

    // Verify QR mapping record
    const qrDoc = docs["binQrMappings/qr-BIN-999"] as Record<string, unknown>;
    expect(qrDoc).toBeDefined();
    expect(qrDoc.qrPayload).toBe("ecoloop://bin/qr-BIN-999");
    expect(qrDoc.enabled).toBe(true);
  });

  it("prevents creating a bin with a retired tombstoned ID", async () => {
    const { binsStore } = createMockStore({
      "binTombstones/BIN-TOMB": {
        binId: "BIN-TOMB",
        deletedBy: "admin-1",
        reason: "Admin deleted unused bin",
      },
    });

    await expect(
      binsStore.createBin(
        caller,
        {
          binId: "BIN-TOMB",
          locationName: "Old Plaza",
          locationDetail: "Ground Floor",
          capacitySpc: 1000,
        },
        "req-tomb",
        "trace-tomb",
        new Date().toISOString()
      )
    ).rejects.toThrow(/retired and cannot be reused/);
  });

  it("updates bin location and enabled state with version checking", async () => {
    const { binsStore, docs } = createMockStore({
      "bins/BIN-UPD": {
        id: "BIN-UPD",
        locationName: "Old Name",
        locationDetail: "Old Detail",
        capacitySpc: 1000,
        occupiedSpc: 0,
        version: 1,
        enabled: true,
      },
      "binQrMappings/qr-BIN-UPD": {
        id: "qr-BIN-UPD",
        binId: "BIN-UPD",
        enabled: true,
        mappingVersion: 1,
      },
    });

    const response = await binsStore.updateBin(
      caller,
      {
        binId: "BIN-UPD",
        expectedVersion: 1,
        locationName: "New Plaza Name",
        locationDetail: "Updated Station Room",
        enabled: false,
      },
      "req-upd-1",
      "trace-upd",
      new Date().toISOString()
    );

    expect(response.status).toBe("committed");
    expect(response.data.version).toBe(2);

    const binDoc = docs["bins/BIN-UPD"] as Record<string, unknown>;
    expect(binDoc.locationName).toBe("New Plaza Name");
    expect(binDoc.enabled).toBe(false);
    expect(binDoc.version).toBe(2);

    // Stale version update rejection
    await expect(
      binsStore.updateBin(
        caller,
        {
          binId: "BIN-UPD",
          expectedVersion: 1, // now version is 2
          locationName: "Stale Edit",
          locationDetail: "Stale Detail",
          enabled: true,
        },
        "req-stale",
        "trace-stale",
        new Date().toISOString()
      )
    ).rejects.toThrow(/Stale bin version/);
  });

  it("enforces deletion restrictions: occupied or referenced bins cannot be deleted", async () => {
    // 1. Occupied bin
    const { binsStore: occupiedStore } = createMockStore({
      "bins/BIN-OCC": {
        id: "BIN-OCC",
        occupiedSpc: 150,
        capacitySpc: 1000,
        version: 1,
      },
    });
    await expect(
      occupiedStore.deleteUnusedBin(
        caller,
        { binId: "BIN-OCC", expectedVersion: 1 },
        "req-del-occ",
        "trace-del-occ",
        new Date().toISOString()
      )
    ).rejects.toThrow(/contains 150 spc of collected materials/);

    // 2. Active reservation
    const { binsStore: reservedStore } = createMockStore({
      "bins/BIN-RES": {
        id: "BIN-RES",
        occupiedSpc: 0,
        capacitySpc: 1000,
        version: 1,
      },
      "binOperations/BIN-RES": {
        binId: "BIN-RES",
        phase: "reserved",
        sessionId: "sess-123",
      },
    });
    await expect(
      reservedStore.deleteUnusedBin(
        caller,
        { binId: "BIN-RES", expectedVersion: 1 },
        "req-del-res",
        "trace-del-res",
        new Date().toISOString()
      )
    ).rejects.toThrow(/active reservation or session/);

    // 3. Historical batch reference
    const { binsStore: historyStore } = createMockStore({
      "bins/BIN-HIST": {
        id: "BIN-HIST",
        occupiedSpc: 0,
        capacitySpc: 1000,
        version: 1,
      },
      "binOperations/BIN-HIST": {
        phase: "available",
        sessionId: null,
      },
      "batches/batch-001": {
        id: "batch-001",
        binId: "BIN-HIST",
      },
    });
    await expect(
      historyStore.deleteUnusedBin(
        caller,
        { binId: "BIN-HIST", expectedVersion: 1 },
        "req-del-hist",
        "trace-del-hist",
        new Date().toISOString()
      )
    ).rejects.toThrow(/historical activity/);
  });

  it("deletes unused empty bin, cleans records, and writes permanent tombstone", async () => {
    const { binsStore, docs } = createMockStore({
      "bins/BIN-EMPTY": {
        id: "BIN-EMPTY",
        occupiedSpc: 0,
        capacitySpc: 1000,
        version: 1,
      },
      "binCycles/BIN-EMPTY-cycle-001": {
        id: "BIN-EMPTY-cycle-001",
        binId: "BIN-EMPTY",
      },
      "binOperations/BIN-EMPTY": {
        phase: "available",
        sessionId: null,
      },
      "binQrMappings/qr-BIN-EMPTY": {
        id: "qr-BIN-EMPTY",
        binId: "BIN-EMPTY",
      },
      "adminBinViews/BIN-EMPTY": {
        binId: "BIN-EMPTY",
      },
    });

    const response = await binsStore.deleteUnusedBin(
      caller,
      { binId: "BIN-EMPTY", expectedVersion: 1 },
      "req-del-success",
      "trace-del-success",
      new Date().toISOString()
    );

    expect(response.status).toBe("committed");

    // All operational documents should be deleted
    expect(docs["bins/BIN-EMPTY"]).toBeUndefined();
    expect(docs["binCycles/BIN-EMPTY-cycle-001"]).toBeUndefined();
    expect(docs["binOperations/BIN-EMPTY"]).toBeUndefined();
    expect(docs["binQrMappings/qr-BIN-EMPTY"]).toBeUndefined();
    expect(docs["adminBinViews/BIN-EMPTY"]).toBeUndefined();

    // Permanent tombstone created to prevent reuse
    const tombstone = docs["binTombstones/BIN-EMPTY"] as Record<string, unknown>;
    expect(tombstone).toBeDefined();
    expect(tombstone.retiredQrPayload).toBe("ecoloop://bin/qr-BIN-EMPTY");
    expect(tombstone.deletedBy).toBe(caller.uid);
  });

  it("exports valid QR code data URL and SVG for existing bins", async () => {
    const { binsStore } = createMockStore({
      "bins/BIN-QR": {
        id: "BIN-QR",
        locationName: "QR Hub",
      },
    });

    const qrResult = await binsStore.getBinQr(caller, "BIN-QR");
    expect(qrResult.binId).toBe("BIN-QR");
    expect(qrResult.qrPayload).toBe("ecoloop://bin/qr-BIN-QR");
    expect(qrResult.dataUrl).toContain("data:image/png;base64,");
    expect(qrResult.svg).toContain("<svg");

    await expect(binsStore.getBinQr(caller, "NON-EXISTENT")).rejects.toThrow(/not found/);
  });
});
