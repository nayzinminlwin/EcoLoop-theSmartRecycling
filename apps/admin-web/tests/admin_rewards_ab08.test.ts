// =============================================================================
// admin_rewards_ab08.test.ts — Unit tests for Phase AB-08 Reward Offer Catalog Management
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeAdminRewardView,
  decodeAdminRewardCategoryView,
  adminRewardViewToReward,
} from "../src/contracts/adminViewCodecs.ts";
import { FirebaseRewardRepository } from "../src/data/firebase/firebaseRewardRepository.ts";
import { createMockRepositories } from "../src/data/mockRepositories.ts";
import type { FirebaseCommandClient } from "../src/core/firebase/commandClient.ts";
import type { RewardInput } from "../src/contracts/admin.ts";

describe("Phase AB-08 — Admin Reward View Codecs", () => {
  it("decodes a valid server AdminRewardView projection cleanly", () => {
    const raw = {
      rewardId: "reward-101",
      title: "RM5 Eco Voucher",
      description: "RM5 discount at EcoMarket",
      merchantName: "EcoMarket",
      categoryId: "shopping",
      categoryName: "Shopping",
      tag: "Popular",
      imageUrl: "https://example.com/voucher.jpg",
      pointsCost: 50,
      expiresAt: "2027-12-31T15:59:59.999Z",
      isActive: true,
      maxRedemptionsPerResident: 2,
      artKey: "art1",
      sortOrder: 1,
      isDemo: true,
      terms: "Valid on all groceries.",
      version: 2,
      updatedAt: "2026-10-21T10:00:00.000Z",
    };

    const decoded = decodeAdminRewardView(raw);
    assert.equal(decoded.rewardId, "reward-101");
    assert.equal(decoded.title, "RM5 Eco Voucher");
    assert.equal(decoded.pointsCost, 50);
    assert.equal(decoded.version, 2);
    assert.equal(decoded.artKey, "art1");
    assert.equal(decoded.isDemo, true);

    const uiReward = adminRewardViewToReward(decoded);
    assert.equal(uiReward.id, "reward-101");
    assert.equal(uiReward.title, "RM5 Eco Voucher");
    assert.equal(uiReward.pointsCost, 50);
    assert.equal(uiReward.isActive, true);
  });

  it("decodes a valid AdminRewardCategoryView", () => {
    const raw = {
      categoryId: "cat-food",
      categoryName: "Food & Beverage",
      description: "Cafe discounts and meal vouchers",
      sortOrder: 0,
    };

    const decoded = decodeAdminRewardCategoryView(raw);
    assert.equal(decoded.categoryId, "cat-food");
    assert.equal(decoded.categoryName, "Food & Beverage");
  });
});

