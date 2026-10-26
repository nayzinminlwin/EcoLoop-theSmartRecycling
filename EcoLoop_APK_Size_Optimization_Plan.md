# EcoLoop Android APK Size Optimization Plan

**Implementation handoff:** GPT-5.6 Luna  
**Scope:** Flutter Android release APK only. iOS is out of scope.  
**Primary goal:** Reduce the installable APK size without breaking startup, Firebase, authentication, QR scanning, Firestore CRUD, dashboard data, or notifications.  
**Approach:** Measure first, make one category of change per phase, validate it, and keep a record of the size difference.

---

## 1. Project facts and constraints

The following details come from the current `APK_BUILD_NOTES.md` and must be preserved unless a phase explicitly requires a change.

| Item | Known state / requirement |
|---|---|
| Current universal release APK | Approximately **74 MB** |
| Android application ID | `sd.idk.ecoLoop` — do not change |
| Version name in notes | `1.0.0` |
| Minimum SDK | 24 |
| Target SDK | 36 |
| Current native ABIs in the universal APK | `arm64-v8a`, `armeabi-v7a`, `x86_64` |
| Firebase mode | `ECOLOOP_FIREBASE_MODE=firebase` |
| Firebase region | `us-central1` |
| Firestore database | `ecoloop-db` |
| App Check mode | `demo-debug` |
| Current release signing | Debug signing, suitable for demonstrations/manual testing only |
| Startup behavior | The real Flutter app must render without waiting for nonessential initialization |
| Test suite | Approximately 166 tests; preserve them and use them for regression checks |

### Preserve these build-time definitions

Every baseline and comparison build must use the same definitions as the known-good build:

```text
--dart-define=ECOLOOP_FIREBASE_MODE=firebase
--dart-define=ECOLOOP_FIREBASE_REGION=us-central1
--dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db
--dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
```

Also preserve the currently intended `--build-number` value and other existing release parameters. Do not copy a placeholder build number literally; obtain the intended value from the current release workflow or the user/project configuration.

### Non-negotiable safety rails

1. **Do not reintroduce blocking startup initialization.** Nonessential SharedPreferences, exit-intent restoration, Firebase Messaging, notification, and `getInitialMessage()` work must remain asynchronous after the real Flutter application can render. If required Firebase client initialization fails, retain a visible error state and retry path instead of an infinite spinner.
2. Do not change the application ID, Firebase project/database configuration, package identity, permissions, or app behavior as incidental size work.
3. Do not remove tests, Firebase plugins, or assets simply because they look large. Prove that each item is unused first.
4. Keep the existing icon tree-shaking behavior enabled. Do not disable asset compression.
5. Do not combine unrelated optimizations in a single implementation step. A build/startup regression must be attributable to one change category.
6. Keep generated size reports, APKs, and symbol files out of the app's bundled assets. Do not accidentally commit large build artifacts or secrets.
7. Do not treat the 20 MB goal as a guaranteed result. Record actual sizes and prioritize verified reductions.

---

## 2. Execution strategy at a glance

| Phase | Work | Why this order | Gate before continuing |
|---|---|---|---|
| 0 | Inspect repo, protect baseline, run current tests | Understand the existing Gradle/plugin setup before editing it | Clean baseline recorded; no pre-existing unexplained failure |
| 1 | Measure universal and ARM64 builds; produce size analysis | Establish comparable evidence before changes | Baseline artifacts, sizes, hashes, and analysis report saved |
| 2 | Add ABI splits and validate each output | Likely the largest low-risk win for direct APK distribution | Correct architecture, clean install, startup, and core flows pass |
| 3 | Remove only confirmed-unused assets and fonts | Low-risk cleanup with easy attribution | Rebuild and regression checks pass; size delta recorded |
| 4 | Switch to unbundled ML Kit barcode model, **only if applicable and supported** | Potential model-size saving, isolated from general dependency cleanup | First scan/model-download/offline behavior and all QR flows pass, or document not applicable |
| 5 | Remove genuinely unused direct dependencies | Avoid native and Dart dependency code that is not needed | Dependency graph/build/tests/core flows pass; size delta recorded |
| 6 | Enable R8 code and resource shrinking | More Gradle/runtime risk; perform after easier cleanup | Release build and all native-plugin/Firebase/QR flows pass |
| 7 | Add `--split-debug-info` and `--obfuscate` to the final release build | Apply release-symbol handling after the code/dependency set is stable | Symbols safely archived; obfuscated build launches and all core flows pass |
| 8 | Final package validation and release-workflow handoff | Verify the exact artifact intended for distribution | Final report includes size comparison, hashes, and test evidence |

