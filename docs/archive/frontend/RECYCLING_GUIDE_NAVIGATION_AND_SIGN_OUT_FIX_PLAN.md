# Recycling Guide, Back Navigation, and Sign-Out Fix Plan

- **Date:** 2026-10-22
- **Status:** Proposed after code inspection; implementation has not started.
- **Scope:** Five reported issues, each with its own implementation phase,
  followed by a shared regression-verification phase.

## Goals and visual references

1. Balance spacing and alignment in **Using the smart bin**, particularly the
   first step immediately below the heading, as shown in the first screenshot.
2. Restore **EcoPoints per item** below the steps, using the second screenshot
   as the table-layout reference.
3. Restore the illustrated material cards under **What can I recycle?**, using
   the latest screenshot as the visual reference: pale icon tiles, material
   illustrations, bold titles, preparation tips, and rounded cards.
4. Make system Back and swipe-back return users through their navigation
   history before the app exits.
5. Fix the red **We could not sign you out. Please try again.** label in
   Settings and ensure the sign-out action reports its actual outcome.

The screenshots guide presentation. Accepted materials, eligibility, and points
must come from the active policy. For example, the current policy accepts glass
bottles and excludes cardboard; the older screenshot's **Paper & cardboard**
wording must therefore be replaced with policy-accurate wording.

## Findings from the current code

| Area | Finding | Relevant files |
| --- | --- | --- |
| Smart-bin steps | The heading is followed immediately by `RecyclingStepsList`. Each row uses text padding of 6 pixels above and 16 below, so instruction wrapping affects the apparent spacing. | `../../../lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`; `../../../lib/features/recycling_guide/presentation/widgets/recycling_steps_list.dart` |
| Missing points section | The UI only renders the section when `data.rates` is nonempty. The Firebase reader expects `rates` and `acceptedClasses`, while the backend defines `pointsPerItemByCategory`, `rewardCategoryByClass`, and `acceptedObjectClasses`. The current schema therefore produces no rates. | `../../../lib/features/recycling_guide/data/firebase_recycling_guide_repository.dart`; `../../../functions/src/domain/policy.ts` |
| Missing material visuals | `MaterialGuideCard` already renders material illustrations, and the four main PNG assets exist. However, the Firebase reader filters materials against the mismatched acceptance field. Reference material records also carry `canonicalClass`, which the Flutter material model currently discards. | `../../../lib/features/recycling_guide/presentation/widgets/material_guide_card.dart`; `../../../lib/features/recycling_guide/domain/models/recycling_material.dart`; `../../../functions/tools/seed_reference_data.ts` |
| Material-card sizing | The grid uses fixed card heights of 132 or 105 logical pixels. Current Firebase preparation instructions are longer than the older mock text, creating a potential clipping/overflow issue once the cards are restored. | `../../../lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart` |
| Back navigation | Home opens guide, history, and rewards with `context.go(...)`, while these are sibling routes. This replaces the page stack instead of preserving the originating page. The stateful shell switches tabs without an explicit previous-tab Back policy. | `../../../lib/app/router/app_router.dart`; `../../../lib/features/home/presentation/screens/home_screen.dart`; `../../../lib/app/presentation/resident_bottom_navigation.dart` |
| Existing leave behavior | Account forms and scan sessions already use `PopScope` and a shared leave-decision coordinator. Navigation changes need to integrate with these handlers. | `../../../lib/app/router/leave_decision_coordinator.dart`; account form screens; `../../../lib/features/scan/presentation/screens/scan_session_screen.dart` |
| Sign-out label | Settings watches `demoSessionControllerProvider`. Its initial load calls `getDemoSession()`, which is unsupported by `FirebaseAccountRepository`. Settings labels any resulting controller error as a sign-out failure, even before Sign out is pressed. | `../../../lib/features/account/presentation/screens/settings_screen.dart`; `../../../lib/features/account/presentation/controllers/demo_session_controller.dart`; `../../../lib/features/account/data/firebase_account_repository.dart` |
| Sign-out result handling | The demo controller also calls `getDemoSession()` after sign-out, potentially reporting an error after authentication has already signed out. Settings then navigates to the signed-out route regardless of whether the operation succeeded. | `../../../lib/features/account/presentation/controllers/demo_session_controller.dart`; `../../../lib/features/account/presentation/screens/settings_screen.dart` |

These findings are based on repository inspection. Device reproduction and
runtime verification are included below.

## Phase 1 — Balance the smart-bin instruction layout

**Objective:** Give the heading and all numbered instructions consistent visual
spacing while accommodating multiline text.

### Implementation

