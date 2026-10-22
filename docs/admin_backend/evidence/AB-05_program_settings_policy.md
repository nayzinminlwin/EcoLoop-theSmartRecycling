# Phase AB-05 Evidence: Immutable Program Settings and Future-Policy Publication

- **Phase:** AB-05
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Target Commit Message:** `feat: publish versioned admin program settings`

---

## 1. Executive Summary

Phase AB-05 implements immutable program settings and future-policy publication for the EcoLoop Admin Web portal and Firebase backend.

Key outcomes achieved:
1. **Separation of Operational Settings and Financial Policy:**
   - Operational settings are stored at `adminSettings/global` (`version: number`, `capacityAlertThreshold: 75 | 80 | 85`, `activePolicyId: string`, `updatedAt: Timestamp`).
   - Canonical program policies are stored immutably at `policies/{policyId}`.
   - Pinned program policy pointer is maintained at `policyPointers/active`.
2. **Threshold-Only Updates:**
   - Threshold-only adjustments (75%, 80%, 85%) do **not** create redundant financial policy documents.
   - Updates `adminSettings/global`, advances `version`, bumps topic revisions (`adminReadVersions/settings` and `adminReadVersions/alerts`), and enqueues a durable `adminIntents/intent-reconcile-${requestId}` for Phase AB-06 collection reconciler.
3. **Immutable Policy Version Publication:**
   - Changes to item-class acceptance or category reward rates generate a new immutable policy in `policies/{newPolicyId}` matching `^policy-[a-f0-9]{8}$`.
   - Advances `policyPointers/active`, while preserving historical policies (e.g. `policy-v1`) completely unmutated.
   - Batches submitted under policy P1 retain P1 arithmetic and rates even after policy P2 is published.
4. **Explicit Class Acceptance & Cardboard Exclusion:**
   - Blanket material eligibility is replaced with granular canonical classes grouped by stream:
     - Plastic: `plastic_bottle`
     - Aluminium: `aluminium_can`
     - Glass: `glass_bottle`
     - Paper: `paper_item`, `paper_bag`
     - Cardboard: `cardboard_item` is strictly forbidden and visibly excluded. The UI displays an explicit warning that cardboard is bulky and must be taken to collection centers.
5. **Optimistic Concurrency & Idempotency:**
   - Rejects concurrent publishers with stale `expectedVersion` via `failed-precondition` (`conflictVersion`).
   - Identical payloads return an explicit `operationState: "replayed"` receipt without incrementing versions or mutating documents.
   - Re-submitting the same `requestId` returns the committed receipt from `adminOperations/{scopedHash}`.
6. **Frontend UI Integration (`SettingsPage.tsx`):**
   - Displays operational version (`v{version}`) and active policy version badges.
   - Granular class acceptance checkboxes grouped by stream with stream status badges.
   - Cardboard visibly disabled with an exclusion alert tag.
   - Non-negative integer rates (0 is valid).
   - Real-time conflict notification banner with a "Reload latest" action if another administrator publishes settings while a local draft is dirty.

---

## 2. Changes Made by Layer

### 2.1 Backend Domain (`functions/src/domain/`)
- **`admin_settings.ts`:**
  - `validateThreshold`: enforces threshold in `[75, 80, 85]` with error message containing `valid_threshold_enum_required`.
  - `validateAcceptedClasses`: enforces non-empty list of allowable canonical classes (`plastic_bottle`, `aluminium_can`, `glass_bottle`, `paper_item`, `paper_bag`) and rejects `cardboard_item` with `cardboard_excluded`.
  - `validateRates`: enforces non-negative integer rates (`0..1000`) for standard categories (`plastic`, `aluminium`, `paper`, `glass`).
  - `hasPolicyChanged`: detects changes in sorted accepted classes and category points.
  - `hasThresholdChanged`: detects threshold adjustments.
  - `generatePolicyId`: generates unique IDs matching `^policy-[a-f0-9]{8}$`.
  - `createNextPolicy`: constructs complete immutable `PolicySnapshot` copying unchanged space calculation parameters.

### 2.2 Backend Infrastructure (`functions/src/infrastructure/firestore/`)
- **`admin_settings_store.ts` (`FirestoreAdminSettingsStore`):**
  - `getSettings`: composes composite DTO combining `adminSettings/global` and the active policy referenced by `policyPointers/active`.
  - `publishSettings`: atomic transaction verifying idempotency, checking `expectedVersion`, detecting diffs, optionally creating `policies/{newPolicyId}`, syncing `guideMaterials` and `guideContent`, enqueuing `adminIntents/intent-reconcile-${requestId}` on threshold change, updating `adminSettings/global`, logging audit events in `adminAuditEvents`, and recording receipts in `adminOperations`.
  - Bumps topic revisions on `adminReadVersions/settings`, `alerts`, and `dashboard`.

### 2.3 Backend Transport (`functions/src/transport/`)
- **`admin_settings.ts`:**
  - `getAdminSettings`: authenticated admin callable returning `AdminSettingsDTO`.
  - `adminPublishSettings`: authenticated admin callable executing `publishSettings` in `FirestoreAdminSettingsStore`.
- **`functions/src/composition.ts`:**
  - Wires `FirestoreAdminSettingsStore` into the service composition container.
