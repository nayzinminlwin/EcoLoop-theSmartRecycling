# BK-P04-I1 — Session, bin, and asset read models

Date: 2026-10-19  
Status: VERIFIED  
Scope: Flutter resident read models for the v1 recycling session, bin, and simulation-asset snapshots.

## Implemented

- Extended `DepositSession` with session version, draft and committed asset identity, committed content digest, batch/job/substage/deadline references, reservation expiry, and termination reason.
- Added a strict `DepositSession.fromBackendJson` factory. It accepts only supported session stages and preserves completed sessions as terminal, including sessions whose result is a review outcome.
- Extended `SmartBin` with raw `capacitySpc`/`occupiedSpc`, cycle identity, and enabled state while retaining the legacy display percentage.
- Added `SmartBin.fromBackendJson`, including clamped floored display projection and validation of positive capacity/non-negative occupancy and supported materials.
- Added `SimulationAsset` with immutable version/reference identity, MIME and geometry metadata, enabled/sort state, and optional SHA-256 content identity.
- Added strict v1 snapshot tests for successful parsing and invalid/unsupported snapshot failures.
- Preserved legacy mock `fromJson` compatibility and existing scan UI consumers.

## Verification

- `flutter analyze` — passed with no issues.
- `flutter test test/features/scan/backend_scan_models_test.dart test/features/scan/scan_flow_test.dart test/features/scan/mock_scan_repository_test.dart` — 19 tests passed.
- `git diff --check` — passed.
- DTD discovery/connection was attempted; no Flutter app was connected, so no hot reload/restart target was available.

## Evidence boundaries

This unit verifies client-side parsing and projection behavior. It does not claim live Firestore snapshot delivery or production Cloud Tasks delivery; those remain covered by the deployment evidence gap.