1. Add a deliberate gap, approximately 12–16 logical pixels, between **Using the
   smart bin** and the first numbered step. Use the established spacing tokens
   where appropriate.
2. Align each numbered circle with the first line of its instruction. Keep the
   badge size and the badge-to-text gap consistent across all steps.
3. Standardize inter-step spacing and an appropriate minimum row height. Let
   longer instructions expand naturally instead of forcing identical heights.
4. Keep the connector centered beneath each badge, continuous between steps,
   and absent after the final badge.
5. Balance the section's separation from the preparation cards above and the
   points section below.

**Primary files:**

- `../../../lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`
- `../../../lib/features/recycling_guide/presentation/widgets/recycling_steps_list.dart`

**Done when:** The first step has clear breathing room beneath the heading;
all six current-policy steps have consistent badge/text alignment; wrapped text
and enlarged fonts do not overlap or clip.

## Phase 2 — Restore policy-driven EcoPoints rates

**Objective:** Make the bottom points section reliably display the active
policy's per-item rates and examples.

### Implementation

1. Update the Firebase guide reader to use `acceptedObjectClasses`,
   `rewardCategoryByClass`, and `pointsPerItemByCategory` from the actual policy
   contract. Keep any legacy/mock support explicit rather than substituting
   hardcoded production rates.
2. Derive eligible reward categories from accepted canonical classes, then
   create one rate row per category in a stable display order. Paper items and
   paper bags share a category and must not produce duplicate rate rows.
3. Preserve class-level eligibility: cardboard must remain excluded even
   though its category mapping is also `paper`.
4. Align the guide-material acceptance filtering with the same contract. Retain
   `canonicalClass` in the material model when present and compare it directly
   with accepted classes. Keep older mock fixtures without that field working
   through an explicit compatibility mapping.
5. Render **EcoPoints per item**, the material/points/example table, and the
   disclaimer below the steps. Calculate example totals from configured item
   counts multiplied by the displayed policy rate.
6. Show an understandable unavailable state if rate data is genuinely absent
   or invalid, with retry/reload behavior appropriate to the existing guide
   controller, instead of silently removing the section.
7. Verify that changes to the active policy pointer and selected policy refresh
   the guide together, so materials, rates, examples, and eligibility remain
   consistent.

### Current-policy reference values

| Material | EcoPoints per accepted item |
| --- | ---: |
| Plastic | 5 |
| Aluminium | 8 |
| Paper | 3 |
| Glass | 10 |

These are the current backend values, not constants to embed in the UI. Example
quantities also come from guide content and may differ from the older screenshot.

**Primary files:**

- `../../../lib/features/recycling_guide/data/firebase_recycling_guide_repository.dart`
- `../../../lib/features/recycling_guide/domain/models/recycling_material.dart`
- `../../../lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`
- `../../../lib/features/recycling_guide/presentation/widgets/material_rates_table.dart`
- `../../../lib/features/recycling_guide/presentation/controllers/recycling_guide_controller.dart`

**Done when:** Current Firebase-shaped policy data produces the expected table;
example arithmetic is correct; excluded classes remain excluded; policy updates
are reflected; the table and disclaimer can be scrolled fully above the bottom
navigation and its raised Scan button.

## Phase 3 — Restore the illustrated recyclable-material cards

**Dependency:** Phase 2 restores policy-accurate material selection.

**Objective:** Restore the graphic cards shown in the latest screenshot while
using the current policy's accepted materials and preparation guidance.

### Implementation

1. Confirm that the restored material list reaches **What can I recycle?**
   with the intended sort order. Distinguish an unavailable material list from
   a valid policy that accepts no supported materials.
2. Reuse the existing illustrated assets:
   - Plastic bottles: `../../../assets/icons/plastic-bottle.png`
   - Glass bottles: `../../../assets/icons/milk-bottle.png`
   - Aluminium cans: `../../../assets/icons/open-can.png`
   - Paper: `../../../assets/icons/paper-recycle.png`
3. Match the reference card composition: rounded light card, subtle border,
   pale-green icon tile, clearly visible illustration, bold title, and a
   preparation tip underneath.
4. Ensure icon selection works with Firebase IDs such as `plastic-bottles` and
   `paper-items`, not only the short mock IDs. Use material type/canonical class
   for a reliable mapping and provide an appropriate fallback for missing assets.
5. Give separately listed paper bags an appropriate paper/bag visual. Preserve
   valid current-policy cards rather than forcing the screenshot's older
   four-card material list.
6. Make the grid responsive: two columns when width and text scale permit, and
   one column when necessary. Replace restrictive fixed heights with sizing
   that accommodates current preparation text and enlarged fonts.
