# BK-P04-I2 — Real scan gateway and mapper

Date: 2026-10-19
Status: VERIFIED
Scope: Flutter production command/read/watch adapter for the v1 scan backend.

## Implemented

- Added `BackendScanMapper` for callable envelopes and Firestore session, bin, asset, and result documents.
- Added `FirebaseScanRepository` with:
  - Durable `CommandClient` command calls for QR scanning, session transitions, asset selection, and inspection submission.
  - Submission identity (`batchId`, `jobId`, `resultId`, deadline, trace) without client-side completion/accounting.
  - Owner-scoped session/result reads and stream checks.
  - Direct bin and simulation-asset reads.
  - Firestore snapshot adapters for session, result, and bin watches.
  - Best-effort session version cache suppressing stale snapshots.
  - Explicit disposal of observed-session state.
- Added fake-read/callable transport tests covering:
  - Actual nested command response mapping.
  - Stable request ID propagation.
  - Stale session suppression.
  - Owner mismatch rejection.

## Verification

- `flutter analyze` — passed with no issues after the final adapter changes.
- `flutter test test/features/scan/firebase_scan_repository_test.dart test/features/scan/backend_scan_models_test.dart test/features/scan/scan_flow_test.dart test/features/scan/mock_scan_repository_test.dart` — passed.
- `git diff --check` — passed.

## Evidence boundaries

The gateway is not yet wired into the legacy `ScanRepository` composition path, as required by the I2 specification. Production wiring and full interface cutover belong to BK-P04-K. No live Firestore or callable deployment claim is made here.
