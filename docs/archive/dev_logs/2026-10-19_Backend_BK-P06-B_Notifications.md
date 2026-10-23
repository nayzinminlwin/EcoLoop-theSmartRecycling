# BK-P06-B Android/Flutter device and message lifecycle

## Objective

Implement the resident Firebase Messaging lifecycle while preserving the backend notification intent boundary from BK-P06-A.

## Reference documents

- `docs/archive/backend_plan/PHASES_05_06_SERVICES.md`
- `docs/archive/backend_plan/EXECUTION_PROTOCOL.md`
- `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` sections 12, 14, and 16
- `../../../.agent/developer/agent.md`

## Changes

- Added `FirebaseNotificationService` with permission-gated registration, persistent installation identity, token refresh, auth-account switching, sign-out unregistration, foreground event forwarding, and a top-level background callback that initializes Firebase only.
- Added `NotificationCoordinator` with event deduplication, authenticated/deferred history navigation, and generic foreground messaging.
- Wired Firebase bootstrap, Riverpod providers, and the app router builder.
- Added backend `unregisterResidentDevice` and disabled-device persistence for sign-out/account switching.
- Added focused notification lifecycle tests.

## Technical decisions

- Permission denial returns without registering a token and does not affect business operations.
- Push payloads are not used to display private points or receipt details. The coordinator verifies that a resident is authenticated, then routes only to the owner-scoped history surface.
- Foreground system presentation is disabled so the coordinator does not duplicate a system notification. Duplicate logical event IDs are ignored.
- The FCM package currently deprecates `getToken`/`onTokenRefresh` in favor of an installation-ID API; registration tokens are still required by the backend send provider, so the deprecated token APIs remain isolated in the Firebase adapter with a clarification suppression.
- `EcoLoopApp` is wrapped with the coordinator because safe deep-link navigation requires a context below `MaterialApp.router`.

## Verification

- `flutter analyze` — passed.
- `flutter test test/features/notifications/notification_lifecycle_test.dart test/features/account/firebase_auth_flow_test.dart test/features/account/account_providers_test.dart` — passed, 9 tests.
- `Set-Location functions; npm run build` — passed.
- DTD discovery/connect succeeded, but no Flutter app was connected. A hot-restart attempt therefore reported no active app; no runtime delivery claim was made.

## Remaining evidence

Actual Android and supported-web permission/token/foreground/background delivery still require a connected device/browser and deployed Firebase configuration.
