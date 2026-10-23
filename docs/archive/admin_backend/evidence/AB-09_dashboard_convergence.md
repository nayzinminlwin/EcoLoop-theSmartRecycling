# Phase AB-09 Evidence: Dashboard Accounting, Realtime Convergence, and Operational Proof

- **Phase:** AB-09
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md) (§14)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Target Commit Message:** `feat: connect admin analytics and cross-client realtime projections`

---

## 1. Executive Summary

Phase AB-09 activates real operational analytics, gross accounting invariants, dynamic Malaysia activity windows, and cross-client realtime convergence for the Admin Overview dashboard across the EcoLoop Firebase backend and Admin Web application.

Key achievements:
1. **Gross Accounting Invariant (EcoPoints Issued vs Wallet Balances):**
   - Enforces that `ecoPointsIssued` and `totalPointsIssued` are derived exclusively from original positive deposit-credit ledger effects (including review settlements).
   - Proven that resident voucher redemptions debit net wallet balances but **never** decrement gross issued totals or verified deposit counts.
2. **Display Weight Calculations & Policy Exclusions:**
   - Standardized unit weights:
     - Plastic (`plastic_bottle`, `plastic`): `0.025 kg`
     - Aluminium (`aluminium_can`, `aluminium`): `0.015 kg`
     - Paper (`paper_item`, `paper_bag`, `paper`): `0.050 kg`
     - Glass (`glass_bottle`, `glass`): `0.200 kg`
     - Cardboard (`cardboard_item`): `0.000 kg` (excluded by active program policy; contributes zero verified weight impact).
   - Proven exit gate scenario: 2 plastic ($0.050\text{ kg}$) + 3 aluminium ($0.045\text{ kg}$) + 1 paper ($0.050\text{ kg}$) equals exactly $0.145\text{ kg}$ across 6 accepted items, yielding 37 EcoPoints.
3. **Dynamic 7-Day Malaysia Activity Window (`Asia/Kuala_Lumpur`):**
   - Formats dates using `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" })`.
   - The activity window dynamically spans today plus the previous 6 Malaysia calendar dates (`[today - 6 days, ..., today]`).
   - Grouping is pegged to the original batch occurrence date (`occurredAt`); a late review across midnight correctly attributes verified counts to the batch's original occurrence date.
4. **Deterministic Attention Bin Classification:**
   - Filters and ranks fleet bins needing operational attention into prioritized tiers:
     1. Active collection required (`critical`, `collection_pending`, or `hasActiveAlert === true`).
     2. High capacity ($fillPercent \ge 85\%$).
     3. Warning band ($fillPercent \ge 75\%$ or `warning`).
     4. Disabled or offline bins (`enabled === false` or `logicalOnline === false`).
   - Deterministically tie-broken by `fillPercent` descending and `binId` ascending.
5. **Realtime Projection Convergence & Tab Visibility Management:**
   - Synchronizes `adminDashboardViews/summary` read projection and invalidates cache via `adminReadVersions/dashboard`.
   - Admin Web `FirebaseDashboardRepository` listens to `adminReadVersions/dashboard` and pauses active reloading when the browser tab is hidden (`document.visibilityState === "hidden"`), immediately revalidating when returning to the foreground.
6. **Preview & Rebuild Administrative Transport:**
   - Implemented HTTPS callables `getAdminDashboard` and `rebuildAdminDashboard`.
   - Rebuilding logs structured metadata in `adminAuditEvents` and increments read version counters.
   - Protected by `../../../../firestore.rules` allowing read access exclusively to authenticated admins.

---

## 2. Changes Made by Layer

### 2.1 Backend Domain (`../../../../functions/src/domain/admin_dashboard.ts`)
- Defined immutable unit weights in `KG_PER_PIECE` with zero weight for cardboard and non-eligible classes.
- Implemented `mapClassToMaterialType(rawClass: string)` to map raw vision classes to canonical material types (`plastic`, `aluminium`, `paper`, `glass`, `unknown`).
- Implemented `getMalaysiaDate(instantOrMs)` and `getSevenDayMalaysiaWindow(nowMs)` using `Asia/Kuala_Lumpur` timezone formatting.
- Implemented `calculateMaterialMix(counts)` computing exact weights, rounding to 3 decimal places, and computing integer percentage shares.
- Implemented `classifyAttentionBins(candidates, thresholdPercent, maxResults)` with 5-tier priority sorting and deterministic tie-breaking.

