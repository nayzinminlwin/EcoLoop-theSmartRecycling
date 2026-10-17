# Resident Flutter UI refactor — five-phase execution plan

**Status:** Proposed implementation plan; no refactor implementation is claimed here.  
**Prepared from:** `Demo_Screenshots/` (all 13 Figma/Flutter pairs), `FLUTTER_UI_IMPLEMENTATION_AUDIT.md`, and the current Flutter code.  
**Code baseline:** `16c82bd`, with the implementation audited at `569e537`.  
**Target:** Recover approximately 70–80% of the important resident UI/behavior gaps through five bounded phases.

## 1. Outcome and priorities

**Restore the main resident experience first: correct transactions, recognizable Figma layouts, and coherent navigation/state.** Keep the existing Flutter application, repositories, and feature boundaries; repair the implementation rather than restarting the original ten phases.

The five phases are deliberately unequal:

| Order | Phase | Priority | Why it belongs here |
|---|---|---|---|
| 1 | Stabilize shared demo data and mutation behavior | **P0 — correctness prerequisite** | A visually polished app cannot complete its primary journey while scans erase the wallet or subsequent redemptions lock up. |
| 2 | Restore the shell, Home, and History | **P1 — highest repeated visual impact** | Branding, typography, navigation, wallet hierarchy, and activity rows affect nearly every screenshot and every visit. |
| 3 | Rebuild the scan experience as one reliable stateful flow | **P1 — core product experience** | Five supplied pairs show the largest repeated visual substitution; this is also where credit, resumability, and count rules must agree. |
| 4 | Restore Rewards and Guide density and styling | **P1 — high-value secondary journeys** | Two-column rewards, differentiated artwork, guide cards, and the rate table recover large visible gaps without adding new features. |
| 5 | Restore Settings/Profile and close scoped acceptance | **P1 — finish the resident loop** | Match the supplied account screens, retain usable forms, verify sign-out/resume, and demonstrate the connected journey. |

**P0 work is mandatory before dependent presentation work. P1 work is the committed scope of this plan. P2 work is explicitly deferred at the bottom.** Do not consume the five phases with an exhaustive backend-contract rewrite or turn the final phase into a catch-all for unfinished earlier phases.

The 70–80% target is an approximate, user-impact-weighted scope goal, **not a measured pixel-match percentage or a promise to close 75% of audit finding IDs**. This plan targets the prominent differences across every supplied page family plus the blockers underneath them. The deferred portion is primarily exhaustive contract hardening, multi-user simulation, secondary-screen polish, and broader certification.

## 2. Design authority and screenshot interpretation

Apply these rules in order:

1. **Current product rules win for data and behavior:** points are count-based; initial balance 245; baseline scan is 2 pcs PET plastic / +10; derived impact is 1.04 kg initially and 1.09 kg after that scan.
2. **Supplied Figma screenshots establish visual composition:** hierarchy, surfaces, grouping, proportions, spacing, and icon treatment. Use the React/CSS source and the original plan's named tokens to resolve dimensions and colors.
3. **Flutter screenshots demonstrate the current gaps**, not the target appearance.
4. **Functional extension screens**—editable forms, vouchers, dialogs, signed-out UI—use the same resident styling and retain their bounded mock behavior.

### Intentional differences that must remain

- Ignore the Figma scrollbar as requested. It is not a visual requirement; do not add a persistent visible scrollbar to reproduce it.
- Exclude phone bezels, outer gray canvas, camera/notch overlays, capture scaling, and desktop browser chrome from comparison. Compare the app viewport after normalizing width and scroll position.
- Keep computed **105 remaining / 70% toward 350**, rather than the screenshot's hardcoded 55 / 82%.
- Keep **1.04 kg**, rather than the screenshot's historical 3.2 kg.
- Keep **2 pcs / +10** and the balance sequence **245 → 255 → 155**, rather than the old +20/weight-based scan result or stale 265 → 165 documentation.
- The Guide table may regain its three-column structure, but its units must be **points/pc** and its examples must be count-derived. Do not restore `pts/kg`.
- Use consistent initials **FR** for Faris Rezza; do not reproduce Settings' inconsistent AN avatar.
- Omit “Open admin demo” entirely. Keep the resident/admin application boundary.
- Branch selection must reflect the actual destination. Do not reproduce the prototype's permanently emphasized Scan label as a false selected state.
- Processing completes automatically through the mock service. Do not restore the prototype's user-approved “Complete verification” shortcut.
- Keep the coherent full mock history. Do not delete extra transactions merely to make the History screenshot show three rows.
- Compact visuals must retain at least 48-logical-pixel interactive hit regions; a small screenshot is not permission to shrink touch targets.

## 3. Screenshot-derived gap register

For each row, compare `Demo_Screenshots/Figma_<suffix>.png` against `Demo_Screenshots/Flutter_<suffix>.png`. Each row is one actual supplied pair; linked phase ownership makes visual acceptance traceable.