**Important comparison rule:** for each phase, compare the same target artifact—preferably the `arm64-v8a` release APK intended for the target Android phones—with the immediately preceding `arm64-v8a` result. Keep the 74 MB universal APK as a separate historical baseline. Do not claim an optimization's size savings by comparing a universal APK with an ARM64-only APK; that measures different packaging choices, not just the optimization.

---

## Phase 0 — Repository reconnaissance and baseline protection

### Tasks

1. Confirm the correct repository, branch, working-tree status, and current commit. Do not discard user changes. If the tree is dirty, identify which changes are pre-existing before editing.
2. Read, at minimum:
   - `pubspec.yaml` and `pubspec.lock`
   - `android/app/build.gradle.kts` (or the actual app Gradle file if named differently)
   - `android/build.gradle.kts` and `android/settings.gradle.kts`, if present
   - `android/gradle.properties`
   - `android/app/proguard-rules.pro`, if present
   - `android/app/src/main/AndroidManifest.xml`
   - the QR-scanner package's documentation and Android implementation/dependency configuration
   - the APK release workflow/scripts, if one exists
3. Record Flutter/Dart versions, Android Gradle Plugin (AGP) version, Gradle wrapper version, Java version, and the current release configuration. Do not upgrade toolchains as part of this plan.
4. Identify the actual QR-scanning package and resolved Android barcode-scanning dependency. **Do not assume that the app uses ML Kit.**
5. Run the current relevant test suite (normally `flutter test`) and record any pre-existing failures. Keep all tests intact.
6. Record the existing build-number source and exact known-good build command, including all four `--dart-define` values above.

### Deliverables

- A short repo/configuration summary for the final report.
- The current test result and any known pre-existing failures.
- A list of unresolved project facts, especially the QR package and whether its Android dependency bundles the ML Kit model.

### Gate

Do not begin modifying Gradle or dependencies until the current app configuration and known-good build inputs have been identified.

---

## Phase 1 — Create a trustworthy size baseline and analyze the build

### Tasks

1. Build the current, unmodified universal release APK using the exact known-good flags and definitions. Immediately record its exact size/hash and copy it to a temporary baseline archive outside `build/`. The next build may overwrite the same output filename.
2. Separately build a normal **ARM64-only release APK** using `--target-platform=android-arm64`, with the same build number and definitions. Immediately record its exact size/hash and copy it to the baseline archive. This gives a useful ARM64 baseline before other changes.
3. In a separate build, generate Flutter's size-analysis report for ARM64:

   ```powershell
   flutter build apk --release --analyze-size --target-platform=android-arm64 `
     --dart-define=ECOLOOP_FIREBASE_MODE=firebase `
     --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 `
     --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db `
     --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
   ```

   Add the same current `--build-number` and any other required release flags used by the existing workflow. Run analysis as a separate build so its output is not mistaken for the normal shipping artifact. Copy the generated analysis JSON to the baseline archive as well.
4. Prefer a local ignored directory or an external artifact location for baseline files; do not commit APKs or generated size reports to source control.
5. Record exact file sizes in bytes, human-readable sizes, SHA-256 hashes, Flutter/Gradle/AGP versions, build commands, and date.
6. Inspect the APK contents and size analysis. Record the approximate contribution of Dart code, Flutter/native libraries, Android DEX/resources, fonts, and Flutter assets. Confirm which ABI directories exist in the universal APK.
7. Use Flutter DevTools' App Size tool to inspect the ARM64 analysis file. Save a screenshot or concise summary of the largest categories if useful. Only diff analysis JSON files that represent comparable ARM64 builds.

### Clarification

