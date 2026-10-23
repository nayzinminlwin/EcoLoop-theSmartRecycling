# Fix Log: Flutter Phase 1 - Shared Demo Data and Mutation Stability

**Date and Time :** 2026-10-17 12:22  
**Agent:** AI assistant using Copilot SDK in VS Code  
**Moderator:** Alex  
**Status:** Work in Progress  
**Fix Type:** Architectural Correction

---

## 1. Triggered By

- **QA Report:** `docs/archive/FLUTTER_UI_REFACTOR_PLAN.md` Phase 1 acceptance gate.
- **Error Summary:** Resident mock data was seeded in multiple places, write
  operations could partially mutate independent projections, and several
  account, scan, and redemption failure paths could lose retryable state.

## 2. Root Cause

The application had repository-local fixture loading alongside a partially
shared `MockDataStore`. The activity provider could overwrite changed deposits
when recreated, rewards stored vouchers and redemptions outside the shared
transaction boundary, and scan completion cleaned up an unobserved derived
`Future`. Account controllers also replaced loaded data with a loading state
during writes, which discarded the projection needed for inline retry.

## 3. Changes Made

- Added one seeded app composition path for metadata, account, wallet,
  activity, scan, and rewards fixtures.
- Added shared scenario/API providers with `MOCK_SCENARIO` parsing and
  operation-targeted failure injection.
- Extended `MockDataStore` with defensive copies, revision notifications,
  reward datasets, and an injectable opaque ID factory.
- Removed the activity provider's mutation-causing reseed behavior.
- Added atomic reward wallet, voucher, and redemption persistence.
- Preserved account projections while profile, password, and preference writes
  are pending or fail.
- Fixed scan completion in-flight cleanup so failures remain retryable without
  an unhandled derived `Future`.
- Added metadata-based +08:00 display/calendar conversion.
- Reconciled profile, wallet/activity, and bin fixtures to the Phase 1
  baseline.

- **Files Modified:** `lib/app/bootstrap.dart`,
  `lib/app/providers/app_providers.dart`, `lib/core/mock/`,
  `lib/features/account/presentation/controllers/`,
  `lib/features/activity/data/mock_activity_repository.dart`,
  `lib/features/rewards/`, `lib/features/scan/`, `lib/main.dart`,
  `assets/mock/account/profile.json`, `assets/mock/activity/deposits.json`,
  `assets/mock/scan/bins.json`
- **Files Created:** `docs/archive/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md`,
  `docs/fix_logs/2026-10-17_FIX_FlutterPhase1_SharedDemoDataAndMutationStability.md`

## 4. Verification Notes

- `flutter analyze` passed with no issues.
- Full `flutter test` passed: 44 tests.
- Focused Phase 1 tests passed: 19 tests.
- Dart formatting passed for the Phase 1-touched files.
- A DTD hot-restart was attempted, but no Flutter app was connected in VS
  Code, so live runtime restart verification was unavailable.

## 5. Ready for Retest

- [ ] Yes — The remaining Phase 1 acceptance items are documented in
  `docs/archive/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md`.

---

## APPENDED FOLLOW-UP FIXES

No follow-up fixes recorded.