| ID | Exact filename suffix | Observed visual gap | Target / owner |
|---|---|---|---|
| V01 | `HomePage1` | White wallet instead of green; small dark balance; green scan CTA instead of white; progress/button treatment differs; header mark and raised navigation absent | Green wallet with 44px balance, amber progress, white full-width reward action; white CTA with green icon tile; shared shell — **Phase 2** |
| V02 | `HomePage2` | Activity lacks the grouped white bordered container and ACTIVITY eyebrow; repeated bin IDs; timestamp mismatch; visible trailing-badge overflow | Source-style two-row recent card, clean labels, demo-local dates, content-sized rows — **Phase 2** |
| V03 | `RecyclingHistoryPage` | Dense ungrouped ListTiles; every trailing column overflows; filter affordances reduced to one icon; impact eyebrow and explanatory note absent | Grouped activity list, two visible date/status controls, YOUR IMPACT heading, note banner — **Phase 2** |
| V04 | `RecyclingProcess_1` | Bin-found stage uses short pale bin illustration; missing SMART BIN SESSION/back composition, capacity emphasis, centered status/details; location differs | Dark stage surface, outlined bin, amber 65%, centered BIN-004 content, split details, full-width Confirm session — **Phase 3** |
| V05 | `RecyclingProcess_2` | Ready stage repeats pale illustration; READY label absent; instructions/actions lack source grouping | Dark bin/READY visual; centered instruction block; “I pressed the finish button” action — **Phase 3** |
| V06 | `RecyclingProcess_3` | Detected stage still shows a bin; camera/pulse illustration absent | Dedicated camera visual with subtle pulse rings and Continue action — **Phase 3** |
| V07 | `RecyclingProcess_4` | Processing stage repeats bin icon and lacks source processing badge/visual hierarchy | Dark recycle/identification visual, Processing badge, timing/help copy, automatic completion and error-only Retry — **Phase 3** |
| V08 | `RecyclingProcess_5` | Result still shows bin icon and generic white result card; missing success ring, earned-points strip, structured count/material, Back to home | Green verified/check stage, status-specific result copy, count-based result row, earned-points strip, Home action — **Phase 3** |
| V09 | `RewardPage` | One tall card per row instead of four compact cards in 2×2; artwork all sage; bordered Material chips; vouchers pushed far below first viewport | Two columns at normal 390/480 widths, four art tones, compact category chips, visible lower voucher section at comparable scroll/height — **Phase 4** |
| V10 | `HowToRecyclePage1` | Missing back/title composition; hero lacks white icon medallion; typography/card sizing differs; do/avoid backgrounds absent | Restore header, hero, compact material grid, separate mint/red guidance panels — **Phase 4** |
| V11 | `HowToRecyclePage2` | Steps/table have different density; rate table lacks examples; typography and footer spacing differ | Source-like step rhythm and three-column count-based rate table; readable muted disclaimer — **Phase 4** |
| V12 | `SettingPage` | No ACCOUNT eyebrow/profile card/grouped settings container; large ungrouped icon rows; identity differs; sign-out styling differs | White profile card, compact separated settings rows, consistent identity, themed sign-out without admin control — **Phase 5** |
| V13 | `Setting_PersonalDetailsPage` | Disabled input boxes replace the designed profile summary; title/back/eyebrow hierarchy differs | Read-only profile summary card and Edit profile button; actual fields only in edit mode — **Phase 5** |

**Shared issue across all pairs:** the plain EcoLoop heading, Material icon substitutions, over-heavy/loosely tracked labels, inset/spacing inconsistencies, and non-raised Scan affordance amplify otherwise local differences. Fix their shared origins in Phase 2 instead of tuning every screen independently.

The supplied process pairs start at **bin found**, not the QR scanner. The scanner remains a required stage and must be checked against the existing source/plan as part of Phase 3; no screenshot evidence is claimed for a missing pair.

## 4. Execution boundaries and common gates

### Preserve the established application boundaries

- Keep `flutter_riverpod`, `go_router`, offline Inter, and bundled SVGs. No new state-management/navigation framework is needed.
- Keep the existing single route table and Home/Scan/Settings branches. Maintain all 18 route patterns.
- All service behavior stays mock-only, asynchronous, deterministic, and process-local. No camera/QR plugin, HTTP service, Firebase runtime activation, or live uploads.
- Preserve `android/build.gradle.kts`, `android/app/build.gradle.kts`, and `android/app/google-services.json`; compare their SHA-256 values against the audit baseline before and after implementation.
- Preserve the original screenshot folder and audit as evidence. Store new comparison captures separately.
- Check current git status before each phase. Enforce separate, clean git commits after every completed phase or request before starting subsequent work; do not commit unrelated or unverified changes.

### Shared implementation approach

- Reuse domain classes and repository interfaces. Add only the small internal store/controller/visual pieces named below; avoid a new generic data framework.
- Put shared geometry, colors, component-specific text roles, and copy in their existing centralized files. The eyebrow's wide tracking must not leak into ordinary badge/button/navigation labels.
- Prefer one shell Scaffold and one page scroll owner. A page title is content, not a second app-wide AppBar. Audit nested `Scaffold`/`SafeArea` use before removing it; preserve keyboard behavior.
- One canonical store commit owns related wallet/activity/bin/session/result or wallet/redemption/voucher changes. Publish one revision **after** success; never mutate repository-private persisted caches ahead of a commit.
- Displayed live data uses repository streams with safe initial subscription, defensive snapshots, and cleanup. Explicit refresh keeps last successful data visible.
- Keep saved data, editable drafts, and write status separate. A write failure must not become an initial-read error screen.

### Per-phase verification, documentation, and commit workflow

Every phase and task update MUST complete the following verification, documentation, and commit steps:

1. **Automated and Visual Quality Gates:**
   - Run focused tests for changed business/state behavior and affected width/layout regressions.
   - Run `dart format --output=none --set-exit-if-changed lib test integration_test`, `flutter analyze`, and `flutter test` before closing the phase.
   - Run `flutter build web` at the presentation milestones (Phases 2–5), and earlier if bootstrap/assets change.
   - Review the phase's screenshot pairs **during that phase**, not only at the end. Record pass/fail plus deliberate semantic differences.
   - A failed gate remains open. Screens/files merely existing is not acceptance.

2. **Mandatory Documentation in Fix Logs & Execution Log (Enforced for Every Task):**
   Agents must maintain two simultaneous documentation layers—neither can be omitted:
   - **Keep refactor-specific living docs:** Do NOT stop writing or delete `docs/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md` (created in Phase 1) or `docs/FLUTTER_UI_REFACTOR_VISUAL_CHECKLIST.md` (created in Phase 2). Keep appending phase status, verified deliverables, and remaining gate work to them. Record new comparison captures under `docs/refactor_visuals/`.
   - **Enforce `docs/fix_logs/` documentation:** Since this is an active refactor plan, every phase and correction MUST produce or append a fix log in `docs/fix_logs/` using `.agent/templates/fix_log_template.md`. Naming convention: `[YYYY-MM-DD]_FIX_[ModuleName]_[ShortBugOrRefactorDescription].md`. For follow-up corrections on the same phase/scope, append under `## 📝 APPENDED FOLLOW-UP FIXES` in the existing fix log instead of creating duplicate files. Document trigger, root cause, changed files, verification results, and status.