`--analyze-size --target-platform=android-arm64` **builds/analyzes an ARM64-targeted release**, not a comparison between the existing universal APK and a future ARM64 APK. The `--analyze-size` flag generates a breakdown; it does not automatically compare two artifacts.

### Deliverables

A baseline table such as:

| Artifact | Purpose | Size (bytes) | SHA-256 |
|---|---|---:|---|
| Universal release APK | Historical existing packaging | Record actual value | Record actual hash |
| ARM64-only release APK | Apples-to-apples architecture baseline | Record actual value | Record actual hash |
| ARM64 size-analysis JSON | Breakdown of compiled app size | N/A | Optional |

### Gate

Do not start cleanup based on guesses. Save the baseline and summarize the biggest actual size contributors first.

---

## Phase 2 — Implement ABI-split APKs

### Goal

Stop shipping native binaries for unrelated CPU architectures inside a single APK intended for one device architecture.

### Changes

1. Make **only** the build/distribution change necessary to generate ABI-split APKs. Do not enable R8, change dependencies, remove assets, or obfuscate Dart code in this phase.
2. Build using `--split-per-abi` and all the same known-good build-number and `--dart-define` values:

   ```powershell
   flutter build apk --release --split-per-abi `
     --dart-define=ECOLOOP_FIREBASE_MODE=firebase `
     --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 `
     --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db `
     --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
   ```

3. Expect outputs similar to:
   - `build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk`
   - `build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`
   - `build/app/outputs/flutter-apk/app-x86_64-release.apk`
4. Compare the split ARM64 APK against the normal ARM64 baseline from Phase 1. Record all sizes and hashes. Also record the universal APK comparison separately as a packaging comparison.
5. Validate every APK that will be published:
   - ZIP integrity succeeds.
   - `zipalign` succeeds.
   - `apksigner verify --verbose` succeeds and confirms a valid APK signature (v2 or newer where supported by the configured tooling).
   - Package ID is exactly `sd.idk.ecoLoop` and version code is correct.
   - APK contents include the expected native ABI and do not include unrelated ABI directories.
6. Test a **clean installation** of the target `arm64-v8a` APK, not just an in-place update. Uninstalling removes local app data, so preserve anything needed for testing before doing it.
7. Confirm the app launches, transitions from the Android splash to Flutter UI, reaches Sign in or Home, initializes Firebase, and does not get stuck on a loading screen. Exercise sign-in, dashboard/Firestore reads, the QR scan + Firestore write/read flow, CRUD, and notification behavior where testable.
8. If a release workflow assumes that `app-release.apk` is the only output, update it only after the split artifacts have passed validation. Make the workflow explicitly publish the intended artifact(s). For the expected target devices, publish ARM64 if that is the chosen supported target; retain other ABI APKs only if they are genuinely needed.

### Deliverables

- Validated ABI APKs.
- Updated release workflow/script, if applicable.
- Size/hash table and clean-install/core-flow results.

### Gate

Proceed only if the selected ABI APK installs cleanly, reaches the app UI, and passes core flows. If the build succeeds but startup regresses, fix or roll back this phase before further optimizations.

---

## Phase 3 — Remove confirmed-unused assets and fonts

### Goal

Remove resources that are actually bundled but not needed at runtime.

### Tasks

1. Review every entry under `flutter.assets`, `flutter.fonts`, and any other asset declarations in `pubspec.yaml`.
2. Search the full project for references to candidate images, fonts, animation files, local JSON/data files, and other bundled assets. Account for dynamically selected asset paths, generated references, and assets read by tests or runtime code.
3. Use Phase 1's analysis and APK contents to prioritize assets that have a measurable size contribution.
4. Remove only assets and font weights that are proven unused. Keep required license files and assets required indirectly by packages.
5. Do not change visual design or replace assets as part of this task. Do not disable compression or Flutter icon tree-shaking.
6. Run relevant tests, build the same normal ARM64 release artifact with the same flags, and record the size/hash change. Inspect the APK contents to confirm the intended files are absent.

### Deliverables

- List of removed files and evidence that they were unused.
- Before/after size and test results.

### Gate

If a file's use cannot be established confidently, leave it in place and note it for later review.

---

## Phase 4 — Switch the QR scanner to the unbundled ML Kit model, only if supported

