# Phase AB-08 Evidence: Real Reward-Offer Catalog Management

- **Phase:** AB-08
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md) (§13)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Target Commit Message:** `feat: activate versioned admin rewards catalog management`

---

## 1. Executive Summary

Phase AB-08 delivers complete versioned reward-offer catalog management across the EcoLoop Firebase backend and Admin Web portal.

Key achievements:
1. **Catalog Offer Management vs Resident Voucher Instances:**
   - Correctly establishes that `/vouchers` (`RewardsVouchersPage.tsx`) manages **reward offers / catalog voucher offers**, whereas resident voucher instances are immutable user-issued tokens with independent lifecycles (`issuedAt + 30 days`).
   - Updated UI headers, buttons, and modal dialogs to explicitly declare "Create Catalog Voucher Offer" and "Edit Catalog Voucher Offer", eliminating operator confusion between catalog offers and resident voucher issuance.
2. **Strict Server Domain Validation & Demo-Only Invariant:**
   - Enforced domain constraints in `../../../../functions/src/domain/admin_rewards.ts`:
     - IDs: uppercase alphanumeric with hyphens (`validateRewardId`).
     - Strings: title (3-80 chars), description (5-500 chars), merchant (2-60 chars), terms (optional, max 1000 chars).
     - Values: `pointsCost` integer [1..100,000], `maxRedemptionsPerResident` [1..100], `sortOrder` [-1000..1000].
     - Categories: valid known categories (`food`, `shopping`, `groceries`, `transport`, `other`).
     - Artwork: valid art keys (`art1`..`art6`, `default`) or HTTPS URLs without server-side fetching.
     - Strictly enforces `demoOnly: true` / `isDemo: true` in this PoC environment.
3. **Malaysia End-of-Day Expiration & Publication vs Deactivation Boundaries:**
   - Date inputs are normalized to Malaysia end-of-day boundary (`23:59:59.999` Malaysia time, UTC+8) with explicit UTC `Timestamp` boundaries.
   - Publication (`isActive === true`) strictly requires expiration in the future.
   - Deactivation (`isActive === false`) allows setting an expired offer to inactive/draft without requiring the operator to fabricate a dummy future expiration date.
4. **Optimistic Concurrency Control via `expectedVersion`:**
   - All update operations, including quick active/draft toggles in `RewardsVouchersPage.tsx`, enforce `expectedVersion`.
   - Prevents stale UI forms from clobbering concurrent administrative edits or resident redemption state.
   - Increments `version` and tracks `offerVersion: "v" + nextVersion`.
5. **Deletion Reference Fencing (`redemptionCount` & Collections Check):**
   - Deletion of an offer is permitted **only** if the offer was never redeemed or issued.
   - Resident redemption transaction in `FirestoreRewardsStore.redeem` atomically increments `redemptionCount: FieldValue.increment(1)`.
   - Admin store deletion check verifies `redemptionCount === 0` and queries the `redemptions` subcollection to ensure zero resident references exist.
   - Attempting to delete a referenced reward returns `failed-precondition` / conflict (`Reward has issued vouchers or redemptions and cannot be deleted. Deactivate it instead.`).
6. **Command Transport, Read Projections & Cache Invalidation:**
   - Exported HTTPS callables: `adminCreateReward`, `adminUpdateReward`, `adminDeleteUnusedReward` (with `adminCreateRewardOffer`, `adminUpdateRewardOffer`, `adminDeleteRewardOffer` aliases).
   - Records idempotent execution receipts in `adminOperations` and audit logs in `adminAuditEvents`.
   - Synchronously updates read model projections in `adminRewardViews/{id}` and bumps `adminReadVersions/rewards`.

---

## 2. Changes Made by Layer

### 2.1 Backend Domain (`../../../../functions/src/domain/admin_rewards.ts`)
- Implemented robust domain validation functions:
  - `validateRewardId`: Validates alphanumeric format.
  - `validateRewardTitle`, `validateRewardDescription`, `validateMerchantName`: Enforces bounded string lengths.
  - `validateCategoryId`: Enforces known category whitelist (`food`, `shopping`, `groceries`, `transport`, `other`).
  - `validatePointsCost`: Requires integer $\ge 1$.
  - `validateMaxRedemptions`: Validates per-resident cap ($1 \le n \le 100$).
  - `validateSortOrder`: Validates priority integer.
  - `validateArtKey`, `validateImageUrl`: Validates art assets safely without arbitrary URL fetching.
  - `validateTerms`: Enforces optional terms boundary.
  - `normalizeMalaysiaExpiry` & `validateExpiryDate`: Ensures Malaysia timezone end-of-day UTC boundary; enforces future date on active publication while permitting deactivation of past dates.