3. **Mandatory Git Commit Policy (Enforced After Every Phase & Update):**
   Agents MUST commit all changes after each phase or request before moving to any subsequent phase or reporting completion:
   - **Commit after each update/phase:** Do not leave uncommitted files or roll multiple phases into a single uncommitted working tree.
   - **Check open issues:** Run `gh issue list --repo nayzinminlwin/EcoLoop-theSmartRecycling` to find relevant open issues.
   - **Format commit messages strictly:**
     - If linked to an open issue: `#[issueID] [titleCode] : [your commit message]` (e.g., `#3 P1 : Stabilize shared demo data and mutation behavior`).
     - If not linked to an open issue, use conventional semantic commit message format (e.g., `refactor(phase1): stabilize shared demo data and mutation behavior`).
   - **Never skip committing:** Committing is mandatory before advancing to the next phase implementation unless the moderator explicitly requests not to commit.

## Phase 1 — Stabilize shared demo data and mutation behavior

**Priority:** P0  
**Dependency:** None  
**Scope boundary:** Fix the data spine and existing write paths required by the five-phase resident journey. Complete Firestore adapter serialization and multi-user simulation remain deferred.

### Work, in priority order

**1.1 Repair the confirmed transaction/UI blockers immediately.**

- Fix the flat-wallet alias/clear bug in scan completion; retain the wallet document and required fields.
- Reset redemption busy state after success/failure and on a new dialog attempt. Keep one stable idempotency key per attempt/retry and allow a different eligible reward afterward.
- Remove the unhandled derived Future from scan completion cleanup; keep per-session in-flight deduplication and allow retry after failure.
- Change profile/security/preference controllers to retain loaded/saved data and track write state separately. Preserve drafts and expose inline save retry; keep typed wrong-password errors on the actual field.

**1.2 Seed fixtures once before the repositories serve resident data.**

- Load metadata, profile, wallet, activity, bins, scan instructions/classifications/sessions/results, guide/rates, and rewards/categories/vouchers/redemptions into the app-scoped store through one initialization path.
- Remove production fixture records from `app_providers.dart` and the lazy `replaceDeposits` side effect. Reopening a screen/provider must never reseed a changed dataset.
- Treat fixture envelopes as loading formats; retain flat persisted rows internally and derive read models in repositories.
- Reconcile the baseline to Faris Rezza / `rezza@example.com`, BIN-004 Cedar Residence · Ground Floor accepting plastic/aluminium, and matching BIN-002/BIN-007 references.
- Preserve 12 verified deposits / 26 items / 1.04 kg. When correcting today's record from 4 to 2 plastic items, rebalance the remaining seed consistently; do not change totals by hardcoding summary output. Keep the separate review/rejected records and document historical glass credit if retained.

**1.3 Establish a bounded shared commit/revision mechanism.**

- Extend `MockDataStore` to include the datasets used by scan, rewards, and account preferences/security/session. Retain its defensive-copy pattern.
- Serialize transactions, work on copies, validate first, then commit all affected rows together. A failed operation leaves all datasets unchanged; an idempotent replay does not publish another mutation.
- Add an injectable opaque string ID factory for new non-user records. Do not allocate Auth UIDs or derive entity IDs from list lengths.
- Implement safe delayed initial snapshots plus post-commit projections for streams used by this plan. Subscribe before initial projection so a write cannot disappear between initial read and change subscription; deduplicate unchanged projections.
- Wire disposal of store/repository subscriptions through their providers. Do not add a second direct fetch beside each live revision.

**1.4 Make the shared rules/scenario seam usable.**

- Read clock/locale/+480-minute display offset from metadata; normalize domain instants and convert display/calendar boundaries without using the host timezone.
- Expose one injected `MockApi`/scenario configuration through composition. Support named read/write failure-once targeting.
- Provide documented selection for `normal`, `review_deposit`, `rejected_deposit`, `invalid_qr`, `full_bin`, `empty_activity`, `empty_rewards`, `no_vouchers`, and `zero_balance`; allow offline-bin and expired/used-voucher fixture overrides in tests.
- Make `--dart-define=MOCK_SCENARIO=<key>` actually select the configured scenario. Keep operation failures independently injectable so an incidental first read cannot consume the wrong failure.
- Validate numbers/invariants used in these mutations: nonnegative wallet/version/costs, positive item count, valid capacity and outcome/points consistency. Leave the exhaustive general-purpose map validation sweep to the deferred backlog.

### Primary file ownership

- `lib/app/bootstrap.dart`, `lib/app/providers/app_providers.dart`
- `lib/core/mock/{mock_data_store,mock_seed_loader,mock_api,mock_scenario,app_clock}.dart`
- `lib/core/presentation/app_formatters.dart`
- `lib/features/{account,activity,wallet,scan,rewards,recycling_guide}/data/` as needed to consume the shared store
- `lib/features/account/presentation/controllers/{profile,security,notification_preferences}_controller.dart`
- The three corresponding account screens for minimal write-state/inline-error wiring; their visual redesign stays in Phase 5
- `lib/features/rewards/presentation/screens/rewards_screen.dart` for the minimal busy-state repair
- Existing `assets/mock/` datasets, `pubspec.yaml` only if an asset declaration changes
- Existing repository tests; add focused shared-store mutation/scenario tests and account failure/retry widget coverage

### Acceptance gate

- [ ] Flat-wallet scan completion produces balance **255**, version +1, one result/activity row, and valid wallet fields; replay produces no additional changes.
- [ ] Snack redemption after that produces **155**, one issued voucher, and leaves the Welcome voucher intact.
- [ ] Two sequential different redemptions work with a sufficiently funded override; the second dialog is idle and cancellable before submission.
- [ ] Injected scan/redemption failure leaves every affected dataset unchanged; retry commits once; no unhandled Future error escapes.
- [ ] Failed profile/password/preference writes keep form content and draft visible; correcting a password or retrying a save works without reopening the page.
- [ ] Seed initialization occurs once, including for scan-first startup; provider recreation cannot overwrite a new deposit.
- [ ] The same instant displays at +08:00, including a near-midnight calendar-boundary test.
- [ ] Scenario selection reaches the production composition path, not just isolated repository constructors.
- [ ] Task documented in `docs/fix_logs/` using `.agent/templates/fix_log_template.md` AND progress recorded in `docs/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md`.
- [ ] Phase 1 changes formatted, analyzed, tested, and committed cleanly to git before advancing to Phase 2.

