// =============================================================================
// admin_settings.test.ts — Unit tests for Admin Program Settings & Policy Publication
// Phase AB-05 — Immutable program settings and future-policy publication
// =============================================================================

import { describe, expect, it } from "vitest";
import {
  validateThreshold,
  validateAcceptedClasses,
  validateRates,
  hasPolicyChanged,
  hasThresholdChanged,
  generatePolicyId,
  createNextPolicy,
} from "../../src/domain/admin_settings.js";
import { initialPolicy, calculateFinalization, type PolicySnapshot } from "../../src/domain/policy.js";
import { FirestoreAdminSettingsStore } from "../../src/infrastructure/firestore/admin_settings_store.js";
import { FirestoreAdminOperationsStore } from "../../src/infrastructure/firestore/admin_operations_store.js";
import { FirestoreAdminReadVersionsStore } from "../../src/infrastructure/firestore/admin_read_versions_store.js";
import type { AdminVerificationResult } from "../../src/infrastructure/firestore/admin_accounts_store.js";
import type { WorkerFinding } from "../../src/domain/types.js";

describe("Phase AB-05 — Domain Validation & Invariants", () => {
  it("enforces capacityAlertThreshold strictly within [75, 80, 85]", () => {
    expect(() => validateThreshold(75)).not.toThrow();
    expect(() => validateThreshold(80)).not.toThrow();
    expect(() => validateThreshold(85)).not.toThrow();

    expect(() => validateThreshold(90)).toThrow(/valid_threshold_enum_required/);
    expect(() => validateThreshold(70)).toThrow(/valid_threshold_enum_required/);
    expect(() => validateThreshold(0)).toThrow(/valid_threshold_enum_required/);
    expect(() => validateThreshold(80.5)).toThrow(/valid_threshold_enum_required/);
    expect(() => validateThreshold("80" as any)).toThrow(/valid_threshold_enum_required/);
  });

  it("strictly excludes cardboard_item from acceptedClasses", () => {
    expect(() =>
      validateAcceptedClasses([
        "plastic_bottle",
        "aluminium_can",
        "paper_item",
        "cardboard_item",
      ])
    ).toThrow(/cardboard_excluded/);

    expect(() =>
      validateAcceptedClasses(["cardboard_item"])
    ).toThrow(/cardboard_excluded/);
  });

  it("accepts valid canonical classes and rejects empty or unknown classes", () => {
    expect(() =>
      validateAcceptedClasses([
        "plastic_bottle",
        "aluminium_can",
        "glass_bottle",
        "paper_item",
        "paper_bag",
      ])
    ).not.toThrow();

    expect(() => validateAcceptedClasses([])).toThrow(/accepted_classes_required/);
    expect(() => validateAcceptedClasses(["unknown_class" as any])).toThrow(/invalid_accepted_class/);
    expect(() =>
      validateAcceptedClasses(["plastic_bottle", "plastic_bottle"])
    ).toThrow(/duplicate_accepted_class/);
  });

  it("validates non-negative integer rates (including 0)", () => {
    expect(() =>
      validateRates([
        { materialType: "plastic", pointsPerItem: 10, eligible: true },
        { materialType: "aluminium", pointsPerItem: 15, eligible: true },
        { materialType: "paper", pointsPerItem: 0, eligible: true },
        { materialType: "glass", pointsPerItem: 0, eligible: false },
      ])
    ).not.toThrow();

    expect(() =>
      validateRates([
        { materialType: "plastic", pointsPerItem: -5, eligible: true },
      ])
    ).toThrow(/invalid_points_per_item/);

    expect(() =>
      validateRates([
        { materialType: "plastic", pointsPerItem: 10.5, eligible: true },
      ])
    ).toThrow(/invalid_points_per_item/);

    expect(() =>
      validateRates([
        { materialType: "unknown" as any, pointsPerItem: 10, eligible: true },
      ])
    ).toThrow(/invalid_material_type/);

    expect(() => validateRates([])).toThrow(/material_rates_required/);
  });

  it("detects policy changes accurately", () => {
    const basePolicy = initialPolicy();

    // Identical rates and classes
    const noChange = hasPolicyChanged(
      basePolicy,
      basePolicy.acceptedObjectClasses,
      [
        { materialType: "plastic", pointsPerItem: 5, eligible: true },
        { materialType: "aluminium", pointsPerItem: 8, eligible: true },
        { materialType: "paper", pointsPerItem: 3, eligible: true },
        { materialType: "glass", pointsPerItem: 10, eligible: true },
      ]
    );
    expect(noChange).toBe(false);

    // Class removed
    const classChanged = hasPolicyChanged(
      basePolicy,
      ["plastic_bottle", "aluminium_can"],
      [
        { materialType: "plastic", pointsPerItem: 5, eligible: true },
        { materialType: "aluminium", pointsPerItem: 8, eligible: true },
        { materialType: "paper", pointsPerItem: 3, eligible: true },
        { materialType: "glass", pointsPerItem: 10, eligible: true },
      ]
    );
    expect(classChanged).toBe(true);

    // Rate changed
    const rateChanged = hasPolicyChanged(
      basePolicy,
      basePolicy.acceptedObjectClasses,
      [
        { materialType: "plastic", pointsPerItem: 12, eligible: true },
        { materialType: "aluminium", pointsPerItem: 8, eligible: true },
        { materialType: "paper", pointsPerItem: 3, eligible: true },
        { materialType: "glass", pointsPerItem: 10, eligible: true },
      ]
    );
    expect(rateChanged).toBe(true);
  });

  it("generates policy ID matching pattern ^policy-[a-f0-9]{8}$", () => {
    const policyId = generatePolicyId();
    expect(policyId).toMatch(/^policy-[a-f0-9]{8}$/);
  });
});

