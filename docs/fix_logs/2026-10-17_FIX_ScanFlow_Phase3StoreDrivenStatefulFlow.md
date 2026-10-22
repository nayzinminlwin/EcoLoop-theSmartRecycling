# Fix Log: ScanFlow - Phase 3 scan experience rebuild (store-driven state machine + stage visuals)

**Date and Time :** 2026-10-17 14:30
**Agent:** GLM (opencode/glm-5.3-flash)
**Moderator:** Alex
**Status:** Completed
**Fix Type:** Refactor (Phase 3 of `docs/archive/FLUTTER_UI_REFACTOR_PLAN.md`)

---

## 1. Triggered By

- **QA Report:** N/A — planned refactor phase, not a QA-triggered fix.
- **Error Summary:** The scan flow used repository-local Dart constants for
  instructions/QR/bins/classification, committed completion results through a
  partial store transaction, and rendered every stage as a recolored bin
  placeholder (audit F03, scan portions of F04/F05/F15/F16, fixture portions
  of F17).

## 2. Root Cause

The scan repository kept bins, sessions, results, and instructions as
widget/repository-local constants instead of reading the Phase 1 seeded
shared store. Completion mutated the wallet/deposits but not the bin row or
session/result rows, so capacity, resume, and replay behavior could drift
from the shared datasets. The presentation layer duplicated one generic bin
illustration across all six stages and owned completion lifecycle in widget
state, so leaving the screen could drop or duplicate the verification
outcome.

## 3. Changes Made

### 3.1 Fixture-driven classification connected to the state machine

- `MockDataStore` gained `scanConfig` (demo QR payload), `materialRates`, and
  a new `transactionScan` that commits wallet, deposits, bins, sessions, and
  results on copies and publishes one revision after success.
- `MockSeedLoader` now seeds the scan config (demo QR payload), all bin rows,
  and the guide material-rate rows into the store so scan, guide, and any
  future consumer share one rate table.
- `MockScanRepository` was rewritten to read QR payloads, instructions, bins,
  classification rules, and rates exclusively from the store. Points derive
  as `itemCount × pointsPerItem` only for verified, eligible, bin-accepted
  material; verified outcomes on ineligible material downgrade to rejected.
- Distinct failures: `invalidQr` (malformed/unknown payload or the
  `invalid_qr` scenario), `binUnavailable` retryable (offline),
  `binUnavailable` non-retryable (full, incl. the `full_bin` scenario),
  `invalidTransition`, and notFound for missing resources.
- `review_deposit`/`rejected_deposit` scenarios produce correctly labeled
  review/rejected results and activity rows with no wallet credit and no
  verified-impact increase; the capacity increase still applies because the
  items are physically in the bin (documented semantic difference).
- Session creation is idempotent per `creationRequestId`; record IDs come
  from the store's injectable ID factory instead of list lengths.

### 3.2 Stage-aware visuals (V04–V08)

- `ScannerStage` (scanner_frame.dart): the dark 250px/22-radius stage surface
  with the radial darkening overlay, optional 11px bottom caption, and the
  success variant that swaps the background for primary green.
- Scanner frame content: four 42px `#65bf8f` corner brackets plus the scan
  icon and the "Camera simulation" caption.
- `ScanStageVisual` (bin_session_visual.dart): one stage-aware widget —
  bin found (white outlined bin + amber capacity), ready (bin + READY),
  item detected (camera icon in subtle mint pulse rings), processing
  (spinning recycle icon), result (green surface + white check ring).
  Reduced-motion falls back to static equivalents; animation never drives
  transaction state.
- `BinDetailsCard`: the split Accepts/Capacity bordered detail row with
  amber/red capacity tones at the source thresholds.
- `DepositResultCard`: outcome badge/title/copy, structured
  `2 pcs / PET plastic bottles` count-material row, and the mint
  EcoPoints-earned strip shown only for credited results.
- Screens: `SMART BIN SESSION` eyebrow + page heading with back control,
  centered flow information, full-width stage actions ("Confirm session",
  "I pressed the finish button", "Continue", "Back to home"), timing notice
  from repository content, and automatic completion with error-only Retry.

### 3.3 Leave/resume/recovery