**Audit coverage:** F01, F02, the write-state core of F06/F16, foundational portions of F03/F09/F11/F12/F17.

## Phase 2 — Restore the shell, Home, and History

**Priority:** P1, immediately after P0  
**Dependency:** Phase 1  
**Screenshot ownership:** V01–V03; shared chrome for V04–V13.

### Work, in priority order

**2.1 Restore the common visual frame once.**

- Center and constrain the **entire shell**, including header/bottom bar, to 480 logical pixels. On narrower viewports fill available width; keep page padding 20 and source stack gaps near 22.
- Use source-derived primary `#176B45`, background `#F8FAF6`, white surfaces, border `#E2E8E0`, and semantic amber/red/mint tokens.
- Restore `AppBrand` with leaf mark and EcoLoop AI wordmark, outlined bell button and dot; bell routes to History. Ensure the wordmark is not cropped by app layout.
- Restore the raised 58px Scan circle, contrasting outer ring and shadow, aligned Home/Settings outline SVGs, and compact untracked navigation labels. Make the full navigation hit region accessible.
- Use a single top-inset/header owner and bottom-inset owner; avoid duplicate page AppBars/insets. Keep content scrollable above the reserved bottom bar.
- Introduce named text roles for page heading, home greeting, eyebrow, wallet number, activity metadata, badge, and nav label. Verify local Inter assets/weights render; do not compensate for a font problem by changing every widget's spacing.
- Use the original source token scale (page heading 29, greeting 25, section heading 19, wallet 44, body 14, metadata/labels 10–13) as the starting point at normalized viewport size. Do not copy raw screenshot pixel sizes or blanket-apply extra-bold/letter-spaced text.

**2.2 Restore Home hierarchy.**

- Green rounded wallet card, white number/copy, pale leaf orbit, amber progress, and white full-width Browse rewards button with trailing arrow.
- White scan CTA with green square scan icon, title/subtitle, trailing arrow, radius/shadow matching the source; preserve its working scan route.
- Compact joined impact card with divider; keep derived 12 / 1.04 kg.
- White bordered guide/history quick cards with mint icon tiles, appropriately weighted labels, and source spacing.
- ACTIVITY eyebrow plus section heading/action, and two recent transactions inside one white bordered rounded group.

**2.3 Replace the overflowing activity layout and restore History.**

- Replace constrained three-line `ListTile` trailing columns with an explicitly content-sized row: icon, flexible material/location/date block, and bounded points/status block. At enlarged text, allow a stacked amount/status layout instead of overflow.
- Normalize location formatting once so `BIN-004` is not prepended twice. Use demo-local Today/date/time copy; show derived kg per History row, while result records remain count-based.
- Restore YOUR IMPACT heading and two visible date/status dropdown-style controls. They may use the existing accessible filter sheet, opened to the relevant section; preserve presets, custom ranges, Apply/Cancel/Reset.
- Put all returned History records into a grouped bordered list with separators; add the muted shield/explanatory note after the list. Do not truncate the canonical data to match the shorter prototype.
- Keep previously loaded content during refresh; distinguish initial loading/error, empty success, and inline refresh failure.

**2.4 Connect the state/navigation needed by these pages.**

- Home and History observe committed profile/wallet/activity projections. Filter changes switch/cancel the correct History subscription and ignore stale responses.
- Apply History query filters on direct link, and reflect applied filters in the URI; strictly validate calendar dates/ranges and convert inclusive end dates using the demo offset.
- Preserve the full pending URI through startup auth restoration; test resource/query direct links before auth resolves.
- Preserve another branch's nested route on branch switch; reset Home/Settings only on same-branch reselect. Define one leave-decision hook that the scan and account phases will register with; do not duplicate branch-specific confirmation dialogs in the bottom bar.
- Implement deterministic Back fallback for Home-owned guide/history/rewards/voucher routes without inventing extra navigation state.

### Primary file ownership

- `lib/app/presentation/{resident_shell,resident_top_bar,resident_bottom_navigation}.dart`
- `lib/app/router/{app_router,route_guards,route_parameter_parsers}.dart`
- `lib/core/theme/`, `lib/core/presentation/{app_copy,app_formatters}.dart`
- `lib/shared/widgets/{app_page,app_page_header,app_brand,app_button,app_badge,app_progress_bar}.dart`
- `lib/features/home/presentation/`
- `lib/features/activity/presentation/`
- `lib/features/{account,wallet,activity}/presentation/controllers/` for live providers
- `test/app/`, `test/features/home/`, `test/features/activity/`
- New small app-level leave-decision coordinator only if existing router/controller hooks cannot own it cleanly

### Acceptance gate

- [ ] At 390/480 widths, Home has the green wallet, white CTA, compact impact/quick cards, and grouped recent activity shown by the reference hierarchy.
- [ ] At desktop width, header/content/nav share the centered 480px frame; at 320 no horizontal clipping or trailing activity overflow occurs.
- [ ] At text scales 1.0 and 1.3, activity points/status/date remain readable; at 2.0 layout may reflow but core controls/content are not clipped.
- [ ] Correct wallet remains **245 / 105 remaining / 70%**, not the prototype's invalid progress.
- [ ] Home/History timestamps use +08:00; each location includes its bin ID once.
- [ ] Already-open History and Home update after a repository deposit without manual refresh.
- [ ] `/history?status=review&from=2024-05-01&to=2024-05-20` actually filters and survives refresh; invalid input recovers predictably.
- [ ] Cold-start settings/voucher links reach their requested destination after auth restoration; bell opens History.
- [ ] V01–V03 comparison captures and shared-shell checklist are reviewed before proceeding.
- [ ] Task documented in `docs/fix_logs/` using `.agent/templates/fix_log_template.md`, with `docs/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md` and `docs/FLUTTER_UI_REFACTOR_VISUAL_CHECKLIST.md` updated.
- [ ] Phase 2 changes formatted, analyzed, tested, and committed cleanly to git before advancing to Phase 3.

**Audit coverage:** F07, F08, F12 for displayed surfaces; Home/History parts of F05/F14/F15; navigation foundation of F04.

