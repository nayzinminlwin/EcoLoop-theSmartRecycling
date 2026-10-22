# Fix Log: Flutter Phase 2 - Shell, Home, and History Visual Restoration

**Date and Time :** 2026-10-17 21:30  
**Agent:** opencode (GLM)  
**Moderator:** Alex  
**Status:** Completed  
**Fix Type:** Refactor

---

## 1. Triggered By

- **QA Report:** `docs/archive/FLUTTER_UI_REFACTOR_PLAN.md` Phase 2 acceptance gate and
  the V01–V03 rows of the screenshot-derived gap register in
  `docs/archive/FLUTTER_UI_IMPLEMENTATION_AUDIT.md` (F07, F08, F12, F14, F15).
- **Error Summary:** The resident shell rendered a plain "EcoLoop" heading with
  a Material bell, the Home wallet card was white with a green CTA inversion,
  recent activity rendered as repeated overflowing ListTiles with duplicated
  bin IDs, and History used one ungrouped list without the impact heading,
  visible filter controls, or derived per-row weight.

## 2. Root Cause

The shared shell, typography, and Home/History presentation had been built
from generic Material scaffolding instead of the source composition:
no 480px shell frame, no raised scan affordance, no named text roles (the
wide eyebrow tracking leaked into every `labelSmall`), no grouped activity
container, one-shot History fetches without stream observation, and no
pending-URI preservation across startup auth restoration.

## 3. Changes Made

- Shell (`resident_shell.dart`, `resident_top_bar.dart`,
  `resident_bottom_navigation.dart`): centered 480px frame for header,
  content, and bottom bar; brand mark + EcoLoop AI wordmark; outlined bell
  with red dot routed to History; raised 58px scan circle with contrast ring
  and shadow; branch-accurate selected labels; same-branch reselect resets to
  the branch root while different-branch switches preserve nested routes; all
  branch transitions consult the shared leave-decision hook.
- Typography (`app_typography.dart`): named source-scale roles (page heading
  29, greeting 25, section heading 19, stat 21, wallet 44, body 14, eyebrow
  11/tracked, badge 11, activity title/metadata 13/10, nav label 10, compact
  action 12); removed wide tracking from `labelSmall`.
- Shared widgets: `AppPage`/`AppPageHeader` became the single page scroll
  owner with an in-content header (48px back target, eyebrow, page heading)
  and a Material surface without a nested Scaffold; `AppBrand` mark/wordmark;
  `AppSectionHeader` eyebrow support; `AppProgressBar` color params;
  `AppBadge` source badge role.
- Home: green wallet card (white number/copy, pale leaf orbit, amber progress,
  white full-width Browse rewards), white scan CTA with green icon tile,
  joined impact stats card, bordered quick cards, ACTIVITY section header, and
  the two-row recent activity group with separators.
- Activity: content-sized `DepositActivityTile` (icon tile, flexible
  material/location/date block, bounded points/status block; stacked layout at
  enlarged text scales), single-place location normalization, demo-local
  `Today` stamps, derived per-row kg; grouped History list with separators,
  YOUR IMPACT header, two dropdown-style filter controls opening the existing
  accessible sheet to the relevant section, and the muted demo note.
- State/navigation: `HistoryController` now observes repository deposit
  streams (filter changes cancel the superseded subscription, stale events are
  ignored by generation, stream failures keep last content with an inline
  refresh failure); History query filters apply on direct links and applied
  filters reflect in the URI; `RouteGuards` preserves the full pending URI
  through startup auth restoration; calendar query dates validate strictly and
  convert inclusive end dates at the demo +08:00 offset.
- Left the provider fallback identity reconciled to Faris Rezza.

- **Files Modified:** the files listed above under
  `lib/app/`, `lib/core/theme/`, `lib/core/presentation/`,
  `lib/shared/widgets/`, `lib/features/home/presentation/`,
  `lib/features/activity/presentation/`, plus
  `test/app/app_router_test.dart`, `test/app/resident_shell_test.dart`,
  `test/features/account/settings_flow_test.dart`,
  `test/features/activity/history_screen_test.dart`.
- **Files Created:** `lib/app/router/leave_decision_coordinator.dart`,
  `test/refactor_visuals/phase2_capture_test.dart`,
  `docs/archive/FLUTTER_UI_REFACTOR_VISUAL_CHECKLIST.md`,
  `docs/refactor_visuals/phase2/*.png`.
- **Files Deleted:** none.

## 4. Verification Notes

- `dart format --output=none --set-exit-if-changed lib test integration_test`
  — clean after formatting.
- `flutter analyze` — no issues.
- `flutter test` — 48 tests passed, including the new shell scenario (bell to
  History, branch preservation/reselect, 480 frame, 320 no-overflow, 2.0 text
  scale reflow), history live update after a committed deposit, direct-link
  filters, and strict calendar validation.
- `flutter build web` — succeeded.
- Comparison captures with real Inter fonts rendered at 390/480/320 are saved
  under `docs/refactor_visuals/phase2/`; V01–V03 match the reference
  hierarchy with the mandated semantic differences (105 remaining / 70%,
  1.04 kg, count-derived row weights).
- Known test-infrastructure limitation (pre-existing on the base branch): a
  second `EcoLoopApp` pump in the same test file never settles, so shell
  scenarios are consolidated into one `testWidgets`.

## 5. Ready for Retest

- [ ] Yes — The Tester agent should append a new retest to
  `docs/test_logs/` covering the Phase 2 acceptance gate.

---

## 📝 APPENDED FOLLOW-UP FIXES

### Follow-up Fix: 2026-10-17 (pre-retest self-review)

- **Status:** Completed
- **Additional Changes:** Self-review before QA handover found and corrected:
  1. `RouteParameterParsers.calendarDate` decoded query values without a
     try/catch; a `%` surviving go_router's decode could throw inside the
     router redirect. Now decodes defensively and returns null (covered by a
     new guard test).
  2. The header bell's hit region was 42px; the plan requires ≥48px
     interactive targets, so the tap area is now 48px around the 42px visual.
  3. `AppPage` constrained the whole header+content Column, so full-height
     page states (the scan session's centered loading/error) shrank to their
     intrinsic size. The viewport minimum now applies to the page content
     itself.
  4. Scan CTA title set to the source's 15px; Home avatar set to the source's
     40px.
  5. The Rewards screen's MARKETPLACE eyebrow now uses the shared eyebrow
     role (shared-chrome fix owned by Phase 2).
  6. History filter control labels watch the filter provider so they update
     immediately on filter changes instead of waiting for the reload.
  7. Added `test/app/route_guards_test.dart`: deep links parked during
     startup keep path+query (last link wins, consumed once), signed-out
     resume restores the requested destination, and malformed query values do
     not crash guard redirects.
