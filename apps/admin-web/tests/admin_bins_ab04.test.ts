// =============================================================================
// admin_bins_ab04.test.ts — Unit tests for Phase AB-04 Bin Management & QR Codes
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FirebaseBinRepository } from "../src/data/firebase/firebaseBinRepository.ts";
import { createMockRepositories } from "../src/data/mockRepositories.ts";
import { MOCK_LOGIN } from "../src/data/mockSeeds.ts";
import { RepositoryError } from "../src/data/repositories.ts";
import type { FirebaseCommandClient } from "../src/core/firebase/commandClient.ts";
import type { Functions } from "firebase/functions";
import type { Firestore } from "firebase/firestore";

describe("Phase AB-04 — FirebaseBinRepository & QR Code Export", () => {
  const executedCommands: Array<{ operation: string; payload: unknown }> = [];

  const fakeCommandClient: FirebaseCommandClient = {
    generateRequestId: () => "req-test-123",
    execute: async <T extends Record<string, unknown>, R = Record<string, unknown>>(
      operation: string,
      payload: T
    ) => {
      executedCommands.push({ operation, payload });
      return {
        schemaVersion: "admin.v1",
        operation,
        requestId: "req-test-123",
        traceId: "trace-test-123",
        status: "committed",
        data: {
          resourceId: String((payload as any).binId ?? "BIN-TEST"),
          version: 1,
          operationState: "applied",
          committedAt: new Date().toISOString(),
        } as unknown as R,
      };
    },
    recover: async () => {
      throw new Error("Not implemented");
    },
    mapFirebaseError: (_err: unknown, op: string) => {
      return new RepositoryError({
        code: "conflict",
        message: `Operation ${op} failed`,
        fieldErrors: {},
      });
    },
  } as unknown as FirebaseCommandClient;

  const fakeFallbackRepo = {
    get: async (id: string) => ({
      bin: {
        id,
        locationName: "Test Hub",
        locationDetail: "Test Station",
        capacityPercent: 0,
        acceptedMaterials: ["plastic", "aluminium", "glass", "paper"],
        isOnline: true,
        lastUpdatedAt: new Date().toISOString(),
      },
      operations: {
        binId: id,
        collectionStatus: "notScheduled" as const,
        lastCollectionTime: null,
      },
    }),
  } as any;

  it("disables direct capacity percentage simulation in live mode", async () => {
    const repo = new FirebaseBinRepository(
      {} as Functions,
      {} as Firestore,
      fakeCommandClient,
      fakeFallbackRepo
    );

    await assert.rejects(
      async () => {
        await repo.simulateCapacity("BIN-004", 85);
      },
      (err: unknown) => {
        assert.ok(err instanceof RepositoryError);
        assert.equal(err.code, "invalidTransition");
        assert.match(err.message, /simulation is disabled in live Firebase mode/);
        return true;
      }
    );
  });

  it("invokes adminCreateBin with positive integer capacitySpc", async () => {
    executedCommands.length = 0;
    const repo = new FirebaseBinRepository(
      {} as Functions,
      {} as Firestore,
      fakeCommandClient,
      fakeFallbackRepo
    );

    const result = await repo.create("BIN-NEW", {
      locationName: "New Center",
      locationDetail: "North Lobby",
      capacityPercent: 0,
      capacitySpc: 1500,
      acceptedMaterials: ["plastic", "glass"],
      isOnline: true,
    });

    assert.equal(result.bin.id, "BIN-NEW");
    assert.equal(executedCommands.length, 1);
    assert.equal(executedCommands[0]?.operation, "adminCreateBin");
    const payload = executedCommands[0]?.payload as Record<string, unknown>;
    assert.equal(payload.binId, "BIN-NEW");
    assert.equal(payload.capacitySpc, 1500);
    assert.equal(payload.locationName, "New Center");
  });

  it("defaults capacitySpc to 1000 if omitted on create", async () => {
    executedCommands.length = 0;
    const repo = new FirebaseBinRepository(
      {} as Functions,
      {} as Firestore,
      fakeCommandClient,
      fakeFallbackRepo
    );

    await repo.create("BIN-DEF", {
      locationName: "Default Center",
      locationDetail: "South Lobby",
      capacityPercent: 0,
      acceptedMaterials: ["plastic"],
      isOnline: true,
    });

    assert.equal(executedCommands.length, 1);
    const payload = executedCommands[0]?.payload as Record<string, unknown>;
    assert.equal(payload.capacitySpc, 1000);
  });
});

describe("Phase AB-04 — Mock Bins Repository QR Generation", () => {
  it("provides registered QR code payload and preview dataUrl in mock mode", async () => {
    const bundle = createMockRepositories({ readDelayMs: 0, writeDelayMs: 0 });
    await bundle.repositories.auth.login(MOCK_LOGIN);
    const qrCode = await bundle.repositories.bins.getQrCode("BIN-001");

    assert.equal(qrCode.binId, "BIN-001");
    assert.equal(qrCode.qrId, "qr-BIN-001");
    assert.equal(qrCode.qrPayload, "ecoloop://bin/qr-BIN-001");
    assert.ok(qrCode.dataUrl.startsWith("data:image/svg+xml"));
    assert.ok(qrCode.svg.includes("<svg"));
  });
});