## Phase 3 — Rebuild the scan experience as one reliable stateful flow

**Priority:** P1 — core feature  
**Dependency:** Phases 1–2  
**Screenshot ownership:** V04–V08, plus the QR scanner from source/plan.

### Work, in priority order

**3.1 Connect fixture-driven classification to the state machine.**

- Read QR payload/instructions/bin/classification rules from the initialized store, not Dart constants or widget-local arrays.
- Validate the actual requested bin and availability at lookup, session creation, and confirmation. Return distinct invalid QR, missing/offline/full bin, and invalid transition failures.
- Derive points as `itemCount × pointsPerItem` only for verified, accepted, eligible material. Unknown/review/rejected outcomes cannot credit the wallet. No screen approves eligibility.
- Commit session/result/activity/wallet/bin capacity atomically through Phase 1's store. Apply configured capacity increase to the current value, clamped at 100; replay must not increase it twice.
- Observe session/bin/result by ID, subscribe to a result only after `resultId` exists, and canonicalize stale/future-stage URLs to committed stage state.
- Let completion live at app/session-controller scope; leaving the widget must not cancel completion or suppress the state update.

**3.2 Replace the generic bin placeholder with a stage-aware visual.**

| Stage | Required presentation | Required action |
|---|---|---|
| Scanner | Dark 250px rounded surface, corner frame, scan SVG, camera-simulation caption | Simulate QR scan; Cancel/back |
| Bin found | Dark surface, white outlined bin, amber capacity percentage; centered BIN-004 badge/location; split accepts/capacity detail row | Confirm session |
| Ready | Dark bin visual with READY label; centered physical-finish instructions | I pressed the finish button |
| Item detected | Camera SVG inside subtle mint pulse rings; centered status/description | Continue |
| Processing | Recycle/identification animation on dark surface; amber Processing badge; useful timing/help copy | Automatic completion; Retry only on error |
| Result | Verified green surface/check ring; outcome-specific alternatives for review/rejection; structured `2 pcs • PET plastic`; earned-points strip | Back to home; optional new scan through existing route policy |

- Restore SMART BIN SESSION eyebrow, page title/back control, centered information block, source radii/spacing, and full-width primary actions.
- Keep stage content near the top with natural remaining whitespace, as shown in the references; do not vertically center the whole page.
- Use the timing notice from repository content, distinguishing mock immediate credit after verification from eventual production timing. Do not let old copy contradict the actual success state.
- Respect reduced motion with a static/low-motion equivalent; animation never drives transaction state.

**3.3 Close scan leaving/resume and recovery behavior.**

- Register pre-processing leave/cancel decisions with Phase 2's navigation hook for top Back, system/browser Back, and branch change. Confirm cancellation or continue the session; catch failed cancellation writes and stay usable.
- While processing, allow leaving without cancellation; revisiting Scan resolves the actual current session/result.
- Scan selection resumes unfinished work from controller/session state, rather than checking only the current route string. Completed/cancelled work returns to scanner for a new request ID.
- Bin/result read failures show an actionable error/Retry or missing-resource recovery, never an indefinite spinner. Do not create service Futures inside repeated builds.

### Primary file ownership

- `lib/features/scan/data/mock_scan_repository.dart`
- `lib/features/scan/presentation/controllers/scan_controller.dart`
- `lib/features/scan/presentation/screens/{scan_screen,scan_session_screen}.dart`
- `lib/features/scan/presentation/widgets/{scanner_frame,bin_session_visual,bin_details_card,deposit_result_card}.dart`
- Scan fixture files and guide material-rate access through repositories/store
- Router/shell leave hook and branch resume callbacks
- `test/features/scan/`, shared-store tests, focused scan navigation tests

Keep the visual in one stage-aware feature widget, or split only genuinely distinct illustrations; do not duplicate the complete screen six times.

### Acceptance gate

- [ ] V04–V08 are recognizably different stages and match the source compositions, not recolored copies of the same bin.
- [ ] Scanner is the entry point; no stage can be skipped by typing a URL; missing session links offer recovery.
- [ ] Normal result shows **2 pcs / +10**, wallet **255**, 13 verified deposits, **1.09 kg**, and baseline capacity **85%**.
- [ ] Changing a configured count/rate changes earned points without editing UI/repository literals.
- [ ] Review/rejection create correctly labeled activity with no credit or verified-impact increase; invalid/full/offline bins cannot begin/confirm an eligible session.
- [ ] Duplicate create/finish/complete calls and revisiting result cannot duplicate credit or activity.
- [ ] Injected completion failure retains processing and supports retry once; bin/result failures do not leave a spinner forever.
- [ ] Leave during processing, return after completion, and see the actual completed result without replaying credit.
- [ ] Pre-processing Back and branch change both present the same cancel/continue decision.
- [ ] Capture processing while it actually runs, using a controlled longer classification delay for review rather than adding a manual completion button.
- [ ] Task documented in `docs/fix_logs/` using `.agent/templates/fix_log_template.md`, with `docs/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md` updated.
- [ ] Phase 3 changes formatted, analyzed, tested, and committed cleanly to git before advancing to Phase 4.

**Audit coverage:** F03, scan portions of F04/F05/F15/F16, and transaction/fixture portions of F17.

## Phase 4 — Restore Rewards and Guide density and styling

**Priority:** P1  
**Dependency:** Phases 1–3  
**Screenshot ownership:** V09–V11.

### Work, in priority order

**4.1 Recover the 2×2 reward marketplace.**

- Replace the unreachable 560px two-column threshold with breakpoints derived from the constrained content width. At normal text scale, show two columns at 390 and 480; at 320 or larger text, fall back if required for readability.
- Use content-aware/minimum card height rather than a fragile fixed aspect ratio. Avoid solving overflow by hiding cost, eligibility, or action labels.
- Match white bordered cards, compact metadata, full-width action, and four art-key tone families: sage, pale amber, warm neutral, and blue-gray. Use the bundled outline gift icon, not one identical art block for every reward.
- Restore compact category chips and the leaf/balance pill; keep actionable selected/disabled states without default Material checkbox/checkmark decoration dominating the design.
- Keep My vouchers below the four-card catalog at a comparable scroll position. Restore the bordered/dashed-style Welcome voucher tile, icon, expiry metadata, and View all action. Do not hardcode a viewport height to force all content onscreen.
- Show a source-style in-page success banner plus Open voucher after redemption; reserve SnackBars for secondary transient feedback such as clipboard copy.

