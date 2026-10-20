# H1 — EcoLoop Demo Environment Readiness

> **Status: IN PROGRESS — do not treat this document as proof that Firebase Console settings or end-to-end tests have passed.**
>
> Values below marked `DEVELOPER-REPORTED` came from the developer's local command output or report. They have not been independently checked against the live Firebase Console in this document.

## 1. Presentation and Execution Window

- Presentation date: **20 October 2026**
- Presentation time: **8:00 PM**
- Time zone: **Asia/Kuala_Lumpur (MYT, UTC+08:00)**
- Available execution allocation: **20 hours (developer-reported)**
- Final configuration deadline: **Before 20 October 2026, 8:00 PM MYT**
- Device owner/operator: **Developer**
- Primary demo platform: **Android mobile app**
- Website/web app needed for presentation: **No — out of scope for this mobile-only demo**
- Browser for presentation: **NOT APPLICABLE unless a QR/action flow opens a browser**

**Scheduling note:** At 3:13 AM MYT on 20 October 2026, the wall-clock time until 8:00 PM MYT is approximately 16 hours 47 minutes. The 20-hour execution allocation exceeds the available wall-clock window unless some work is done earlier or the deadline changes.

## 2. Android Device and QR Test

- Device model: **Redmi Note 13** (`DEVELOPER-REPORTED`)
- Android product: `gold` (`DEVELOPER-REPORTED`)
- Android model identifier: `2312DRAABC` (`DEVELOPER-REPORTED`)
- ADB device ID: `qgfy7xz9eaci4tvs` (`DEVELOPER-REPORTED`)
- `adb devices -l` entry: `qgfy7xz9eaci4tvs device product:gold model:2312DRAABC device:gold transport_id:2`
- Android version: **15 (VERIFIED by ADB on 20 October 2026)**
- Android SDK level: **35 (VERIFIED by ADB on 20 October 2026)**
- Camera permission granted: **UNVERIFIED**
- QR displayed on second screen: **UNVERIFIED**
- QR printed on paper: **UNVERIFIED / NOT REQUIRED unless printout is part of the demo**
- QR result opens intended application flow: **UNVERIFIED**

Suggested read-only verification commands:

```powershell
adb -s qgfy7xz9eaci4tvs shell getprop ro.product.model
adb -s qgfy7xz9eaci4tvs shell getprop ro.build.version.release
adb -s qgfy7xz9eaci4tvs shell getprop ro.build.version.sdk
```

## 3. Login Hotfix and Launch Configuration

- Reported root causes: missing/unregistered Android SHA certificate fingerprint and an incorrect Firebase region define (`asia` was used instead of `us-central1`).
- Corrected/reported launch command:

```powershell
flutter run -d qgfy7xz9eaci4tvs --dart-define=ECOLOOP_FIREBASE_MODE=firebase --dart-define=ECOLOOP_FIREBASE_REGION=us-central1
```

- Login hotfix reportedly succeeded: **DEVELOPER-REPORTED; retain terminal/test evidence if available**
- Exact signing-certificate SHA-1 value: `c4971cac4d6eefd2aec606b0339fae607e5f8f24` (**VERIFIED for `build\app\outputs\flutter-apk\app-debug.apk`**)
- Exact signing-certificate SHA-256 value: `115ce5cb92791a016b19573ce43202daa4de3edb89b9efc13aba94b72d7c9113` (**VERIFIED for `build\app\outputs\flutter-apk\app-debug.apk`**)
- Confirmation that both fingerprints are registered on the Firebase Android app: **VERIFIED (developer-confirmed)**
- Android app support-email / Google provider confirmation: **VERIFIED (developer-confirmed in Section 5)**
- Native/configuration files changed for the hotfix: **UNVERIFIED — inspect `git diff`, staged diff and relevant commit history**
- Original command history independently recovered: **UNVERIFIED**

Important: the command above runs the app on the device. If the demo will be delivered as an APK file, separately build and inspect the actual APK with the same required Dart defines; do not assume the signing report alone proves the APK's signer.

Suggested debug APK build command, after confirming this is the intended variant:

