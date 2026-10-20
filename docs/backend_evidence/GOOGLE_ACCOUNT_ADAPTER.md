# BK-P02-D Google Account Adapter Evidence

**Captured:** 2026-10-18  
**Unit:** BK-P02-D — Google account adapter and sign-in UI  
**Specification:** ECOLOOP-SPEC-001 sections 2, 9, 15 and 16  
**Status:** BLOCKED — automated adapter gate passed; real platform smoke remains unavailable

## Implementation

- Added `FirebaseAccountRepository` with explicit Google sign-in/sign-out behavior.
- Added injectable Google and Firebase Auth gateways so credential exchange and provisioning can be tested without live credentials.
- The production gateway uses the current `google_sign_in` API: initialize once, authenticate on a user gesture, and exchange the Google ID token through `GoogleAuthProvider`.
- Successful authentication refreshes custom claims, calls `bootstrapResident`, and only then publishes a resident-ready `AuthState`.
- Cancellation returns a signed-out result. Bootstrap and contract failures remain visible as `AppFailure` values with request/trace correlation where supplied by the backend envelope.
- Added an `AuthController` and standalone `SignInScreen`. The existing mock repository retains its demo-only resume behavior; production sign-in is not routed through mock fixtures.
- Auth state is subscribed once, and repository disposal cancels that subscription and closes streams.

## Verification

```text
flutter analyze
flutter test test\features\account\firebase_auth_flow_test.dart test\features\account\mock_account_repository_test.dart test\features\account\account_models_test.dart
flutter test
```

Results:

- Flutter analyzer: **PASS — No issues found**.
- Account-focused tests: **PASS — 9 tests passed**.
- Full Flutter test suite: **PASS — 93 tests passed**.

The real Android/web sign-in smoke gate is not claimed. No Flutter app was connected to DTD for hot restart, and the OAuth authorized domains plus Android release/debug SHA configuration remain unverified. The adapter is ready for the real smoke pass once those platform prerequisites are supplied.