describe("Phase AB-05 — FirestoreAdminSettingsStore Publication & Invariants", () => {
  const caller: AdminVerificationResult = {
    uid: "admin-tester",
    email: "admin@ecoloop.test",
    displayName: "Admin Tester",
    enabled: true,
    role: "admin",
  };

  function createMockStore(initialDocs: Record<string, unknown> = {}) {
    const docs = { ...initialDocs };
    const writtenAuditEvents: unknown[] = [];

    const mockFirestore = {
      doc: (path: string) => ({
        id: path.split("/").pop()!,
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
        where: () => ({
          where: () => ({
            limit: () => ({
              get: async () => ({
                empty: true,
                docs: [],
              }),
            }),
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
    };

    const operationsStore = new FirestoreAdminOperationsStore(mockFirestore as any);
    const readVersionsStore = new FirestoreAdminReadVersionsStore(mockFirestore as any);
    const store = new FirestoreAdminSettingsStore(
      mockFirestore as any,
      operationsStore,
      readVersionsStore
    );

    return { store, docs, mockFirestore, writtenAuditEvents };
  }

  it("reads default operational settings and active policy composite DTO", async () => {
    const { store } = createMockStore({
      "adminSettings/global": {
        id: "global",
        version: 1,
        capacityAlertThreshold: 80,
        activePolicyId: "policy-v1",
        updatedAt: "2026-10-21T00:00:00.000Z",
      },
      "policyPointers/active": {
        version: "policy-v1",
        policyId: "policy-v1",
      },
      "policies/policy-v1": initialPolicy(),
    });

    const settings = await store.getSettings();
    expect(settings.version).toBe(1);
    expect(settings.policyVersion).toBe("policy-v1");
    expect(settings.capacityAlertThreshold).toBe(80);
    expect(settings.acceptedClasses).toContain("plastic_bottle");
    expect(settings.acceptedClasses).toContain("aluminium_can");
    expect(settings.acceptedClasses).not.toContain("cardboard_item");
    expect(settings.materialRates).toHaveLength(4);
    expect(settings.materialRates.find((r) => r.materialType === "plastic")?.pointsPerItem).toBe(5);
  });

  it("rejects publication with stale expectedVersion (concurrency fencing)", async () => {
    const { store } = createMockStore({
      "adminSettings/global": {
        id: "global",
        version: 2,
        capacityAlertThreshold: 80,
        activePolicyId: "policy-v1",
      },
      "policyPointers/active": {
        version: "policy-v1",
        policyId: "policy-v1",
      },
      "policies/policy-v1": initialPolicy(),
    });

    // Caller expects version 1, but stored is 2
    await expect(
      store.publishSettings(
        caller,
        {
          expectedVersion: 1,
          capacityAlertThreshold: 85,
          acceptedClasses: ["plastic_bottle", "aluminium_can"],
          materialRates: [
            { materialType: "plastic", pointsPerItem: 10, eligible: true },
            { materialType: "aluminium", pointsPerItem: 15, eligible: true },
            { materialType: "paper", pointsPerItem: 3, eligible: true },
            { materialType: "glass", pointsPerItem: 0, eligible: false },
          ],
        },
        "req-stale-001",
        "trace-stale",
        "2026-10-21T10:00:00.000Z"
      )
    ).rejects.toThrow(/Stale settings version/);
  });

  it("handles threshold-only update without creating a new financial policy", async () => {
    const { store, docs } = createMockStore({
      "adminSettings/global": {
        id: "global",
        version: 1,
        capacityAlertThreshold: 80,
        activePolicyId: "policy-v1",
      },
      "policyPointers/active": {
        version: "policy-v1",
        policyId: "policy-v1",
      },
      "policies/policy-v1": initialPolicy(),
    });

    // Update threshold from 80 to 85, keeping rates and classes identical
    const res = await store.publishSettings(
      caller,
      {
        expectedVersion: 1,
        capacityAlertThreshold: 85,
        acceptedClasses: initialPolicy().acceptedObjectClasses,
        materialRates: [
          { materialType: "plastic", pointsPerItem: 5, eligible: true },
          { materialType: "aluminium", pointsPerItem: 8, eligible: true },
          { materialType: "paper", pointsPerItem: 3, eligible: true },
          { materialType: "glass", pointsPerItem: 10, eligible: true },
        ],
      },
      "req-threshold-001",
      "trace-thresh",
      "2026-10-21T10:00:00.000Z"
    );

    expect(res.status).toBe("committed");
    expect(res.data.version).toBe(2);
    expect(res.data.activePolicyId).toBe("policy-v1");
    expect(res.data.policyCreated).toBe(false);
    expect(res.data.thresholdChanged).toBe(true);

    // Verify operational settings version bumped and threshold updated
    const settingsDoc = docs["adminSettings/global"] as any;
    expect(settingsDoc.version).toBe(2);
    expect(settingsDoc.capacityAlertThreshold).toBe(85);
    expect(settingsDoc.activePolicyId).toBe("policy-v1");

    // Pointer unchanged
    const pointerDoc = docs["policyPointers/active"] as any;
    expect(pointerDoc.policyId).toBe("policy-v1");

    // Reconciliation intent enqueued for AB-06
    const intentDoc = docs["adminIntents/intent-reconcile-req-threshold-001"] as any;
    expect(intentDoc).toBeDefined();
    expect(intentDoc.type).toBe("reconcile_threshold");
    expect(intentDoc.previousThreshold).toBe(80);
    expect(intentDoc.newThreshold).toBe(85);
    expect(intentDoc.settingsVersion).toBe(2);
    expect(intentDoc.status).toBe("pending");
  });

  it("publishes new immutable policy version when rates or accepted classes change", async () => {
    const { store, docs } = createMockStore({
      "adminSettings/global": {
        id: "global",
        version: 1,
        capacityAlertThreshold: 80,
        activePolicyId: "policy-v1",
      },
      "policyPointers/active": {
        version: "policy-v1",
        policyId: "policy-v1",
      },
      "policies/policy-v1": initialPolicy(),
    });

    // Update rates: plastic 5 -> 10, aluminium 8 -> 15
    const res = await store.publishSettings(
      caller,
      {
        expectedVersion: 1,
        capacityAlertThreshold: 80,
        acceptedClasses: ["plastic_bottle", "aluminium_can", "paper_item", "paper_bag"],
        materialRates: [
          { materialType: "plastic", pointsPerItem: 10, eligible: true },
          { materialType: "aluminium", pointsPerItem: 15, eligible: true },
          { materialType: "paper", pointsPerItem: 3, eligible: true },
          { materialType: "glass", pointsPerItem: 0, eligible: false },
        ],
      },
      "req-publish-settings-008",
      "trace-pub",
      "2026-10-21T10:00:00.000Z"
    );

    expect(res.status).toBe("committed");
    expect(res.data.version).toBe(2);
    expect(res.data.activePolicyId).toMatch(/^policy-[a-f0-9]{8}$/);
    expect(res.data.policyCreated).toBe(true);
    expect(res.data.thresholdChanged).toBe(false);

    const newPolicyId = res.data.activePolicyId;
    const newPolicyDoc = docs[`policies/${newPolicyId}`] as any;
    expect(newPolicyDoc).toBeDefined();
    expect(newPolicyDoc.id).toBe(newPolicyId);
    expect(newPolicyDoc.pointsPerItemByCategory.plastic).toBe(10);
    expect(newPolicyDoc.pointsPerItemByCategory.aluminium).toBe(15);
    expect(newPolicyDoc.acceptedObjectClasses).toEqual([
      "plastic_bottle",
      "aluminium_can",
      "paper_item",
      "paper_bag",
    ]);

    // Historical policy-v1 remains completely intact and unmutated
    const oldPolicyDoc = docs["policies/policy-v1"] as any;
    expect(oldPolicyDoc.pointsPerItemByCategory.plastic).toBe(5);
    expect(oldPolicyDoc.pointsPerItemByCategory.aluminium).toBe(8);

    // Active policy pointer advanced to new policy
    const pointerDoc = docs["policyPointers/active"] as any;
    expect(pointerDoc.policyId).toBe(newPolicyId);

    // Operational settings points to new policy
    const settingsDoc = docs["adminSettings/global"] as any;
    expect(settingsDoc.activePolicyId).toBe(newPolicyId);
    expect(settingsDoc.version).toBe(2);

    // Guide documents synced
    expect(docs[`guideMaterials/${newPolicyId}`]).toBeDefined();
    expect(docs[`guideContent/${newPolicyId}`]).toBeDefined();
  });

  it("returns idempotent replay when payload is identical to current settings", async () => {
    const { store } = createMockStore({
      "adminSettings/global": {
        id: "global",
        version: 1,
        capacityAlertThreshold: 80,
        activePolicyId: "policy-v1",
      },
      "policyPointers/active": {
        version: "policy-v1",
        policyId: "policy-v1",
      },
      "policies/policy-v1": initialPolicy(),
    });

    const res = await store.publishSettings(
      caller,
      {
        expectedVersion: 1,
        capacityAlertThreshold: 80,
        acceptedClasses: initialPolicy().acceptedObjectClasses,
        materialRates: [
          { materialType: "plastic", pointsPerItem: 5, eligible: true },
          { materialType: "aluminium", pointsPerItem: 8, eligible: true },
          { materialType: "paper", pointsPerItem: 3, eligible: true },
          { materialType: "glass", pointsPerItem: 10, eligible: true },
        ],
      },
      "req-replay-same",
      "trace-replay",
      "2026-10-21T10:00:00.000Z"
    );

    expect(res.status).toBe("committed");
    expect(res.data.operationState).toBe("replayed");
    expect(res.data.version).toBe(1);
    expect(res.data.policyCreated).toBe(false);
  });

  it("preserves submitted-policy arithmetic: batch submitted under P1 retains P1 points even after P2 published", () => {
    const policyP1: PolicySnapshot = initialPolicy(); // plastic: 5 points
    const policyP2: PolicySnapshot = createNextPolicy(
      policyP1,
      "policy-p2",
      ["plastic_bottle", "aluminium_can"],
      [
        { materialType: "plastic", pointsPerItem: 20, eligible: true }, // plastic: 20 points
        { materialType: "aluminium", pointsPerItem: 30, eligible: true },
        { materialType: "paper", pointsPerItem: 3, eligible: false },
        { materialType: "glass", pointsPerItem: 10, eligible: false },
      ]
    );

    const findings: WorkerFinding[] = [
      {
        candidateId: "cand-1",
        resolution: "plastic_bottle",
        confidence: 0.95,
        eligibility: "eligible",
        reasonCode: "verified",
      },
      {
        candidateId: "cand-2",
        resolution: "plastic_bottle",
        confidence: 0.92,
        eligibility: "eligible",
        reasonCode: "verified",
      },
    ];

    // Finalize under pinned policy P1
    const finalizationP1 = calculateFinalization(policyP1, "resolved", findings);
    expect(finalizationP1.policyVersion).toBe("policy-v1");
    expect(finalizationP1.pointsAwarded).toBe(10); // 2 bottles * 5 pts = 10 pts

    // Finalize a new batch under policy P2
    const finalizationP2 = calculateFinalization(policyP2, "resolved", findings);
    expect(finalizationP2.policyVersion).toBe("policy-p2");
    expect(finalizationP2.pointsAwarded).toBe(40); // 2 bottles * 20 pts = 40 pts

    // Resolving historical P1 batch now still strictly uses P1!
    expect(finalizationP1.pointsAwarded).toBe(10);
  });

  it("never silently fills a missing pinned policy with defaults when pointer exists", async () => {
    const { store } = createMockStore({
      "adminSettings/global": {
        id: "global",
        version: 1,
        capacityAlertThreshold: 80,
        activePolicyId: "policy-missing-404",
      },
      "policyPointers/active": {
        version: "policy-missing-404",
        policyId: "policy-missing-404",
      },
      // Note: "policies/policy-missing-404" is missing!
    });

    await expect(
      store.publishSettings(
        caller,
        {
          expectedVersion: 1,
          capacityAlertThreshold: 85,
          acceptedClasses: ["plastic_bottle"],
          materialRates: [
            { materialType: "plastic", pointsPerItem: 10, eligible: true },
            { materialType: "aluminium", pointsPerItem: 10, eligible: false },
            { materialType: "paper", pointsPerItem: 0, eligible: false },
            { materialType: "glass", pointsPerItem: 0, eligible: false },
          ],
        },
        "req-fail-missing",
        "trace-missing",
        "2026-10-21T10:00:00.000Z"
      )
    ).rejects.toThrow(/Active pinned policy "policy-missing-404" not found/);
  });
});