**4.2 Make reward/voucher state reliably live.**

- Observe the same wallet projection as Home and live catalog/voucher streams, including filtered categories/statuses. Eliminate current-category-only invalidation gaps.
- Derive reward counts by resident and reward; scope idempotency to the demo owner/attempt. Use the same current catalog for sorted next-reward thresholds and eligibility.
- Resolve current reward/cost/balance before confirmation and recheck in the repository. Keep the dialog open with inline failure and a stable retry key; allow Cancel except during the actual write.
- Seed detail streams before initial projection; existing voucher deep links must not flash permanent missing state because no list was opened first.
- Synchronize category/status URL changes with provider state on navigation updates, not just `initState`.
- Keep voucher list/detail visually consistent using shared headers and cards, but avoid a separate redesign of extension pages without supplied references.

**4.3 Restore Guide grouping and compact content.**

- Use the shared back/LEARN/page-heading composition and a sage hero with white circular recycle medallion.
- Restore material cards with compact mint icon tiles, clear title/tip hierarchy, and two-column layout at normal 390/480 widths.
- Eliminate the fixed-aspect-ratio overflow at 320; support one column or flexible card height and enlarged text.
- Put To-do in a mint rounded panel and To-avoid in a pale-red rounded panel, with their distinct icon/text tones.
- Restore the vertical step rhythm/connecting line and compact numbered circles.
- Restore three-column **Material / Points per pc / Example** presentation. Use plastic 5 with 2 pcs = 10; aluminium 8 with 2 pcs = 16; paper 3 with 4 pcs = 12. Store example counts in guide content/read data rather than widget-local fake lists; calculate displayed example points from the same rate rules used by scan.
- Keep the repository disclaimer and all guide lists data-backed. At narrow/text-scaled widths, allow the table to reflow into labeled rows rather than clip text.

### Primary file ownership

- `lib/features/rewards/presentation/{controllers,screens,widgets}/`
- `lib/features/rewards/data/mock_rewards_repository.dart`
- `lib/features/wallet/data/mock_wallet_repository.dart`
- `lib/features/recycling_guide/presentation/{screens,widgets}/`
- Guide composed/read content models and `assets/mock/recycling_guide/guide.json` for count examples only; keep persisted material-rate fields unchanged
- Shared theme/art tokens and existing feedback/dialog components
- `test/features/rewards/`, `test/features/recycling_guide/`, `test/features/wallet/`

### Acceptance gate

- [ ] V09: at normal 390/480, four rewards form a balanced 2×2 grid, each art tone differs, actions/costs are visible, and My vouchers is no longer pushed below four tall full-width cards.
- [ ] At 320 and enlarged text, responsive layout prevents clipped titles/actions; semantic reading order follows visual order.
- [ ] Scan changes the already-visited Rewards wallet; redemption changes Home and all visited catalog/voucher filters without manual refresh.
- [ ] Snack redemption from **255** yields **155** and a new voucher; second eligible redemption works with a funded override; no overspend or duplicate debit occurs.
- [ ] A cold valid voucher detail link resolves; copy/open never consumes the voucher; category/status URLs and browser changes select the displayed filter.
- [ ] V10/V11: guide has the icon medallion, two guidance panels, compact steps, and count-based example column.
- [ ] Guide has no RenderFlex overflow at 320/390/480; scan and table agree if a rate changes.
- [ ] Loading/read error/empty catalog/no vouchers/zero-balance states remain intentional and retryable where appropriate.
- [ ] Task documented in `docs/fix_logs/` using `.agent/templates/fix_log_template.md`, with `docs/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md` updated.
- [ ] Phase 4 changes formatted, analyzed, tested, and committed cleanly to git before advancing to Phase 5.

**Audit coverage:** reward/guide portions of F05/F09/F11/F14/F15/F17; maintains the F02 repair.

## Phase 5 — Restore Settings/Profile and close scoped acceptance

**Priority:** P1  
**Dependency:** Phases 1–4  
**Screenshot ownership:** V12–V13; final review of earlier accepted pairs.

### Work, in priority order

**5.1 Restore the two supplied account compositions.**

- Settings: ACCOUNT eyebrow and page heading; white bordered profile card with avatar/name/email; one white rounded settings group with dividers and compact outline icons/trailing arrows.
- Remove large default ListTile-style subtitles/icon circles from the reference-facing landing layout unless essential content requires them. Keep longer helper content within the detail screens.
- Use consistent Faris Rezza / FR profile data from the repository. Make Sign out a quiet full-width/ghost-style resident action at the source-like spacing; omit the prototype's admin button.
- Profile view: SETTINGS eyebrow, title “Profile & personal details,” bordered Back action, summary card with icon/name/email, then full-width Edit profile. Do not use disabled input fields as the view state.
- Profile edit: show editable fields using the shared form styling; Save/Cancel restores the summary or saved values appropriately, without changing the designed view-mode layout.

**5.2 Finish existing account interaction/lifecycle behavior.**

- Use Phase 1's separate write state for profile, password, and preferences. Keep form drafts through failure and clear password drafts after successful save.
- Security: retain its metadata summary and a Change password entry action; form includes current/new/confirm, visibility controls, validation, and meaningful Retry/error feedback.
- Preferences: explicit Save and Cancel; saved switches survive route changes; Cancel restores saved state. No OS push permission or delivery feature.
- Register dirty profile/password/preferences forms with the shared leave-decision policy for top/system/browser Back and branch changes.
- On sign-out, await a single disabled-while-pending operation, clear owner-scoped presentation/form caches and branch stacks, and emit null/empty owner projections. Private one-shot reads fail as unauthenticated rather than returning cached owner records.
- Continue demo restores the same demo owner through fresh reads, preserving canonical wallet/history/profile changes. This is single-resident lifecycle correctness; a multi-resident claim-switch simulator remains deferred.

**5.3 Prove the chosen scope and reconcile its documentation.**

