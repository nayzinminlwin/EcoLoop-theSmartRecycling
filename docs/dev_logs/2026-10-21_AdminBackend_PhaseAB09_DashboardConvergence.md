# Dev Log: Admin Backend - Phase AB-09 Dashboard Accounting & Convergence

**Date and Time :** 2026-10-21 13:05  
**Agent:** Gemini 3.8 Flash High (Antigravity)  
**Moderator:** Alex  
**Status:** Completed  

## 1. Objective

Implement Phase AB-09 of the Admin Backend Activation Plan (`docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md`), integrating real operational analytics, gross EcoPoints issued accounting (independent of resident wallet redemptions), display weight material mix with zero-impact cardboard exclusion, dynamic 7-day Malaysia activity windows (`Asia/Kuala_Lumpur`), deterministic attention bin classification, realtime projection invalidation listeners with background tab visibility pause/reconnect, and preview/rebuild administrative transport.

## 2. Reference Documents

- `docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` (Section 14, Phase AB-09)
- `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` (Sections 8, 9, 10, 14, 16)
- `contracts/admin/v1/`
- `.agent/developer/agent.md`, `.agent/web_developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `functions/src/domain/admin_dashboard.ts`: Domain logic for unit weights (`KG_PER_PIECE`: plastic 0.025, aluminium 0.015, paper 0.050, glass 0.200, cardboard 0.000 kg), `mapClassToMaterialType`, `getMalaysiaDate`, `getSevenDayMalaysiaWindow`, `calculateMaterialMix`, and `classifyAttentionBins` (deterministic 5-tier priority with tie-breaking).
  - `functions/src/infrastructure/firestore/admin_dashboard_store.ts`: `FirestoreAdminDashboardStore` computing dashboard projections from canonical collections (`bins`, `binCollectionState`, `capacityAlerts`, `reviewTickets`, `batches`), persisting to `adminDashboardViews/summary`, bumping `adminReadVersions/dashboard`, and logging rebuild audit events.
  - `functions/src/transport/admin_dashboard.ts`: HTTPS callables `getAdminDashboard` and `rebuildAdminDashboard`.
  - `functions/tests/unit/admin_dashboard.test.ts`: 6 unit tests verifying weights, date formatting, 7-day dynamic window, exit gate calculations (37 points, 6 items, 0.145 kg), and attention bin sorting.
  - `apps/admin-web/src/data/firebase/firebaseDashboardRepository.ts`: Live dashboard repository with `getSummary()` via callable and `watchSummary()` with realtime `adminReadVersions/dashboard` listener and `visibilitychange` background pause/foreground revalidation.
  - `apps/admin-web/tests/admin_dashboard_ab09.test.ts`: 5 unit tests for dashboard view codecs, summary mapping, exit gate calculations, callable execution, and proving wallet redemptions do not decrement issued EcoPoints or verified deposits.
  - `docs/admin_backend/evidence/AB-09_dashboard_convergence.md`: Phase AB-09 evidence document.
- **Files Modified:**
  - `firestore.rules`: Added protected read access for `adminDashboardViews/{dashboardId}` enforcing `isAdmin()`.
  - `functions/src/composition.ts`: Registered `adminDashboard` store in DI container.
  - `functions/src/index.ts`: Exported `getAdminDashboard` and `rebuildAdminDashboard` in `us-central1`.
  - `apps/admin-web/src/contracts/adminViewCodecs.ts`: Added `AdminDashboardView`, `AdminDailyActivityView`, `AdminMaterialMixView`, `AdminAttentionBinView`, `decodeAdminDashboardView`, and `adminDashboardViewToSummary`.
  - `apps/admin-web/src/app/services.ts`: Wired `FirebaseDashboardRepository` into `services.repositories.dashboard`.
  - `apps/admin-web/package.json`: Registered `tests/admin_dashboard_ab09.test.ts` in test and typecheck scripts.
- **Impact to other modules:** No impact on Flutter resident mobile code.

## 4. Technical Decisions & Deviations

- **Gross Issued EcoPoints vs Net Wallet Balances:** EcoPoints issued totals are calculated strictly from original positive credits on verified batches. Redemptions debit user wallet balance but never reduce gross issued totals or verified deposit counts.
- **Display Weights & Cardboard Policy:** Unit weights are fixed at 0.025 kg (plastic), 0.015 kg (aluminium), 0.050 kg (paper), 0.200 kg (glass). Cardboard items are excluded by program policy and contribute 0.000 kg.
- **Malaysia Dynamic Activity Window:** Activity dates use `Asia/Kuala_Lumpur` calendar dates. Finalized deposits are grouped by their original occurrence date (`occurredAt`), ensuring late-night or cross-midnight reviews update the correct occurrence day.
- **Tab Visibility Throttling:** Subscriptions pause queries while the browser tab is hidden to save battery and network bandwidth, immediately executing a refresh when the tab returns to foreground if any version change occurred while hidden.

## 5. Verification Results

- **Backend tests:** 18/18 test files passed, 111/111 tests passed (`npm test` in `functions`).
- **Frontend tests:** 9/9 test suites passed, 194/194 tests passed (`npm test` in `apps/admin-web`).
- **Frontend typecheck:** `npm run check:tests` and `npm run lint` passed with 0 errors.
- **Frontend build:** `npm run build` completed cleanly in 445ms.
