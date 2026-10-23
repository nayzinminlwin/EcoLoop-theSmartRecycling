# BK-P04-J — Controlled camera capture and simulation-asset picker

Date: 2026-10-19
Status: VERIFIED
Scope: Flutter scan presentation widgets for real QR capture lifecycle and controlled simulation-asset selection.

## Implemented

- Added `QrCaptureView` around `mobile_scanner`:
  - Starts/stops the camera based on visibility, command activity, and app lifecycle.
  - Stops before invoking a decoded QR callback and suppresses duplicate callbacks until it completes.
  - Renders a clear camera-permission denial state.
  - Exposes an injectable scanner surface and permission override for deterministic widget tests.
  - Disposes owned scanner resources.
- Added `SimulationAssetPicker`:
  - Controlled single selection.
  - A later selection replaces the prior selection.
  - Disabled assets are excluded.
  - Accessible selected-state semantics.
  - No navigation, inference, or submission side effect.
- Kept Continue and flow ownership in the parent scan screens as required; full interface/UI cutover remains BK-P04-K.

## Verification

- `flutter analyze` — passed with no issues.
- `flutter test test/features/scan/capture_and_picker_test.dart` — 4 tests passed.
- Existing scan regression tests remain covered by the preceding I2 gate.
- Real platform permission behavior remains a P07 device/platform verification item.
