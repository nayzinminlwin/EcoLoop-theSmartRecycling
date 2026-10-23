# Dev Log: Admin Backend - Phase AB-08 Rewards Catalog Management

**Date and Time :** 2026-10-21 12:45  
**Agent:** Gemini 3.8 Flash High (Antigravity)  
**Moderator:** Alex  
**Status:** Completed  

## 1. Objective

Implement Phase AB-08 of the Admin Backend Activation Plan (`docs/archive/admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md`), integrating real reward-offer catalog management across the Firebase backend and Admin Web portal, versioned offer updates (`expectedVersion`), optimistic concurrency control, Malaysia end-of-day expiration boundaries, publication vs deactivation rules, deletion reference fencing against existing resident redemptions/vouchers, server-enforced demo-only requirements, and updated UI labeling on `/vouchers` (`RewardsVouchersPage.tsx`).

## 2. Reference Documents

- `docs/archive/admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` (Section 13, Phase AB-08)
- `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` (Sections 11, 14, 15, 16)
- `../../../contracts/admin/v1`
- `../../../.agent/developer/agent.md`, `../../../.agent/web_developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `../../../functions/src/domain/admin_rewards.ts`: Domain validations (`validateRewardId`, `validateRewardTitle`, `validateRewardDescription`, `validateMerchantName`, `validateCategoryId`, `validatePointsCost`, `validateMaxRedemptions`, `validateSortOrder`, `validateArtKey`, `validateImageUrl`, `validateTerms`, `normalizeMalaysiaExpiry`, `validateExpiryDate`).
  - `../../../functions/src/infrastructure/firestore/admin_rewards_store.ts`: `FirestoreAdminRewardsStore` implementing `createReward`, `updateReward`, and `deleteReward` with optimistic concurrency version checking, reference fencing against `redemptionCount` and `redemptions` collection, audit logs, idempotency receipts, and read view projection updates.
  - `../../../functions/src/transport/admin_rewards.ts`: Exported callables `adminCreateReward`, `adminCreateRewardOffer`, `adminUpdateReward`, `adminUpdateRewardOffer`, `adminDeleteUnusedReward`, `adminDeleteRewardOffer`.
  - `../../../functions/tests/unit/admin_rewards.test.ts`: 11 unit tests covering reward domain validations, Malaysia date normalization, future date requirement on publication, past date allowance on deactivation, and invalid inputs.
  - `../../../apps/admin-web/tests/admin_rewards_ab08.test.ts`: 9 unit tests for reward view codecs, mock repository versioning, reference fencing against issued vouchers, and `FirebaseRewardRepository` command execution.
  - `docs/archive/admin_backend/evidence/AB-08_rewards_catalog.md`: Full phase evidence document.
- **Files Modified:**
  - `../../../functions/src/infrastructure/firestore/rewards_store.ts`: Added `transaction.update(rewardRef, { redemptionCount: FieldValue.increment(1) })` in `FirestoreRewardsStore.redeem` so resident redemptions maintain the deletion reference fence marker.
  - `../../../functions/src/composition.ts`: Wired `adminRewards` store into dependency injection container.
  - `../../../functions/src/index.ts`: Exported admin reward callables in `us-central1`.
  - `../../../apps/admin-web/src/contracts/admin.ts`: Extended `RewardInput` with optional `expectedVersion`, `terms`, and `isDemo`.
  - `../../../apps/admin-web/src/data/repositories.ts`: Extended `AdminRewardsRepository.delete(id: string, expectedVersion?: number): Promise<void>`.
  - `../../../apps/admin-web/src/data/firebase/firebaseRewardRepository.ts`: Implemented `create`, `update`, `delete` using `this.commandClient.execute(...)` with canonical operations.
  - `../../../apps/admin-web/src/data/mockRepositories.ts`: Implemented version-checked update and delete, reference fencing against `vouchers` and `redemptions`, and flexible expiry validation for deactivation.
  - `../../../apps/admin-web/src/data/mockSeeds.ts`: Updated initial voucher seed `VCH-WELCOME` to reference `rewardId: "RWD-SNACK"` for testing reference fence rejections.
  - `../../../apps/admin-web/src/features/program/RewardsVouchersPage.tsx`: Added `editingRewardVersion` tracking; updated active/draft status toggle to send `expectedVersion`; updated form validation to permit deactivating expired offers; updated action and modal titles to "Create Catalog Voucher Offer" / "Edit Catalog Voucher Offer".
  - `../../../apps/admin-web/package.json`: Registered `tests/admin_rewards_ab08.test.ts` in test and typecheck scripts.
- **Impact to other modules:** No impact on Flutter resident mobile code.

## 4. Technical Decisions & Deviations

- **Catalog Offer vs Resident Voucher Instances:** The `/vouchers` UI route manages catalog voucher offers, not individual resident voucher instances. The copy and modal titles were clarified to prevent confusion.
- **Publication Expiry vs Deactivation:** Active publication requires `expiresAt` to be strictly in the future. Deactivating an expired offer is explicitly permitted without forcing the administrator to enter an arbitrary future date.
- **Malaysia Timezone Normalization:** Date strings without explicit times are pegged to Malaysia end-of-day (`23:59:59.999+08:00`), converted to explicit UTC timestamps.
- **Deletion Reference Fence:** An offer can only be deleted if it has never been redeemed or issued (`redemptionCount === 0` and no matching redemptions). Once referenced, it cannot be deleted; operators must deactivate it instead.

## 5. Verification Results

- **Backend tests:** 17/17 test files passed, 105/105 tests passed (`npm test` in `../../../functions`).
- **Frontend tests:** 8/8 test suites passed, 189/189 tests passed (`npm test` in `../../../apps/admin-web`).
- **Frontend typecheck:** `check:tests` and `lint` passed with 0 errors.
- **Frontend build:** `npm run build` completed successfully, producing production bundle in `dist/`.
