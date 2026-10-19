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
- Visual checklist started at `docs/archive/FLUTTER_UI_REFACTOR_VISUAL_CHECKLIST.md`.
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

### Pre-retest self-review corrections (2026-10-17)

- Hardened `RouteParameterParsers.calendarDate` against undecodable query
  values (defensive decode, no redirect crash).
- Bell hit region expanded to 48px around the 42px source visual; scan CTA
  title set to the source 15px; Home avatar set to the source 40px.
- `AppPage` applies the viewport minimum to the page content so full-height
  loading/error states (scan session) stay centered.
- Rewards MARKETPLACE eyebrow moved to the shared eyebrow role; History filter
  labels watch the filter provider for immediate updates.
- Added `test/app/route_guards_test.dart` covering pending-URI parking,
  signed-out resume, and malformed-query safety. Suite now 52 tests.

---

## Phase 3 — Rebuild the scan experience as one reliable stateful flow

**Status:** Completed
**Date:** 17 October 2026

### Implemented

- **Fixture-driven classification (3.1):** the scan repository now reads the
  demo QR payload, instructions, bins, classification rules, and material
  rates exclusively from the seeded shared store (`scanConfig`,
  `materialRates`, and the scan datasets added to `MockDataStore`). Points
  derive as `itemCount × pointsPerItem` only for verified, eligible,
  bin-accepted material; ineligible verified classifications downgrade to
  rejected. Distinct `invalidQr` / offline / full-bin / invalid-transition /
  not-found failures, including the `invalid_qr` and `full_bin` scenario
  overrides.
- **Atomic completion (3.1):** new `transactionScan` commits the session,
  result, activity row, wallet credit, and bin capacity increase together on
  copies; failed operations leave every dataset unchanged and replays never
  duplicate credit. Session creation is idempotent per request ID; new
  record IDs use the store's injectable ID factory.
- **Stage visuals (3.2, V04–V08):** one dark 250px `ScannerStage` surface
  with the radial overlay, corner-bracket scanner frame, white outlined bin
  with amber capacity (bin found), READY label (ready), camera-in-pulse-rings
  (item detected), spinning recycle loader (processing), and the green
  verified surface with white check ring (result). Split Accepts/Capacity
  detail row, structured count/material result row, mint EcoPoints-earned
  strip, and outcome-specific titles/copy. Reduced motion falls back to
  static equivalents. SMART BIN SESSION eyebrow, page heading/back control,
  centered flow info, full-width stage actions, and the repository timing
  notice (no user-approved "Complete verification" shortcut — completion is
  automatic; Retry appears only on failure).
- **Leave/resume/recovery (3.3):** app-scoped completion controller and
  active-session tracker in `scan_controller.dart`; pre-processing stages
  register the shared leave guard and present the same cancel-or-continue
  dialog for top Back, system/browser Back (PopScope), and branch changes;
  failed cancellation writes keep the session usable; leaving during
  processing is unrestricted and returning resolves the committed state.
  Route redirects canonicalize stale/future-stage URLs via a synchronous
  store-backed stage peek; unknown session links show actionable recovery.
  The bottom navigation resumes tracked scan work from controller state
  instead of the current route string. `AppButton` labels wrap instead of
  overflowing.

### Verification

- `dart format --output=none --set-exit-if-changed lib test integration_test`
  — clean.
- `flutter analyze` — no issues.
- `flutter test` — 68 tests passed, including the scan acceptance coverage:
  full-fixture baseline (255 balance / 13 verified / 1.09 kg / capacity 85%),
  atomicity + idempotency, rate-driven points, review/rejected no-credit,
  distinct bin/QR failures, failure rollback + retry-once commit,
  stage-distinct rendering, URL canonicalization, missing-session recovery,
  pre-processing leave dialogs (back + branch change), and
  leave-during-processing resume without replayed credit.
- `flutter build web` — succeeded.
- Comparison captures recorded under `docs/refactor_visuals/phase3/`
  (scanner + V04–V08 at 390 logical pixels, real Inter assets); processing
  captured while it actually ran with the controlled longer classification
  delay. Visual checklist updated.
- Phase documented in
  `docs/fix_logs/2026-10-17_FIX_ScanFlow_Phase3StoreDrivenStatefulFlow.md`.

### Remaining Phase 3 notes / deferred

- Capacity still increases on review/rejected completions because the items
  are physically in the bin; recorded as an intentional semantic choice.
- Voucher/guide surfaces remain on their Phase 4 scope; scan reads guide
  rates through the shared store while the guide screen keeps its own
  repository until Phase 4 unifies it.

