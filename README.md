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
[`docs/FLUTTER_UI_ACCEPTANCE.md`](docs/FLUTTER_UI_ACCEPTANCE.md).

Backend integration and the standalone admin website are later roadmap goals.
