# BK-P06-C Web worker, Hosting and permitted native permissions

## Objective

Implement the resident web Firebase Messaging worker, Hosting behavior, and the limited native permissions required by the specification.

## Reference documents

- `docs/backend_plan/PHASES_05_06_SERVICES.md`
- `docs/backend_plan/EXECUTION_PROTOCOL.md`
- `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` sections 2, 14, and 15
- `.agent/developer/agent.md`

## Changes

- Added `web/firebase-messaging-sw.js` using the pinned Firebase compat SDK `10.14.1`, matching the Flutter Firebase package generation.
- Used the existing verified public Firebase web configuration; no provider secrets are present.
- Added explicit `ECOLOOP_WEB_VAPID_KEY` validation to the web adapter and `tools/backend/build_web_config.ps1`, which requires the public deployment VAPID key and passes it through `--dart-define`.
- Added resident Hosting SPA fallback plus worker JavaScript MIME and no-cache headers.
- Added only camera, Internet, and Android 13 notification permissions to the permitted manifest. Protected Gradle and Google Services files were not changed.

## Verification

- `flutter analyze` — passed.
- `flutter build web --release --dart-define=ECOLOOP_FIREBASE_MODE=mock --dart-define=ECOLOOP_WEB_VAPID_KEY=<test public key>` — passed.
- `node --check web/firebase-messaging-sw.js` — passed.
- Built worker exists at `build/web/firebase-messaging-sw.js`.
- `firebase.json` parses successfully.
- Protected Android file diff is empty.
- `flutter test test/features/notifications/notification_lifecycle_test.dart` — passed, 4 tests.
- `git diff --check` — passed.

## Remaining evidence

The repository does not contain a VAPID key, intentionally. A real deployment must invoke the helper with the Firebase Console's public Web Push certificate key. Real browser permission/token delivery, Hosting HTTPS behavior, authorized domain registration, and deployed worker update behavior remain acceptance evidence for BK-P07-C.