### 2.2 Backend Infrastructure (`../../../../functions/src/infrastructure/firestore/admin_dashboard_store.ts`)
- Created `FirestoreAdminDashboardStore`:
  - `getDashboard(nowMs)`: Retrieves `adminDashboardViews/summary`. If missing or last calculated on a prior calendar day (Malaysia rollover), executes a full rebuild.
  - `rebuildDashboard(actorUid, nowMs)`: Aggregates active data from canonical collections (`bins`, `binCollectionState`, `capacityAlerts`, `reviewTickets`, `batches`).
  - Computes `registeredBins`, `activeAlerts`, `pendingReviews`, `verifiedDepositsToday`, `pointsIssuedToday`, `totalVerifiedDeposits`, `totalPointsIssued`, `totalWeightKg`, `dailyActivity` (7 days), `materialMix`, and `attentionBins`.
  - Atomically writes projection to `adminDashboardViews/summary` and bumps `adminReadVersions/dashboard`.
  - Emits audit entry to `adminAuditEvents` when manually rebuilt by an administrator.

### 2.3 Backend Transport (`../../../../functions/src/transport/admin_dashboard.ts`, `composition.ts`, `index.ts`, `../../../../firestore.rules`)
- Created HTTPS callables:
  - `getAdminDashboard`: Authenticates admin claim via App Check / Auth token, returning `AdminDashboardViewRecord`.
  - `rebuildAdminDashboard`: Recomputes analytics projection and returns fresh dashboard.
- Registered `adminDashboard` in composition container (`../../../../functions/src/composition.ts`).
- Exported callables in `us-central1` with App Check and admin authorization (`../../../../functions/src/index.ts`).
- Added Firestore security rule in `../../../../firestore.rules`:
  ```text
  match /adminDashboardViews/{dashboardId} {
    allow read: if isAdmin();
    allow write: if false;
  }
  ```

### 2.4 Frontend Contracts & Codecs (`apps/admin-web/src/contracts/adminViewCodecs.ts`)
- Created TypeScript interfaces:
  - `AdminDailyActivityView` (`date`, `depositsCount`, `pointsAwarded`).
  - `AdminMaterialMixView` (`materialType`, `percentage`, `itemCount`, `weightKg`).
  - `AdminAttentionBinView` (`binId`, `locationName`, `fillPercent`, `collectionState`).
  - `AdminDashboardView` (full dashboard projection envelope).
- Implemented `decodeAdminDashboardView(raw: unknown): AdminDashboardView` with safe defaults, timestamp normalization, and array clamps.
- Implemented `adminDashboardViewToSummary(view: AdminDashboardView): DashboardSummary` mapping server projections cleanly to UI state.

### 2.5 Frontend Repositories & UI Integration (`apps/admin-web/src/`)
- Created `FirebaseDashboardRepository` in `apps/admin-web/src/data/firebase/firebaseDashboardRepository.ts`:
  - `getSummary()`: Calls `getAdminDashboard` callable and converts through codecs.
  - `watchSummary()`: Subscribes to `adminReadVersions/dashboard` onSnapshot listener.
  - Tab visibility management: Pauses state reloads when `document.visibilityState === "hidden"` and sets `pendingRefresh = true`; executes immediate revalidation upon returning to foreground.
- Wired `FirebaseDashboardRepository` into `services.repositories.dashboard` in `apps/admin-web/src/app/services.ts`.

---

## 3. Test Verification & Verification Matrix

### 3.1 Backend Test Results (`functions/`)
Command: `npm.cmd test`
```
 ✓ tests/unit/admin_reviews.test.ts (7 tests)
 ✓ tests/unit/policy.test.ts (3 tests)
 ✓ tests/unit/admin_rewards.test.ts (11 tests)
 ✓ tests/unit/notifications.test.ts (3 tests)
 ✓ tests/unit/admin_dashboard.test.ts (6 tests)
 ✓ tests/unit/contracts.test.ts (3 tests)
 ✓ tests/unit/rewards.test.ts (3 tests)
 ✓ tests/unit/logger.test.ts (1 test)
 ✓ tests/unit/reconciliation.test.ts (1 test)
 ✓ tests/unit/voucher_policy.test.ts (2 tests)
 ✓ tests/unit/identity.test.ts (2 tests)
 ✓ tests/unit/workspace.test.ts (1 test)
 ✓ tests/unit/admin_settings.test.ts (13 tests)
 ✓ tests/unit/dispatch.test.ts (1 test)
 ✓ tests/unit/admin_alerts.test.ts (16 tests)
 ✓ tests/unit/admin_bins.test.ts (11 tests)
 ✓ tests/unit/admin_auth.test.ts (11 tests)
 ✓ tests/unit/admin_projections.test.ts (16 tests)

 Test Files  18 passed (18)
      Tests  111 passed (111)
   Duration  3.88s
```