7. Verify the cards in both mock and Firebase-backed modes, including asset
   visibility, text wrapping, and consistency with the points table.

**Primary files:**

- `../../../lib/features/recycling_guide/presentation/widgets/material_guide_card.dart`
- `../../../lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`
- `../../../lib/features/recycling_guide/domain/models/recycling_material.dart`
- `../../../assets/icons`
- `../../../pubspec.yaml`, if an additional illustration is needed

**Done when:** Every displayed accepted material has a visible, appropriate
illustration and readable preparation guidance. Cards resemble the reference,
remain policy-accurate, and have no overflow at narrow widths or larger text sizes.

## Phase 4 — Repair system Back and swipe-back navigation

**Objective:** Preserve the previous destination and give hardware/button Back,
system swipe-back, and in-app back arrows consistent behavior.

### Navigation rules

1. Close the active dialog or sheet before leaving the page.
2. If the active tab has a previous page, return to that page.
3. At a tab root, return to the previously visited tab when available; otherwise
   return to Home. Consume tab history as Back is used so it cannot loop.
4. For a directly opened secondary page with no prior visit, provide its logical
   parent, such as Home for the guide or Settings for Profile.
5. Allow normal system exit only at Home with no remaining navigation history.
6. Apply the existing form/scan leave decisions before leaving guarded work.

### Implementation

1. Review the route hierarchy and preserve parent pages for secondary routes,
   including direct-link entry. Keep existing route URLs and query parameters
   working.
2. Change secondary-page entry points to preserve history, using appropriate
   push/nested-route behavior. Review Home shortcuts, header notifications,
   rewards, voucher lists, and voucher details.
3. Handle bottom-navigation Back behavior at the shell level while keeping
   per-tab page stacks and existing tab-resume/reselect behavior coherent.
4. Make in-app back arrows follow the same page/parent rules, with explicit
   fallbacks when no previous page exists.
5. Integrate modern Flutter Back handling with the existing `PopScope` widgets
   and leave-decision coordinator. Ensure one gesture/action does not trigger
   duplicate dialogs or multiple pops, and inactive tabs do not consume Back.
6. Preserve canonical scan-stage transitions. Back must not reopen stale
   deposit stages, repeat submission, or bypass existing cancellation/leave
   behavior. Processing/completed sessions must follow their intended leave rules.
7. Keep filter/query updates from creating unnecessary Back entries. Preserve
   history filters, rewards categories, and page state when returning where
   appropriate.
8. Verify Android button and gesture delivery through Flutter and `go_router`,
   including predictive Back on supported devices. Make native configuration
   changes only if device verification identifies a platform-level issue.

**Primary files:**

- `../../../lib/app/router/app_router.dart`
- `../../../lib/app/presentation/resident_shell.dart`
- `../../../lib/app/presentation/resident_bottom_navigation.dart`
- `../../../lib/app/presentation/resident_top_bar.dart`
- `../../../lib/app/router/leave_decision_coordinator.dart`
- Navigation entry points in Home, rewards, activity, account, and scan screens
- `../../../android/app/src/main/AndroidManifest.xml`, if platform verification requires it

**Done when:**

- Home -> How to Recycle -> system Back returns to Home.
- Rewards -> Vouchers -> Voucher details returns one page at a time.
- Settings -> Profile -> Back returns to Settings.
- Tab switches can be reversed according to the rules above without loops.
- Direct links have sensible parent destinations.
- Unsaved forms and active scans retain their existing leave decisions.
- The app exits only after the user reaches the true navigation root.

## Phase 5 — Fix the Settings sign-out error and operation state

**Objective:** Show sign-out errors only when a user-initiated sign-out actually
fails, and correctly complete both Firebase and mock sign-out flows.

### Implementation

1. Decouple Settings sign-out state from demo-session loading. Use a dedicated
   operation state/controller, initially idle, that does not call
   `getDemoSession()` when Settings opens.
2. Call the supported account-repository sign-out operation. Do not read the
   unsupported Firebase demo-session API before or after sign-out. Keep demo
   session resume behavior confined to the mock/demo flow.
3. Give the operation a clear success/failure result. Clear old sign-out errors
   at the start of a new attempt; disable duplicate submissions while running;
   show **Signing out...** only while the operation is pending.
4. Display **We could not sign you out. Please try again.** only after a real
   failed attempt while the account remains signed in. An initial settings or
   session-load error must not be presented as a sign-out failure.
5. Navigate based on successful sign-out and observed authentication state,
   coordinating with route guards so authentication changes do not trigger
   conflicting redirects. A failed attempt must not unconditionally navigate
   away from Settings.
