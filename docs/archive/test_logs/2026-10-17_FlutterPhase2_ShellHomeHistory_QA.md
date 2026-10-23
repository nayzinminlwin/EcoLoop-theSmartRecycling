# Test Log: Flutter Phase 2 — Shell, Home, and History Restoration

**Date:** 2026-10-17
**Tester:** opencode (GLM)
**Phase:** Phase 2 — "Restore the shell, Home, and History" (`docs/archive/frontend_ui/FLUTTER_UI_REFACTOR_PLAN.md`)
**Task / Implementation:** Verification of commits `06b30a9` ("refactor(phase2): restore shell, Home, and History presentation") and `4a90c32` ("refactor(phase2): harden shell and history details from self-review")

---

## 1. Scope

**Requirements Tested (Phase 2 acceptance gate):**

- Home hierarchy at 390/480 widths: green wallet card, white scan CTA, compact impact/quick cards, grouped recent activity per the reference hierarchy (V01–V02).
- Desktop width: header/content/nav share the centered 480px frame; 320 width has no horizontal clipping/overflow.
- Text scales 1.0/1.3 readable; 2.0 may reflow but must not clip core content.
- Correct wallet values: 245 / 105 remaining / 70% (not the prototype's 55 / 82%).
- Home/History timestamps use the +08:00 demo offset; each location shows its bin ID exactly once.
- Already-open History and Home update after a repository deposit without manual refresh.
- `/history?status=review&from=2024-05-01&to=2024-05-20` filters on direct link, survives refresh, invalid input recovers predictably.
- Cold-start deep links reach their destination after auth restoration; header bell opens History.
- Same-branch reselect resets Home/Settings branches to roots; branch switches preserve nested routes; shared leave-decision coordinator exists and is consulted before branch transitions.
- Common gates: `dart format`, `flutter analyze`, `flutter test`, `flutter build web`.
- Mock-only boundary: no live Firebase SDK calls; deterministic mock services.
- Documentation: visual checklist (V01–V03), fix log, execution log.

**References:**

- `docs/archive/frontend_ui/FLUTTER_UI_REFACTOR_PLAN.md` — Phase 2 section and acceptance gate
- `docs/archive/fix_logs/2026-10-17_FIX_FlutterPhase2_ShellHomeHistoryRestoration.md`
- `docs/archive/frontend_ui/FLUTTER_UI_REFACTOR_EXECUTION_LOG.md` — Phase 2 section
- `docs/archive/frontend_ui/FLUTTER_UI_REFACTOR_VISUAL_CHECKLIST.md`
- `docs/archive/frontend_ui/FLUTTER_UI_IMPLEMENTATION_AUDIT.md` (F04, F07, F08, F12, F14, F15 — background)
- `../../../EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`, `src/index.css` (READ-ONLY ground truth)
- `../../../Demo_Screenshots/Figma_HomePage1.png`, `Figma_HomePage2.png`, `Figma_RecyclingHistoryPage.png`

---

## 2. Test Results

| ID | Test / Scenario | Expected Result | Status | Notes |
|---|---|---|---|---|
| T-01 | Home at 390 width vs `Figma_HomePage1.png` (`docs/archive/refactor_visuals/phase2/home_390_top.png`) | Green wallet card with white 245 number, leaf orbit, amber progress, white full-width Browse rewards + arrow; white scan CTA with green icon tile; joined impact card; bordered quick cards | PASS | Reviewed the PNG myself; hierarchy, colors, proportions match the reference |
| T-02 | Home recent-activity section vs `Figma_HomePage2.png` (`home_390_activity.png`) | ACTIVITY eyebrow + "Recent recycling" + View all; two rows in one white bordered rounded group with separator; clean labels; no trailing overflow | PASS | Bin IDs appear once ("BIN-004 · Cedar Residence", "BIN-002 · Maple Lobby"); demo-local stamps ("Today, 10:42 AM") |
| T-03 | History at 390 vs `Figma_RecyclingHistoryPage.png` (`history_390.png`) | YOUR IMPACT eyebrow, page heading, two dropdown-style filter controls, grouped bordered list with separators, muted shield note | PASS | Note sits after the full untruncated list per plan §2 rule 47; derived per-row kg shown (0.05 kg for 2 pcs PET — mandated semantic difference) |
| T-04 | Home at 480 width (`home_480_top.png`) | Content fills the 480px frame at reference proportions | PASS | Capture reviewed; shell test additionally asserts the brand is inside the centered frame at 1200px viewport |
| T-05 | Home at 320 width (`home_320_top.png`) | No horizontal clipping/overflow; content reflows | PASS | Capture shows wrapped greeting/cards with no cut-off; shell test pumps 320×800 and asserts no exception |
| T-06 | Desktop-width centered frame | Header, content, and bottom bar share the centered 480px frame | PASS | `ResidentShell` wraps the entire `Scaffold` (appBar + body + bottomNavigationBar) in `Center` + `ConstrainedBox(maxWidth: 480)` (`resident_shell.dart:20-38`); shell test asserts `EcoLoop AI` dx ≥ 360 at 1200px |
| T-07 | Text scale 2.0 | Layout may reflow but no clipping/overflow exception | PASS | Shell test sets `textScaleFactorTestValue = 2.0` at 390×900 and asserts no exception; `DepositActivityTile` switches to a stacked row when scaled text > 1.3× (`deposit_activity_tile.dart:43-45`) |
| T-08 | Wallet values | 245 balance / "105 points to your next reward" / 70% | PASS | `home_screen_test.dart` asserts 245 and 105; `home_390_top.png` shows 70%; 245/350 = 70% confirmed |
| T-09 | +08:00 demo offset timestamps | Demo-local "Today, h:mm a" stamps; no host-timezone leakage | PASS | `AppClock.toDisplay` + `AppFormatters.activityStamp`; history test asserts "Today, 10:42 AM · 0.05 kg" for a `2024-05-20T10:42:00+08:00` record |
| T-10 | Bin ID appears exactly once | No "BIN-004 · BIN-004" duplication | PASS | Single normalization point `AppFormatters.location` (`app_formatters.dart:37-44`) skips prepending when the location already starts with the ID; test asserts "BIN-004 · Cedar Residence" once |
| T-11 | Already-open History updates after a deposit | New row appears without manual refresh | PASS | `history_screen_test.dart` "history updates after a committed deposit without refresh" commits a `store.transaction` insert and asserts the new "Aluminium" row appears |
| T-12 | Already-open Home updates after a deposit | Home projections rebuild from repository streams | PASS | `HomeController.build` watches profile/wallet/summary/recent-deposit stream providers (`home_controller.dart:61-81`); wallet test asserts balance mutation propagation; Home renders from the same streams verified in T-11's store revision mechanism |
| T-13 | Direct-link history filter `?status=review&from=2024-05-01&to=2024-05-20` | Filters apply on direct link; applied filters reflect in the URI; refresh keeps them | PASS | Route builder parses query into `HistoryScreen(routeFilter:)`; `_syncRouteFilter` applies it; `_updateUri` writes filters back to the URI; router test verifies +08:00 conversion (from 2024-05-01 → `2024-05-01T00:00+08:00` minus offset); screen test "query-derived filters apply on direct links" asserts only Review rows render |
| T-14 | Invalid history query input | Recovers predictably (clean `/history`), no crash | PASS | `app_router.dart:72-91` redirects invalid dates/status to clean `/history`; `RouteParameterParsers.calendarDate` strictly validates `yyyy-MM-dd` and decodes defensively (try/catch); covered by `app_router_test.dart` and `route_guards_test.dart` malformed-query test |
| T-15 | Cold-start deep link after auth restoration | Pending URI (path+query) reaches its destination; last link wins; consumed once | PASS | `RouteGuards.redirect` parks the full URI when unresolved and `_consumePending` restores it (`route_guards.dart:48-72`); `route_guards_test.dart` asserts path+query preservation, last-link-wins, single consumption, and signed-out resume |
| T-16 | Header bell opens History | Bell routes to `/history` | PASS | `resident_top_bar.dart:37` → `context.go(AppRoutes.history)`; shell test taps the bell and asserts the History screen renders |
| T-17 | Same-branch reselect resets to root; branch switch preserves nested routes | Home/Settings reselect returns to branch root; nested route survives a switch away and back | PASS | `resident_bottom_navigation.dart:35` (`initialLocation: sameBranch`); shell test navigates Settings → Profile → Home → Settings and asserts Profile persists, then reselects Settings and asserts Profile is gone |
| T-18 | Shared leave-decision coordinator | Exists at `../../../lib/app/router/leave_decision_coordinator.dart`; consulted before every branch transition | PASS | `ResidentBottomNavigation._select` awaits `coordinator.confirmLeave()` before any `goBranch` call (`resident_bottom_navigation.dart:20-23`); no branch-specific dialogs duplicated in the shell |
| T-19 | Scan label emphasis reflects actual branch | No permanently-emphasized Scan label | PASS | `selected = navigationShell.currentIndex == 1`; captures show Home/Settings emphasized on their own branches; mandated semantic difference per plan §2 |
| T-20 | Mock-only boundary | No live Firebase SDK calls; deterministic mock services | PASS | Repo-wide grep of `../../../lib` for `Firebase|firebase` returns no matches; services use `MockApi` delays and the seeded `MockDataStore` |
| T-21 | Documentation artifacts | Visual checklist with V01–V03 reviewed, fix log, execution log updated | PASS | `docs/archive/frontend_ui/FLUTTER_UI_REFACTOR_VISUAL_CHECKLIST.md` marks V01–V03 and shared shell pass with capture links; fix log exists with appended self-review follow-up; execution log Phase 2 section present |
| T-22 | Protected Android config files | Unchanged | PASS | `git status` clean — no modifications to `../../../android` files; only untracked pre-existing moderator files (`../../../Demo_Screenshots`, `docs/archive/frontend_ui/recycle_bin_multi_model_orchestrator_plan.md`) |

**Deliberate semantic differences (per plan §2 — NOT defects):** 105 remaining / 70% (not 55/82%), 1.04 kg (not 3.2 kg), count-derived per-row kg (0.05 kg for 2 pcs PET), scan label emphasis reflects actual branch, bell routes to History. All confirmed present and correctly implemented.

---

## 3. Automated Testing

**Tests Run:**

```text
dart format --output=none --set-exit-if-changed lib test integration_test
flutter analyze
flutter test
flutter build web
```

**Result:**

- `dart format --output=none --set-exit-if-changed lib test integration_test` — exit 0, "Formatted 157 files (0 changed)".
- `flutter analyze` — exit 0, "No issues found! (ran in 5.5s)".
- `flutter test` — exit 0, **52 tests passed, 0 failed** ("All tests passed!"). Matches the execution log's claimed 52.
- `flutter build web` — exit 0, "√ Built build\web".

**Coverage:** Phase 2 behaviors covered by the suite include the consolidated shell scenario (destinations, bell → History, branch preservation/reselect, 480px frame, 320 no-overflow, 2.0 text scale, ≥48px nav targets), route guards (pending URI parking/resume, malformed query safety), history live update after a committed store transaction, direct-link filters, strict calendar validation, and wallet/summary values. No coverage gaps relevant to the Phase 2 gate were identified.

---

## 4. Issues Found

None. No confirmed defects were found in the Phase 2 scope.

**Non-blocking observations (not counted as defects):**

- The bottom bar's scan-resume check still reads the current route string (`resident_bottom_navigation.dart:28-32`). This is a documented Phase 3 ownership item in the execution log and fix log, not a Phase 2 defect.
- A second `EcoLoopApp` pump in one test file never settles (pre-existing test-infra limitation reproduced on the base branch); shell scenarios are consolidated into one `testWidgets`. Documented in the fix log and execution log; accepted as a known limitation.
- Flutter widget tests render with placeholder fonts while the capture harness loads the real Inter assets — expected test-env behavior; captures reviewed show correct Inter rendering.

---

## 5. Final Status

**Status:** PASSED

**Summary:**

All Phase 2 acceptance-gate items verified. The 390/480/320 captures were reviewed directly against the Figma references and match the source hierarchy with only the plan-mandated semantic differences. All 52 automated tests pass; format, analyze, and the web build are clean. Navigation state handling (pending deep links, branch reselect/reset, leave-decision coordinator) and live History/Home projections are implemented and tested as specified. Documentation artifacts (visual checklist, fix log, execution log) are complete and consistent with what was verified.

**Required Action:**

None — Phase 2 may proceed. Phase 3 can start; Phase 3 must replace the route-string scan-resume check with session state as already documented.

---

# Retest History

(none — first QA pass for Phase 2)
