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
  activity fixture contains twelve verified deposits totaling 26 pcs and 150
  points; its 1.04 kg impact is derived from fixed material conversion
  constants, with separate review and rejected records.
- Added account, wallet, and activity repository seams plus Riverpod providers.

### Verification

- `flutter analyze` passes with no issues.
- Focused Phase 3 tests pass for mock storage, account models, wallet
  projections, activity filtering, async failure/retry, empty activity, and
  fixture integrity.
- No Firebase SDK initialization, network calls, emulator connections, or
  protected Android configuration changes were introduced.

## Phase 4 — Home dashboard and recycling history

**Status:** Completed
**Date:** 16 October 2026

### Completed

- Added repository-composed Home dashboard data with profile greeting,
  wallet/reward progress, derived recycling impact, quick actions, scan CTA,
  and the two newest activity records.
- Added History with typed date/status filter state, inclusive custom-date
  conversion to exclusive calendar boundaries, reset/cancel/apply behavior,
  refresh/error/empty states, and stale-request protection.
- Registered `/home` and `/history`, making Home the normal initial data route.
- Added focused Home and History widget tests while preserving the mock-only
  Firebase boundary.

### Verification

- `dart format --output=none --set-exit-if-changed lib test` passes.
- `flutter analyze` passes with no issues.
- `flutter test` passes all 21 tests.
- `flutter build web` succeeds.
- DTD hot-restart was attempted; no Flutter app was connected in VS Code.
- A post-phase audit added injected clock usage, functional custom date
  pickers, visible refresh-failure feedback, and Home repository stream
  subscriptions. History filter reads remain guarded one-shot operations
  because the mock stream lifecycle left the filter sheet in a settling state
  during widget verification.

## Phase 5 — Recycling guide and configured point-rate content

**Status:** Completed
**Date:** 16 October 2026

### Completed

- Added JSON-round-trippable guide content, material, step, and integer
  points-per-item rate models.
- Added the repository-composed recycling guide fixture with ordered material
  cards, preparation tips, source do/avoid lists, five smart-bin steps, and
  plastic/aluminium/paper rates of 5/8/3 points per item.
- Added the stateful async mock guide repository and Riverpod stream/controller
  seams without Firebase or external service calls.
- Corrected repository persistence so an updated guide remains the source for
  later reads as well as stream emissions; model collections are immutable.
- Added the responsive `/guide` screen, material cards, step list, and rate
  table. Unknown fixture icon keys fall back to the generic recycle icon.
- Registered the guide repository, route, asset manifest entry, and loading
  copy. Home's existing guide quick action now opens the complete guide.

### Verification

- `flutter test test/features/recycling_guide` passes all 3 focused tests.
- `flutter analyze` passes with no issues.
- `flutter test` passes all 25 tests.
- `flutter build web` succeeds.
- DTD discovery and connection were attempted, but the VS Code DTD instance
  had no active Flutter app; hot restart therefore could not connect.

Detailed implementation notes are recorded in
`docs/dev_logs/2026-10-16_App_Phase5RecyclingGuide.md`.
