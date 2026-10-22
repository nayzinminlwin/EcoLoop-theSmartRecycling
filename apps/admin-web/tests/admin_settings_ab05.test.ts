// =============================================================================
// admin_settings_ab05.test.ts — Unit tests for Phase AB-05 Program Settings & Policy
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FirebaseSettingsRepository } from "../src/data/firebase/firebaseSettingsRepository.ts";
import { createMockRepositories } from "../src/data/mockRepositories.ts";
import { MOCK_LOGIN } from "../src/data/mockSeeds.ts";
import { RepositoryError } from "../src/data/repositories.ts";
import type { FirebaseCommandClient } from "../src/core/firebase/commandClient.ts";
import type { AdminSettings } from "../src/contracts/admin.ts";

describe("Phase AB-05 — FirebaseSettingsRepository & Program Policy Publication", () => {
  const executedCommands: Array<{ operation: string; payload: unknown }> = [];

  const fakeCommandClient: FirebaseCommandClient = {
    generateRequestId: () => "req-test-settings-001",
    execute: async <T extends Record<string, unknown>, R = Record<string, unknown>>(
      operation: string,
      payload: T
    ) => {
      executedCommands.push({ operation, payload });
      return {
        schemaVersion: "admin.v1",
        operation,
        requestId: "req-test-settings-001",
        traceId: "trace-test-settings-001",
        status: "committed",
        data: {
          resourceId: "global",
          version: Number((payload as any).expectedVersion ?? 1) + 1,
          activePolicyId: "policy-abc12345",
          operationState: "applied",
          committedAt: new Date().toISOString(),
        } as unknown as R,
      };
    },
    recover: async () => {
      throw new Error("Not implemented");
    },
    mapFirebaseError: (err: unknown, op: string) => {
      return new RepositoryError({
        code: "conflict",
        message: err instanceof Error ? err.message : `Operation ${op} failed`,
        fieldErrors: {},
      });
    },
  } as unknown as FirebaseCommandClient;

  let currentSettings: AdminSettings = {
    id: "global",
    version: 1,
    policyVersion: "policy-v1",
    capacityAlertThreshold: 80,
    acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
    acceptedClasses: [
      "plastic_bottle",
      "aluminium_can",
      "glass_bottle",
      "paper_item",
      "paper_bag",
    ],
    materialRates: [
      { materialType: "plastic", displayName: "Plastic", pointsPerItem: 5, eligible: true },
      { materialType: "aluminium", displayName: "Metal / Aluminium", pointsPerItem: 8, eligible: true },
      { materialType: "paper", displayName: "Paper (Cardboard excluded)", pointsPerItem: 3, eligible: true },
      { materialType: "glass", displayName: "Glass", pointsPerItem: 10, eligible: true },
    ],
    updatedAt: new Date().toISOString(),
  };

  const fakeFallbackRepo = {
    get: async () => currentSettings,
    watch: () => {
      throw new Error("Not implemented");
    },
    update: async () => currentSettings,
  } as any;

  const repo = new FirebaseSettingsRepository(
    {} as any,
    {} as any,
    fakeCommandClient,
    fakeFallbackRepo
  );

  it("reads composite settings with version, policyVersion, and explicit classes", async () => {
    const settings = await repo.get();
    assert.equal(settings.version, 1);
    assert.equal(settings.policyVersion, "policy-v1");
    assert.equal(settings.capacityAlertThreshold, 80);
    assert.ok(settings.acceptedClasses?.includes("plastic_bottle"));
    assert.ok(settings.acceptedClasses?.includes("aluminium_can"));
    assert.ok(!settings.acceptedClasses?.includes("cardboard_item"));
  });

  it("submits adminPublishSettings with expectedVersion, threshold, acceptedClasses, and rates", async () => {
    executedCommands.length = 0;

    await repo.update({
      expectedVersion: 1,
      capacityAlertThreshold: 85,
      acceptedMaterials: ["plastic", "aluminium", "paper"],
      acceptedClasses: ["plastic_bottle", "aluminium_can", "paper_item", "paper_bag"],
      materialRates: [
        { materialType: "plastic", displayName: "Plastic", pointsPerItem: 12, eligible: true },
        { materialType: "aluminium", displayName: "Metal / Aluminium", pointsPerItem: 18, eligible: true },
        { materialType: "paper", displayName: "Paper (Cardboard excluded)", pointsPerItem: 4, eligible: true },
        { materialType: "glass", displayName: "Glass", pointsPerItem: 0, eligible: false },
      ],
    });

    assert.equal(executedCommands.length, 1);
    const cmd = executedCommands[0];
    assert.equal(cmd.operation, "adminPublishSettings");
    const payload = cmd.payload as any;
    assert.equal(payload.expectedVersion, 1);
    assert.equal(payload.capacityAlertThreshold, 85);
    assert.deepEqual(payload.acceptedClasses, [
      "plastic_bottle",
      "aluminium_can",
      "paper_item",
      "paper_bag",
    ]);
    assert.equal(payload.materialRates.length, 4);
    assert.equal(payload.materialRates[0].pointsPerItem, 12);
  });
});