```powershell
flutter build apk --debug --dart-define=ECOLOOP_FIREBASE_MODE=firebase --dart-define=ECOLOOP_FIREBASE_REGION=us-central1
```

Expected default output path: `build\app\outputs\flutter-apk\app-debug.apk` (verify the actual output path).

## 4. Firebase Project and App Identity

- Firebase project ID: `ecoloop-thesmartrecycling` (**DEVELOPER-REPORTED**)
- Firebase project number: `353725053297` (**DEVELOPER-REPORTED**)
- Storage bucket: `ecoloop-thesmartrecycling.firebasestorage.app` (**DEVELOPER-REPORTED from local config summary; verify in Console**)
- Android Gradle namespace: `com.example.eco_loop` (**DEVELOPER-REPORTED**)
- Android `applicationId`: `sd.idk.ecoLoop` (**DEVELOPER-REPORTED**)
- Firebase Android App ID: `1:353725053297:android:5f87dfd3ae7c99552f5ed0` (**DEVELOPER-REPORTED**)
- Android package listed in `google-services.json`: `sd.idk.ecoLoop` (**DEVELOPER-REPORTED**)
- OAuth client entries reported in that JSON client: `2` (**DEVELOPER-REPORTED**)
- `google-services.json` reported status: **OK according to developer's local check**
- `.firebaserc` mapping compared with live Console: **VERIFIED locally; Firebase CLI selected `ecoloop-thesmartrecycling`**
- `lib/firebase_options.dart` identity compared with live Console: **VERIFIED by Firebase app listing and local configuration comparison**
- Messaging worker identity, if used: **VERIFIED locally against the same project identity**
- Actual APK application ID and signer: **VERIFIED: `sd.idk.ecoLoop`; debug signer fingerprints recorded above**

The Gradle `namespace` and Android `applicationId` can differ. Use `applicationId` and the built APK's application ID when matching the Firebase Android app registration.

## 5. Authentication and Authorized Domains

- Google sign-in provider enabled in Firebase Authentication: **VERIFIED (developer-confirmed)**
- Support email usable by the intended Google account: **VERIFIED (developer-confirmed)**
- Intended test account successfully signs in against the intended Firebase project: **VERIFIED (developer-confirmed)**
- Authorized domains: **NOT REQUIRED for this mobile-only demo; no domains should be added unless an actual web flow requires one**
- OAuth configuration confirmed in Firebase Console: **VERIFIED (developer-confirmed)**

These statuses reflect the developer's confirmation; no web flow is in the presentation scope.

## 6. Firestore and Storage

- Required Firestore database ID: `ecoloop-db`
- CLI database-list result: `projects/ecoloop-thesmartrecycling/databases/ecoloop-db` (**DEVELOPER-REPORTED**)
- Database edition/type reported: `STANDARD` / `FIRESTORE_NATIVE` (**DEVELOPER-REPORTED**)
- Actual database location/status: **VERIFIED by gcloud: `asia-southeast1`, `FIRESTORE_NATIVE`, delete protection disabled**
- Flutter application explicitly selects `ecoloop-db`: **VERIFIED in `lib/core/firebase/firebase_clients.dart` via `databaseId`**
- Storage bucket value from local config summary: `ecoloop-thesmartrecycling.firebasestorage.app` (**DEVELOPER-REPORTED; verify in Console if Storage is used**)
- Accidental `(default)` database creation: **NOT REPORTED; verify no change was made**
- Existing resident wallets reset/modified during H1: **NOT REPORTED; verify and preserve**

Do not create `(default)`, create a second project/database, migrate data, or reset wallets to work around a mismatch.

## 7. Distribution and App Check

- Demo distribution choice: **Android debug APK**
- App Check plan: **NO, per developer report**
- Android App Check app/provider registration: **UNVERIFIED**
- App Check enforcement status for Authentication, Cloud Firestore and Cloud Storage (if used): **VERIFIED by developer: enforcement is not enabled**
- Debug token generated/registered: **NOT PLANNED according to current “App Check: NO” choice; revisit only if a required service enforces App Check**
- Web App Check / reCAPTCHA Enterprise: **NOT REQUIRED for the stated mobile-only demo, unless the scope changes**