describe("Phase AB-08 — Mock Rewards Repository Versioning & Reference Fencing", () => {
  it("creates, updates with version check, and increments version in mock mode", async () => {
    const mockBundle = createMockRepositories();
    mockBundle.controls.setAuthState({ uid: "ADM-001", role: "admin", isSignedIn: true });

    // 1. Create a reward
    const input: RewardInput = {
      title: "Test Coffee",
      description: "One hot americano",
      merchantName: "Cyber Cafe",
      categoryId: "food",
      tag: "Fresh",
      imageUrl: "https://example.com/coffee.jpg",
      pointsCost: 20,
      expiresAt: "2029-12-31T23:59:59+08:00",
      isActive: true,
      maxRedemptionsPerResident: 1,
      artKey: "art0",
      sortOrder: 0,
    };

    const created = await mockBundle.repositories.rewards.create(input);
    assert.ok(created.id);
    assert.equal(created.title, "Test Coffee");

    // 2. Update reward with expectedVersion 1 -> should succeed and bump version
    const updateInput: RewardInput = {
      ...input,
      title: "Test Coffee (Updated)",
      expectedVersion: 1,
    };

    const updated = await mockBundle.repositories.rewards.update(created.id, updateInput);
    assert.equal(updated.title, "Test Coffee (Updated)");

    // 3. Stale update with expectedVersion 1 -> should throw conflict
    await assert.rejects(
      async () => {
        await mockBundle.repositories.rewards.update(created.id, {
          ...updateInput,
          expectedVersion: 1,
        });
      },
      /version mismatch/i
    );
  });

  it("permits deactivating an offer even with a past expiry date", async () => {
    const mockBundle = createMockRepositories();
    mockBundle.controls.setAuthState({ uid: "ADM-001", role: "admin", isSignedIn: true });

    // 1. Create a draft with future expiry
    const created = await mockBundle.repositories.rewards.create({
      title: "Draft Deal",
      description: "Special deal",
      merchantName: "Merchant A",
      categoryId: "food",
      tag: null,
      imageUrl: null,
      pointsCost: 15,
      expiresAt: "2029-12-31T23:59:59+08:00",
      isActive: true,
      maxRedemptionsPerResident: 1,
      artKey: "art2",
      sortOrder: 0,
    });

    // 2. Deactivate with past expiry -> should succeed without error
    const deactivated = await mockBundle.repositories.rewards.update(created.id, {
      title: "Draft Deal",
      description: "Special deal",
      merchantName: "Merchant A",
      categoryId: "food",
      tag: null,
      imageUrl: null,
      pointsCost: 15,
      expiresAt: "2020-01-01T00:00:00+08:00",
      isActive: false,
      maxRedemptionsPerResident: 1,
      artKey: "art2",
      sortOrder: 0,
      expectedVersion: 1,
    });

    assert.equal(deactivated.isActive, false);
  });

  it("blocks deletion of a reward that has existing vouchers or redemptions", async () => {
    const mockBundle = createMockRepositories();
    mockBundle.controls.setAuthState({ uid: "ADM-001", role: "admin", isSignedIn: true });

    // RWD-SNACK has existing mock vouchers
    await assert.rejects(
      async () => {
        await mockBundle.repositories.rewards.delete("RWD-SNACK");
      },
      /Reward has issued vouchers or redemptions/i
    );
  });

  it("allows deletion of an unreferenced reward", async () => {
    const mockBundle = createMockRepositories();
    mockBundle.controls.setAuthState({ uid: "ADM-001", role: "admin", isSignedIn: true });

    // Create a new unreferenced reward
    const created = await mockBundle.repositories.rewards.create({
      title: "Unused Promo",
      description: "No one redeemed this",
      merchantName: "Store X",
      categoryId: "shopping",
      tag: null,
      imageUrl: null,
      pointsCost: 10,
      expiresAt: "2029-12-31T23:59:59+08:00",
      isActive: true,
      maxRedemptionsPerResident: 1,
      artKey: "art3",
      sortOrder: 0,
    });

    // Delete it -> should succeed
    await mockBundle.repositories.rewards.delete(created.id, 1);

    // Verify it is gone
    await assert.rejects(
      async () => {
        await mockBundle.repositories.rewards.get(created.id);
      },
      /not found/i
    );
  });
});

