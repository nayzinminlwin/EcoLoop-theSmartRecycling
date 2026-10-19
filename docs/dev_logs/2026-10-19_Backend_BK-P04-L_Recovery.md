# BK-P04-L — Lease, Navigation, and Reopen Recovery

## Objective

Harden the scan journey against stale snapshots, branch changes, lifecycle
transitions, account changes, and app reopen while keeping processing and
settlement server-owned.

## Changes

- Added session-version-aware active scan tracking. Older snapshots can no
  longer move the resume target backwards.
- Made active-session clearing session-specific so a completed old route cannot
  clear a replacement session.
- Added foreground lifecycle observation to the scan session screen.
- Renewed only visible, pre-processing sessions while the app is foregrounded
  and the signed-in resident still owns the session.
- Stopped renewal on background/offstage/sign-out and left processing
  untouched by lease renewal.
- Preserved existing post-frame canonicalization, leave guards, deep-link
  parking, unknown-session recovery, and durable command-operation recovery.

## Verification

Passed:

- `flutter analyze`
- `flutter test test/features/scan`
- `flutter test test/features/scan/session_recovery_test.dart test/features/scan/scan_flow_test.dart test/app/route_guards_test.dart test/app/app_router_test.dart test/core/data/pending_operation_store_test.dart`
- `git diff --check`

The available DTD had no connected Flutter application. A hot-restart attempt
was made and reported no active app connection; no runtime hot-restart evidence
is claimed.

## Remaining evidence

Real production reopen, account-switch, private Cloud Run processing, and
Cloud Tasks delivery evidence remain deployment/integration evidence rather
than local Flutter-test evidence. The existing BK-P04-D deployment gap remains
open.