describe("Phase AB-05 — Mock Settings Repository Concurrency & Invariants", () => {
  it("initializes mock state with operational version 1 and active policy-v1", async () => {
    const mock = createMockRepositories();
    await mock.repositories.auth.login(MOCK_LOGIN);

    const settings = await mock.repositories.settings.get();
    assert.equal(settings.version, 1);
    assert.equal(settings.policyVersion, "policy-v1");
    assert.equal(settings.capacityAlertThreshold, 80);
    assert.ok(!settings.acceptedClasses?.includes("cardboard_item"));
  });

  it("increments operational version on successful update", async () => {
    const mock = createMockRepositories();
    await mock.repositories.auth.login(MOCK_LOGIN);

    const initial = await mock.repositories.settings.get();
    assert.equal(initial.version, 1);

    const updated = await mock.repositories.settings.update({
      expectedVersion: 1,
      capacityAlertThreshold: 75,
      acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
      acceptedClasses: ["plastic_bottle", "aluminium_can", "glass_bottle", "paper_item"],
      materialRates: [
        { materialType: "plastic", displayName: "Plastic", pointsPerItem: 10, eligible: true },
        { materialType: "aluminium", displayName: "Aluminium", pointsPerItem: 15, eligible: true },
        { materialType: "paper", displayName: "Paper", pointsPerItem: 3, eligible: true },
        { materialType: "glass", displayName: "Glass", pointsPerItem: 10, eligible: true },
      ],
    });

    assert.equal(updated.version, 2);
    assert.equal(updated.capacityAlertThreshold, 75);
  });

  it("rejects publication when expectedVersion does not match current version (concurrency conflict)", async () => {
    const mock = createMockRepositories();
    await mock.repositories.auth.login(MOCK_LOGIN);

    // First update bumps version to 2
    await mock.repositories.settings.update({
      expectedVersion: 1,
      capacityAlertThreshold: 85,
      acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
      materialRates: [
        { materialType: "plastic", displayName: "Plastic", pointsPerItem: 5, eligible: true },
        { materialType: "aluminium", displayName: "Aluminium", pointsPerItem: 8, eligible: true },
        { materialType: "paper", displayName: "Paper", pointsPerItem: 3, eligible: true },
        { materialType: "glass", displayName: "Glass", pointsPerItem: 10, eligible: true },
      ],
    });

    // Concurrent administrator tries to update with stale expectedVersion 1
    await assert.rejects(
      async () => {
        await mock.repositories.settings.update({
          expectedVersion: 1,
          capacityAlertThreshold: 75,
          acceptedMaterials: ["plastic", "aluminium", "paper", "glass"],
          materialRates: [
            { materialType: "plastic", displayName: "Plastic", pointsPerItem: 10, eligible: true },
            { materialType: "aluminium", displayName: "Aluminium", pointsPerItem: 10, eligible: true },
            { materialType: "paper", displayName: "Paper", pointsPerItem: 5, eligible: true },
            { materialType: "glass", displayName: "Glass", pointsPerItem: 5, eligible: true },
          ],
        });
      },
      (err: any) => {
        assert.equal(err.code, "conflict");
        assert.match(err.message, /Stale settings version/);
        return true;
      }
    );
  });

  it("strictly rejects cardboard in acceptedClasses", async () => {
    const mock = createMockRepositories();
    await mock.repositories.auth.login(MOCK_LOGIN);

    await assert.rejects(
      async () => {
        await mock.repositories.settings.update({
          expectedVersion: 1,
          capacityAlertThreshold: 80,
          acceptedMaterials: ["plastic", "paper"],
          acceptedClasses: ["plastic_bottle", "cardboard_item"],
          materialRates: [
            { materialType: "plastic", displayName: "Plastic", pointsPerItem: 5, eligible: true },
            { materialType: "aluminium", displayName: "Aluminium", pointsPerItem: 8, eligible: false },
            { materialType: "paper", displayName: "Paper", pointsPerItem: 3, eligible: true },
            { materialType: "glass", displayName: "Glass", pointsPerItem: 10, eligible: false },
          ],
        });
      },
      (err: any) => {
        assert.equal(err.code, "validation");
        assert.match(err.message, /Cardboard cannot be accepted/);
        return true;
      }
    );
  });
});
