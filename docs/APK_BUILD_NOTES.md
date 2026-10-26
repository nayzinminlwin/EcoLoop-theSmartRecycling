# EcoLoop APK Build Notes

These notes capture the lessons from the previous Android APK build and
installation troubleshooting. Follow them when changing the APK packaging
strategy, especially when replacing the universal APK with ABI-specific APKs.

## Known-good baseline

The following command produced a working APK:

```bash
flutter build apk --release \
  --build-number=<build-number> \
  --dart-define=ECOLOOP_FIREBASE_MODE=firebase \
  --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 \
  --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db \
  --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
```

The working APK used:

- Package name: `sd.idk.ecoLoop`
- Version name: `1.0.0`
- Minimum SDK: 24
- Target SDK: 36
- Debug signing, suitable only for demonstrations
- Universal native libraries:
  - `arm64-v8a`
  - `armeabi-v7a`
  - `x86_64`

The universal APK was approximately 74 MB.

## Verified Valid Release Build (2026-10-26)

The release build was confirmed functional and valid on device `qgfy7xz9eaci4tvs`:

- **Commit:** `b6f3205`
- **Output Artifact:** `build/app/outputs/flutter-apk/app-release.apk`
- **Size:** 82.8 MB (86,781,990 bytes)
- **Packaged ABIs:** `arm64-v8a`, `armeabi-v7a`, `x86_64` (Universal)
- **Build Command:**
  ```bash
  flutter build apk --release \
    --dart-define=ECOLOOP_FIREBASE_MODE=firebase \
    --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 \
    --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db \
    --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
  ```

### Key Issues Resolved in This Build:

1. **R8 Minification / `shared_preferences_android` Stripping:**
   - Previous release builds crashed during QR scan (`scanBinQr`) and reward redemption (`redeemReward`) with:
     `PlatformException, java.lang.NoSuchMethodError: no non-static method "Lio/flutter/plugins/sharedpreferences/SharedPreferencesApiRegistrar;.getAll(...)"`
   - Upgraded `shared_preferences_android` from `2.5.0` to `2.5.3` (which includes proper consumer ProGuard rules).
   - Created `android/app/proguard-rules.pro` with explicit keep rules for Flutter plugins, SharedPreferences, and Firebase.
   - Configured `android/app/build.gradle.kts` with `isMinifyEnabled = false` and `isShrinkResources = false`.
2. **Defensive Storage Operations:**
   - Wrapped `PendingOperationStore` reads/writes so that local caching hiccups never crash resident transactions.
   - Handled non-fatal push token registration errors gracefully in `FirebaseNotificationService`.
3. **App Check Guarding:**
   - In `FirebaseClients.initialize`, guarded App Check activation with `if (config.useAppCheck)` so direct/sideloaded APKs authenticate cleanly with Firebase Auth without requiring Play Store attestation.
4. **Device Verification:**
   - Successfully installed and verified on physical Android device (`qgfy7xz9eaci4tvs`). Camera QR scan, bin reservation, session progression, and rewards redemption confirmed functional.

## Critical startup fix

Do not reintroduce blocking initialization before the real Flutter application
is rendered.

The startup code previously waited for:

- SharedPreferences installation ID generation
- Exit-intent restoration
- Firebase notification initialization
- Firebase Messaging `getInitialMessage()`

Those waits could leave the app indefinitely displaying the bootstrap splash
screen after a manually installed APK.

The current startup behavior is:

1. Render the bootstrap screen.
2. Initialize the minimum required Firebase clients.
3. Render `EcoLoopApp`.
4. Restore exit-intent state asynchronously.
5. Start notification initialization asynchronously.
6. Log initialization failures instead of blocking the whole application.

Any future startup work must follow this rule:

> Nonessential initialization must not block rendering of `EcoLoopApp`.

If Firebase client initialization itself fails, show a visible error state with
a retry action instead of leaving an infinite spinner.

## ABI split build

For size reduction, first try Flutter's supported split build:

```bash
flutter build apk --release --split-per-abi \
  --build-number=<build-number> \
  --dart-define=ECOLOOP_FIREBASE_MODE=firebase \
  --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 \
  --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db \
  --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
```