**Important gate:** An App Check provider being unused is safe for this demo only if the required services do not reject requests lacking valid App Check tokens. Check enforcement status; do not enable enforcement during H1 as a troubleshooting experiment.

## 8. CLI Access and Test Accounts

- Firebase CLI installed: **VERIFIED, version 15.30.2**
- Firebase CLI authentication/current project: **VERIFIED; `ecoloop-thesmartrecycling`**
- Access to intended project confirmed through Firebase CLI: **VERIFIED by `firebase apps:list`**
- Google Cloud CLI access: **VERIFIED; active account configured**
- Fresh zero-wallet resident test account available: **UNVERIFIED**
- Second Google account for account-switch test available: **UNVERIFIED**
- Fresh resident sign-in/onboarding tested: **UNVERIFIED**
- Account-switch isolation tested: **UNVERIFIED**
- Existing wallet values preserved: **UNVERIFIED**

Do not store Google passwords, recovery information, CLI tokens, service-account keys, OAuth secrets, or App Check tokens here.

## 9. Remaining Tasks and Owners

| Priority | Task | Owner | Status / exit evidence |
|---|---|---|---|
| P0 | Run `signingReport`; inspect the actual APK's application ID and signing certificate | Developer | SHA-1/SHA-256 tied to the demo APK; values recorded privately or as safe fingerprints in evidence |
| P0 | Verify SHA-1 for Android Google sign-in is registered on the correct Firebase Android app | Developer / Firebase Console owner | **VERIFIED — both APK fingerprints are registered (developer-confirmed)** |
| P0 | Confirm Google provider is enabled and support email is usable | Developer / Firebase Console owner | **VERIFIED — developer-confirmed** |
| P0 | Verify the app selects `ecoloop-db`, not an unintended database | Developer / agent read-only inspection | **VERIFIED — explicit Flutter `databaseId` selection added** |
| P0 | Check App Check enforcement status for services the app uses | Developer / Firebase Console owner | **VERIFIED — no App Check enforcement; no App Check planned** |
| P0 | Test QR on the selected phone | Developer | **DEFERRED by developer; not part of this H1 checkpoint** |
| P0 | Test fresh zero-wallet account and second-account switching | Developer | **DEFERRED by developer; not part of this H1 checkpoint** |
| P1 | Compare `.firebaserc`, `firebase_options.dart`, and messaging worker identities | Agent read-only; developer verifies Console | Public manifest contains verified values or `UNVERIFIED` |
| P1 | Review `git status`, staged diff, and evidence for secrets | Developer | Only intentional safe files staged |
| P1 | Commit H1 evidence/public config manifest; record commit SHA in tracker | Developer | Commit SHA and clean/known working-tree state recorded |

## 10. Secret and Data-Safety Rules

- Do not store raw App Check debug tokens, OAuth secrets, passwords, access tokens, refresh tokens, or service-account private keys in this document, any manifest, commit, issue, or agent prompt.
- Do not publish token lists or full private environment dumps.
- Do not run deployments or alter database contents as part of read-only inventory.
- Do not create Firebase projects, extra app registrations, buckets, or `(default)` Firestore databases as workarounds.
- Do not reset personal wallets or delete resident data to prepare the demo.
- Mark facts `UNVERIFIED` until backed by local output, Console evidence, or a successful test.

## 11. Commit / Handoff

- H1 evidence reviewed: **REVIEWED; demo-flow tests intentionally deferred**
- Secret review completed: **PENDING**
- Intentional public configuration changes: **UNVERIFIED / record exact files and reason**
- H1 commit SHA: **PENDING until this evidence and the database-selection fix are committed**
- Agent A1 handoff: **PENDING**

Suggested evidence-only commit message:

```text
docs: record demo H1 environment readiness
```

## Official References

- Firebase Android setup: https://firebase.google.com/docs/android/setup
- Google sign-in on Android: https://firebase.google.com/docs/auth/android/google-signin
- Firebase Google services JSON configuration: https://firebase.google.com/docs/android/google-services-plugin-and-file
- Firebase App Check enforcement: https://firebase.google.com/docs/app-check/enable-enforcement
- Firebase Firestore database management: https://firebase.google.com/docs/firestore/manage-databases
