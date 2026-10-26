# Rewards redemption troubleshooting

## Findings

On 2026-10-26, resident reward redemption returned:

```text
This offer changed. Refresh the rewards list and try again.
```

The Cloud Function validates the submitted reward ID, offer version, point
cost, active state, and expiry against the Firestore document in the
`ecoloop-db` database. The live catalog was checked with `gcloud` and contains
active, future-dated offers using:

```text
offerVersion: demo-offer-v1
```

The deployed `redeemReward` function is configured with
`ECOLOOP_FIRESTORE_DATABASE=ecoloop-db`, so the database selection is
consistent with the Flutter client configuration.

The Flutter console and Cloud Logging also showed invalid App Check debug
tokens. The function currently has App Check enforcement disabled, so these
warnings are not the business-level offer comparison. They should still be
resolved before App Check enforcement is enabled.

## Changes made

### Clear stale redemption intents

`offer_changed` is a known business rejection, not an ambiguous transport
failure. Previously it was treated as retryable by the durable command client,
which attempted `recoverOperation` and retained the failed request. A later
attempt for a different reward then conflicted with that stale request and was
displayed as a redemption-limit error.

[`CommandClient`](../lib/core/firebase/command_client.dart) now clears the
pending operation immediately for `offer_changed` and only performs recovery
for genuinely ambiguous failures.

### Read the current offer from the server

Before calling `redeemReward`, the Firebase rewards repository now reads the
selected reward document using `Source.server`. It submits the freshly read
`offerVersion` and `pointsCost` rather than trusting a possibly stale reward
object held by the UI.

### Honor the documented runtime defines

The client now honors:

```text
ECOLOOP_FIRESTORE_DATABASE
ECOLOOP_APP_CHECK_MODE
```

The database define selects the named Firestore database. Any App Check mode
other than `off` enables the debug provider for a debug Android run.

## Validation

The following checks passed after the changes:

- Flutter reward redemption and command-client regression tests
- Flutter analyzer for all changed Dart files
- Functions TypeScript build
- Functions unit suite: 115 tests passed
- Fresh APK launch on device `qgfy7xz9eaci4tvs`

## App Check operator steps

For `ECOLOOP_APP_CHECK_MODE=demo-debug`:

1. Start the debug app.
2. Read the current debug token from the Flutter/Android console.
3. Register that current token under Firebase Console → App Check → the
   Android app.
4. Fully stop and restart the app after changing the registration.

Debug tokens can change after reinstalling or rebuilding the app. A token from
an earlier launch must not be assumed to remain current. During diagnosis,
`ECOLOOP_APP_CHECK_MODE=off` can be used because the deployed callable
currently has App Check enforcement disabled.

## Reproduction command

```powershell
flutter run -d qgfy7xz9eaci4tvs `
  --dart-define=ECOLOOP_FIREBASE_MODE=firebase `
  --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 `
  --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db `
  --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
```

This document records the client-side fix and diagnosis. It does not replace
the App Check registration or deployment configuration in Firebase Console.
