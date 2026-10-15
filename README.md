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
the mobile-first Figma design. Backend integration and the standalone admin
website are later roadmap goals.
