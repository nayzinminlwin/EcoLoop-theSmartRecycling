# BK-P00-A Environment Inventory

**Captured:** 2026-10-18 (local time, Asia/Singapore)
**Unit:** BK-P00-A inventory, updated by BK-P00-B/C verification
**Role:** Integration executor
**Specification:** ECOLOOP-SPEC-001 sections 1-3, 7 and 20
**Base revision:** `21fbb5fa3e2876c1a32b6fb8971b629211178123`
**Worktree at capture:** dirty before this unit; pre-existing untracked paths were `../../../Demo_Screenshots`, `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md`, `docs/archive/backend/ECOLOOP_BACKEND_IMPLEMENTATION_PLAN.md`, and `docs/archive/backend_plan`.

## Toolchain

| Tool | Observed version / result |
|---|---|
| Flutter | 3.47.0 stable, framework `4cf24164269a5ebf0c16a028a00727d0e77bbb05` |
| Dart | 3.13.0 stable |
| Node.js | v22.23.3 |
| npm | 10.9.9 |
| Python | 3.12.10 |
| uv | 0.13.1 |
| Java on PATH | OpenJDK 25.0.4.1 LTS |
| Flutter-configured JDK | Microsoft OpenJDK 21.0.12.1 |
| Firebase CLI | 15.30.2 |
| Google Cloud CLI | 589.0.0; authenticated |
| Git | 2.55.0.windows.2 |
| GitHub CLI | 2.101.0 |
| Gradle wrapper | 9.3.1 |
| Android Gradle Plugin | 9.1.0 |
| Android SDK | 36.0.0; emulator 37.1.11.0 |

The current Android build uses Java source/target compatibility 17. Current AGP 9.1 documentation requires JDK 17 or newer; Gradle 9.3.1 supports running on Java 17-25. The configured JDK 21 therefore satisfies the build requirement. The Android emulator is an SDK tool and does not impose a separate application Java runtime requirement; Android build tooling remains the relevant Java gate.

## Project and application resources

Firebase CLI access verified project `ecoloop-thesmartrecycling` (`353725053297`), display name `EcoLoop-theSmartRecycling`, active state, and Hosting site `ecoloop-thesmartrecycling`.

| Resource | Verified value |
|---|---|
| Android application ID / Firebase namespace | `sd.idk.ecoLoop` |
| Android Gradle namespace | `com.example.eco_loop` |
| Firebase Android app ID | `1:353725053297:android:5f87dfd3ae7c99552f5ed0` |
| Firebase web app ID | `1:353725053297:web:f9c407f5c8c886692f5ed0` |
| Registered web app display name | `Eco Loop Admin Panel` |
| Configured Storage bucket | `ecoloop-thesmartrecycling.firebasestorage.app` |
| Firebase project number | `353725053297` |

The Android package in `../../../android/app/google-services.json` matches the Gradle `applicationId` and the active Firebase Android registration. The namespace is intentionally different and was not used as the Firebase package identity.

## Devices and test paths

Flutter detected:

- Windows desktop (`windows`)
- Chrome web (`chrome`), executable at `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Edge web (`edge`), detected by Flutter

`adb devices` returned `qgfy7xz9eaci4tvs` in `device` state. Flutter reports the Android 15/API 35 device as `2312DRAABC`. Android camera, QR, push and offline behavior still require later acceptance tests.

The available web path is Chrome or Edge with browser camera permission testing. Web push permission/service-worker testing and a real push-capable browser profile remain unverified.

## Access and configuration status

| Item | Status |
|---|---|
| Firebase project identity | Verified with `firebase projects:list --json` |
| Android app registration | Verified with `firebase apps:list --project ecoloop-thesmartrecycling --json` |
| Web app registration | Verified with `firebase apps:list --project ecoloop-thesmartrecycling --json` |
| Firestore region | Verified: database `ecoloop-db`, `asia-southeast1`, Native, PESSIMISTIC |
| Storage bucket region | Verified: `US-EAST1` |
| Cloud Run region choice | Candidate verified available: `asia-southeast1` |
| Billing/API permissions | Billing enabled; active account has `roles/owner` |
| Required API status | Firebase, Firestore, Identity Toolkit, Storage, Generative Language, Run, Artifact Registry, Cloud Build, Secret Manager, Cloud Tasks and Cloud Scheduler enabled |
| OAuth authorized domains/client configuration | Not verified |
| Vision/Gemini/Roboflow secret references | `roboflow-api-key`, `gemini-api-key`; values are not present in the repository |
| `../../../services/vision` source tree | Present; hosted adapters and Cloud Run orchestration are documented in MODEL_ACCESS.md and DEPLOYMENT.md |
| `../../../functions` source tree | Not present |

No secret values were read into or written to this report.

## Commands and evidence

- `git status --short`
- `git rev-parse HEAD`
- `flutter --version --machine`
- `flutter doctor -v`
- `dart --version`
- `node --version`
- `npm --version`
- `python --version`
- `uv --version` (not found)
- `java -version`
- `firebase --version`
- `firebase projects:list --json`
- `firebase apps:list --project ecoloop-thesmartrecycling --json`
- `gcloud --version`
- `gcloud config get-value project`
- `gcloud auth list --filter=status:ACTIVE`
- `gcloud firestore databases describe --database=ecoloop-db --project=ecoloop-thesmartrecycling`
- `gcloud storage buckets describe gs://ecoloop-thesmartrecycling.firebasestorage.app`
- `gcloud billing projects describe ecoloop-thesmartrecycling`
- `gcloud services list --enabled --project=ecoloop-thesmartrecycling`
- `gcloud run regions list`
- `gcloud projects get-iam-policy ...`
- `flutter devices`
- `adb devices`

Protected files were inspected read-only and had no diff at capture:

- `../../../android/build.gradle.kts`
- `../../../android/app/build.gradle.kts`
- `../../../android/app/google-services.json`

## Subsequent verification

BK-P00-B verified the hosted providers with Python 3.12/uv from `../../../services/vision`. BK-P00-C verified the private Cloud Run service in `asia-southeast1` with the service and revision recorded in [DEPLOYMENT.md](DEPLOYMENT.md). The remaining Android camera/QR/push/offline and web push checks are P07 acceptance work, not completed by these foundation units.
