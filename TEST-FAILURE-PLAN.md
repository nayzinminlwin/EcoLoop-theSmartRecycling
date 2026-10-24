# CI Test Failure Plan

## Goal

Restore a green `Backend CI` check without weakening or skipping validations.

## Plan

1. **Run Flutter tests in mock mode**
   - Update the Flutter CI test command to pass
     `--dart-define=ECOLOOP_FIREBASE_MODE=mock`.
   - Keep production app defaults unchanged.
   - Run the Flutter analyzer and full test suite locally.

2. **Fix scanner test isolation**
   - Prevent `mobile_scanner` platform calls from running in host-side visual
     tests.
   - Use the existing test seam or a focused mock/fallback for scanner
     initialization and disposal.
   - Re-run the scan-flow and phase 3 capture tests.

3. **Re-check visual capture tests**
   - Confirm phase 2 captures no longer fail with `Bad state: No element`.
   - Confirm phase 3 captures reach each expected scan stage.
   - Avoid changing production UI behavior just to satisfy screenshots.

4. **Fix Functions compilation**
   - Run `npm test` in `functions/`.
   - Resolve the `TS2339` errors under `functions/src/transport/`.
   - Re-run Functions unit tests and the Firebase emulator checks.

5. **Validate CI**
   - Run the relevant Flutter and Functions commands locally.
   - Commit the fixes and push to `dev`.
   - Confirm all Backend CI jobs pass on the pull request.