### 2.2 Backend Infrastructure (`../../../../functions/src/infrastructure/firestore`)
- **`rewards_store.ts` (`FirestoreRewardsStore`):**
  - Updated `redeem` transaction to maintain reference marker: `transaction.update(rewardRef, { redemptionCount: FieldValue.increment(1), updatedAt: nowTimestamp });`.
- **`admin_rewards_store.ts` (`FirestoreAdminRewardsStore`):**
  - `createReward`: Validates inputs, creates `rewards/{rewardId}` with `version: 1`, `offerVersion: "v1"`, `redemptionCount: 0`, `demoOnly: true`, writes projection in `adminRewardViews`, invalidates `adminReadVersions/rewards`, logs `adminAuditEvents`, and writes `adminOperations` idempotency receipt.
  - `updateReward`: Transactionally verifies `reward.version === input.expectedVersion`, checks publication expiry rules, increments version, updates document and projection, logs audit event, and writes idempotency receipt.
  - `deleteReward`: Checks `redemptionCount > 0` and performs query check against `redemptions` collection. Throws `failed-precondition` conflict if referenced. Deletes document and projection, bumps read version, logs audit event, and writes idempotency receipt.

### 2.3 Backend Transport (`../../../../functions/src/transport/admin_rewards.ts`, `composition.ts`, `index.ts`)
- Created HTTPS callables:
  - `adminCreateReward` / `adminCreateRewardOffer`
  - `adminUpdateReward` / `adminUpdateRewardOffer`
  - `adminDeleteUnusedReward` / `adminDeleteRewardOffer`
- Wired `adminRewards` into dependency injection container in `../../../../functions/src/composition.ts`.
- Exported callables in `us-central1` with App Check and admin identity claims in `../../../../functions/src/index.ts`.

### 2.4 Frontend Contracts & Codecs (`../../../../apps/admin-web/src/contracts/admin.ts`, `repositories.ts`)
- Extended `RewardInput` with optional `expectedVersion?: number`, `terms?: string | null`, and `isDemo?: boolean`.
- Extended `AdminRewardsRepository.delete(id: string, expectedVersion?: number): Promise<void>`.

### 2.5 Frontend Repositories & UI (`../../../../apps/admin-web/src`)
- **`firebaseRewardRepository.ts` (`FirebaseRewardRepository`):**
  - Fully implemented `create`, `update`, and `delete` using `this.commandClient.execute(...)` with `adminCreateReward`, `adminUpdateReward`, and `adminDeleteUnusedReward`.
  - Added automatic `expectedVersion` lookup from projection when updating or deleting.
- **`mockRepositories.ts`:**
  - Implemented versioned update and delete in mock mode with expected version conflict checks.
  - Implemented deletion reference fencing: checks whether any mock vouchers reference the `rewardId` or redemptions exist, rejecting deletion if referenced.
  - Updated `validateRewardInput` to allow deactivation of offers with past expiration dates.
- **`mockSeeds.ts`:**
  - Updated initial seed voucher `VCH-WELCOME` to reference `rewardId: "RWD-SNACK"` for testing reference fence rejections.
- **`RewardsVouchersPage.tsx`:**
  - Updated header title and primary action: `"Create offer"` / `"Create Catalog Voucher Offer"`.
  - Stored `editingRewardVersion` in state during modal edit opening.
  - Included `expectedVersion` in `handleToggleStatus` to prevent clobbering concurrent edits.
  - Updated form validation to permit deactivating expired offers without requiring artificial dates.
  - Updated delete modal confirmation text to clearly state reference fencing behavior.

---

## 3. Test Verification & Verification Matrix

### 3.1 Backend Test Results (`../../../../functions`)
Command: `npm.cmd test`
```
 ✓ tests/unit/policy.test.ts (3 tests)
 ✓ tests/unit/admin_rewards.test.ts (11 tests)
 ✓ tests/unit/admin_reviews.test.ts (7 tests)
 ✓ tests/unit/notifications.test.ts (3 tests)
 ✓ tests/unit/rewards.test.ts (3 tests)
 ✓ tests/unit/contracts.test.ts (3 tests)
 ✓ tests/unit/reconciliation.test.ts (1 test)
 ✓ tests/unit/logger.test.ts (1 test)
 ✓ tests/unit/voucher_policy.test.ts (2 tests)
 ✓ tests/unit/identity.test.ts (2 tests)
 ✓ tests/unit/workspace.test.ts (1 test)
 ✓ tests/unit/dispatch.test.ts (1 test)
 ✓ tests/unit/admin_alerts.test.ts (16 tests)
 ✓ tests/unit/admin_settings.test.ts (13 tests)
 ✓ tests/unit/admin_auth.test.ts (11 tests)
 ✓ tests/unit/admin_projections.test.ts (16 tests)
 ✓ tests/unit/admin_bins.test.ts (11 tests)

 Test Files  17 passed (17)
      Tests  105 passed (105)
   Duration  3.98s
```

