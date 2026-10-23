# Dev Log: Admin Backend - Phase AB-06 Capacity Alerts and Collection Cycles

**Date and Time :** 2026-10-21 11:40  
**Agent:** Gemini 3.8 Flash High (Antigravity)  
**Moderator:** Alex  
**Status:** Completed  

## 1. Objective

Implement Phase AB-06 of the Admin Backend Activation Plan (`docs/archive/admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md`), integrating raw capacity occupancy evaluation, deterministic alert uniqueness per bin and cycle, alert latching, four-stage lifecycle management (`pending` -> `scheduled` -> `collected` -> `resolved`), atomic collection transactions resetting bin occupancy to 0% and opening a new cycle, independent resolution, and removal of legacy 10% reset claims from the admin web interface.

## 2. Reference Documents

- `docs/archive/admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` (Section 11, Phase AB-06)
- `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` (Sections 8, 14, 15, 16)
- `../../../contracts/admin/v1/dtos.schema.json` and `commands.schema.json`
- `../../../.agent/developer/agent.md`, `../../../.agent/web_developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `../../../functions/src/domain/admin_alerts.ts`: Alert lifecycle state machine, validation rules, deterministic ID generators (`alert-${binId}-${cycleId}`, collection events, next cycles).
  - `../../../functions/src/infrastructure/firestore/admin_alerts_store.ts`: Transactional operations for evaluating capacity alerts, scheduling collections, executing atomic collection transactions (cycle rotation, 0% reset, event write, alert advance, idempotency receipt), and resolving collected alerts.
  - `../../../functions/src/transport/admin_alerts.ts`: Admin HTTPS callables (`listAdminAlerts`, `getAdminAlert`, `adminScheduleCollection`, `adminRecordCollection`, `adminResolveCapacityAlert`).
  - `../../../functions/tests/unit/admin_alerts.test.ts`: Comprehensive unit tests covering alert generation, threshold crossing, deterministic uniqueness, lifecycle transitions, collection transactional atomicity, 0% reset, new cycle opening, and resolution independence.
  - `../../../apps/admin-web/src/data/firebase/firebaseAlertsRepository.ts`: Live Firebase implementation of `AlertsRepository` with command mutations and real-time query watchers.
  - `../../../apps/admin-web/tests/admin_alerts_ab06.test.ts`: Integration and unit tests for codec decoding, row mapping, mutation commands, and error handling.
  - `docs/archive/admin_backend/evidence/AB-06_capacity_alerts_collection.md`: Full phase evidence document.
- **Files Modified:**
  - `../../../contracts/admin/v1/dtos.schema.json`: Expanded `alertLifecycleState` enum to `["pending", "active", "scheduled", "collected", "resolved"]`.
  - `../../../functions/src/infrastructure/firestore/admin_projections_store.ts`: Added alert view projection record and projection writer.
  - `../../../functions/src/infrastructure/firestore/admin_queries_store.ts`: Added alert query listing and retrieval functions with cursor pagination.
  - `../../../functions/src/composition.ts`: Registered alert store and queries in composition container.
  - `../../../functions/src/index.ts`: Exported alert endpoints in `us-central1`.
  - `../../../firestore.rules`: Configured admin read-only access for `capacityAlerts`, `binCollectionState`, and `collectionEvents`.
  - `../../../apps/admin-web/src/contracts/adminViewCodecs.ts`: Added alert projection codecs and row mapping.
  - `../../../apps/admin-web/src/app/services.ts`: Wired `FirebaseAlertsRepository` into the production Firebase repository bundle.
  - `../../../apps/admin-web/src/features/operations/CapacityAlertsPage.tsx`: Purged legacy 10% reset claims and automated dispatch language; updated collection confirmation dialog and resolution banners.
  - `../../../apps/admin-web/package.json`: Included `admin_alerts_ab06.test.ts` in test scripts.
- **Impact to other modules:** No impact on Flutter mobile app or resident core repositories.

## 4. Technical Decisions & Deviations

- **0% Empty-Cycle Collection vs. 10% Reset:** In alignment with production backend specifications, physical collection closes the cycle and resets bin occupancy to `0 spc / 0%`. The legacy 10% reset was a mock fixture construct and has been purged from copy, dialogs, and backend logic.
- **Deterministic Alert Uniqueness & Latching:** Keyed by `alert-${binId}-${cycleId}`. An alert remains latched once triggered even if subsequent review voids drop the fill below threshold before collection.
- **Receipt Recording Sequence:** `operationsStore.recordReceipt` is an independent async method that manages its own transaction; it is invoked immediately following the core collection transaction to prevent nested transaction errors.
- **Resolution Independence:** Resolving an alert (`collected` -> `resolved`) does not mutate bin occupancy or the newly active cycle. Subsequent deposits in the new cycle create their own alerts under a new cycle ID.

## 5. Verification Results

- `../../../functions`: `npm.cmd test` -> 15 test files passed, 87 tests passed (including 16 in `admin_alerts.test.ts`).
- `../../../apps/admin-web`: `npm.cmd run check:tests` -> Exit code 0 (TypeScript strict check clean).
- `../../../apps/admin-web`: `npm.cmd run lint` -> Exit code 0.
- `../../../apps/admin-web`: `npm.cmd test` -> Exit code 0 (171 tests passed across 6 test suites).
- `../../../apps/admin-web`: `npm.cmd run build` -> Exit code 0 (Production build clean).
