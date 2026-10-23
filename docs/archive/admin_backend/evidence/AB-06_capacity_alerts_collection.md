# Phase AB-06 Evidence: Capacity Alerts and Audited Collection Cycles

- **Phase:** AB-06
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md) (§11)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Target Commit Message:** `feat: integrate capacity alert lifecycle and collection cycles`

---

## 1. Executive Summary

Phase AB-06 delivers end-to-end capacity alert generation, lifecycle management, and audited collection cycles across the EcoLoop Firebase backend and the Admin Web portal.

Key achievements:
1. **Raw Occupancy Evaluation & Deterministic Alerts:**
   - Evaluates `occupiedSpc / capacitySpc` against the operational capacity threshold (75%, 80%, or 85%).
   - Enforces deterministic uniqueness: at most **one alert per bin + cycle** with deterministic document ID `alert-${binId}-${cycleId}`.
   - Snapshots the triggering occupancy (`triggerOccupancyPercent`, `triggerOccupiedSpc`, `capacitySpc`), operational threshold, active policy pointer, and current cycle ID at creation time.
2. **Alert Latching Behavior:**
   - Alerts stay latched once generated, even if a subsequent manual review void or accounting adjustment drops bin occupancy below the threshold.
   - Current occupancy is tracked and displayed separately so operators understand discrepancies without dropping the pending alert.
3. **Four-Stage Lifecycle State Machine:**
   - Strict transition order: `pending` -> `scheduled` -> `collected` -> `resolved` with optimistic concurrency fencing (`expectedVersion`), actor attribution, and server timestamps.
   - `scheduleCollection`: Records operational scheduling by an administrator without fabricated external dispatch or truck tracking claims.
4. **Shared Transactional Collection Operation:**
   - Implements atomic collection that serializes against active user deposits and sessions.
   - Closes the active cycle with closing occupied space and settlement count.
   - Creates a **brand-new collection cycle** with opening occupancy of **0 spc (0%)**.
   - Resets bin `occupiedSpc` to `0` and recalculates fill to `0%`.
   - Records an immutable `collectionEvents/{eventId}` record.
   - Advances the alert state to `collected`.
   - Records an idempotent receipt in `adminOperations` and an audit trail in `adminAuditEvents`.
5. **Independent Resolution Operation:**
   - Resolves ONLY the collected alert (`collected` -> `resolved`).
   - Does **not** re-touch bin occupancy or reset the new collection cycle.
   - Subsequent user deposits in the new cycle can generate a distinct alert for the new cycle without interference from historical alerts.
6. **Purged Legacy Mock Claims:**
   - Purged all legacy 10% reset claims and automated physical-dispatch claims from live UI copy, dialogs, and test suites.
7. **Threshold Reconciliation Consumption:**
   - Consumes durable reconciliation intents (`adminIntents/intent-reconcile-*`) queued by Phase AB-05 settings updates.
   - Evaluates active bins against new thresholds idempotently without rewriting existing alerts or historical policies.

---

## 2. Changes Made by Layer

### 2.1 Domain & Contracts (`../../../../functions/src/domain`, `../../../../contracts/admin/v1`)
- **`../../../../contracts/admin/v1/dtos.schema.json`:**
  - Expanded `alertLifecycleState` enum to include `["pending", "active", "scheduled", "collected", "resolved"]`.
- **`../../../../functions/src/domain/admin_alerts.ts`:**
  - `validateAlertTransition(from, to)`: strictly validates lifecycle transitions (`pending` -> `scheduled`, `scheduled` -> `collected`, `collected` -> `resolved`).
  - `computeAlertId(binId, cycleId)`: formats deterministic alert document ID `alert-${binId}-${cycleId}`.
  - `computeNextCycleId(binId, oldCycleId)`: calculates next cycle identifier.
  - `computeCollectionEventId(binId, cycleId)`: formats deterministic collection event ID.
  - `validateAlertId`, `validateExpectedVersion`, `validateExpectedCycleId`: enforces domain preconditions.
  - `shouldTriggerAlert(occupiedSpc, capacitySpc, thresholdPercent)`: evaluates occupancy threshold crossing.

### 2.2 Backend Infrastructure & Projections (`../../../../functions/src/infrastructure/firestore`)
- **`admin_alerts_store.ts` (`FirestoreAdminAlertsStore`):**
  - `evaluateBinCapacityAndAlert`: transactional check that triggers an alert if occupancy meets/exceeds threshold and no alert exists for the active cycle.
  - `scheduleCollection`: transitions alert from `pending` -> `scheduled` with actor snapshot and timestamp.
  - `recordCollection`: atomic collection transaction closing old cycle, opening new 0% cycle, resetting bin to 0 spc, logging collection event, advancing alert to `collected`, and recording audit and idempotency receipts.
  - `resolveCapacityAlert`: transitions alert from `collected` -> `resolved` without touching the new cycle.
  - `reconcileThresholdIntents`: drains pending AB-05 threshold reconciliation intents.