Expected outputs:

```text
build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk
build/app/outputs/flutter-apk/app-arm64-v8a-release.apk
build/app/outputs/flutter-apk/app-x86_64-release.apk
```

For most modern physical Android phones, `arm64-v8a` is normally the
appropriate artifact. Do not distribute an ABI APK that the target device
cannot run.

The release workflow must be updated so it does not assume that only this file
exists:

```text
build/app/outputs/flutter-apk/app-release.apk
```

It should validate and publish each ABI APK separately, or explicitly publish
only the intended `arm64-v8a` artifact.

## Required APK validation

Validate every output before publishing:

```bash
unzip -t <apk>
$ANDROID_HOME/build-tools/<version>/zipalign -c -P 16 -v 4 <apk>
$ANDROID_HOME/build-tools/<version>/apksigner verify --verbose <apk>
$ANDROID_HOME/build-tools/<version>/aapt dump badging <apk>
```

Confirm that:

- ZIP integrity succeeds.
- `zipalign` succeeds.
- `apksigner` reports `Verification successful`.
- APK Signature Scheme v2 or newer is valid.
- The package name is exactly `sd.idk.ecoLoop`.
- The version code is the intended build number.
- The native libraries match the APK filename.

For example, an `arm64-v8a` APK should not contain unrelated ABI directories:

```bash
unzip -l <apk> | grep 'lib/'
```

Record the SHA-256 hash of every published APK:

```bash
sha256sum <apk>
```

## Installation testing

Do not test only with an in-place update:

```bash
adb install -r <apk>
```

That preserves existing app data and may hide first-install problems.

Also test a clean installation:

```bash
adb uninstall sd.idk.ecoLoop
adb install <apk>
```

Verify that:

1. The app launches.
2. The Android splash transitions to Flutter UI.
3. The app reaches the Sign in or Home screen.
4. No infinite loading screen appears.
5. Firebase initialization does not crash.
6. Notification initialization does not prevent app rendering.

Manual installation is important because the original problem occurred when an
APK was installed separately, while an `adb` in-place update appeared to work.

## Firebase and package identity

Keep these values consistent:

- `android/app/build.gradle.kts` application ID:
  `sd.idk.ecoLoop`
- `android/app/google-services.json` Android package name:
  `sd.idk.ecoLoop`
- `lib/firebase_options.dart` Android Firebase app ID
- Google Sign-In configuration and certificate fingerprints

Changing the application ID requires updating Firebase configuration. Do not
change the package name as part of APK size optimization.

## Signing warning

The current release build uses the debug signing key:

```kotlin
signingConfig = signingConfigs.getByName("debug")
```

This is acceptable for demonstrations and manual testing only. It is not
suitable for Google Play or production distribution.

Before production release:

- Create a private release keystore.
- Store signing credentials in GitHub Actions secrets.
- Configure a release signing configuration.
- Never commit the keystore or passwords.
- Preserve the same signing key for future updates.

## Size optimization guidance

ABI splitting should be implemented and measured first. Do not combine it with
many unrelated changes before validating startup.

After ABI splitting works, measure additional changes independently:

- Remove unused assets from `pubspec.yaml`.
- Remove unused font files and font weights.
- Inspect native libraries included by plugins.
- Confirm whether all Firebase plugins are required.
- Keep Flutter icon tree shaking enabled.
- Do not disable compression.
- Compare APK contents before and after each change.
- Keep release builds enabled with `--release`.

Do not remove Firebase configuration, assets, or plugins merely because they
appear large. Confirm that the application still builds and that each feature
remains functional.

## Recommended handoff sequence

1. Preserve the current startup fix.
2. Build and validate the existing universal APK as a baseline.
3. Add `--split-per-abi`.
4. Validate all ABI outputs.
5. Perform clean installation testing for the target ABI.
6. Confirm that the app reaches the Sign in or Home screen.
7. Update the release workflow to publish the selected ABI artifacts.
8. Only then investigate further size reductions.
9. Keep unrelated visual or documentation changes out of the packaging commit.
