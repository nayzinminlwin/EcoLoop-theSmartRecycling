// =============================================================================
// admin_reviews_store.ts — Review resolution transactional operations
// Phase AB-07 — Shared settlement, evidence-backed reviews, and retention intent
// =============================================================================

import { createHash } from "node:crypto";
import type { Firestore, DocumentData } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { AdminVerificationResult } from "./admin_accounts_store.js";
import { computePayloadFingerprint } from "../../domain/admin_crypto.js";
import type {
  ReviewPreviewInput,
  ReviewResolutionInput,
  ComputedReviewPlan,
} from "../../domain/admin_reviews.js";
import {
  validateTicketId,
  validateExplanation,
  validateReviewDecisions,
  calculateReviewPlan,
} from "../../domain/admin_reviews.js";
import { initialPolicy, type PolicySnapshot } from "../../domain/policy.js";
import type { FirestoreAdminOperationsStore } from "./admin_operations_store.js";
import type { FirestoreAdminProjectionsStore } from "./admin_projections_store.js";
import type { FirestoreAdminReadVersionsStore } from "./admin_read_versions_store.js";

function policyFromData(data: DocumentData | undefined): PolicySnapshot {
  const fallback = initialPolicy();
  if (!data) return fallback;
  return {
    id: typeof data.id === "string" ? data.id : fallback.id,
    acceptedObjectClasses: Array.isArray(data.acceptedObjectClasses)
      ? data.acceptedObjectClasses
      : fallback.acceptedObjectClasses,
    rewardCategoryByClass: (data.rewardCategoryByClass as PolicySnapshot["rewardCategoryByClass"]) ?? fallback.rewardCategoryByClass,
    pointsPerItemByCategory: (data.pointsPerItemByCategory as PolicySnapshot["pointsPerItemByCategory"]) ?? fallback.pointsPerItemByCategory,
    spcPerItemByClass: (data.spcPerItemByClass as PolicySnapshot["spcPerItemByClass"]) ?? fallback.spcPerItemByClass,
    defaultSpcPerRecognizedItem: Number(data.defaultSpcPerRecognizedItem ?? fallback.defaultSpcPerRecognizedItem),
    unresolvedSpcPerCandidate: Number(data.unresolvedSpcPerCandidate ?? fallback.unresolvedSpcPerCandidate),
    unreadableBatchSpc: Number(data.unreadableBatchSpc ?? fallback.unreadableBatchSpc),
  };
}

export class FirestoreAdminReviewsStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly operationsStore: FirestoreAdminOperationsStore,
    private readonly projectionsStore: FirestoreAdminProjectionsStore,
    private readonly readVersionsStore: FirestoreAdminReadVersionsStore
  ) {}

  /**
   * Preview resolution calculation non-committing using the pinned policy.
   */
  async previewReviewResolution(input: ReviewPreviewInput): Promise<ComputedReviewPlan> {
    const ticketId = validateTicketId(input.ticketId);
    validateReviewDecisions(input.inventoryState, input.objects);

    const ticketSnap = await this.firestore.doc(`reviewTickets/${ticketId}`).get();
    if (!ticketSnap.exists) {
      throw new HttpsError("not-found", `Review ticket ${ticketId} not found.`);
    }

    const ticketData = ticketSnap.data()!;
    const batchId = String(ticketData.batchId ?? ticketId);
    const batchSnap = await this.firestore.doc(`deposits/${batchId}`).get();
    if (!batchSnap.exists) {
      throw new HttpsError("not-found", `Deposit batch ${batchId} not found.`);
    }

    const batchData = batchSnap.data()!;
    const provisionalSpace = Number(
      ticketData.provisionalSpaceSpc ?? batchData.spaceContributionSpc ?? 0
    );

    let policy: PolicySnapshot | undefined = undefined;
    if (batchData.policyVersion) {
      const policySnap = await this.firestore.doc(`policies/${batchData.policyVersion}`).get();
      if (policySnap.exists) {
        policy = policyFromData(policySnap.data());
      }
    }

    return calculateReviewPlan(policy, input.inventoryState, input.objects, provisionalSpace);
  }

  /**
   * Resolve an open review ticket atomically with shared settlement invariants.
   */
  async resolveReview(
    input: ReviewResolutionInput & {
      readonly caller: AdminVerificationResult;
      readonly requestId: string;
    }
  ): Promise<{
    readonly schemaVersion: "admin.v1";
    readonly operation: "adminResolveReview";
    readonly requestId: string;
    readonly operationState: "committed" | "replayed";
    readonly ticketId: string;
    readonly batchId: string;
    readonly decisionVersion: number;
    readonly outcome: string;
    readonly pointsAwarded: number;
    readonly spaceContributionSpc: number;
    readonly spaceDeltaSpc: number;
    readonly acceptedCount: number;
    readonly replayed: boolean;
  }> {
    const ticketId = validateTicketId(input.ticketId);
    const explanation = validateExplanation(input.explanation);
    validateReviewDecisions(input.inventoryState, input.objects);

    const existingReceipt = await this.operationsStore.getReceipt(
      input.caller.uid,
      "adminResolveReview",
      input.requestId
    );

    if (existingReceipt) {
      const payload = existingReceipt.data as Record<string, unknown>;
      return {
        schemaVersion: "admin.v1",
        operation: "adminResolveReview",
        requestId: input.requestId,
        operationState: "replayed",
        ticketId: String(payload.ticketId ?? ticketId),
        batchId: String(payload.batchId ?? ""),
        decisionVersion: Number(payload.decisionVersion ?? 0),
        outcome: String(payload.outcome ?? ""),
        pointsAwarded: Number(payload.pointsAwarded ?? 0),
        spaceContributionSpc: Number(payload.spaceContributionSpc ?? 0),
        spaceDeltaSpc: Number(payload.spaceDeltaSpc ?? 0),
        acceptedCount: Number(payload.acceptedCount ?? 0),
        replayed: true,
      };
    }

    const nowISO = new Date().toISOString();
    const nowTimestamp = Timestamp.now();

    const transactionResult = await this.firestore.runTransaction(async (transaction) => {
      const ticketRef = this.firestore.doc(`reviewTickets/${ticketId}`);
      const ticketSnap = await transaction.get(ticketRef);
      if (!ticketSnap.exists) {
        throw new HttpsError("not-found", `Review ticket ${ticketId} not found.`);
      }

      const ticketData = ticketSnap.data()!;
      const currentState = String(ticketData.state ?? "open");
      if (currentState === "resolved") {
        throw new HttpsError(
          "failed-precondition",
          `Review ticket ${ticketId} is already resolved.`
        );
      }

      const currentDecisionVersion = Number(ticketData.decisionVersion ?? 0);
      if (currentDecisionVersion !== input.expectedDecisionVersion) {
        throw new HttpsError(
          "failed-precondition",
          `Decision version mismatch: expected ${input.expectedDecisionVersion}, found ${currentDecisionVersion}.`
        );
      }

      const batchId = String(ticketData.batchId ?? ticketId);
      const batchRef = this.firestore.doc(`deposits/${batchId}`);
      const batchSnap = await transaction.get(batchRef);
      if (!batchSnap.exists) {
        throw new HttpsError("not-found", `Deposit batch ${batchId} not found.`);
      }
      const batchData = batchSnap.data()!;

      const batchHash = createHash("sha256").update(batchId).digest("hex");
      const resultRef = this.firestore.doc(`depositResults/result-${batchHash}`);
      const resultSnap = await transaction.get(resultRef);

      const binId = String(batchData.binId ?? ticketData.binId ?? "");
      const binRef = binId ? this.firestore.doc(`bins/${binId}`) : null;
      const binSnap = binRef ? await transaction.get(binRef) : null;

      const ownerId = String(batchData.ownerId ?? ticketData.ownerId ?? "");
      const walletRef = ownerId ? this.firestore.doc(`residents/${ownerId}/wallet/current`) : null;
      const walletSnap = walletRef ? await transaction.get(walletRef) : null;

      const statsRef = ownerId ? this.firestore.doc(`residents/${ownerId}/stats/current`) : null;
      const statsSnap = statsRef ? await transaction.get(statsRef) : null;

      let policy: PolicySnapshot | undefined = undefined;
      if (batchData.policyVersion) {
        const policySnap = await transaction.get(
          this.firestore.doc(`policies/${batchData.policyVersion}`)
        );
        if (policySnap.exists) {
          policy = policyFromData(policySnap.data());
        }
      }

      const provisionalSpace = Number(
        ticketData.provisionalSpaceSpc ?? batchData.spaceContributionSpc ?? 0
      );

      const plan = calculateReviewPlan(policy, input.inventoryState, input.objects, provisionalSpace);
      const nextDecisionVersion = input.expectedDecisionVersion + 1;

      // 1. Update deposit batch
      transaction.update(batchRef, {
        status: plan.outcome,
        pointsAwarded: plan.pointsAwarded,
        spaceContributionSpc: plan.spaceContributionSpc,
        totalDetectedObjectCount: plan.totalDetectedObjectCount,
        lines: plan.lines,
        decisionVersion: nextDecisionVersion,
        updatedAt: nowISO,
      });

      // 2. Update deposit result
      if (resultSnap?.exists) {
        transaction.update(resultRef, {
          outcome: plan.outcome,
          pointsAwarded: plan.pointsAwarded,
          spaceContributionSpc: plan.spaceContributionSpc,
          lines: plan.lines,
          decisionVersion: nextDecisionVersion,
          explanation,
          updatedAt: nowISO,
        });
      } else {
        transaction.set(resultRef, {
          id: resultRef.id,
          batchId,
          outcome: plan.outcome,
          pointsAwarded: plan.pointsAwarded,
          spaceContributionSpc: plan.spaceContributionSpc,
          lines: plan.lines,
          decisionVersion: nextDecisionVersion,
          explanation,
          createdAt: nowISO,
          updatedAt: nowISO,
        });
      }

      // 3. Update review ticket
      transaction.update(ticketRef, {
        state: "resolved",
        decisionVersion: nextDecisionVersion,
        resolvedBy: input.caller.uid,
        resolvedAt: nowTimestamp,
        resolutionReason: explanation,
        finalOutcome: plan.outcome,
        heldPoints: plan.pointsAwarded,
      });

      // 4. Record capacity entry
      const capacityRef = this.firestore.doc(
        `capacityEntries/${batchId}-review-${nextDecisionVersion}`
      );
      const binData = binSnap?.data() ?? {};
      const isHistoricalCycle =
        String(batchData.cycleId ?? "") !== String(binData.currentCycleId ?? "");

      transaction.set(capacityRef, {
        id: capacityRef.id,
        binId,
        cycleId: String(batchData.cycleId ?? ""),
        batchId,
        deltaSpc: plan.spaceDeltaSpc,
        kind: "review_correction",
        decisionVersion: nextDecisionVersion,
        createdAt: nowISO,
        historical: isHistoricalCycle,
      });

      // 5. Update bin occupancy ONLY if this review belongs to the current active cycle
      if (binRef && binSnap?.exists && !isHistoricalCycle) {
        const currentOccupied = Number(binData.occupiedSpc ?? 0);
        const capacitySpc = Number(binData.capacitySpc ?? 1000);
        const nextOccupied = Math.max(0, Math.min(capacitySpc, currentOccupied + plan.spaceDeltaSpc));
        transaction.update(binRef, {
          occupiedSpc: nextOccupied,
          lastUpdatedAt: nowTimestamp,
        });
      }

      // 6. Credit resident wallet if points are awarded
      if (plan.pointsAwarded > 0 && walletRef && walletSnap?.exists) {
        const walletData = walletSnap.data()!;
        const currentBalance = Number(walletData.balance ?? 0);
        const currentWalletVersion = Number(walletData.version ?? 0);
        const nextWalletBalance = currentBalance + plan.pointsAwarded;
        const nextWalletVersion = currentWalletVersion + 1;

        transaction.update(walletRef, {
          balance: nextWalletBalance,
          version: nextWalletVersion,
          updatedAt: nowISO,
        });

        const walletEntryRef = this.firestore.doc(`walletEntries/${batchId}-review`);
        transaction.set(walletEntryRef, {
          id: `${batchId}-review`,
          residentId: ownerId,
          type: "deposit_credit",
          pointsDelta: plan.pointsAwarded,
          sourceType: "deposit_review",
          sourceId: batchId,
          balanceAfter: nextWalletBalance,
          walletVersion: nextWalletVersion,
          createdAt: nowISO,
        });
      }

      // 7. Update resident stats
      if (statsRef && statsSnap?.exists) {
        const statsData = statsSnap.data()!;
        const verifiedDelta = plan.outcome === "verified" ? 1 : 0;
        transaction.update(statsRef, {
          verifiedBatchCount: Number(statsData.verifiedBatchCount ?? 0) + verifiedDelta,
          acceptedItemCount: Number(statsData.acceptedItemCount ?? 0) + plan.acceptedCount,
          updatedAt: nowISO,
        });
      }

      // 8. Enqueue resident notification event
      const notifRef = this.firestore.doc(
        `notificationEvents/${batchId}-${nextDecisionVersion}`
      );
      transaction.set(notifRef, {
        id: notifRef.id,
        recipientUid: ownerId,
        batchId,
        outcome: plan.outcome,
        pointsAwarded: plan.pointsAwarded,
        state: "pending",
        createdAt: nowISO,
      });

      // 9. Enqueue diagnostic retention event due at resolution + 30 days
      const retentionRef = this.firestore.doc(`retentionEvents/${batchId}`);
      const purgeDueAt = new Date(Date.now() + 30 * 86400000).toISOString();
      transaction.set(retentionRef, {
        id: batchId,
        batchId,
        resolvedAt: nowISO,
        purgeDueAt,
        state: "active",
        createdAt: nowISO,
      });

      // 10. Audit event
      const auditRef = this.firestore.collection("adminAuditEvents").doc();
      transaction.set(auditRef, {
        eventId: auditRef.id,
        timestamp: nowTimestamp,
        actorUid: input.caller.uid,
        action: "resolve_review",
        entityType: "review_ticket",
        entityId: ticketId,
        details: {
          batchId,
          outcome: plan.outcome,
          pointsAwarded: plan.pointsAwarded,
          spaceDeltaSpc: plan.spaceDeltaSpc,
          acceptedCount: plan.acceptedCount,
          decisionVersion: nextDecisionVersion,
          explanation,
        },
      });

      return {
        batchId,
        binId,
        ownerId,
        nextDecisionVersion,
        plan,
        binData,
        batchData,
        ticketData,
      };
    });

    // Invalidate read topic caches
    await Promise.all([
      this.readVersionsStore.bumpVersion("reviews", input.caller.uid),
      this.readVersionsStore.bumpVersion("dashboard", input.caller.uid),
    ]);

    // Update query projection view
    const updatedReviewView = this.projectionsStore.projectReview(
      {
        id: ticketId,
        batchId: transactionResult.batchId,
        binId: transactionResult.binId,
        state: "resolved",
        decisionVersion: transactionResult.nextDecisionVersion,
        resolvedBy: input.caller.uid,
        resolvedAt: nowISO,
        finalOutcome: transactionResult.plan.outcome,
        createdAt: transactionResult.ticketData.createdAt ?? nowISO,
      },
      {
        ...transactionResult.batchData,
        status: transactionResult.plan.outcome,
        pointsAwarded: transactionResult.plan.pointsAwarded,
        totalDetectedObjectCount: transactionResult.plan.totalDetectedObjectCount,
        lines: transactionResult.plan.lines,
      },
      transactionResult.binData
    );
    await this.projectionsStore.writeReviewView(updatedReviewView);

    // Record idempotency receipt
    const fingerprint = computePayloadFingerprint({
      ticketId,
      expectedDecisionVersion: input.expectedDecisionVersion,
      inventoryState: input.inventoryState,
      objects: input.objects,
      explanation,
    });

    const receiptPayload = {
      resourceId: ticketId,
      version: transactionResult.nextDecisionVersion,
      ticketId,
      batchId: transactionResult.batchId,
      decisionVersion: transactionResult.nextDecisionVersion,
      outcome: transactionResult.plan.outcome,
      pointsAwarded: transactionResult.plan.pointsAwarded,
      spaceContributionSpc: transactionResult.plan.spaceContributionSpc,
      spaceDeltaSpc: transactionResult.plan.spaceDeltaSpc,
      acceptedCount: transactionResult.plan.acceptedCount,
    };

    await this.operationsStore.recordReceipt(
      input.caller.uid,
      "adminResolveReview",
      input.requestId,
      fingerprint,
      input.requestId,
      receiptPayload
    );

    return {
      schemaVersion: "admin.v1",
      operation: "adminResolveReview",
      requestId: input.requestId,
      operationState: "committed",
      ticketId,
      batchId: transactionResult.batchId,
      decisionVersion: transactionResult.nextDecisionVersion,
      outcome: transactionResult.plan.outcome,
      pointsAwarded: transactionResult.plan.pointsAwarded,
      spaceContributionSpc: transactionResult.plan.spaceContributionSpc,
      spaceDeltaSpc: transactionResult.plan.spaceDeltaSpc,
      acceptedCount: transactionResult.plan.acceptedCount,
      replayed: false,
    };
  }
}
