# Dev Log: Admin Backend - Phase AB-05 Program Settings and Policy Publication

**Date and Time :** 2026-10-21 11:12  
**Agent:** Gemini 3.8 Flash High (Antigravity)  
**Moderator:** Alex  
**Status:** Completed  

## 1. Objective

Implement Phase AB-05 of the Admin Backend Activation Plan (`docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md`), delivering immutable program settings and future-policy publication, separation of operational capacity alert threshold from financial policy versions, explicit class acceptance controls with cardboard exclusion, optimistic concurrency version fencing, and draft conflict resolution in the admin portal.

## 2. Reference Documents

- `docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` (Section 10, Phase AB-05)
- `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` (Sections 8, 9, 14, 16)
- `contracts/admin/v1/commands.schema.json` (`adminPublishSettings`)
- `contracts/admin/v1/golden_cases.json` and `invalid_cases.json`
- `.agent/developer/agent.md`, `.agent/web_developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `functions/src/domain/admin_settings.ts`: Domain validations (`validateThreshold`, `validateAcceptedClasses`, `validateRates`, `hasPolicyChanged`, `hasThresholdChanged`, `generatePolicyId`, `createNextPolicy`).
  - `functions/src/infrastructure/firestore/admin_settings_store.ts`: Transactional store for atomic settings publication and immutable policy creation (`FirestoreAdminSettingsStore`).
  - `functions/src/transport/admin_settings.ts`: HTTPS callables in `us-central1` protected by `requireAdminCaller` (`getAdminSettings`, `adminPublishSettings`).
  - `functions/tests/unit/admin_settings.test.ts`: Unit tests for domain validations, threshold-only updates, immutable policy generation, idempotency replay, and submitted-policy arithmetic preservation.
  - `apps/admin-web/src/data/firebase/firebaseSettingsRepository.ts`: Live Firebase adapter implementing `SettingsRepository` (`get`, `watch`, `update`).
  - `apps/admin-web/tests/admin_settings_ab05.test.ts`: Unit tests for live Firebase repository mutations, error mapping, and mock mode concurrency and invariant enforcement.
  - `docs/admin_backend/evidence/AB-05_program_settings_policy.md`: Evidence document capturing verification, architecture decisions, and exit gates.
- **Files Modified:**
  - `functions/src/composition.ts`: Wired `FirestoreAdminSettingsStore` into the service composition container.
  - `functions/src/index.ts`: Exported `getAdminSettings` and `adminPublishSettings`.
  - `functions/package.json`: Added `test:admin:settings` script.
  - `firestore.rules`: Protected `adminIntents/{intentId}` collection (`allow read, write: if false;`).
  - `apps/admin-web/src/contracts/admin.ts`: Extended `AdminSettings` and `ProgramSettingsDocument` with `version`, `policyVersion`, and `acceptedClasses`; extended `SettingsInput` with `expectedVersion` and `acceptedClasses`.
  - `apps/admin-web/src/app/services.ts`: Wired `FirebaseSettingsRepository` into the live service bundle.
  - `apps/admin-web/src/data/mockRepositories.ts`: Aligned in-memory mock settings repository with operational versions, active policy IDs, explicit class acceptance, and concurrency conflict checks.
  - `apps/admin-web/src/features/program/SettingsPage.tsx`: Enhanced UI to display settings and policy versions, grouped canonical class acceptance checkboxes, cardboard visibly excluded with warning, non-negative integer rates (0 is valid), and real-time version conflict banner with a reload handler.
  - `apps/admin-web/src/features/program/program.css`: Added styles for policy badge bar, class category groups, disabled excluded class card, and conflict banner.
  - `apps/admin-web/package.json`: Added `tests/admin_settings_ab05.test.ts` to `check:tests` and `test` scripts.
- **Impact to other modules:** No impact on Flutter mobile app or resident core repositories.

## 4. Technical Decisions & Deviations

- **Separation of Operational Settings and Financial Policy:** Operational capacity alert thresholds are maintained at `adminSettings/global` (`version: number`, `capacityAlertThreshold: 75 | 80 | 85`). Pinned recycling policies are stored immutably in `policies/{policyId}`.
- **Threshold-Only Updates:** When only the capacity alert threshold is adjusted, `adminSettings/global` advances its operational version and enqueues a reconciliation intent `adminIntents/intent-reconcile-${requestId}` for Phase AB-06. No unnecessary financial policies are created.
- **Immutable Policy Publication:** Changes to class acceptance or points rates create a brand-new immutable policy document `policies/{newPolicyId}` matching `^policy-[a-f0-9]{8}$`. The pointer `policyPointers/active` is advanced, leaving older policies (e.g. `policy-v1`) completely unmodified so historical batches retain their pinned arithmetic.
- **Granular Class Acceptance & Cardboard Exclusion:** Replaced blanket material toggles with canonical classes grouped by stream: plastic (`plastic_bottle`), aluminium (`aluminium_can`), glass (`glass_bottle`), and paper (`paper_item`, `paper_bag`). Cardboard (`cardboard_item`) is strictly excluded in both domain validation and the UI with an explicit warning banner explaining that bulky items belong at manual recycling centers.
- **Optimistic Concurrency & Idempotency:** Any publication with an `expectedVersion` different from current `adminSettings/global.version` is rejected with `failed-precondition` (`conflictVersion`). Identical payloads return an explicit `replayed` receipt without mutating Firestore.

## 5. Verification Results

- `functions`: `npm.cmd test` -> 14 test files passed, 70 tests passed (including 12 unit tests in `admin_settings.test.ts`).
- `functions`: `npm.cmd run test:admin:settings` -> 12 passed.
- `apps/admin-web`: `npm.cmd run check:tests` -> Exit code 0 (TypeScript strict check passed).
- `apps/admin-web`: `npm.cmd run lint` -> Exit code 0 (Clean check over `src/main.tsx`).
- `apps/admin-web`: `npm.cmd test` -> Exit code 0 (165 passed across 5 test suites).
- `apps/admin-web`: `npm.cmd run build` -> Exit code 0 (Vite build completed in 741ms).