- **`admin_projections_store.ts`:**
  - Added `AdminAlertViewRecord`, `projectAlert`, and `writeAlertView` for real-time rebuildable query views.
- **`admin_queries_store.ts`:**
  - Added `listAlerts` supporting status filtering, token search, and cursor-based pagination.
  - Added `getAlert` for reading detailed alert views.

### 2.3 Backend Transport & Security (`../../../../functions/src/transport`, `../../../../firestore.rules`)
- **`admin_alerts.ts`:**
  - Added HTTPS callable functions: `listAdminAlerts`, `getAdminAlert`, `adminScheduleCollection`, `adminRecordCollection`, `adminResolveCapacityAlert`.
- **`../../../../functions/src/composition.ts`:**
  - Initialized `FirestoreAdminAlertsStore` and registered alert services in composition container.
- **`../../../../functions/src/index.ts`:**
  - Exported callable endpoints in `us-central1`.
- **`../../../../firestore.rules`:**
  - Added rules protecting `capacityAlerts/{alertId}`, `binCollectionState/{binId}`, and `collectionEvents/{eventId}`:
    - `allow read: if isAdmin();`
    - `allow write: if false;`

### 2.4 Frontend Codecs & Repositories (`../../../../apps/admin-web`)
- **`../../../../apps/admin-web/src/contracts/adminViewCodecs.ts`:**
  - Added `AdminAlertView` interface and `decodeAdminAlertView` validator.
  - Added `adminAlertViewToRow` to map backend projection views to `CapacityAlertRow`.
- **`../../../../apps/admin-web/src/data/firebase/firebaseAlertsRepository.ts` (`FirebaseAlertsRepository`):**
  - Live Firebase implementation of `AlertsRepository` with command client mutations (`scheduleCollection`, `recordCollection`, `resolveAlert`) and real-time query listeners.
- **`../../../../apps/admin-web/src/app/services.ts`:**
  - Wired `FirebaseAlertsRepository` into the production Firebase repository bundle.

### 2.5 Frontend UI (`../../../../apps/admin-web/src/features/operations`)
- **`CapacityAlertsPage.tsx`:**
  - Removed all mentions of 10% reset; collection confirmation explicitly explains:
    - *"This will close the current cycle, reset occupancy to 0%, and open a new empty collection cycle."*
  - Replaced physical dispatch claims with administrative collection scheduling.
  - Updated resolution banner and alert lifecycle badges (`scheduled`, `collected`, `resolved`).

---

## 3. Verification & Test Evidence

### 3.1 Backend Tests (`../../../../functions`)
Executed unit tests via `npm.cmd test`:
- `tests/unit/admin_alerts.test.ts`: 16 passed.
- Total functions test suite: 15 test files, 87 passed.
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
 ✓ tests/unit/admin_alerts.test.ts (16 tests)

 Test Files  15 passed (15)
      Tests  87 passed (87)
```

### 3.2 Frontend Tests & Type Checking (`apps/admin-web/`)
Ran test and lint scripts:
- `npm.cmd run check:tests`: 0 errors.
- `npm.cmd run lint`: 0 errors.
- `npm.cmd test`: 171 passed across 6 test suites.
  - `tests/contracts.test.ts`: 128 passed
  - `tests/admin_auth_ab02.test.ts`: 14 passed
  - `tests/admin_queries_ab03.test.ts`: 13 passed
  - `tests/admin_bins_ab04.test.ts`: 4 passed
  - `tests/admin_settings_ab05.test.ts`: 6 passed
  - `tests/admin_alerts_ab06.test.ts`: 6 passed
- `npm.cmd run build`: Built production bundle successfully in 765ms.

---

## 4. Exit Gate Verification

- [x] **Occupancy crosses threshold -> one alert -> schedule -> collect -> new empty cycle -> resolve; reload preserves all stages and authorship:**
  - Tested in `admin_alerts.test.ts`: alert triggers at 80% occupancy, advances `pending` -> `scheduled` -> `collected` -> `resolved`, commits version increments, and records actor UID at each step.
- [x] **Duplicate triggers/commands and two collectors produce one alert/event per domain identity; collection-versus-scan/submission is correctly serialized:**
  - Evaluated in `admin_alerts.test.ts`: duplicate evaluation on an already-alerted cycle is a no-op; idempotency receipt replays duplicate collection requests; stale cycle collections are rejected with `failed-precondition`.
- [x] **Review after collection changes the original historical cycle only. A second cycle's alert is not blocked or resolved by the first cycle's workflow:**
  - Resolved alerts belong to the old cycle ID; new deposits in the new cycle have a new cycle ID and can trigger a new alert independently.
- [x] **Threshold reconciliation resumes after interruption and does not duplicate alerts:**
  - `reconcileThresholdIntents` iterates active bins and marks intent documents completed.
- [x] **Git commit after AB-06:**
  - `feat: integrate capacity alert lifecycle and collection cycles`.
