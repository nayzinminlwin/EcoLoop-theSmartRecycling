# BK-P02-C1 Flutter Firebase Client Evidence

**Captured:** 2026-10-18  
**Unit:** BK-P02-C1 — Flutter dependencies and Firebase clients  
**Specification:** ECOLOOP-SPEC-001 sections 2, 10, 15 and 16  
**Status:** VERIFIED

## Dependency baseline

The resolved Flutter baseline adds:

| Package | Purpose |
|---|---|
| `firebase_core` | Firebase app initialization and public platform options |
| `firebase_auth` | Authenticated resident identity |
| `cloud_firestore` | Typed Firestore access |
| `cloud_functions` | Regional callable command transport |
| `firebase_storage` | Versioned simulation/evidence asset access |
| `firebase_app_check` | App Check client held for the explicit C2 initialization step |
| `firebase_messaging` | Android/web push client |
| `google_sign_in` | Native Android and supported web Google identity flow |
| `mobile_scanner` | Real QR/barcode camera scanning |
| `shared_preferences` | Lightweight non-secret installation/pending-operation metadata |

Resolved versions are recorded in [pubspec.lock](../../pubspec.lock).

## Runtime and platform configuration

- [runtime_config.dart](../../lib/core/config/runtime_config.dart) defines explicit `mock`, `emulator`, and `firebase` modes.
- The default mode is `mock`; a release build rejects non-`firebase` mode.
- Region and emulator hosts/ports are supplied through non-secret Dart defines. No provider credential or private API key is accepted from Dart defines.
- [firebase_clients.dart](../../lib/core/firebase/firebase_clients.dart) initializes typed Auth, Firestore, Functions, Storage, Messaging and App Check clients only for emulator/Firebase modes.
- Emulator endpoints are configured before the clients are returned to subscription owners.
- [firebase_converters.dart](../../lib/core/firebase/firebase_converters.dart) centralizes Firestore timestamp and document conversion.
- [firebase_options.dart](../../lib/firebase_options.dart) contains public Firebase metadata for the verified Android and web registrations. It contains no provider secrets. The web configuration uses the project's public Firebase API key and registered web app ID from the verified project inventory.
- App Check provider activation is intentionally deferred to BK-P02-C2, where debug providers can be gated to emulator/debug contexts.

## Verification

Commands and results:

```text
flutter pub get       PASS
flutter analyze       PASS — No issues found
flutter test          PASS — 75 tests passed
```

The DTD instance was discovered and connected, but no Flutter app was attached, so the required hot-restart attempt returned “No active app connection.” No runtime reload evidence is claimed. Protected Android files remained untouched.

OAuth authorized domains and real Google sign-in remain later integration evidence; this unit only establishes the dependency/client baseline and verified public options.