- Expand the connected journey through History, redemption, voucher detail, profile edit, and Home; repair the old exact-text assertions for duplicated Settings labels and My vouchers.
- Use a connected widget test with real shared mock repositories for the normal journey as well as the device integration test, so the logic remains executable in this workspace without a mobile target.
- Run focused recovery journeys: named read retry; classification/redemption/profile write failure → inline retry → exactly one commit; scan cancellation/resume; sign-out → protected cold link blocked → Continue demo.
- Recheck all V01–V13 entries using the captures completed by their owning phases. Correct regressions in shared components; do not postpone missing Phase 2–4 deliverables into this phase.
- Update README scenario commands, acceptance status, execution log (including the missing original Phase 6 entry), and actual mock-contract limitations. Correct stale count arithmetic and distinguish verified/pending/deferred evidence.

### Primary file ownership

- `lib/features/account/presentation/{controllers,screens,widgets}/`
- `lib/features/account/data/mock_account_repository.dart` for demo sign-out/read ownership behavior
- Other owner-scoped mock repositories where signed-out null/empty streams or unauthenticated read guards must be enforced
- Owner-scoped providers and router/leave-decision integration
- `test/features/account/`, `test/app/`, connected resident-journey widget coverage
- `integration_test/resident_journey_test.dart`
- `README.md`, `docs/FLUTTER_UI_ACCEPTANCE.md`, `docs/FLUTTER_UI_EXECUTION_LOG.md`, `docs/FLUTTER_MOCK_CONTRACTS.md`
- Refactor execution log, visual checklist, and new comparison captures

### Acceptance gate

- [ ] V12/V13 match the profile/settings grouping and view-mode hierarchy; FR is consistent on Home/Settings/Profile and no admin action exists.
- [ ] Profile save updates Home and Settings; Cancel/discard preserves the correct saved data; failed saves leave visible editable drafts.
- [ ] Wrong current password remains an actionable field error; corrected password succeeds; visibility controls and preference Save/Cancel work.
- [ ] Dirty forms prompt on Back and branch change; sign-out clears private observations/drafts and blocks protected links; resume preserves committed data.
- [ ] Complete normal journey passes: **Home 245 → Guide → all scan stages → 255 / 13 / 1.09 kg → History new record → snack redemption 155 → issued voucher → update name → Home updated name**.
- [ ] Main recovery/navigation cases pass using the shared production composition and deterministic overrides, not fake per-screen datasets.
- [ ] Each visual pair has a reviewed capture/status; intentional semantic differences are recorded, not reported as defects or silently copied from the prototype.
- [ ] All common checks pass; a device run has a real result or an explicit unavailable-target record. A web build is never reported as a device integration pass.
- [ ] Final refactor updates documented in `docs/fix_logs/` using `.agent/templates/fix_log_template.md`, with `docs/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md` finalized.
- [ ] All final changes formatted, analyzed, tested, and committed cleanly to git before reporting completion.

**Audit coverage:** F04/F06 for account behavior, single-resident portions of F10, Settings/Profile portions of F15, scoped F18/F19.

## 5. Visual and journey acceptance protocol

Use this throughout the five phases; it is not an additional phase.

### Capture protocol

1. Capture the Flutter **app viewport only** at 390 and 480 logical pixels, text scale 1.0, normal fixtures, and a fixed demo clock. Record actual viewport size/device pixel ratio.
2. Normalize the Figma app viewport to the same width for comparison. Do not stretch width and height independently or compare phone-frame screenshots pixel-for-pixel.
3. Capture matching top/scroll positions for HomePage1/2 and HowToRecyclePage1/2; keep header/bottom bar visible. Use controlled process latency to capture processing before it completes.
4. Review major surface colors, order/grouping, card proportions, title hierarchy, icon identity, text wrapping, spacing, and fixed chrome. Record numerical/copy differences that follow the count-based rules.
5. Spot-check 320 width and 1.3/2.0 text scale for overflow/reflow; check a wide browser for the centered 480px shell.
6. Save captures under descriptive names such as `docs/refactor_visuals/phase2/home_390_top.png`; link each capture in the visual checklist to V01–V13 and its source pair. Keep screenshot evidence immutable in `Demo_Screenshots/`.

No arbitrary “80% pixel similarity” threshold is required. A page passes when its specified structural/color/hierarchy gaps are resolved, text/actions remain usable, and remaining differences are explicitly accepted or deferred. Do not approve new screenshots solely because snapshot tests were regenerated.

### Minimum meaningful automated coverage

| Area | Required evidence | Owning phase |
|---|---|---|
| Mutation correctness | Shared-store wallet/deposit/result/capacity atomicity, redemption idempotency/concurrency, failure rollback | 1, extended in 3/4 |
| Visible failure recovery | Failed account write retains editable form; scan errors yield Retry; second redemption returns idle | 1, extended in 3/5 |
| Responsive regressions | Activity trailing layout at 320; constrained shell; guide cards/table; reward grid at 390/480 and reflow | 2, 4 |
| Reactive state | Pre-open History/Rewards/filter pages, perform scan/redemption, then verify coherent updates | 2–4 |
| Navigation | Cold link through auth startup, History queries, pre-processing cancel, processing resume, dirty form leave, signed-out block | 2, 3, 5 |
| Connected normal journey | Real shared repositories across Home/Guide/Scan/History/Rewards/Voucher/Profile | 5 |

Avoid creating a golden for every widget. Prefer a few representative rendered surfaces only if they provide regression value beyond the required comparison captures and layout tests.

### Final execution commands

```powershell
flutter pub get
dart format --output=none --set-exit-if-changed lib test integration_test
flutter analyze
flutter test
flutter build web
flutter devices
```

For documentation and phase commit:

```powershell
# Check open issues for commit tagging
gh issue list --repo nayzinminlwin/EcoLoop-theSmartRecycling

# Ensure documentation is written in both:
# 1. docs/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md
# 2. docs/fix_logs/ using .agent/templates/fix_log_template.md

# Stage and commit phase updates
git add <changed-files>
git commit -m "#<issueID> <titleCode> : <description>"
```

For manual review:

```powershell
flutter run -d chrome --dart-define=MOCK_SCENARIO=normal
flutter run -d chrome --dart-define=MOCK_SCENARIO=review_deposit
```