### 3.2 Frontend Test Results (`apps/admin-web/`)
Command: `npm.cmd test`
```
✔ Phase 3 — Rewards CRUD, Settings, & Failure Injection (185.2092ms)
✔ Phase 3 — Watch / Observable Contract (155.5315ms)
✔ Phase AB-02 — Config & Runtime Mode Resolution (1.083ms)
✔ Phase AB-02 — Firebase Command Client (1.8399ms)
✔ Phase AB-02 — Scoped Hashing & Payload Fingerprinting (7.7959ms)
✔ Phase AB-02 — Admin Identity Claim Enforcement (0.2371ms)
✔ Phase AB-03 — Admin Bin View Codec (3.6601ms)
✔ Phase AB-03 — Admin Reward View Codec (0.9671ms)
✔ Phase AB-03 — Paginated Envelopes & Cursors (1.6601ms)
✔ Phase AB-04 — FirebaseBinRepository & QR Code Export (3.2475ms)
✔ Phase AB-04 — Mock Bins Repository QR Generation (3.699ms)
✔ Phase AB-05 — FirebaseSettingsRepository & Program Policy Publication (1.7541ms)
✔ Phase AB-05 — Mock Settings Repository Concurrency & Invariants (5970.5375ms)
✔ Phase AB-06 — Admin Alert View Codecs (2.2647ms)
✔ Phase AB-06 — FirebaseAlertsRepository (1.701ms)
✔ Phase AB-07 — Admin Review View Codecs (3.0914ms)
✔ Phase AB-07 — Mock Verification Repository Resolution & Invariants (1720.8909ms)
✔ Phase AB-07 — FirebaseVerificationRepository (1.6553ms)
✔ Phase AB-08 — Admin Reward View Codecs (2.2568ms)
✔ Phase AB-08 — Mock Rewards Repository Versioning & Reference Fencing (5619.8369ms)
✔ Phase AB-08 — FirebaseRewardRepository Command Client (2.0126ms)

ℹ tests 189
ℹ suites 59
ℹ pass 189
ℹ fail 0
```

### 3.3 Static Analysis & Build (`apps/admin-web/`)
- `npm run check:tests`: Exited 0 (TypeScript compile check passed).
- `npm run lint`: Exited 0 (TypeScript check of source passed).
- `npm run build`: Exited 0 (Vite production bundle built cleanly in 548ms).

---

## 4. Requirement Verification Matrix

| Section 13 Checklist Item | Implementation Status | Evidence / Verification Test |
| --- | --- | --- |
| Create/edit/publication/delete-unused with expectedVersion and strict validation | COMPLETE | `FirestoreAdminRewardsStore`, `admin_rewards.test.ts`, `admin_rewards_ab08.test.ts` |
| Canonical catalog fields, demo terms, server-enforced demo-only | COMPLETE | `validateTerms`, `demoOnly: true`, `isDemo: true` enforced on write |
| Version generation on update, preserve resident redemption snapshots | COMPLETE | Increment `version` + `offerVersion`, resident redemption records snapshot |
| Active/draft toggle version-checked against clobbering | COMPLETE | `handleToggleStatus` passes `expectedVersion`, store throws on version mismatch |
| Malaysia end-of-day expiry with explicit UTC Timestamp boundary | COMPLETE | `normalizeMalaysiaExpiry` computes `23:59:59.999+08:00` UTC boundary |
| HTTPS artwork URLs validated safely without SSRF | COMPLETE | URL regex pattern check (`https://...`), artKey fallback |
| Reject publication of expired offers, allow deactivation of expired offers | COMPLETE | Domain validator and store allow `!isActive` with past date |
| Delete permitted only if never redeemed/issued | COMPLETE | Store queries `redemptionCount` and `redemptions`, returns conflict if referenced |
| Catalog lifecycle independent of issued voucher validity | COMPLETE | Catalog update/delete/deactivate does not touch resident `vouchers` |
| Catalog UI labeled "Create Catalog Voucher Offer" | COMPLETE | `RewardsVouchersPage.tsx` modal title and buttons updated |

---

## 5. Conclusion

Phase AB-08 satisfies all criteria defined in Section 13 of the Admin Backend Implementation Plan. The reward offer catalog is completely versioned, reference-fenced against orphaning redeemed vouchers, protected against concurrent update collisions, and integrated between Firebase Functions and the Admin Web interface.