---

## Phase 4 — Restore Rewards and Guide density and styling

**Status:** Completed
**Date:** 17 October 2026

### Implemented

- **Rewards marketplace (4.1):** replaced the unreachable 560px grid
  breakpoint with a constrained-width breakpoint that renders two compact
  columns at normal 390/480 layouts and falls back to one column below 340
  logical pixels or at enlarged text scales. Cards use content-aware
  metadata/action placement, white bordered surfaces, the bundled outline
  gift icon, and four art-key tone families (sage, pale amber, warm neutral,
  and blue-gray). Category chips and the balance pill remain actionable and
  compact; the Welcome voucher remains immediately below the catalog.
- **Redemption feedback/state (4.2):** all reward catalog family instances
  are invalidated after a successful redemption, not only the selected
  category. The catalog and voucher providers consume the repository's live
  streams, so visited filters receive redemption updates without a manual
  refresh. Successful redemption now shows an in-page success banner with an
  Open voucher action while SnackBars remain available for secondary
  transient feedback. Existing repository idempotency and shared-wallet
  transaction behavior remain unchanged.
- **Guide composition (4.3):** restored the shared LEARN/page-heading
  composition, white recycle medallion, compact two-column material cards,
  mint/pale-red guidance panels, and a vertical numbered step rhythm with a
  connecting line. Added fixture-backed rate examples and a three-column
  Material / Points per pc / Example table; displayed examples are calculated
  with `MaterialRate.pointsFor` (plastic 2 = 10, aluminium 2 = 16, paper
  4 = 12). Intrinsic reward-card sizing avoids a fixed grid aspect ratio;
  the guide table reflows into labeled rows below 360 logical pixels or at
  enlarged text scales, preventing the prior fixed-ratio/column overflow.

### Verification

- `dart format lib test integration_test` — clean.
- `flutter analyze` — no issues.
- Focused Rewards/Guide tests — all passed.
- `flutter test` — passed (full suite, exit code 0).
- `flutter build web` — succeeded.
- No Flutter app was connected to the VS Code DTD, so hot reload/restart and
  live capture were unavailable in this session; the DTD connection was
  established proactively and the visual checklist records the structural
  acceptance evidence.
- Phase checklist updated in
  `docs/archive/FLUTTER_UI_REFACTOR_VISUAL_CHECKLIST.md`.

### Remaining Phase 4 notes / deferred

- Device/browser comparison captures should be produced when a supported
  Flutter target is connected; no new screenshot files are claimed here.
- Voucher deep-link stream hardening and a full connected resident journey
  remain in the plan's broader acceptance work and are not expanded into an
  unrelated repository rewrite in this phase.

---

## Phase 5 — Restore Settings/Profile and close scoped acceptance

**Status:** Implemented
**Date:** 17 October 2026

### Implemented

- **Settings/Profile composition (5.1):** Settings now uses the ACCOUNT
  eyebrow, shared page heading, bordered profile summary card, and one grouped
  bordered action surface with compact outline icons and dividers. Profile
  uses SETTINGS / “Profile & personal details”, a bordered summary card, and a
  distinct editable form reached through Edit profile. The admin demo action
  remains absent and the seeded profile is consistently Faris Rezza / FR.
- **Account interaction lifecycle (5.2):** Profile, password, and preference
  forms retain their previous value while a write is loading or fails. Profile
  saves validate and retry in place; Security includes current/new/confirm
  fields, visibility controls, actionable current-password errors, and draft
  clearing only after success. Preferences provide explicit Save and Cancel.
  Dirty forms register with the shared leave-decision coordinator and guard
  top/system Back and branch changes.
- **Signed-out ownership:** Private account reads and writes now fail with the
  standard unauthenticated failure when signed out. Sign-out emits null private
  projections so account observers cannot retain an apparently valid owner
  record; Continue demo still resolves fresh canonical data.

### Verification

- `dart format lib/features/account` — clean.
- `flutter analyze` — passed with no issues.
- `flutter test test/features/account` — passed: 7 tests.
- Full-suite rerun is required after the updated Profile title assertions.
- Device integration remains unavailable without an attached Flutter target.

### Remaining scoped acceptance

- Complete connected resident journey coverage (including voucher and profile
  update) remains a follow-up acceptance test; no mobile target was connected
  for this phase.
- V12/V13 live comparison captures remain pending; the structural checklist is
  updated by this implementation, while supplied Figma screenshots remain
  immutable.
