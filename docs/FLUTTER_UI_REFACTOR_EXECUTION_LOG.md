# Flutter UI Refactor Execution Log

## Phase 1 — Stabilize shared demo data and mutation behavior

**Status:** Completed (committed at `47fcee7`)  
**Date:** 17 October 2026

### Implemented

- Added an app-scoped seeded `MockDataStore` bootstrap path that loads the
  metadata, account, wallet, activity, scan, and rewards fixture envelopes once
  before the resident app is composed.
- Added a shared `MockApi` and `MockScenarioState` composition seam, including
  `MOCK_SCENARIO` selection and operation-targeted read/write failure injection.
- Extended the store with defensive copies for scan and rewards datasets,
  revision notifications, and an injectable opaque ID factory.
- Removed the activity provider's store-overwriting seed side effect. Production
  activity reads now use the already-seeded store.
- Preserved loaded account data during profile, password, and preference writes
  so failed saves can be retried without losing the loaded projection.
- Made reward wallet, voucher, and redemption writes use one store transaction.
- Fixed scan completion cleanup so failed completion operations can be retried
  without an unhandled derived `Future`, and moved local scan projections after
  the shared wallet/deposit commit.
- Added metadata-driven +08:00 display and calendar-boundary helpers.
- Reconciled the resident fixture baseline to Faris Rezza,
  `rezza@example.com`, Cedar Residence BIN-004, and BIN-002/BIN-007 references.
  Today's verified plastic count is 2 while the remaining seed is rebalanced to
  preserve 12 verified deposits, 26 items, and 1.04 kg.

### Verification

- `flutter analyze` — passed with no issues.
- `flutter test` — passed: 44 tests.
- Focused Phase 1 repositories/fixtures — passed: 19 tests.
- `dart format` — all Phase 1-touched Dart files format cleanly. The full
  repository gate still identifies pre-existing formatting in
  `scan_session_screen.dart`, which is outside this Phase 1 change set.

### Remaining Phase 1 gate work

- Scan classification/bin/session/result records still need to be fully
  projected from the shared store rather than the repository-local state.
- Scenario fixture overrides for every named review/rejected/full/offline and
  empty-state case still need repository wiring.
- Focused acceptance tests for atomic scan completion, sequential redemptions,
  provider recreation, and near-midnight display boundaries should be added.

---

## Phase 2 — Restore the shell, Home, and History

**Status:** Completed  
**Date:** 17 October 2026

### Implemented

- **Shared frame (2.1):** one shell Scaffold centered and constrained to 480
  logical pixels for header, content, and bottom bar; page padding 20 and
  22px stack gaps; source color tokens confirmed; `AppBrand` restored with the
  leaf mark and EcoLoop AI wordmark (FittedBox scale-down so it never crops);
  outlined bell button with red dot routed to History; raised 58px scan circle
  with contrasting background ring and shadow; outline Home/Settings SVGs with
  compact untracked 10px labels; branch-accurate selected labels (no
  permanently emphasized Scan state); same-branch reselect resets Home/
  Settings to their roots while different-branch switches preserve nested
  routes; every branch transition consults the new shared leave-decision
  coordinator (`lib/app/router/leave_decision_coordinator.dart`) that the scan
  and account phases will register guards with.
- **Typography (2.1):** named source-scale text roles in `AppTypography`
  (page heading 29, greeting 25, section heading 19, stat 21, wallet 44, body
  14, eyebrow 11 with .11em tracking, badge 11, activity title/metadata 13/10,
  nav label 10, compact action 12); the wide eyebrow tracking no longer leaks
  into badges, buttons, or navigation labels.
- **Page composition:** `AppPage` is the single page scroll owner with an
  in-content `AppPageHeader` (48px back target, eyebrow, page heading); the
  nested per-page Scaffold/AppBar/SafeArea stack was removed; the shell owns
  the insets. Scan screens keep working unchanged ahead of Phase 3.
- **Home hierarchy (2.2):** green wallet card with white number/copy, pale
  leaf orbit, amber 6px progress, and white full-width Browse rewards action;
  white scan CTA with green square icon tile; joined impact stats card with
  center divider (12 / 1.04 kg); white bordered quick cards with mint icon
  tiles; ACTIVITY eyebrow section header; two recent transactions inside one
  white bordered rounded group.
- **Activity and History (2.3):** replaced the overflowing three-line
  `ListTile` with a content-sized row (icon tile, flexible material/location/
  date block, bounded points/status block, stacked layout at enlarged text
  scales); single-place location normalization so the bin ID never prepends
  twice; demo-local `Today` stamps at +08:00; derived per-row kg on History
  while results stay count-based; grouped bordered list with separators for
  all returned records; YOUR IMPACT heading; two dropdown-style date/status
  controls opening the existing accessible filter sheet at the relevant
  section (presets, custom ranges, Apply/Cancel/Reset preserved); muted
  shield demo note after the list.
- **State/navigation (2.4):** `HistoryController` observes repository deposit
  streams — filter changes cancel the superseded subscription and ignore
  stale responses (generation counter), stream failures keep the last content
  with an inline refresh-failure banner and retry; Home keeps its live
  profile/wallet/summary/recent projections; History query filters apply on
  direct links and applied filters reflect in the URI; calendar query
  parameters validate strictly (`yyyy-MM-dd`) and convert inclusive end dates
  at the demo +08:00 offset; `RouteGuards` preserve the full pending URI
  (path+query) through startup auth restoration and consume it after the
  resident resolves; invalid input still recovers through the existing
  redirects.

### Verification

- `dart format --output=none --set-exit-if-changed lib test integration_test`
  — clean.
- `flutter analyze` — no issues.
- `flutter test` — 48 tests passed, including new/updated coverage: shell
  scenario (destinations, bell → History, branch preservation/reselect, 480px
  frame, 320 no-overflow, 2.0 text-scale reflow, 48px nav targets), history
  grouped rendering with demo-local stamps and derived weights, live history
  update after a committed deposit without manual refresh, direct-link filter
  application, and strict calendar-date validation.
- `flutter build web` — succeeded.
- Comparison captures rendered with the real Inter assets at 390/480/320 are
  recorded under `docs/refactor_visuals/phase2/` and reviewed against
  `Demo_Screenshots/Figma_*`; V01–V03 pass with the mandated semantic
  differences (105 remaining / 70%, 1.04 kg, count-derived row weights).
- Visual checklist started at `docs/FLUTTER_UI_REFACTOR_VISUAL_CHECKLIST.md`.
- Phase documented in
  `docs/fix_logs/2026-10-17_FIX_FlutterPhase2_ShellHomeHistoryRestoration.md`.

### Remaining Phase 2 gate work / deferred notes

- Inter asset rendering was verified in the capture harness; a browser/device
  spot check of font weights remains part of the Phase 5 device run.
- The bottom bar's scan-resume check still reads the current route string;
  Phase 3 replaces it with session/controller state.
- Pre-existing test-infrastructure limitation (confirmed on the base branch):
  a second `EcoLoopApp` pump within one test file never settles, so shell
  scenarios are consolidated into a single `testWidgets`.