- `scan_controller.dart` now owns app-scoped providers: session/bin/result
  stream watches by ID, an `ActiveScanSession` tracker (controller/session
  state, not route strings), and a `ScanCompletionController` that keeps
  completion running at app scope so leaving the processing screen never
  cancels or suppresses it; failures stay retryable without a new session.
- Pre-processing stages register a leave guard with the Phase 2
  `LeaveDecisionCoordinator` (branch changes) and reuse the same
  cancel-or-continue dialog for the top Back and system/browser Back
  (`PopScope`). Failed cancellation writes are caught and the session stays
  usable. Leaving during processing needs no decision.
- Route redirects canonicalize stale/future-stage URLs to the committed stage
  state through a synchronous store-backed `peekSessionStage` resolver, so no
  stage can be skipped by typing a URL; unknown session links show an
  actionable recovery screen with Retry and Back to scanner.
- The bottom navigation resumes tracked scan work from controller state;
  cancelled work returns to the scanner for a new request ID.
- `AppButton` labels are now flexible so long labels wrap instead of
  overflowing at narrow widths or enlarged text scales.

- **Files Modified:** `lib/core/mock/mock_data_store.dart`,
  `lib/core/mock/mock_seed_loader.dart`,
  `lib/features/scan/data/mock_scan_repository.dart`,
  `lib/features/scan/domain/repositories/scan_repository.dart`,
  `lib/features/scan/presentation/controllers/scan_controller.dart`,
  `lib/features/scan/presentation/screens/scan_screen.dart`,
  `lib/features/scan/presentation/screens/scan_session_screen.dart`,
  `lib/features/scan/presentation/widgets/scanner_frame.dart`,
  `lib/features/scan/presentation/widgets/bin_session_visual.dart`,
  `lib/features/scan/presentation/widgets/bin_details_card.dart`,
  `lib/features/scan/presentation/widgets/deposit_result_card.dart`,
  `lib/app/router/app_router.dart`,
  `lib/app/presentation/resident_bottom_navigation.dart`,
  `lib/shared/widgets/app_button.dart`, `lib/shared/widgets/app_page_header.dart`,
  `lib/core/presentation/app_copy.dart`,
  `test/features/scan/mock_scan_repository_test.dart`,
  `test/features/scan/scan_flow_test.dart`,
  `test/app/resident_shell_test.dart`
- **Files Created (if any):** `test/fixtures/mock_scan_store.dart`,
  `test/features/scan/mock_scan_baseline_test.dart`,
  `test/refactor_visuals/phase3_capture_test.dart`,
  `docs/refactor_visuals/phase3/*.png`
- **Files Deleted (if any):** none

## 4. Verification Notes

- `dart format --output=none --set-exit-if-changed lib test integration_test`
  — clean.
- `flutter analyze` — no issues.
- `flutter test` — 68 tests passed, including new coverage: atomic scan
  completion (wallet 255, 13 verified deposits, 1.09 kg, capacity 85% from
  the real seeded fixtures), replay/duplicate idempotency, rate/count-driven
  points, review/rejected no-credit scenarios, distinct invalid-QR/full/
  offline failures, injected completion failure rollback + single retry
  commit, cancellation rules, stage-distinct rendering, canonicalization of
  future-stage URLs, unknown-session recovery, pre-processing back and
  branch-change cancel/continue dialogs, and leave-during-processing resume
  without replayed credit.
- `flutter build web` — succeeded.
- Comparison captures recorded under `docs/refactor_visuals/phase3/`
  (scanner, V04–V08) at 390 logical pixels with real Inter assets, reviewed
  against `Demo_Screenshots/Figma_RecyclingProcess_*`; processing was
  captured while it actually ran using the controlled 30s classification
  delay.
- Protected Android configuration files verified unchanged (SHA-256 compared;
  `git status` clean for `android/`).

## 5. Ready for Retest

- [x] Yes — The Tester agent should append a new retest to
  `docs/test_logs/` covering the scan flow acceptance gate.

---

## 📝 APPENDED FOLLOW-UP FIXES

_(Agent Instruction: If you make additional corrections to the same
bug/feature after the initial log, append below. Do NOT create a new file.)_

### Follow-up Fix: none yet

- **Status:** n/a
- **Additional Changes:** none