6. Preserve existing pre-sign-out cleanup and verify Google sign-in, other
   supported Firebase account paths, and mock sessions. Distinguish actual
   operation failures from provider disposal/auth-state changes after success.
7. Use confirmation copy appropriate to the runtime mode. Firebase users should
   see ordinary sign-out wording; demo-specific wording belongs to demo mode.
8. Coordinate with Phase 4 so successful sign-out clears resident navigation
   history and Back cannot reopen authenticated pages. A later sign-in starts
   with appropriate fresh navigation and operation state.

**Primary files:**

- `../../../lib/features/account/presentation/screens/settings_screen.dart`
- `../../../lib/features/account/presentation/controllers/demo_session_controller.dart`
- A dedicated sign-out controller under `../../../lib/features/account/presentation/controllers`
- `../../../lib/features/account/data/firebase_account_repository.dart`
- `../../../lib/features/account/data/mock_account_repository.dart`
- `../../../lib/app/router/route_guards.dart`

**Done when:** Opening Settings shows no sign-out error. Cancelling confirmation
does nothing. Successful sign-out reaches the signed-out screen without a false
failure label. Genuine failure keeps the user on Settings with a retryable error;
retry success clears it. Back after success cannot restore the resident screens.

## Phase 6 — Focused regression verification

### Automated coverage

Extend the existing tests with behavioral regression cases:

- **Guide repository:** Use the real backend policy/reference-document shape,
  not only legacy synthetic `rates` fixtures. Cover accepted canonical classes,
  category deduplication, cardboard exclusion, glass, examples, and active-policy
  changes.
- **Guide rendering:** Verify that Firebase-shaped data produces both the
  material-card section and the points section, including a genuine
  missing-rate/material-data state.
- **Navigation:** Exercise system-pop requests, nested page history, tab history,
  direct-link parents, form leave decisions, and scan-stage behavior.
- **Sign-out:** Open Settings with a Firebase-compatible repository that rejects
  demo-session reads; verify an initially clean UI. Cover cancellation, pending
  state, actual failure, retry success, successful auth redirection, and Back
  after sign-out. Verify that the flow never calls the demo-session API.

Relevant existing suites:

- `../../../test/features/recycling_guide/firebase_guide_test.dart`
- `../../../test/features/recycling_guide/recycling_guide_test.dart`
- `../../../test/app/app_router_test.dart`
- `../../../test/app/resident_shell_test.dart`
- `../../../test/features/account/settings_flow_test.dart`
- `../../../test/features/account/firebase_auth_flow_test.dart`
- `../../../test/features/account/account_providers_test.dart`
- Relevant tests under `../../../test/features/scan` and `../../../test/features/rewards`
- `../../../integration_test/resident_journey_test.dart`

Use visual inspection for the small spacing adjustments; prioritize automated
coverage for the data-contract, navigation, and sign-out regressions.

### Commands

From the repository root:

```text
flutter analyze
flutter test test/features/recycling_guide test/app test/features/account test/features/scan test/features/rewards
flutter test integration_test/resident_journey_test.dart -d <android-device-id>
```

Run the resident journey in the mock runtime it expects. Verify Firebase behavior
separately using the project's configured emulator/test runtime and real policy
document shape. Adjust the journey's assertions if the intended UI wording has
changed, keeping its end-to-end purpose intact.

### Visual and device acceptance checklist

- [ ] Compare the three guide sections with the supplied screenshots.
- [ ] Check approximately 320, 390, and 480 logical-pixel widths and enlarged text.
- [ ] Verify all current-policy material illustrations and longer preparation tips.
- [ ] Verify six smart-bin steps, connector alignment, and heading spacing.
- [ ] Scroll to the end and confirm the points table/disclaimer clear the bottom bar.
- [ ] Exercise Android three-button Back and swipe-back, including repeated Back.
- [ ] Verify direct links, tab switching, overlays, dirty forms, and an active scan.
- [ ] Open Settings before any sign-out attempt and confirm the red label is absent.
- [ ] Verify sign-out cancellation, success, actual failure, retry, and re-sign-in.
- [ ] Confirm Back after successful sign-out cannot restore resident pages.

## Delivery order and completion

Recommended sequence: **Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 ->
Phase 6**. Phase 3 uses Phase 2's corrected material selection; Phase 5 integrates
with Phase 4's navigation handling. Each phase should meet its own completion
criteria before moving on.

The work is complete when all five reported issues meet their acceptance
criteria, focused automated checks pass, and the Android visual/navigation
checks are recorded with the device and runtime mode used.