describe("Phase AB-08 — FirebaseRewardRepository Command Client", () => {
  it("executes adminCreateReward with canonical payload via commandClient", async () => {
    let capturedOperation: string | null = null;
    let capturedPayload: unknown = null;

    const mockCommandClient: Partial<FirebaseCommandClient> = {
      execute: (async (op: string, payload: unknown) => {
        capturedOperation = op;
        capturedPayload = payload;
        return {
          schemaVersion: "admin.v1",
          operation: op,
          requestId: "req-1",
          traceId: "trace-1",
          status: "committed",
          data: {
            rewardId: "reward-test-99",
            title: (payload as any).title,
            description: (payload as any).description,
            merchantName: (payload as any).merchantName,
            categoryId: (payload as any).categoryId,
            categoryName: "Food",
            tag: null,
            imageUrl: null,
            pointsCost: (payload as any).pointsCost,
            expiresAt: (payload as any).expiresAt,
            isActive: (payload as any).isActive,
            maxRedemptionsPerResident: (payload as any).maxRedemptionsPerResident,
            artKey: (payload as any).artKey,
            sortOrder: (payload as any).sortOrder,
            isDemo: true,
            terms: "Demo terms",
            version: 1,
            updatedAt: "2026-10-21T10:00:00.000Z",
          },
        };
      }) as FirebaseCommandClient["execute"],
    };

    const repo = new FirebaseRewardRepository(
      {} as any,
      {} as any,
      mockCommandClient as FirebaseCommandClient,
      {} as any
    );

    const input: RewardInput = {
      title: "Eco Bottle Voucher",
      description: "Redeemable for reusable bottle",
      merchantName: "Green Goods",
      categoryId: "merchandise",
      tag: null,
      imageUrl: null,
      pointsCost: 75,
      expiresAt: "2027-01-01T00:00:00Z",
      isActive: true,
      maxRedemptionsPerResident: 2,
      artKey: "art1",
      sortOrder: 5,
    };

    const res = await repo.create(input);
    assert.equal(capturedOperation, "adminCreateReward");
    assert.equal((capturedPayload as any).title, "Eco Bottle Voucher");
    assert.equal((capturedPayload as any).isDemo, true);
    assert.equal(res.id, "reward-test-99");
    assert.equal(res.pointsCost, 75);
  });

  it("executes adminUpdateReward with expectedVersion", async () => {
    let capturedOperation: string | null = null;
    let capturedPayload: unknown = null;

    const mockCommandClient: Partial<FirebaseCommandClient> = {
      execute: (async (op: string, payload: unknown) => {
        capturedOperation = op;
        capturedPayload = payload;
        return {
          schemaVersion: "admin.v1",
          operation: op,
          requestId: "req-2",
          traceId: "trace-2",
          status: "committed",
          data: {
            rewardId: (payload as any).rewardId,
            title: (payload as any).title,
            description: (payload as any).description,
            merchantName: (payload as any).merchantName,
            categoryId: (payload as any).categoryId,
            categoryName: "Food",
            tag: null,
            imageUrl: null,
            pointsCost: (payload as any).pointsCost,
            expiresAt: (payload as any).expiresAt,
            isActive: (payload as any).isActive,
            maxRedemptionsPerResident: (payload as any).maxRedemptionsPerResident,
            artKey: (payload as any).artKey,
            sortOrder: (payload as any).sortOrder,
            isDemo: true,
            terms: "Demo terms",
            version: 2,
            updatedAt: "2026-10-21T10:00:00.000Z",
          },
        };
      }) as FirebaseCommandClient["execute"],
    };

    const repo = new FirebaseRewardRepository(
      {} as any,
      {} as any,
      mockCommandClient as FirebaseCommandClient,
      {} as any
    );

    const input: RewardInput = {
      title: "Eco Bottle Voucher (v2)",
      description: "Redeemable for reusable bottle",
      merchantName: "Green Goods",
      categoryId: "merchandise",
      tag: null,
      imageUrl: null,
      pointsCost: 80,
      expiresAt: "2027-01-01T00:00:00Z",
      isActive: false,
      maxRedemptionsPerResident: 2,
      artKey: "art1",
      sortOrder: 5,
      expectedVersion: 1,
    };

    const res = await repo.update("reward-test-99", input);
    assert.equal(capturedOperation, "adminUpdateReward");
    assert.equal((capturedPayload as any).rewardId, "reward-test-99");
    assert.equal((capturedPayload as any).expectedVersion, 1);
    assert.equal((capturedPayload as any).pointsCost, 80);
    assert.equal(res.id, "reward-test-99");
  });

  it("executes adminDeleteUnusedReward with expectedVersion", async () => {
    let capturedOperation: string | null = null;
    let capturedPayload: unknown = null;

    const mockCommandClient: Partial<FirebaseCommandClient> = {
      execute: (async (op: string, payload: unknown) => {
        capturedOperation = op;
        capturedPayload = payload;
        return {
          schemaVersion: "admin.v1",
          operation: op,
          requestId: "req-3",
          traceId: "trace-3",
          status: "committed",
          data: {},
        };
      }) as FirebaseCommandClient["execute"],
    };

    const repo = new FirebaseRewardRepository(
      {} as any,
      {} as any,
      mockCommandClient as FirebaseCommandClient,
      {} as any
    );

    await repo.delete("reward-test-99", 2);
    assert.equal(capturedOperation, "adminDeleteUnusedReward");
    assert.equal((capturedPayload as any).rewardId, "reward-test-99");
    assert.equal((capturedPayload as any).expectedVersion, 2);
  });
});
