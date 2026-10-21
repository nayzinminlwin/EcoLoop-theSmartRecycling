// =============================================================================
// admin_settings_store.ts — Transactional store for admin program settings & policy
// Phase AB-05 — Immutable program settings and future-policy publication
// =============================================================================

import { randomUUID } from "node:crypto";
import type { Firestore, Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { AdminVerificationResult } from "./admin_accounts_store.js";
import { computeScopedHash, computePayloadFingerprint } from "../../domain/admin_crypto.js";
import {
  type CapacityAlertThreshold,
  type MaterialRateInput,
  type PublishSettingsInput,
  type AdminSettingsDTO,
  validateThreshold,
  validateAcceptedClasses,
  validateRates,
  hasPolicyChanged,
  hasThresholdChanged,
  generatePolicyId,
  createNextPolicy,
} from "../../domain/admin_settings.js";
import { initialPolicy, type PolicySnapshot } from "../../domain/policy.js";
import type { CanonicalClass, RewardCategory } from "../../domain/types.js";
import type { FirestoreAdminOperationsStore } from "./admin_operations_store.js";
import type { FirestoreAdminReadVersionsStore } from "./admin_read_versions_store.js";
import { tryTimestampToInstant } from "./codecs.js";

export interface AdminCommandResponse<T = Record<string, unknown>> {
  readonly schemaVersion: "admin.v1";
  readonly operation: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly status: "committed";
  readonly data: {
    readonly resourceId: string;
    readonly version: number;
    readonly operationState: "applied" | "replayed";
    readonly committedAt: string;
  } & T;
}

function deriveAcceptedMaterials(
  policy: PolicySnapshot
): RewardCategory[] {
  const categories: RewardCategory[] = ["plastic", "aluminium", "paper", "glass"];
  return categories.filter((cat) => {
    return Object.entries(policy.rewardCategoryByClass).some(
      ([cls, mappedCat]) =>
        mappedCat === cat && policy.acceptedObjectClasses.includes(cls as CanonicalClass)
    );
  });
}

function buildMaterialRatesList(
  policy: PolicySnapshot,
  acceptedMaterials: RewardCategory[]
): AdminSettingsDTO["materialRates"] {
  const categories: RewardCategory[] = ["plastic", "aluminium", "paper", "glass"];
  const displayNames: Record<RewardCategory, string> = {
    plastic: "Plastic",
    aluminium: "Metal / Aluminium",
    paper: "Paper (Cardboard excluded)",
    glass: "Glass",
  };

  return categories.map((cat) => ({
    materialType: cat,
    displayName: displayNames[cat],
    pointsPerItem: policy.pointsPerItemByCategory[cat] ?? 0,
    eligible: acceptedMaterials.includes(cat),
  }));
}

function policyFromData(data: Record<string, unknown> | undefined, fallbackId: string): PolicySnapshot {
  if (!data) {
    const base = initialPolicy();
    return { ...base, id: fallbackId };
  }
  const base = initialPolicy();
  return {
    ...base,
    id: String(data.id ?? data.version ?? fallbackId),
    acceptedObjectClasses: Array.isArray(data.acceptedObjectClasses)
      ? (data.acceptedObjectClasses as CanonicalClass[])
      : base.acceptedObjectClasses,
    rewardCategoryByClass: (data.rewardCategoryByClass as Record<CanonicalClass, string>) ?? base.rewardCategoryByClass,
    pointsPerItemByCategory:
      (data.pointsPerItemByCategory as Record<string, number>) ?? base.pointsPerItemByCategory,
    spcPerItemByClass: (data.spcPerItemByClass as Record<CanonicalClass, number>) ?? base.spcPerItemByClass,
    defaultSpcPerRecognizedItem: Number(data.defaultSpcPerRecognizedItem ?? base.defaultSpcPerRecognizedItem),
    unresolvedSpcPerCandidate: Number(data.unresolvedSpcPerCandidate ?? base.unresolvedSpcPerCandidate),
    unreadableBatchSpc: Number(data.unreadableBatchSpc ?? base.unreadableBatchSpc),
  };
}

export class FirestoreAdminSettingsStore {
  private readonly firestore: Firestore;
  private readonly operationsStore: FirestoreAdminOperationsStore;
  private readonly readVersionsStore: FirestoreAdminReadVersionsStore;

  constructor(
    firestore: Firestore,
    operationsStore: FirestoreAdminOperationsStore,
    readVersionsStore: FirestoreAdminReadVersionsStore
  ) {
    this.firestore = firestore;
    this.operationsStore = operationsStore;
    this.readVersionsStore = readVersionsStore;
  }

  async getSettings(): Promise<AdminSettingsDTO> {
    const [settingsSnap, pointerSnap] = await Promise.all([
      this.firestore.doc("adminSettings/global").get(),
      this.firestore.doc("policyPointers/active").get(),
    ]);

    const activePolicyId = pointerSnap.exists
      ? String(pointerSnap.data()?.policyId ?? pointerSnap.data()?.version ?? "policy-v1")
      : "policy-v1";

    const policySnap = await this.firestore.doc(`policies/${activePolicyId}`).get();
    const policy = policyFromData(
      policySnap.exists ? (policySnap.data() as Record<string, unknown>) : undefined,
      activePolicyId
    );

    const operationalVersion = settingsSnap.exists ? Number(settingsSnap.data()?.version ?? 1) : 1;
    const capacityAlertThreshold = settingsSnap.exists
      ? (Number(settingsSnap.data()?.capacityAlertThreshold ?? 80) as CapacityAlertThreshold)
      : 80;
    const updatedAt = settingsSnap.exists
      ? tryTimestampToInstant(settingsSnap.data()?.updatedAt) ?? new Date().toISOString()
      : new Date().toISOString();

    const acceptedMaterials = deriveAcceptedMaterials(policy);
    const materialRates = buildMaterialRatesList(policy, acceptedMaterials);

    return {
      id: "global",
      version: operationalVersion,
      policyVersion: activePolicyId,
      capacityAlertThreshold,
      acceptedClasses: policy.acceptedObjectClasses,
      acceptedMaterials,
      materialRates,
      updatedAt,
    };
  }

  async publishSettings(
    caller: AdminVerificationResult,
    input: PublishSettingsInput,
    requestId: string,
    traceId: string,
    nowInstant: string
  ): Promise<AdminCommandResponse> {
    // 1. Domain Validations
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
      throw new HttpsError("invalid-argument", "expectedVersion must be a non-negative integer.");
    }
    try {
      validateThreshold(input.capacityAlertThreshold);
      validateAcceptedClasses(input.acceptedClasses);
      validateRates(input.materialRates);
    } catch (err) {
      throw new HttpsError("invalid-argument", err instanceof Error ? err.message : String(err));
    }

    const payloadFingerprint = computePayloadFingerprint(input);
    const scopedHash = computeScopedHash(caller.uid, "adminPublishSettings", requestId);

    // 2. Pre-check idempotency outside transaction
    const existingReceipt = await this.operationsStore.getReceipt(
      caller.uid,
      "adminPublishSettings",
      requestId
    );
    if (existingReceipt) {
      return existingReceipt as unknown as AdminCommandResponse;
    }

    // 3. Execute atomic publication transaction
    const result = await this.firestore.runTransaction(async (transaction) => {
      const operationRef = this.firestore.doc(`adminOperations/${scopedHash}`);
      const operationSnap = await transaction.get(operationRef);
      if (operationSnap.exists) {
        const stored = operationSnap.data() as Record<string, unknown>;
        if (stored.payloadFingerprint !== payloadFingerprint) {
          throw new HttpsError(
            "already-exists",
            `Idempotency payload conflict: requestId "${requestId}" was already used with a different payload.`
          );
        }
        return {
          response: {
            schemaVersion: "admin.v1",
            operation: "adminPublishSettings",
            requestId,
            traceId,
            status: "committed",
            data: {
              resourceId: "global",
              version: Number(stored.data ? (stored.data as Record<string, unknown>).version : 1),
              operationState: "replayed",
              committedAt: String(stored.data ? (stored.data as Record<string, unknown>).committedAt : nowInstant),
              activePolicyId: String(stored.data ? (stored.data as Record<string, unknown>).activePolicyId : "policy-v1"),
            },
          } as AdminCommandResponse,
          policyCreated: false,
          thresholdChanged: false,
        };
      }

      const settingsRef = this.firestore.doc("adminSettings/global");
      const pointerRef = this.firestore.doc("policyPointers/active");

      const [settingsSnap, pointerSnap] = await Promise.all([
        transaction.get(settingsRef),
        transaction.get(pointerRef),
      ]);

      const currentOperationalVersion = settingsSnap.exists
        ? Number(settingsSnap.data()?.version ?? 1)
        : 1;

      // Optimistic concurrency control check
      if (input.expectedVersion !== currentOperationalVersion) {
        throw new HttpsError(
          "failed-precondition",
          `Stale settings version. Current operational version is ${currentOperationalVersion}, but draft expected ${input.expectedVersion}. Refresh settings before publishing.`,
          { conflictVersion: currentOperationalVersion }
        );
      }

      const currentThreshold = settingsSnap.exists
        ? (Number(settingsSnap.data()?.capacityAlertThreshold ?? 80) as CapacityAlertThreshold)
        : 80;

      const currentPolicyId = pointerSnap.exists
        ? String(pointerSnap.data()?.policyId ?? pointerSnap.data()?.version ?? "policy-v1")
        : "policy-v1";

      const currentPolicyRef = this.firestore.doc(`policies/${currentPolicyId}`);
      const currentPolicySnap = await transaction.get(currentPolicyRef);
      if (pointerSnap.exists && !currentPolicySnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          `Active pinned policy "${currentPolicyId}" not found. Cannot publish settings without a valid base policy.`
        );
      }
      const currentPolicy = policyFromData(
        currentPolicySnap.exists ? (currentPolicySnap.data() as Record<string, unknown>) : undefined,
        currentPolicyId
      );

      const policyChanged = hasPolicyChanged(currentPolicy, input.acceptedClasses, input.materialRates);
      const thresholdChanged = hasThresholdChanged(currentThreshold, input.capacityAlertThreshold);

      // Check identical payload: no changes needed!
      if (!policyChanged && !thresholdChanged) {
        const replayData = {
          resourceId: "global",
          version: currentOperationalVersion,
          activePolicyId: currentPolicyId,
          operationState: "replayed" as const,
          committedAt: nowInstant,
          policyCreated: false,
          thresholdChanged: false,
        };

        transaction.set(operationRef, {
          scopedHash,
          actorUid: caller.uid,
          operation: "adminPublishSettings",
          requestId,
          payloadFingerprint,
          traceId,
          status: "committed",
          data: replayData,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          response: {
            schemaVersion: "admin.v1",
            operation: "adminPublishSettings",
            requestId,
            traceId,
            status: "committed",
            data: replayData,
          } as AdminCommandResponse,
          policyCreated: false,
          thresholdChanged: false,
        };
      }

      const nextOperationalVersion = currentOperationalVersion + 1;
      let nextPolicyId = currentPolicyId;

      // When policy changed (acceptance classes or category rates): create new immutable policy
      if (policyChanged) {
        nextPolicyId = generatePolicyId();
        const nextPolicy = createNextPolicy(
          currentPolicy,
          nextPolicyId,
          input.acceptedClasses,
          input.materialRates
        );

        const newPolicyRef = this.firestore.doc(`policies/${nextPolicyId}`);
        transaction.set(newPolicyRef, {
          ...nextPolicy,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: caller.uid,
        });

        // Sync corresponding guide documents for resident app
        const guideMaterialsRef = this.firestore.doc(`guideMaterials/${nextPolicyId}`);
        transaction.set(guideMaterialsRef, {
          id: nextPolicyId,
          items: nextPolicy.acceptedObjectClasses.map((cls, idx) => {
            const cat = nextPolicy.rewardCategoryByClass[cls] ?? "unknown";
            const titles: Record<string, string> = {
              plastic_bottle: "Plastic bottles",
              aluminium_can: "Aluminium cans",
              glass_bottle: "Glass bottles",
              paper_item: "Paper items",
              paper_bag: "Paper bags",
            };
            return {
              id: `${cls}-${idx + 1}`,
              type: cat,
              canonicalClass: cls,
              title: titles[cls] ?? cls,
              sortOrder: idx + 1,
            };
          }),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const guideContentRef = this.firestore.doc(`guideContent/${nextPolicyId}`);
        transaction.set(guideContentRef, {
          id: nextPolicyId,
          policyVersion: nextPolicyId,
          acceptedObjectClasses: nextPolicy.acceptedObjectClasses,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Advance active policy pointer
        transaction.set(pointerRef, {
          version: nextPolicyId,
          policyId: nextPolicyId,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: caller.uid,
        });
      }

      // If threshold changed: enqueue a durable threshold-reconciliation intent for AB-06
      if (thresholdChanged) {
        const intentRef = this.firestore.doc(`adminIntents/intent-reconcile-${requestId}`);
        transaction.set(intentRef, {
          id: `intent-reconcile-${requestId}`,
          type: "reconcile_threshold",
          previousThreshold: currentThreshold,
          newThreshold: input.capacityAlertThreshold,
          settingsVersion: nextOperationalVersion,
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
          requestId,
        });
      }

      // Update operational admin settings
      transaction.set(
        settingsRef,
        {
          id: "global",
          version: nextOperationalVersion,
          capacityAlertThreshold: input.capacityAlertThreshold,
          activePolicyId: nextPolicyId,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: caller.uid,
        },
        { merge: true }
      );

      // Record audit event
      const auditRef = this.firestore.doc(`adminAuditEvents/${randomUUID()}`);
      transaction.set(auditRef, {
        id: auditRef.id,
        eventType: "admin_publish_settings",
        actorUid: caller.uid,
        actorEmail: caller.email,
        resourceId: "global",
        requestId,
        traceId,
        occurredAt: FieldValue.serverTimestamp(),
        details: {
          previousVersion: currentOperationalVersion,
          newVersion: nextOperationalVersion,
          policyCreated: policyChanged,
          previousPolicyId: currentPolicyId,
          nextPolicyId,
          thresholdChanged,
          previousThreshold: currentThreshold,
          newThreshold: input.capacityAlertThreshold,
          acceptedClasses: input.acceptedClasses,
        },
      });

      // Record idempotency receipt
      const responseData = {
        resourceId: "global",
        version: nextOperationalVersion,
        activePolicyId: nextPolicyId,
        operationState: "applied" as const,
        committedAt: nowInstant,
        policyCreated: policyChanged,
        thresholdChanged,
      };

      transaction.set(operationRef, {
        scopedHash,
        actorUid: caller.uid,
        operation: "adminPublishSettings",
        requestId,
        payloadFingerprint,
        traceId,
        status: "committed",
        data: responseData,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        response: {
          schemaVersion: "admin.v1",
          operation: "adminPublishSettings",
          requestId,
          traceId,
          status: "committed",
          data: responseData,
        } as AdminCommandResponse,
        policyCreated: policyChanged,
        thresholdChanged,
      };
    });

    // 4. Bump relevant topic revisions for realtime cross-client invalidation
    await this.readVersionsStore.bumpVersion("settings", caller.uid);
    if (result.thresholdChanged) {
      await this.readVersionsStore.bumpVersion("alerts", caller.uid);
    }
    await this.readVersionsStore.bumpVersion("dashboard", caller.uid);

    return result.response;
  }
}