### Goal

If the current Android QR implementation packages the bundled ML Kit barcode model, evaluate switching to the Google Play Services-delivered model to reduce the APK's installed/downloaded package contents.

### Investigation required before editing

1. Confirm the QR-scanning Flutter package and version from `pubspec.yaml`/`pubspec.lock`.
2. Inspect its Android implementation and the resolved release dependency graph. Verify whether it uses:
   - the bundled model artifact `com.google.mlkit:barcode-scanning`, or
   - the unbundled/thin-model artifact `com.google.android.gms:play-services-mlkit-barcode-scanning`.
3. Consult the exact package version's official documentation/source to confirm whether switching is supported through a documented plugin version/configuration. Do not add or force a Gradle dependency blindly; a plugin may declare the bundled artifact or may not support the alternate dependency.
4. If it is already unbundled, or if the plugin cannot switch safely, do not invent a workaround. Mark this phase **not applicable** or **blocked by plugin support**, with the evidence.

### Implementation, if supported

1. Make only the documented change required to use the unbundled model.
2. Do not remove the QR scanner or replace it with a different scanner API as part of this optimization.
3. Build the same normal ARM64 release APK and record the size delta separately from other changes.
4. Test:
   - First scan on a device with Google Play Services and working internet.
   - The scanner's first-use/model-download state and user-visible behavior.
   - What happens if scanning is attempted before the model is available.
   - A subsequent scan after model installation.
   - A cold launch and the app's startup transition.
   - QR payload parsing, Firestore fetch, and Firestore write/update behavior.
   - Offline or restricted-network behavior, documenting any expected first-use limitation.
5. Confirm that the hackathon demonstration devices have Google Play Services and reliable connectivity if the model is downloaded on demand.

### Trade-off to document

Google's current Android barcode-scanning guidance describes the unbundled model as roughly a **200 KB** app-size increase versus roughly **2.4 MB** for the bundled model, but the exact saving in this app depends on the plugin, dependency graph, and packaging. The unbundled model may need to download before the first scan can work. Measure the actual APK and test the first-use experience rather than assuming the headline saving.

### Deliverables

- Exact QR plugin/dependency evidence.
- Either a tested supported switch or a clear not-applicable/blocked result.
- Before/after size and QR/startup test results.

### Gate

Do not proceed with an unbundled model if first-use scanning becomes unreliable for the intended demonstration environment or if the required change is an undocumented dependency override.

---

## Phase 5 — Remove genuinely unused dependencies

### Goal

Reduce avoidable Dart packages and native Android libraries without removing needed functionality.

### Tasks

1. Review direct dependencies in `pubspec.yaml` against actual source imports, generated code, platform-channel use, and feature flows.
2. Inspect the resolved dependency graph using `flutter pub deps` and inspect Android's release runtime dependency graph with the project's Gradle wrapper where appropriate.
3. Check dynamic use, plugin registration, generated Firebase code, background handlers, and manifest-declared Android components before deciding a package is unused. A dependency may be used indirectly even if no direct Dart import is obvious.
4. Remove **one confirmed-unused direct dependency at a time**. Let Pub resolve dependencies normally; do not manually edit `pubspec.lock` to force a desired outcome.
5. Do not update unrelated dependencies, change major versions, remove Firebase packages without feature evidence, or change the QR-scanner package just to simplify this phase.
6. After each removal, run `flutter pub get`, relevant tests, and a normal ARM64 release build with the preserved defines. Exercise the feature set and record the measured delta.
7. If no dependency is provably unused, make no dependency changes and record that result.

### Deliverables

- Dependency removals with the reason each was considered unused.
- Test/build results and size deltas per meaningful change.

### Gate

All required features and tests must pass. Restore a dependency if its removal breaks a required or indirectly invoked feature.

---

## Phase 6 — Enable R8 code shrinking and Android resource shrinking

### Goal

Reduce unused Android/Java/Kotlin code and Android resources in the release build.

### Pre-work

1. Re-read the actual app-level Gradle file, AGP version, existing `buildTypes.release`, and any existing ProGuard/R8 rules.
2. Determine the syntax supported by this project's AGP version. Current Android Gradle Plugin versions have evolved their optimization DSL; do not paste a generic configuration without matching it to the project.
3. Check whether minification/resource shrinking is already enabled. If so, verify what it does before changing anything.