- **`functions/src/index.ts`:**
  - Exports `getAdminSettings` and `adminPublishSettings`.
- **`firestore.rules`:**
  - Added protected rule for `adminIntents/{intentId}` (`allow read, write: if false;`).

### 2.4 Frontend Contracts & Repositories (`apps/admin-web/`)
- **`apps/admin-web/src/contracts/admin.ts`:**
  - Extended `AdminSettings` and `ProgramSettingsDocument` with `version`, `policyVersion`, and `acceptedClasses`.
  - Extended `SettingsInput` with optional `expectedVersion` and `acceptedClasses`.
- **`apps/admin-web/src/data/firebase/firebaseSettingsRepository.ts` (`FirebaseSettingsRepository`):**
  - Implements `SettingsRepository` using `getAdminSettings` and `adminPublishSettings`.
  - Watches `adminSettings/global` and `adminReadVersions/settings` for live cross-client updates.
- **`apps/admin-web/src/app/services.ts`:**
  - Wires `FirebaseSettingsRepository` into the live service bundle.
- **`apps/admin-web/src/data/mockRepositories.ts`:**
  - Aligned mock `settings.get` and `settings.update` with operational versioning, active policy ID, explicit class acceptance, and concurrency conflict checks.

### 2.5 Frontend UI (`apps/admin-web/src/features/program/`)
- **`SettingsPage.tsx`:**
  - Added policy identity bar showing `Settings Version`, `Active Policy ID`, and `Last Published`.
  - Replaced flat material checkboxes with grouped canonical classes:
    - Plastic (`plastic_bottle`)
    - Metal / Aluminium (`aluminium_can`)
    - Glass (`glass_bottle`)
    - Paper (`paper_item`, `paper_bag`)
    - Cardboard (`cardboard_item`) displayed as disabled and visibly excluded.
  - Allowed 0 points per item.
  - Implemented version conflict banner and `Reload latest` recovery handler.
- **`program.css`:**
  - Added styles for `.settings-policy-bar`, `.settings-policy-pill`, `.conflict-banner`, `.class-category-group`, `.class-option-card`, and `.excluded-tag`.

---

## 3. Verification & Test Evidence

### 3.1 Backend Tests (`functions/`)
Ran unit test suite via `npm.cmd test`:
- `tests/unit/admin_settings.test.ts`: 12 passed.
- Total functions test suite: 14 test files, 70 passed.
```text
 ✓ tests/unit/notifications.test.ts (3 tests)
 ✓ tests/unit/policy.test.ts (3 tests)
 ✓ tests/unit/reconciliation.test.ts (1 test)
 ✓ tests/unit/logger.test.ts (1 test)
 ✓ tests/unit/rewards.test.ts (3 tests)
 ✓ tests/unit/contracts.test.ts (3 tests)
 ✓ tests/unit/voucher_policy.test.ts (2 tests)
 ✓ tests/unit/identity.test.ts (2 tests)
 ✓ tests/unit/workspace.test.ts (1 test)
 ✓ tests/unit/dispatch.test.ts (1 test)
 ✓ tests/unit/admin_auth.test.ts (11 tests)
 ✓ tests/unit/admin_bins.test.ts (11 tests)
 ✓ tests/unit/admin_projections.test.ts (16 tests)
 ✓ tests/unit/admin_settings.test.ts (12 tests)

 Test Files  14 passed (14)
      Tests  70 passed (70)
```

### 3.2 Frontend Tests & Type Checking (`apps/admin-web/`)
Ran test and lint scripts:
- `npm.cmd run check:tests`: 0 errors.
- `npm.cmd run lint`: 0 errors.
- `npm.cmd test`: 165 tests passed across 5 test suites.
  - `tests/contracts.test.ts`: 128 passed
  - `tests/admin_auth_ab02.test.ts`: 14 passed
  - `tests/admin_queries_ab03.test.ts`: 13 passed
  - `tests/admin_bins_ab04.test.ts`: 4 passed
  - `tests/admin_settings_ab05.test.ts`: 6 passed
- `npm.cmd run build`: Built production bundle successfully in 741ms.

---

## 4. Exit Gate Verification

- [x] **Submit batch under policy P1, publish P2, then resolve P1:**
  - P1 accounting retains P1 point rates (e.g. 5 pts/plastic bottle) even after P2 is published (20 pts/plastic bottle).
  - New batches and current recycling guide reference policy P2.
- [x] **Two concurrent publishers cannot both replace the same expected pointer:**
  - Verified in `admin_settings.test.ts` and `admin_settings_ab05.test.ts`: if `expectedVersion` does not match, transaction fails with `failed-precondition` / `conflict`.
- [x] **Zero-rate accepted items still count toward verified impact:**
  - Items with `pointsPerItem: 0` are accepted and count toward `acceptedCount` and `spaceContributionSpc` without awarding points.
- [x] **Saving category rates cannot accidentally accept cardboard or mutate stored policy P1:**
  - `cardboard_item` is strictly rejected by domain validation.
  - Cardboard is disabled in `SettingsPage.tsx`.
  - Historical policy P1 document is immutable and never updated in place.
- [x] **Git commit after AB-05:**
  - `feat: publish versioned admin program settings`.
