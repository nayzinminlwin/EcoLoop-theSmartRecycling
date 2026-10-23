// =============================================================================
// admin_rewards_store.ts — Transactional store for Admin Reward Catalog Operations
// Phase AB-08 — Versioned reward-offer catalog management & deletion fences
// =============================================================================

import { randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import type { AdminVerificationResult } from "./admin_accounts_store.js";
import { computePayloadFingerprint } from "../../domain/admin_crypto.js";
import type {
  CreateRewardOfferInput,
  UpdateRewardOfferInput,
  DeleteRewardOfferInput,
} from "../../domain/admin_rewards.js";
import {
  validateRewardId,
  validateRewardTitle,
  validateRewardDescription,
  validateMerchantName,
  validateCategoryId,
  validatePointsCost,
  validateMaxRedemptions,
  validateSortOrder,
  validateArtKey,
  validateImageUrl,
  validateTerms,
  validateExpiryDate,
} from "../../domain/admin_rewards.js";
import type { FirestoreAdminOperationsStore } from "./admin_operations_store.js";
import type {
  FirestoreAdminProjectionsStore,
  AdminRewardViewRecord,
} from "./admin_projections_store.js";
import type { FirestoreAdminReadVersionsStore } from "./admin_read_versions_store.js";

export class FirestoreAdminRewardsStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly operationsStore: FirestoreAdminOperationsStore,
    private readonly projectionsStore: FirestoreAdminProjectionsStore,
    private readonly readVersionsStore: FirestoreAdminReadVersionsStore
  ) {}

  /**
   * Creates a new reward offer in draft or active state.
   */
  async createReward(
    input: CreateRewardOfferInput & {
      readonly caller: AdminVerificationResult;
      readonly requestId: string;
    }
  ): Promise<{
    readonly schemaVersion: "admin.v1";
    readonly operation: "adminCreateReward";
    readonly requestId: string;
    readonly operationState: "committed" | "replayed";
    readonly rewardId: string;
    readonly version: number;
    readonly replayed: boolean;
    readonly data: AdminRewardViewRecord;
  }> {
    const existingReceipt = await this.operationsStore.getReceipt(
      input.caller.uid,
      "adminCreateReward",
      input.requestId
    );

    if (existingReceipt) {
      const payload = existingReceipt.data as Record<string, unknown>;
      const rewardId = String(payload.rewardId ?? "");
      const viewSnap = await this.firestore.doc(`adminRewardViews/${rewardId}`).get();
      const viewData = (viewSnap.data() ?? payload) as AdminRewardViewRecord;

      return {
        schemaVersion: "admin.v1",
        operation: "adminCreateReward",
        requestId: input.requestId,
        operationState: "replayed",
        rewardId,
        version: Number(payload.version ?? 1),
        replayed: true,
        data: viewData,
      };
    }

    // Domain validations
    const title = validateRewardTitle(input.title);
    const description = validateRewardDescription(input.description);
    const merchantName = validateMerchantName(input.merchantName);
    const categoryId = validateCategoryId(input.categoryId);
    const pointsCost = validatePointsCost(input.pointsCost);
    const expiresAt = validateExpiryDate(input.expiresAt, input.isActive, false);
    const maxRedemptions = validateMaxRedemptions(input.maxRedemptionsPerResident);
    const artKey = validateArtKey(input.artKey);
    const sortOrder = validateSortOrder(input.sortOrder);
    const imageUrl = validateImageUrl(input.imageUrl);
    const terms = validateTerms(input.terms);
    const tag = input.tag ? String(input.tag).trim().slice(0, 40) : null;

    // Resolve category name from catalog
    let categoryName = categoryId;
    try {
      const catSnap = await this.firestore.doc(`rewardCategories/${categoryId}`).get();
      if (catSnap.exists) {
        const catData = catSnap.data()!;
        categoryName = String(catData.categoryName ?? catData.label ?? categoryId);
      }
    } catch {
      // Fallback to categoryId
    }

    const rewardId = `reward-${randomBytes(6).toString("hex")}`;
    const nowISO = new Date().toISOString();
    const nowTimestamp = Timestamp.now();

    const rewardDoc = {
      id: rewardId,
      title,
      description,
      merchantName,
      merchant: merchantName,
      categoryId,
      categoryName,
      tag,
      imageUrl,
      pointsCost,
      catalogExpiresAt: expiresAt,
      expiresAt,
      isActive: Boolean(input.isActive),
      maxRedemptionsPerResident: maxRedemptions,
      residentLimit: maxRedemptions,
      artKey,
      sortOrder,
      demoOnly: true,
      isDemo: true,
      terms,
      offerVersion: "v1",
      version: 1,
      redemptionCount: 0,
      createdAt: nowISO,
      updatedAt: nowISO,
    };

    // Save reward document
    await this.firestore.doc(`rewards/${rewardId}`).set(rewardDoc);

    // Write audit event
    const auditRef = this.firestore.collection("adminAuditEvents").doc();
    await auditRef.set({
      eventId: auditRef.id,
      timestamp: nowTimestamp,
      actorUid: input.caller.uid,
      action: "create_reward",
      entityType: "reward",
      entityId: rewardId,
      details: {
        title,
        merchantName,
        pointsCost,
        isActive: input.isActive,
        expiresAt,
        version: 1,
      },
    });

    // Invalidate read topic cache
    await this.readVersionsStore.bumpVersion("rewards", input.caller.uid);

    // Project and write view
    const view = this.projectionsStore.projectReward(rewardDoc, categoryName);
    await this.projectionsStore.writeRewardView(view);

    // Record idempotency receipt
    const fingerprint = computePayloadFingerprint({
      title,
      merchantName,
      categoryId,
      pointsCost,
      expiresAt,
      isActive: input.isActive,
    });

    await this.operationsStore.recordReceipt(
      input.caller.uid,
      "adminCreateReward",
      input.requestId,
      fingerprint,
      input.requestId,
      {
        resourceId: rewardId,
        rewardId,
        version: 1,
        title,
        isActive: input.isActive,
      }
    );

    return {
      schemaVersion: "admin.v1",
      operation: "adminCreateReward",
      requestId: input.requestId,
      operationState: "committed",
      rewardId,
      version: 1,
      replayed: false,
      data: view,
    };
  }

  /**
   * Updates an existing reward offer atomically with version checking.
   */
  async updateReward(
    input: UpdateRewardOfferInput & {
      readonly caller: AdminVerificationResult;
      readonly requestId: string;
    }
  ): Promise<{
    readonly schemaVersion: "admin.v1";
    readonly operation: "adminUpdateReward";
    readonly requestId: string;
    readonly operationState: "committed" | "replayed";
    readonly rewardId: string;
    readonly version: number;
    readonly replayed: boolean;
    readonly data: AdminRewardViewRecord;
  }> {
    const rewardId = validateRewardId(input.rewardId);

    const existingReceipt = await this.operationsStore.getReceipt(
      input.caller.uid,
      "adminUpdateReward",
      input.requestId
    );

    if (existingReceipt) {
      const payload = existingReceipt.data as Record<string, unknown>;
      const viewSnap = await this.firestore.doc(`adminRewardViews/${rewardId}`).get();
      const viewData = (viewSnap.data() ?? payload) as AdminRewardViewRecord;

      return {
        schemaVersion: "admin.v1",
        operation: "adminUpdateReward",
        requestId: input.requestId,
        operationState: "replayed",
        rewardId,
        version: Number(payload.version ?? input.expectedVersion),
        replayed: true,
        data: viewData,
      };
    }

    const title = validateRewardTitle(input.title);
    const description = validateRewardDescription(input.description);
    const merchantName = validateMerchantName(input.merchantName);
    const categoryId = validateCategoryId(input.categoryId);
    const pointsCost = validatePointsCost(input.pointsCost);
    const maxRedemptions = validateMaxRedemptions(input.maxRedemptionsPerResident);
    const artKey = validateArtKey(input.artKey);
    const sortOrder = validateSortOrder(input.sortOrder);
    const imageUrl = validateImageUrl(input.imageUrl);
    const terms = validateTerms(input.terms);
    const tag = input.tag ? String(input.tag).trim().slice(0, 40) : null;

    const nowISO = new Date().toISOString();
    const nowTimestamp = Timestamp.now();

    const transactionResult = await this.firestore.runTransaction(async (transaction) => {
      const rewardRef = this.firestore.doc(`rewards/${rewardId}`);
      const rewardSnap = await transaction.get(rewardRef);
      if (!rewardSnap.exists) {
        throw new HttpsError("not-found", `Reward offer ${rewardId} not found.`);
      }

      const rewardData = rewardSnap.data()!;
      const currentVersion = Number(rewardData.version ?? 1);
      if (currentVersion !== input.expectedVersion) {
        throw new HttpsError(
          "failed-precondition",
          `Reward offer version mismatch: expected ${input.expectedVersion}, found ${currentVersion}.`
        );
      }

      const wasActive = rewardData.isActive === true;
      const isDeactivating = wasActive && !input.isActive;
      const expiresAt = validateExpiryDate(input.expiresAt, input.isActive, isDeactivating);

      let categoryName = String(rewardData.categoryName ?? categoryId);
      if (categoryId !== rewardData.categoryId) {
        try {
          const catRef = this.firestore.doc(`rewardCategories/${categoryId}`);
          const catSnap = await transaction.get(catRef);
          if (catSnap.exists) {
            const catData = catSnap.data()!;
            categoryName = String(catData.categoryName ?? catData.label ?? categoryId);
          }
        } catch {
          // Keep categoryName
        }
      }

      const nextVersion = currentVersion + 1;
      const nextOfferVersion = `v${nextVersion}`;

      const updatedReward = {
        title,
        description,
        merchantName,
        merchant: merchantName,
        categoryId,
        categoryName,
        tag,
        imageUrl,
        pointsCost,
        catalogExpiresAt: expiresAt,
        expiresAt,
        isActive: Boolean(input.isActive),
        maxRedemptionsPerResident: maxRedemptions,
        residentLimit: maxRedemptions,
        artKey,
        sortOrder,
        demoOnly: true,
        isDemo: true,
        terms,
        offerVersion: nextOfferVersion,
        version: nextVersion,
        updatedAt: nowISO,
      };

      transaction.update(rewardRef, updatedReward);

      // Audit event
      const auditRef = this.firestore.collection("adminAuditEvents").doc();
      transaction.set(auditRef, {
        eventId: auditRef.id,
        timestamp: nowTimestamp,
        actorUid: input.caller.uid,
        action: "update_reward",
        entityType: "reward",
        entityId: rewardId,
        details: {
          title,
          merchantName,
          pointsCost,
          isActive: input.isActive,
          expiresAt,
          version: nextVersion,
          previousVersion: currentVersion,
        },
      });

      return {
        rewardId,
        nextVersion,
        categoryName,
        fullReward: {
          ...rewardData,
          ...updatedReward,
          id: rewardId,
        },
      };
    });

    // Invalidate read topic cache
    await this.readVersionsStore.bumpVersion("rewards", input.caller.uid);

    // Project and write view
    const view = this.projectionsStore.projectReward(
      transactionResult.fullReward,
      transactionResult.categoryName
    );
    await this.projectionsStore.writeRewardView(view);

    // Record idempotency receipt
    const fingerprint = computePayloadFingerprint({
      rewardId,
      expectedVersion: input.expectedVersion,
      title,
      merchantName,
      categoryId,
      pointsCost,
      expiresAt: input.expiresAt,
      isActive: input.isActive,
    });

    await this.operationsStore.recordReceipt(
      input.caller.uid,
      "adminUpdateReward",
      input.requestId,
      fingerprint,
      input.requestId,
      {
        resourceId: rewardId,
        rewardId,
        version: transactionResult.nextVersion,
        title,
        isActive: input.isActive,
      }
    );

    return {
      schemaVersion: "admin.v1",
      operation: "adminUpdateReward",
      requestId: input.requestId,
      operationState: "committed",
      rewardId,
      version: transactionResult.nextVersion,
      replayed: false,
      data: view,
    };
  }

  /**
   * Deletes an unused reward offer.
   * If the offer was ever redeemed, deletion is blocked with a conflict error.
   */
  async deleteReward(
    input: DeleteRewardOfferInput & {
      readonly caller: AdminVerificationResult;
      readonly requestId: string;
    }
  ): Promise<{
    readonly schemaVersion: "admin.v1";
    readonly operation: "adminDeleteUnusedReward";
    readonly requestId: string;
    readonly operationState: "committed" | "replayed";
    readonly rewardId: string;
    readonly replayed: boolean;
  }> {
    const rewardId = validateRewardId(input.rewardId);

    const existingReceipt = await this.operationsStore.getReceipt(
      input.caller.uid,
      "adminDeleteUnusedReward",
      input.requestId
    );

    if (existingReceipt) {
      return {
        schemaVersion: "admin.v1",
        operation: "adminDeleteUnusedReward",
        requestId: input.requestId,
        operationState: "replayed",
        rewardId,
        replayed: true,
      };
    }

    const nowTimestamp = Timestamp.now();

    await this.firestore.runTransaction(async (transaction) => {
      const rewardRef = this.firestore.doc(`rewards/${rewardId}`);
      const rewardSnap = await transaction.get(rewardRef);
      if (!rewardSnap.exists) {
        throw new HttpsError("not-found", `Reward offer ${rewardId} not found.`);
      }

      const rewardData = rewardSnap.data()!;
      const currentVersion = Number(rewardData.version ?? 1);
      if (currentVersion !== input.expectedVersion) {
        throw new HttpsError(
          "failed-precondition",
          `Reward offer version mismatch: expected ${input.expectedVersion}, found ${currentVersion}.`
        );
      }

      // Check reference marker on document
      const redemptionCount = Number(rewardData.redemptionCount ?? 0);
      if (redemptionCount > 0) {
        throw new HttpsError(
          "failed-precondition",
          "Reward offer has already been redeemed by residents and cannot be deleted. Deactivate it instead."
        );
      }

      // Authoritative check: redemptions collection
      const redemptionQuery = this.firestore
        .collection("redemptions")
        .where("rewardId", "==", rewardId)
        .limit(1);
      const redemptionsSnap = await transaction.get(redemptionQuery);
      if (!redemptionsSnap.empty) {
        throw new HttpsError(
          "failed-precondition",
          "Reward offer has already been redeemed by residents and cannot be deleted. Deactivate it instead."
        );
      }

      transaction.delete(rewardRef);

      // Audit event
      const auditRef = this.firestore.collection("adminAuditEvents").doc();
      transaction.set(auditRef, {
        eventId: auditRef.id,
        timestamp: nowTimestamp,
        actorUid: input.caller.uid,
        action: "delete_reward",
        entityType: "reward",
        entityId: rewardId,
        details: {
          title: rewardData.title,
          merchantName: rewardData.merchantName,
          version: currentVersion,
        },
      });
    });

    // Delete projection view
    await this.firestore.doc(`adminRewardViews/${rewardId}`).delete();

    // Invalidate read topic cache
    await this.readVersionsStore.bumpVersion("rewards", input.caller.uid);

    // Record idempotency receipt
    const fingerprint = computePayloadFingerprint({
      rewardId,
      expectedVersion: input.expectedVersion,
    });

    await this.operationsStore.recordReceipt(
      input.caller.uid,
      "adminDeleteUnusedReward",
      input.requestId,
      fingerprint,
      input.requestId,
      {
        resourceId: rewardId,
        rewardId,
        version: input.expectedVersion,
      }
    );

    return {
      schemaVersion: "admin.v1",
      operation: "adminDeleteUnusedReward",
      requestId: input.requestId,
      operationState: "committed",
      rewardId,
      replayed: false,
    };
  }
}
