# Flutter UI Execution Log

## Phase 1 — Bootstrap, dependencies, feature structure, and centralized AppTheme

**Status:** Completed
**Date:** 15 October 2026

### Completed

- Replaced the Flutter starter counter with the EcoLoop bootstrap and a
  `MaterialApp.router` composition root.
- Added the Phase 1 dependency boundary: Riverpod, go_router, intl,
  flutter_svg, and integration_test. No Firebase SDK was added or initialized.
- Added the final route/name constants while registering only the branded
  bootstrap route and an error fallback. Feature routes remain reserved for
  their implementation phases.
- Centralized Figma-derived colors, typography, spacing, radii, shadows,
  motion, semantic theme extension, and Material component themes.
- Added offline Inter font files under the SIL Open Font License and extracted
  the resident outline icon set as tintable SVG assets.
- Added a bootstrap smoke test and updated the local launch instructions.

### Fidelity decisions

- The initial route is intentionally a branded loading surface rather than a
  dashboard, because resident data and screens are introduced in later
  phases.
- Inter is bundled locally so the app has no remote font dependency.
- SVG icons preserve the source 24×24 viewBox, 1.8 stroke, round caps, and
  round joins; Flutter applies color through `ColorFilter`.

### Verification

- Protected Android SHA-256 baseline recorded before edits:
  - `android/build.gradle.kts`: `13A662F4ADCAB37EEF0CD7F5FE61B5144EDF2B252EEF99DA7F2E9CCE8C542092`
  - `android/app/build.gradle.kts`: `0B3842D2BEE62AE3992642D449FAB99B69006A39606D6942FAECEDD3F5169FA6`
  - `android/app/google-services.json`: `41D6F3137C47DB4A18D827EBBDBA4E1757C8A82102485080D893E35270840C92`
- Flutter analysis, formatting, tests, and web build are run after dependency
  resolution.
- A debug web launch initially exposed a missing production `ProviderScope`;
  the composition root was corrected and the focused analyzer/test gate was
  repeated successfully. The final connected-app runtime check reported no
  runtime errors.

## Phase 2 — Reusable shared UI and feedback components

**Status:** Completed
**Date:** 15 October 2026

### Completed

- Added repository-free shared widgets for branding, icons, buttons, fields,
  cards, badges, avatars, page structure, filters, points, and progress.
- Added reusable confirmation dialogs and keyboard-aware bottom sheets with
  pending and inline failure states.
- Added accessible loading, error, empty, and live feedback views with
  caller-supplied copy and callbacks.
- Added focused widget coverage for loading/disabled controls, form errors,
  modal cancel/confirm behavior, and retry feedback.

### Verification

- `flutter analyze` passes with no issues.
- `flutter test` passes, including
  `test/shared/widgets/shared_components_test.dart`.
- A hot restart was attempted through DTD; no Flutter app was connected in the
  VS Code DTD instance, so no runtime restart was available for this phase.

## Phase 3 — Shared mock foundation and resident data contracts

**Status:** Completed
**Date:** 15 October 2026

### Completed

- Added SDK-free async mock infrastructure with fixed demo clock, failure
  scenarios, fixture loading, transactional in-memory storage, and broadcast
  update streams.
- Added Firestore-ready account, wallet, material, deposit, filter, summary,
  auth projection, and application failure contracts with JSON round-trips.
- Added canonical profile, wallet, metadata, and activity fixtures. The
  activity fixture derives twelve verified deposits and 3.2 kg of verified
  weight, with separate review and rejected records.
- Added account, wallet, and activity repository seams plus Riverpod providers.

### Verification

- `flutter analyze` passes with no issues.
- Focused Phase 3 tests pass for mock storage, account models, wallet
  projections, activity filtering, async failure/retry, empty activity, and
  fixture integrity.
- No Firebase SDK initialization, network calls, emulator connections, or
  protected Android configuration changes were introduced.