### 3.2 Frontend Test Results (`apps/admin-web/`)
Command: `npm.cmd test`
```
✔ Phase 3 — Rewards CRUD, Settings, & Failure Injection (185.2092ms)
✔ Phase 3 — Watch / Observable Contract (155.5315ms)
✔ Phase AB-02 — Config & Runtime Mode Resolution (1.083ms)
✔ Phase AB-02 — Firebase Command Client (2.1391ms)
✔ Phase AB-02 — Scoped Hashing & Payload Fingerprinting (8.8979ms)
✔ Phase AB-02 — Admin Identity Claim Enforcement (0.2175ms)
✔ Phase AB-03 — Admin Bin View Codec (3.3646ms)
✔ Phase AB-03 — Admin Reward View Codec (0.7116ms)
✔ Phase AB-03 — Paginated Envelopes & Cursors (1.5556ms)
✔ Phase AB-04 — FirebaseBinRepository & QR Code Export (2.6275ms)
✔ Phase AB-04 — Mock Bins Repository QR Generation (4.0573ms)
✔ Phase AB-05 — FirebaseSettingsRepository & Program Policy Publication (1.8553ms)
✔ Phase AB-05 — Mock Settings Repository Concurrency & Invariants (5964.0354ms)
✔ Phase AB-06 — Admin Alert View Codecs (2.2895ms)
✔ Phase AB-06 — FirebaseAlertsRepository (1.6314ms)
✔ Phase AB-07 — Admin Review View Codecs (2.7231ms)
✔ Phase AB-07 — Mock Verification Repository Resolution & Invariants (1735.8207ms)
✔ Phase AB-07 — FirebaseVerificationRepository (1.1332ms)
✔ Phase AB-08 — Admin Reward View Codecs (2.1143ms)
✔ Phase AB-08 — Mock Rewards Repository Versioning & Reference Fencing (5635.2079ms)
✔ Phase AB-08 — FirebaseRewardRepository Command Client (1.0824ms)
✔ Phase AB-09 — Admin Dashboard View Codecs & Calculations (2.3632ms)
✔ Phase AB-09 — FirebaseDashboardRepository (0.3797ms)
✔ Phase AB-09 — Cross-Client Convergence & Ledger Invariants (719.2773ms)

ℹ tests 194
ℹ suites 62
ℹ pass 194
ℹ fail 0
```

### 3.3 Static Analysis & Build (`apps/admin-web/`)
- `npm run check:tests`: Exited 0 (TypeScript compile check passed).
- `npm run lint`: Exited 0 (TypeScript check of source passed).
- `npm run build`: Exited 0 (Vite production bundle built cleanly in 445ms).

---

## 4. Requirement Verification Matrix

| Section 14 Checklist Item | Implementation Status | Evidence / Verification Test |
| --- | --- | --- |
| Registered bins as nondeleted fleet records; active alerts as unresolved | COMPLETE | `FirestoreAdminDashboardStore` filters `deleted !== true` and alert state `!= resolved/closed` |
| EcoPoints issued computed from positive deposit-credit ledger effects | COMPLETE | `totalPointsIssued` aggregates verified batches; `admin_dashboard_ab09.test.ts` proves redemptions do not decrement issued totals |
| Material mix with exact weights: plastic 0.025, aluminium 0.015, paper 0.050, glass 0.200 kg | COMPLETE | `KG_PER_PIECE`, `calculateMaterialMix`, cardboard excluded (0.000 kg) |
| Dynamic 7-day activity window in Malaysia timezone grouped by occurrence date | COMPLETE | `getSevenDayMalaysiaWindow`, `getMalaysiaDate` via `Asia/Kuala_Lumpur` |
| Attention bins sorted deterministically with display bands | COMPLETE | `classifyAttentionBins` 5-tier priority with `fillPercent` and `binId` tie-breakers |
| Rebuild and preview of dashboard from canonical records | COMPLETE | `rebuildDashboard`, `getAdminDashboard`, `rebuildAdminDashboard` callables |
| Visibility change management (pause refresh while tab hidden, revalidate on foreground) | COMPLETE | `FirebaseDashboardRepository.watchSummary` listens to `visibilitychange` |
| Exit Gate: 37-point batch yields 1 deposit, 6 items, 0.145 kg | COMPLETE | Verified in `admin_dashboard.test.ts` and `admin_dashboard_ab09.test.ts` |
| Protected read security rules for dashboard projection | COMPLETE | `firestore.rules` enforces `isAdmin()` on `adminDashboardViews/{dashboardId}` |

---

## 5. Conclusion

Phase AB-09 satisfies all criteria defined in Section 14 of the Admin Backend Implementation Plan. The Admin Overview dashboard reflects real fleet status, strict gross point issuance independent of resident redemptions, accurate display weight estimates, dynamic Malaysia weekly windows, and realtime cross-client convergence.
