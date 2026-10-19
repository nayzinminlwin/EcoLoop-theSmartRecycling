# EcoLoop AI

EcoLoop AI is the resident recycling Flutter application. The UI conversion
uses offline assets and stateful mock services during Goals 1–2; it does not
initialize or call Firebase.

## Run locally

Install Flutter 3.47.0 (Dart 3.13.0), then run:

```powershell
flutter pub get
flutter run -d chrome --dart-define=MOCK_SCENARIO=normal
```

The resident app is constrained to a 480 logical-pixel content frame to match
the mobile-first Figma design. The supported local scenarios are `normal`, `readFailureOnce`,
`classificationFailureOnce`, `profileSaveFailureOnce`, `emptyActivity`, and
`redemptionFailureOnce`. Scenario selection is a repository-test override;
production startup remains normal and offline.

## Verification

```powershell
dart format --output=none --set-exit-if-changed lib test integration_test
flutter analyze
flutter test
flutter build web
flutter devices
flutter test integration_test/resident_journey_test.dart -d <device-id>
```

The integration test requires an attached emulator or physical device. If no
device is available, the unit/widget suite and web build remain the offline
acceptance checks; record the unavailable device in
[`docs/archive/FLUTTER_UI_ACCEPTANCE.md`](docs/archive/FLUTTER_UI_ACCEPTANCE.md).

## Backend deployment and diagnosis

The backend deployment is explicit and private. Read the versioned [deployment evidence](docs/backend_evidence/DEPLOYMENT.md), [acceptance matrix](docs/backend_evidence/ACCEPTANCE.md), and [operator handoff](docs/backend_evidence/ADMIN_HANDOFF.md) before operating the PoC.

Build and test the locked backend components from the repository root:

```powershell
npm --prefix functions ci
npm --prefix functions test
Set-Location services\vision
uv sync --locked --group test
uv run pytest
Set-Location ..\..
flutter analyze
flutter build web --release --dart-define=ECOLOOP_FIREBASE_MODE=firebase
```

Deploy only with explicit existing-project inputs and a verified production App Check configuration:

```powershell
.\tools\backend\deploy_poc.ps1 `
  -ProjectId ecoloop-thesmartrecycling `
  -RuntimeServiceAccount <runtime-service-account> `
  -TaskInvokerServiceAccount <task-invoker-service-account> `
  -ArtifactBucket ecoloop-thesmartrecycling.firebasestorage.app `
  -VapidKey <production-public-vapid-key> `
  -AppCheckConfigured
```

Do not use debug App Check providers, expose provider credentials, call the private worker URL from a resident client, or treat mock integration tests as live acceptance evidence. Use [ADMIN_HANDOFF.md](docs/backend_evidence/ADMIN_HANDOFF.md) for exact trace filters and replay rules.