After a supported device/emulator is available:

```powershell
flutter test integration_test/resident_journey_test.dart -d <available-device-id>
```

Phase 1 must implement the scenario commands before they are recorded as working. Compare protected Android hashes using `Get-FileHash -Algorithm SHA256 -LiteralPath "android/build.gradle.kts", "android/app/build.gradle.kts", "android/app/google-services.json"`.

## 6. Audit-to-plan coverage ledger

“Close” below is a required target, not a claim of completed work. Partial items must retain their remaining backlog explicitly.

| Audit finding | Target within this plan | Owner |
|---|---|---|
| F01 wallet corruption | Close | 1 |
| F02 repeated redemption lock | Close | 1, UI acceptance 4 |
| F03 hardcoded scan configuration | Close for the resident scenarios and shared count rules | 1, 3 |
| F04 dirty/scan leave policy | Close for existing resident forms and scan | 2 hook, 3/5 consumers |
| F05 stale displayed state | Close for the supported resident routes and filters | 2–5 |
| F06 write failures hide forms | Close | 1, full flow 5 |
| F07 lost startup destination | Close | 2 |
| F08 ignored History queries/wrong bell | Close | 2 |
| F09 stream contract/lifecycle | Close used resident streams, safe seeding/delivery/disposal; exhaustive interface conformance remains deferred | 1–5 |
| F10 private data/owner lifecycle | Close sign-out/resume and owner-scoped counts; defer arbitrary UID/claim switching | 4, 5 |
| F11 missing deterministic scenarios | Implement named injection and the listed resident scenarios; defer exhaustive combinations | 1, exercised 3–5 |
| F12 offset/calendar behavior | Close for current resident display/filter paths | 1, 2 |
| F13 full SDK-free model/map contract | Partial: dates and transaction invariants only; full map/URL/document-contract sweep deferred | 1 |
| F14 shell width/overflow | Close main 320/390/480 and text-scale regressions | 2, 4 |
| F15 visual substitutions | Close supplied page compositions and shared shell; only themed consistency for unsupplied extension surfaces | 2–5 |
| F16 hanging/leaking scan failure | Close | 1, 3 |
| F17 fragmented fixture sources | Close shared runtime seed/transaction/catalog issues; document historical fixture rules | 1, 3, 4 |
| F18 incomplete acceptance | Close core normal/recovery/navigation cases and supplied visual review; device availability and exhaustive matrix remain explicit | 1–5 |
| F19 overstated/incomplete logs | Reconcile this refactor's actual evidence and remaining limits; full backend reference expansion deferred | 5 |

## 7. Deferred work — the remaining approximate 20–30%

These items are deliberately outside the five-phase commitment. The percentages describe approximate remaining scope/value, not a count of unimplemented screens. Do not reclassify wallet loss, unusable forms, broken navigation, or the supplied main-screen visual gaps into this backlog.

| ID | Deferred item | What remains after this plan | Why it is deferred / follow-up trigger |
|---|---|---|---|
| D01 | **Complete SDK-free Firestore contract hardening** | Universal `fromMap`/`toMap` coverage, native-date/Timestamp-parts validation edge cases, strict HTTPS URL validation everywhere, document-ID/embedded-ID mapping, immutable collection sweep, exact backend-facing contract tests | Broad preparatory work has less immediate screenshot/demo impact. Complete before implementing Firebase adapters; do not label models fully Firestore-ready meanwhile. |
| D02 | **Multi-resident and arbitrary role/claim-change simulator** | Switching between different UIDs, old-user listener replacement under rapid claim changes, multi-user fixture ownership/idempotency isolation across every repository | Current scope guarantees the one-resident sign-out/resume loop and owner-scoped calculations. Add the simulator before genuine multi-account/backend integration. |
| D03 | **Exhaustive scenario/route/error combinations** | Every malformed encoding/date/status combination, every operation failed at every stage, all expiry-boundary permutations, high-contention stress, long randomized event sequences | Implement representative high-risk cases now; expand after the normal/recovery flows stabilize. Individual known failures encountered during this plan still require fixes. |
| D04 | **Bespoke visual polish for unsupplied extension screens** | Dedicated art/layout redesign of voucher list/detail, signed-out screen, confirmation modals, security/preferences detail screens beyond shared styling, functionality, and usable form layout | These surfaces have no supplied paired visual reference. Keep them functional and consistent now; refine against a future approved design. |
| D05 | **Fine motion and pixel-level decorative polish** | Precise pulse easing, subtle radial shading, hover transforms, ornamental shadow/leaf-orbit tuning after the major silhouettes match | Basic distinct scan visuals, visible processing, raised Scan affordance, and reduced-motion support are in scope. Pursue decorative tuning only after the visual checklist passes. |
| D06 | **Expanded platform/accessibility certification** | iOS build/runtime certification, broad Android device/IME/inset matrix, comprehensive screen-reader/focus audit across every modal, full browser matrix, sustained offline/performance profiling | Basic semantics, keyboard usability, 48px targets, 320-width layout, and 1.3/2.0 text-scale checks are in scope. Broader certification needs dedicated targets/time. An unavailable device run must remain pending, not marked passed. |
| D07 | **Complete backend-handoff reference expansion** | Full exact signatures/document-path/enum tables cross-checked against the future separate admin client's contracts | Correct misleading statements now; perform the exhaustive cross-client reference audit together with D01 before backend integration. |

**Later roadmap, separate from this gap-percentage budget:** live Firebase Auth/Firestore/Storage/App Check, rules/indexes, deployment, admin-web implementation, real camera/bin/AI events, merchant voucher consumption, push delivery, avatar uploads, production login/registration, and persistence across process restarts. These were already outside the resident mock-only goal and should not be counted as refactor omissions.

### Final definition of success

The five-phase refactor is complete when the supplied resident screen families look recognizably like the Figma compositions, all major visible overflow/grouping/color/stage substitutions in V01–V13 are resolved, the **245 → 255 → 155** journey and account/navigation recovery work on canonical shared mock state, and the verification record clearly separates **passed**, **pending target**, and **deferred D01–D07**. This is a bounded resident-experience recovery, not a claim that every original architecture/backend checklist is finished.