### Implementation

1. Enable code optimization/minification for the **release** build using the correct configuration for the installed AGP version.
2. Enable Android resource shrinking where supported. On legacy Gradle DSLs, resource shrinking requires code shrinking as well; use the project's correct Kotlin DSL/Groovy syntax.
3. Use the standard optimize ProGuard configuration recommended for the project's AGP version and retain custom rules only where justified by actual plugin behavior or build/runtime evidence.
4. Do not add broad keep rules pre-emptively; they can negate shrinking. Do not delete existing keep rules without proving they are unnecessary.
5. Make no other code, dependency, asset, scanner, or signing changes in this phase.
6. Build the same normal ARM64 release artifact, compare its size with Phase 5, and inspect R8 warnings.
7. Run the full relevant tests and manually verify clean installation/startup, Firebase initialization, authentication, Firestore CRUD/dashboard, QR scanning, and notifications. Pay particular attention to native plugins and any functionality that relies on reflection or manifest metadata.
8. If a feature breaks, use R8 diagnostics and add the narrowest evidence-based rule, or revert the R8 change if a reliable fix is not established.

### Important boundary

R8's Android resource shrinking does **not** replace Phase 3: it is not a general-purpose remover for arbitrary files declared as Flutter assets under `assets/flutter_assets/`. Keep Flutter asset cleanup as a separate measured task.

### Deliverables

- Minimal Gradle/R8 configuration changes.
- Any evidence-based keep rules and their reasons.
- Build logs, before/after size, and test/core-flow results.

### Gate

Proceed only if the optimized release build passes clean-install testing and all required plugin/Firebase/QR behaviors.

---

## Phase 7 — Split Dart debug information and obfuscate the final release

### Goal

Reduce the compiled Dart artifact's size where possible and make release Dart symbol names harder to inspect, while retaining the symbol files needed to diagnose production crashes.

### Requirements

1. Use `--split-per-abi`, `--split-debug-info=<durable-unique-directory>`, and `--obfuscate` for the final release build. Preserve the current build number and all four `--dart-define` values.
2. Do not place symbol files inside `assets/` or any directory bundled into the APK.
3. Use a unique symbol output directory for each release/build. Store it outside a directory that `flutter clean` or the release process may delete. Archive the matching symbols safely as a build/CI artifact or in the project's approved private release archive.
4. Never publish an APK and discard its matching symbol files. Symbol files must be matched to the exact build they came from; they are not interchangeable across releases.
5. Obfuscation is not a substitute for keeping symbol files. Keep the appropriate obfuscation/symbol output for every shipped build so Dart stack traces can be symbolized later.

### Build command template

Replace `<durable-unique-directory>` with a real path outside disposable build outputs, and append the same current build-number flag used by earlier phases.

```powershell
flutter build apk --release --split-per-abi `
  --split-debug-info=<durable-unique-directory> `
  --obfuscate `
  --dart-define=ECOLOOP_FIREBASE_MODE=firebase `
  --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 `
  --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db `
  --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
```

The directory placeholder above is explanatory, not a literal PowerShell argument. Replace it before running the command.

### Validation

1. Record the size of each final ABI APK and compare the ARM64 result with Phase 6.
2. Verify the symbols were generated in the chosen external directory and safely archived.
3. Confirm symbol files are not inside the APK.
4. Clean-install the final ARM64 APK and re-run the core feature checklist and tests.
5. Document that obfuscation may make crash traces harder to read without the exact matching symbol output.

### Gate

Do not publish the obfuscated APK until the corresponding symbols are securely archived and the final artifact passes validation.

---

## Phase 8 — Final validation, workflow update, and report

### APK validation checklist

For every APK being published:

- [ ] ZIP integrity passes.
- [ ] `zipalign` validation passes.
- [ ] `apksigner verify --verbose` succeeds.
- [ ] Package ID remains `sd.idk.ecoLoop`.
- [ ] Version code/build number is the intended value.
- [ ] APK filename and native ABI contents agree.
- [ ] SHA-256 hash is recorded.
- [ ] Clean installation on the intended Android device succeeds.
- [ ] Android splash transitions to Flutter UI; there is no infinite loading screen.
- [ ] Firebase initialization, sign-in, dashboard reads, QR read/write, CRUD, and relevant notification flows pass.
- [ ] All relevant automated tests pass; existing test files remain present.
- [ ] The exact Dart symbol files for the final obfuscated build are archived.
- [ ] Release workflow publishes only the intended, validated ABI APK(s), rather than assuming `app-release.apk` always exists.

### Final comparison table

Populate actual measurements—do not estimate or invent values.

| Stage | Universal APK | ARM64 APK | Change vs previous ARM64 stage | Tests / device validation |
|---|---:|---:|---:|---|
| Existing baseline | ~74 MB (confirm exact bytes) | Record | Baseline | Record |
| ABI split only | Not the primary distribution artifact | Record | Record MB and % | Record |
| Asset cleanup | N/A unless universal build is also produced | Record | Record MB and % | Record |
| Unbundled model (if applicable) | N/A unless universal build is also produced | Record | Record MB and % | Record |
| Unused dependencies | N/A unless universal build is also produced | Record | Record MB and % | Record |
| R8 code/resource shrinking | N/A unless universal build is also produced | Record | Record MB and % | Record |
| Split debug info + obfuscation | N/A unless universal build is also produced | Record | Record MB and % | Record |
| Final release artifact | Only if still needed | Record exact bytes and hash | Total ARM64 change vs ARM64 baseline | Pass/fail summary |

For each phase, calculate:

- **Absolute saving:** previous comparable ARM64 APK size − new comparable ARM64 APK size.
- **Percentage saving:** absolute saving ÷ previous comparable ARM64 APK size × 100.

Keep the universal-vs-ARM64 packaging difference separate from the source/dependency optimization savings.

### Final handoff report

Provide a concise final report containing:

1. Before/after sizes in bytes and MB, including the universal 74 MB baseline and final ARM64 APK.
2. Per-phase size deltas and what actually caused each reduction.
3. Exact build command and build number used for the final artifact.
4. List of generated APKs and SHA-256 hashes.
5. Automated test results and manual device/core-flow results.
6. ML Kit finding: bundled, unbundled, not applicable, or blocked, with evidence.
7. R8 configuration changes and any keep rules.
8. Location of the archived matching Dart symbols for the obfuscated build.
9. Remaining opportunities or blockers, including whether the 20 MB target was achieved. Do not sacrifice required features to hit an arbitrary number.

---

## Instructions to GPT-5.6 Luna

- Execute phases sequentially. Do not skip a gate to save time.
- Make one optimization category at a time and show the measured result before proceeding.
- Inspect actual project files before editing; this plan intentionally does not assume the QR-scanner package or AGP version.
- Keep `APK_BUILD_NOTES.md`'s startup fix and Firebase settings intact.
- Keep tests. Do not introduce unrelated UI, refactoring, documentation, or toolchain changes.
- If a phase is not applicable, explain why and move on without forcing an unsupported workaround.
- If a build/test fails, diagnose and fix or roll back the current phase before continuing. Do not bury a regression under the next optimization.
- Report real values from build outputs. Never claim a size reduction without comparing the same target artifact.

---

## References

### Project-specific source

- `APK_BUILD_NOTES.md` — known-good build flags, current ABI contents, startup behavior, validation requirements, package identity, and release-workflow assumptions.

### Official documentation

- Flutter — Measuring app size: https://docs.flutter.dev/perf/app-size
- Flutter — App Size tool and comparing analysis snapshots: https://docs.flutter.dev/tools/devtools/app-size
- Flutter — Android deployment and ABI-split APKs: https://docs.flutter.dev/deployment/android
- Android Developers — Enable app optimization with R8: https://developer.android.com/topic/performance/app-optimization/enable-app-optimization
- Android Developers — Reduce APK size: https://developer.android.com/topic/performance/reduce-apk-size
- Google ML Kit — Barcode scanning on Android (bundled vs unbundled model): https://developers.google.com/ml-kit/vision/barcode-scanning/android
