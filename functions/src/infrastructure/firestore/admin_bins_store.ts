// =============================================================================
// admin_bins_store.ts — Transactional store for admin smart bin fleet lifecycle
// Phase AB-04 — Creation, versioned update, unused deletion, and QR export
// =============================================================================

import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import QRCode from "qrcode";
import type { AdminVerificationResult } from "./admin_accounts_store.js";
import { computePayloadFingerprint } from "../../domain/admin_crypto.js";
import {
  type CreateBinInput,
  type UpdateBinInput,
  type DeleteBinInput,
  validateBinId,
  validateCapacitySpc,
  validateLocationName,
  validateLocationDetail,
  computeQrId,
  computeQrPayload,
  computeInitialCycleId,
} from "../../domain/admin_bins.js";
import type { FirestoreAdminOperationsStore } from "./admin_operations_store.js";
import type { FirestoreAdminProjectionsStore } from "./admin_projections_store.js";
import type { FirestoreAdminReadVersionsStore } from "./admin_read_versions_store.js";

export interface AdminBinQrResult {
  readonly binId: string;
  readonly qrId: string;
  readonly qrPayload: string;
  readonly dataUrl: string;
  readonly svg: string;
}

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

export class FirestoreAdminBinsStore {
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

  async createBin(
    caller: AdminVerificationResult,
    input: CreateBinInput,
    requestId: string,
    traceId: string,
    nowInstant: string
  ): Promise<AdminCommandResponse> {
    validateBinId(input.binId);
    validateCapacitySpc(input.capacitySpc);
    validateLocationName(input.locationName);
    validateLocationDetail(input.locationDetail);

    // 1. Idempotent check
    const payloadFingerprint = computePayloadFingerprint(
      input as unknown as Record<string, unknown>
    );
    const existing = await this.operationsStore.getReceipt(
      caller.uid,
      "adminCreateBin",
      requestId
    );
    if (existing) {
      return existing as unknown as AdminCommandResponse;
    }

    const { binId, locationName, locationDetail, capacitySpc } = input;
    const qrId = computeQrId(binId);
    const qrPayload = computeQrPayload(qrId);
    const cycleId = computeInitialCycleId(binId);

    // 2. Transactional execution
    await this.firestore.runTransaction(async (transaction) => {
      // Tombstone check
      const tombstoneRef = this.firestore.doc(`binTombstones/${binId}`);
      const tombstoneSnap = await transaction.get(tombstoneRef);
      if (tombstoneSnap.exists) {
        throw new HttpsError(
          "already-exists",
          `Bin ID "${binId}" has been retired and cannot be reused.`
        );
      }

      // Existing bin check
      const binRef = this.firestore.doc(`bins/${binId}`);
      const binSnap = await transaction.get(binRef);
      if (binSnap.exists) {
        throw new HttpsError(
          "already-exists",
          `Smart bin "${binId}" already exists.`
        );
      }

      // Existing QR mapping check
      const qrRef = this.firestore.doc(`binQrMappings/${qrId}`);
      const qrSnap = await transaction.get(qrRef);
      if (qrSnap.exists) {
        throw new HttpsError(
          "already-exists",
          `QR mapping "${qrId}" is already registered.`
        );
      }

      // Read active policy pointer if present
      const policyPointerRef = this.firestore.doc("policyPointers/active");
      const policyPointerSnap = await transaction.get(policyPointerRef);
      const sharedPolicyVersion = policyPointerSnap.exists
        ? String(policyPointerSnap.data()?.version ?? "v1.0.0")
        : "v1.0.0";

      // 2a. Write canonical bin record
      transaction.set(binRef, {
        id: binId,
        displayName: locationName,
        locationName,
        locationDetail,
        capacitySpc,
        occupiedSpc: 0,
        capacityPercent: 0,
        cycleId,
        enabled: true,
        isOnline: true,
        logicalOnline: true,
        version: 1,
        sharedPolicyVersion,
        acceptedObjectClasses: [
          "plastic_bottle",
          "aluminium_can",
          "glass_bottle",
          "paper_item",
          "paper_bag",
        ],
        acceptedMaterials: ["plastic", "aluminium", "glass", "paper"],
        availability: "available",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2b. Write initial zero-opening cycle
      const cycleRef = this.firestore.doc(`binCycles/${cycleId}`);
      transaction.set(cycleRef, {
        id: cycleId,
        binId,
        openingOccupiedSpc: 0,
        capacitySpc,
        contributionTotalSpc: 0,
        startedAt: FieldValue.serverTimestamp(),
        endedAt: null,
      });

      // 2c. Write private operations state
      const opsRef = this.firestore.doc(`binOperations/${binId}`);
      transaction.set(opsRef, {
        binId,
        ownerId: null,
        sessionId: null,
        phase: "available",
        simulatedAccess: "closed",
        expiresAt: null,
        version: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2d. Write enabled QR mapping
      transaction.set(qrRef, {
        id: qrId,
        binId,
        qrPayload,
        enabled: true,
        mappingVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
      });

      // 2e. Write immutable audit log
      const auditRef = this.firestore.doc(`adminAuditEvents/${randomUUID()}`);
      transaction.set(auditRef, {
        eventId: auditRef.id,
        actorUid: caller.uid,
        actorEmail: caller.email,
        action: "adminCreateBin",
        resourceType: "bin",
        resourceId: binId,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          locationName,
          capacitySpc,
          qrPayload,
          cycleId,
        },
      });
    });

    // 3. Update projected view
    const projectedView = this.projectionsStore.projectBin(
      {
        id: binId,
        displayName: locationName,
        locationName,
        locationDetail,
        capacitySpc,
        occupiedSpc: 0,
        cycleId,
        enabled: true,
        logicalOnline: true,
        version: 1,
      },
      {
        collectionStatus: "notScheduled",
      }
    );
    await this.projectionsStore.writeBinView(projectedView);

    // 4. Save idempotent receipt
    // 4. Save idempotent receipt
    const receipt = await this.operationsStore.recordReceipt(
      caller.uid,
      "adminCreateBin",
      requestId,
      payloadFingerprint,
      traceId,
      {
        resourceId: binId,
        version: 1,
      }
    );

    // 5. Bump topic revision
    await Promise.all([
      this.readVersionsStore.bumpVersion("bins", caller.uid),
      this.readVersionsStore.bumpVersion("dashboard", caller.uid),
    ]);

    return receipt as unknown as AdminCommandResponse;
  }

  async updateBin(
    caller: AdminVerificationResult,
    input: UpdateBinInput,
    requestId: string,
    traceId: string,
    nowInstant: string
  ): Promise<AdminCommandResponse> {
    validateBinId(input.binId);
    validateLocationName(input.locationName);
    validateLocationDetail(input.locationDetail);

    // 1. Idempotency check
    const payloadFingerprint = computePayloadFingerprint(
      input as unknown as Record<string, unknown>
    );
    const existing = await this.operationsStore.getReceipt(
      caller.uid,
      "adminUpdateBin",
      requestId
    );
    if (existing) {
      return existing as unknown as AdminCommandResponse;
    }

    const { binId, expectedVersion, locationName, locationDetail, enabled } = input;
    const qrId = computeQrId(binId);
    let nextVersion = expectedVersion + 1;
    let existingDocData: Record<string, unknown> = {};

    // 2. Transactional execution
    await this.firestore.runTransaction(async (transaction) => {
      const binRef = this.firestore.doc(`bins/${binId}`);
      const binSnap = await transaction.get(binRef);
      if (!binSnap.exists) {
        throw new HttpsError("not-found", `Smart bin "${binId}" not found.`);
      }

      existingDocData = binSnap.data()!;
      const currentVersion = Number(existingDocData.version ?? 0);
      if (currentVersion !== expectedVersion) {
        throw new HttpsError(
          "failed-precondition",
          `Stale bin version: expected ${expectedVersion}, but current version is ${currentVersion}.`
        );
      }

      nextVersion = currentVersion + 1;

      // Update bin record
      transaction.update(binRef, {
        displayName: locationName,
        locationName,
        locationDetail,
        enabled,
        version: nextVersion,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update QR mapping enabled state
      const qrRef = this.firestore.doc(`binQrMappings/${qrId}`);
      const qrSnap = await transaction.get(qrRef);
      if (qrSnap.exists) {
        transaction.update(qrRef, {
          enabled,
          mappingVersion: (qrSnap.data()?.mappingVersion ?? 1) + 1,
        });
      }

      // Record audit event
      const auditRef = this.firestore.doc(`adminAuditEvents/${randomUUID()}`);
      transaction.set(auditRef, {
        eventId: auditRef.id,
        actorUid: caller.uid,
        actorEmail: caller.email,
        action: "adminUpdateBin",
        resourceType: "bin",
        resourceId: binId,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          locationName,
          locationDetail,
          enabled,
          previousVersion: currentVersion,
          newVersion: nextVersion,
        },
      });
    });

    // 3. Update projected view
    const projectedView = this.projectionsStore.projectBin({
      ...existingDocData,
      id: binId,
      locationName,
      locationDetail,
      enabled,
      version: nextVersion,
    });
    await this.projectionsStore.writeBinView(projectedView);

    // 4. Save idempotent receipt
    const receipt = await this.operationsStore.recordReceipt(
      caller.uid,
      "adminUpdateBin",
      requestId,
      payloadFingerprint,
      traceId,
      {
        resourceId: binId,
        version: nextVersion,
      }
    );

    // 5. Bump topic revision
    await Promise.all([
      this.readVersionsStore.bumpVersion("bins", caller.uid),
      this.readVersionsStore.bumpVersion("dashboard", caller.uid),
    ]);

    return receipt as unknown as AdminCommandResponse;
  }

  async deleteUnusedBin(
    caller: AdminVerificationResult,
    input: DeleteBinInput,
    requestId: string,
    traceId: string,
    nowInstant: string
  ): Promise<AdminCommandResponse> {
    validateBinId(input.binId);

    // 1. Idempotency check
    const payloadFingerprint = computePayloadFingerprint(
      input as unknown as Record<string, unknown>
    );
    const existing = await this.operationsStore.getReceipt(
      caller.uid,
      "adminDeleteUnusedBin",
      requestId
    );
    if (existing) {
      return existing as unknown as AdminCommandResponse;
    }

    const { binId, expectedVersion } = input;
    const qrId = computeQrId(binId);
    const cycleId = computeInitialCycleId(binId);

    // 2. Reference checks (can only delete never-used empty bins)
    const binRef = this.firestore.doc(`bins/${binId}`);
    const binSnap = await binRef.get();
    if (!binSnap.exists) {
      throw new HttpsError("not-found", `Smart bin "${binId}" not found.`);
    }

    const binData = binSnap.data()!;
    const currentVersion = Number(binData.version ?? 0);
    if (currentVersion !== expectedVersion) {
      throw new HttpsError(
        "failed-precondition",
        `Stale bin version: expected ${expectedVersion}, but current version is ${currentVersion}.`
      );
    }

    const occupiedSpc = Number(binData.occupiedSpc ?? 0);
    if (occupiedSpc > 0) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot delete bin "${binId}" because it contains ${occupiedSpc} spc of collected materials. Collect materials first.`
      );
    }

    // Check active reservation or session
    const opsSnap = await this.firestore.doc(`binOperations/${binId}`).get();
    if (opsSnap.exists) {
      const opsData = opsSnap.data()!;
      if (opsData.phase !== "available" || opsData.sessionId !== null) {
        throw new HttpsError(
          "failed-precondition",
          `Cannot delete bin "${binId}" because it currently has an active reservation or session.`
        );
      }
    }

    // Check historical references: batches, depositSessions, capacityAlerts, collectionEvents
    const [batchesSnap, sessionsSnap, alertsSnap, collectionsSnap] = await Promise.all([
      this.firestore.collection("batches").where("binId", "==", binId).limit(1).get(),
      this.firestore.collection("depositSessions").where("binId", "==", binId).limit(1).get(),
      this.firestore.collection("capacityAlerts").where("binId", "==", binId).limit(1).get(),
      this.firestore.collection("collectionEvents").where("binId", "==", binId).limit(1).get(),
    ]);

    if (!batchesSnap.empty || !sessionsSnap.empty || !alertsSnap.empty || !collectionsSnap.empty) {
      throw new HttpsError(
        "failed-precondition",
        `Cannot delete bin "${binId}" because it has historical activity (batches, sessions, alerts, or collections). Disable the bin instead.`
      );
    }

    // 3. Transactional deletion & tombstone creation
    await this.firestore.runTransaction(async (transaction) => {
      // Re-verify bin in transaction
      const snap = await transaction.get(binRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", `Smart bin "${binId}" not found.`);
      }

      transaction.delete(binRef);
      transaction.delete(this.firestore.doc(`binCycles/${cycleId}`));
      transaction.delete(this.firestore.doc(`binOperations/${binId}`));
      transaction.delete(this.firestore.doc(`binQrMappings/${qrId}`));
      transaction.delete(this.firestore.doc(`adminBinViews/${binId}`));

      // Tombstone record
      const tombstoneRef = this.firestore.doc(`binTombstones/${binId}`);
      transaction.set(tombstoneRef, {
        binId,
        retiredQrPayload: computeQrPayload(qrId),
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: caller.uid,
        reason: "Admin deleted unused bin",
      });

      // Audit event
      const auditRef = this.firestore.doc(`adminAuditEvents/${randomUUID()}`);
      transaction.set(auditRef, {
        eventId: auditRef.id,
        actorUid: caller.uid,
        actorEmail: caller.email,
        action: "adminDeleteUnusedBin",
        resourceType: "bin",
        resourceId: binId,
        timestamp: FieldValue.serverTimestamp(),
        details: {
          previousVersion: currentVersion,
        },
      });
    });

    // 4. Save idempotent receipt
    const receipt = await this.operationsStore.recordReceipt(
      caller.uid,
      "adminDeleteUnusedBin",
      requestId,
      payloadFingerprint,
      traceId,
      {
        resourceId: binId,
        version: currentVersion,
      }
    );

    // 5. Bump topic revision
    await Promise.all([
      this.readVersionsStore.bumpVersion("bins", caller.uid),
      this.readVersionsStore.bumpVersion("dashboard", caller.uid),
    ]);

    return receipt as unknown as AdminCommandResponse;
  }

  async getBinQr(caller: AdminVerificationResult, binId: string): Promise<AdminBinQrResult> {
    validateBinId(binId);

    const qrId = computeQrId(binId);
    const qrPayload = computeQrPayload(qrId);

    // Verify bin exists
    const binSnap = await this.firestore.doc(`bins/${binId}`).get();
    if (!binSnap.exists) {
      throw new HttpsError("not-found", `Smart bin "${binId}" not found.`);
    }

    // Generate QR code artifacts
    const [dataUrl, svg] = await Promise.all([
      QRCode.toDataURL(qrPayload, {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "M",
      }),
      QRCode.toString(qrPayload, {
        type: "svg",
        margin: 2,
        errorCorrectionLevel: "M",
      }),
    ]);

    return {
      binId,
      qrId,
      qrPayload,
      dataUrl,
      svg,
    };
  }
}
