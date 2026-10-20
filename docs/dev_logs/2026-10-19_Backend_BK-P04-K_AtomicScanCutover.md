# BK-P04-K — Atomic Scan Interface and UI Cutover

## Scope

BK-P04-K replaces the production scan lookup/create path with the atomic
`scanBinQr` command and connects the Firebase scan journey to server-owned
session, asset, inspection, processing, and result state. Mock mode remains
available for existing deterministic demo and regression flows.

## Implemented

- Extended the shared scan repository contract with atomic QR submission,
  version-aware commands, asset observation, image selection, renewal, and
  inspection submission.
- Wired the initialized Firebase clients into the production repository
  provider while retaining the mock repository for mock runtime mode.
- Preserved a QR request ID across transport failures so command recovery
  reuses the same operation identity.
- Connected Firebase scan entry to `QrCaptureView`; the simulation button
  remains mock-only.
- Added Firebase asset catalog observation and controlled single-asset
  selection at Item Detected.
- Submitted the selected asset identity/version through the inspection
  command and kept processing/result transitions driven by repository
  watchers.
- Kept legacy completion helpers isolated to mock behavior; Firebase
  implementations reject client-side completion/accounting.
- Added coherent mock asset synthesis and mock implementations for the
  expanded contract.

## Verification

Passed:

- `flutter analyze`
- `flutter test test/features/scan/scan_flow_test.dart test/features/scan/mock_scan_repository_test.dart test/features/scan/mock_scan_baseline_test.dart`
- `flutter test test/features/scan/firebase_scan_repository_test.dart test/features/scan/backend_scan_models_test.dart test/features/scan/capture_and_picker_test.dart`
- `git diff --check`

The available DTD had no connected Flutter application. A hot-restart attempt
was made and reported no active app connection; no runtime hot-restart evidence
is therefore claimed.

## Boundaries and remaining evidence

This unit does not claim live Cloud Tasks delivery, private Cloud Run task
receipt, or real Storage-image processing. Those remain part of the documented
BK-P04-D deployment gap and require configured production deployment evidence.
