# Resident UX Improvement Implementation Plan

- **Date:** 2026-10-22
- **Status:** Planning complete; UX direction approved by the user; implementation
  and runtime verification remain to be performed.
- **Scope:** The five original issues, an expanded resident UX improvement phase,
  and final cross-stack verification. Supporting changes cover Flutter, Firebase
  Functions/Firestore, shared contracts, and the Python vision worker.

## Approved UX decisions and priorities

The user approved these decisions after the codebase UX review:

- Keep cancellation and sign-out confirmation dialogs open, with immediate
  progress feedback, until the operation completes or a recoverable error occurs.
- Let users continue using EcoLoop during server-side verification, with a
  persistent progress card and a reliable way back to the deposit/result.
- Prioritize the resident app and its supporting backend.

Implement the expanded UX work in this order:

| Priority | Workstream | Detailed section |
| --- | --- | --- |
| 1 | Immediate visual feedback | Phase 6A |
| 2 | Partitioned scan-loading UX with real progress | Phase 6B |
| 3 | Background continuation and restoration | Phase 6C |
| 4 | Recovery and task continuity | Phase 6D |
| 5 | Broader polish, accessibility, and measured responsiveness | Phase 6E |

Phases 1–5 retain the original issue identifiers. For the next implementation
increment, start with Phase 6A and its Phase 5 sign-out prerequisite. Complete
the Phase 4 navigation integration before background-continuation acceptance.
The delivery sequence at the end maps the original fixes into this priority order.

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
6. Acknowledge network-backed actions immediately and keep action-specific
   pending, success, and failure states visible at the point of interaction.
7. Replace the long undifferentiated scan spinner with backend-driven stage
   messages and a segmented progress indicator in the main scan card.
8. Preserve in-progress deposits and newly completed results across navigation,
   backgrounding, app restarts, and temporary disconnection.
9. Improve recovery, notifications, receipts/history, partial loading, form
   feedback, and accessible interaction throughout the resident app.

The screenshots guide presentation. Accepted materials, eligibility, and points
must come from the active policy. For example, the current policy accepts glass
bottles and excludes cardboard; the older screenshot's **Paper & cardboard**
wording must therefore be replaced with policy-accurate wording.

## Findings from the current code

| Area | Finding | Relevant files |
| --- | --- | --- |
| Smart-bin steps | The heading is followed immediately by `RecyclingStepsList`. Each row uses text padding of 6 pixels above and 16 below, so instruction wrapping affects the apparent spacing. | `lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`; `lib/features/recycling_guide/presentation/widgets/recycling_steps_list.dart` |
| Missing points section | The UI only renders the section when `data.rates` is nonempty. The Firebase reader expects `rates` and `acceptedClasses`, while the backend defines `pointsPerItemByCategory`, `rewardCategoryByClass`, and `acceptedObjectClasses`. The current schema therefore produces no rates. | `lib/features/recycling_guide/data/firebase_recycling_guide_repository.dart`; `functions/src/domain/policy.ts` |
| Missing material visuals | `MaterialGuideCard` already renders material illustrations, and the four main PNG assets exist. However, the Firebase reader filters materials against the mismatched acceptance field. Reference material records also carry `canonicalClass`, which the Flutter material model currently discards. | `lib/features/recycling_guide/presentation/widgets/material_guide_card.dart`; `lib/features/recycling_guide/domain/models/recycling_material.dart`; `functions/tools/seed_reference_data.ts` |
| Material-card sizing | The grid uses fixed card heights of 132 or 105 logical pixels. Current Firebase preparation instructions are longer than the older mock text, creating a potential clipping/overflow issue once the cards are restored. | `lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart` |
| Back navigation | Home opens guide, history, and rewards with `context.go(...)`, while these are sibling routes. This replaces the page stack instead of preserving the originating page. The stateful shell switches tabs without an explicit previous-tab Back policy. | `lib/app/router/app_router.dart`; `lib/features/home/presentation/screens/home_screen.dart`; `lib/app/presentation/resident_bottom_navigation.dart` |
| Existing leave behavior | Account forms and scan sessions already use `PopScope` and a shared leave-decision coordinator. Navigation changes need to integrate with these handlers. | `lib/app/router/leave_decision_coordinator.dart`; account form screens; `lib/features/scan/presentation/screens/scan_session_screen.dart` |
| Sign-out label | Settings watches `demoSessionControllerProvider`. Its initial load calls `getDemoSession()`, which is unsupported by `FirebaseAccountRepository`. Settings labels any resulting controller error as a sign-out failure, even before Sign out is pressed. | `lib/features/account/presentation/screens/settings_screen.dart`; `lib/features/account/presentation/controllers/demo_session_controller.dart`; `lib/features/account/data/firebase_account_repository.dart` |
| Sign-out result handling | The demo controller also calls `getDemoSession()` after sign-out, potentially reporting an error after authentication has already signed out. Settings then navigates to the signed-out route regardless of whether the operation succeeded. | `lib/features/account/presentation/controllers/demo_session_controller.dart`; `lib/features/account/presentation/screens/settings_screen.dart` |
| Cancellation feedback | The scan leave dialog returns a decision and closes before `cancelSession` is awaited. There is no visible cancellation-pending state during the request. | `lib/features/scan/presentation/screens/scan_session_screen.dart`, `_confirmLeave` |
| Shared button feedback | Loading hides the button label; secondary/ghost variants default to a white spinner on a light surface. | `lib/shared/widgets/app_button.dart` |
| Real QR lookup | The camera stops while a bin lookup is pending, but production scanning has no explicit checking-bin overlay. | `lib/features/scan/presentation/screens/scan_screen.dart`; `lib/features/scan/presentation/widgets/qr_capture_view.dart` |
| Image selection | The selected chip changes immediately, but draft-save status is hidden. Asset-list errors become an empty list and the picker can remain absent. | `lib/features/scan/presentation/screens/scan_session_screen.dart`; `lib/features/scan/presentation/widgets/simulation_asset_picker.dart` |
| Progress plumbing | Flutter parses `jobSubstage` but does not render it. Worker stage timings are logged, while the durable checkpoint occurs after artifact creation. The checkpoint operation requires an artifact reference and is not a general progress-event API. | `lib/features/scan/domain/models/deposit_session.dart`; `services/vision/src/ecoloop_vision/application/run_job.py`; `services/vision/src/ecoloop_vision/application/inspect_image.py`; `functions/src/infrastructure/firestore/jobs_store.ts` |
| Background restoration | The Flutter active-session tracker is in memory and screen-driven. Backend settlement clears the resident's `activeSessionId`, so that pointer alone cannot restore a result completed while the app was closed. | `lib/features/scan/presentation/controllers/scan_controller.dart`; `functions/src/infrastructure/firestore/settlement_store.ts` |
| Notification interruptions | The coordinator routes every handled deposit event to History, including foreground messages, and does not open the specific deposit. | `lib/features/notifications/presentation/notification_coordinator.dart` |
| Hidden recovery | Commands are serialized per resident and ambiguous writes have durable recovery support, but the UI does not distinguish queuing/recovery from an ordinary failure. | `lib/core/firebase/command_client.dart`; `lib/core/data/pending_operation_store.dart` |
| History access | The controller receives pagination cursors, but the screen offers no Load more action. Activity rows do not open receipt details. | `lib/features/activity/presentation/controllers/history_controller.dart`; `lib/features/activity/presentation/screens/history_screen.dart`; `lib/features/activity/presentation/widgets/deposit_activity_tile.dart` |
| Dashboard coupling | Core dashboard data is assembled as one async value, so one failed dependency can remove otherwise usable sections. | `lib/features/home/presentation/controllers/home_controller.dart`; `lib/features/home/presentation/screens/home_screen.dart` |
| Forms and outcomes | Profile editing is considered dirty even without changed values; save success is subtle; completed scan visuals use a check/success-style surface for nonverified outcomes as well. | Account form screens; `lib/features/scan/presentation/widgets/bin_session_visual.dart` |

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

- `lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`
- `lib/features/recycling_guide/presentation/widgets/recycling_steps_list.dart`

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

- `lib/features/recycling_guide/data/firebase_recycling_guide_repository.dart`
- `lib/features/recycling_guide/domain/models/recycling_material.dart`
- `lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`
- `lib/features/recycling_guide/presentation/widgets/material_rates_table.dart`
- `lib/features/recycling_guide/presentation/controllers/recycling_guide_controller.dart`

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
   - Plastic bottles: `assets/icons/plastic-bottle.png`
   - Glass bottles: `assets/icons/milk-bottle.png`
   - Aluminium cans: `assets/icons/open-can.png`
   - Paper: `assets/icons/paper-recycle.png`
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

- `lib/features/recycling_guide/presentation/widgets/material_guide_card.dart`
- `lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`
- `lib/features/recycling_guide/domain/models/recycling_material.dart`
- `assets/icons/`
- `pubspec.yaml`, if an additional illustration is needed

**Done when:** Every displayed accepted material has a visible, appropriate
illustration and readable preparation guidance. Cards resemble the reference,
remain policy-accurate, and have no overflow at narrow widths or larger text sizes.

## Phase 4 — Repair system Back and swipe-back navigation

**Objective:** Preserve the previous destination and give hardware/button Back,
system swipe-back, and in-app back arrows consistent behavior.

### Navigation rules

1. Close a dismissible dialog or sheet before leaving the page. An in-flight
   mutation dialog follows Phase 6A's pending/recovery behavior instead of being
   dismissed as though the operation had stopped.
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

- `lib/app/router/app_router.dart`
- `lib/app/presentation/resident_shell.dart`
- `lib/app/presentation/resident_bottom_navigation.dart`
- `lib/app/presentation/resident_top_bar.dart`
- `lib/app/router/leave_decision_coordinator.dart`
- Navigation entry points in Home, rewards, activity, account, and scan screens
- `android/app/src/main/AndroidManifest.xml`, if platform verification requires it

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
   show **Signing out...** in the still-open confirmation dialog while pending,
   using the common interaction behavior defined in Phase 6A.
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

- `lib/features/account/presentation/screens/settings_screen.dart`
- `lib/features/account/presentation/controllers/demo_session_controller.dart`
- A dedicated sign-out controller under `lib/features/account/presentation/controllers/`
- `lib/features/account/data/firebase_account_repository.dart`
- `lib/features/account/data/mock_account_repository.dart`
- `lib/app/router/route_guards.dart`

**Done when:** Opening Settings shows no sign-out error. Cancelling confirmation
does nothing. Successful sign-out reaches the signed-out screen without a false
failure label. Genuine failure keeps the user on Settings with a retryable error;
retry success clears it. Back after success cannot restore the resident screens.

## Phase 6 — Resident UX improvements in approved priority order

### Shared interaction and state rules

Every network-backed action must have a visible state transition:

```text
Idle -> Pending -> Confirmed success
                 -> Confirmed failure -> Retry
                 -> Outcome unknown -> Recover original operation -> Resolved
```

- Set pending state synchronously when an accepted action starts, before awaiting
  network calls, command locks, or persisted-operation access. Target a visible
  acknowledgement on the next frame, approximately within 100–200 ms on the
  reference device. This is a UX response target, not a backend completion SLA.
- Use action-specific labels and preserve control dimensions during loading.
- Optimistically reflect reversible local choices, such as selected images or
  draft switches. Confirm cancellation, points credits, redemption, and sign-out
  only from the corresponding authoritative outcome.
- Keep errors near the action that failed. Preserve usable content and drafts.
- Prevent repeated submissions and conflicting actions while a command is in
  flight. An uncertain result is a recovery state, not proof of failure.
- Keep operation state separate from initial page loading and from business
  state such as session stage, result outcome, or wallet balance.

### Phase 6A — Immediate visual feedback

**Priority:** 1. **Dependency:** Integrate the Phase 5 sign-out repair in this
increment. Subsequent UX phases reuse these controls and operation states.

#### 6A.1 — Shared pending buttons, dialogs, and feedback

1. Extend `AppButton` with a pending label while keeping a visible spinner and
   text together. Correct spinner contrast for primary, secondary, danger, and
   ghost variants; preserve the minimum tap target and prevent layout jumps.
2. Extend `AppConfirmationDialog` with action-specific pending copy and an async
   confirmation result. Reuse it for scan cancellation and sign-out rather than
   closing the dialog and running an invisible command afterwards.
3. Keep the dialog open while pending. Guard its buttons, barrier taps, and system
   Back consistently so a gesture cannot dismiss it and imply cancellation of a
   request already being processed. Before confirmation, normal dismissal means
   no operation starts.
4. On genuine failure, restore retry controls and show an inline message in the
   same dialog. On success, close/navigate once. If the authentication router
   already removed the dialog, do not pop a second route or access disposed state.
5. Reuse `AppFeedbackBanner` for meaningful local success/recovery messages. Make
   pending/error/success changes accessible through text and restrained live
   announcements rather than colour alone.

#### 6A.2 — Scan cancellation

1. Keep **Keep recycling** and **Cancel session** explicit in the confirmation.
   After confirmation, change the latter to **Cancelling session...** immediately.
2. Use a single-flight cancellation operation shared by the Back arrow, system
   Back, and tab-leave coordinator. Repeated leave actions must not create several
   dialogs or several cancellation requests.
3. Do not clear the active session or leave its screen until cancellation is
   acknowledged or recovered as already applied.
4. If submission and cancellation compete, resolve the committed session stage
   first. A submitted deposit transitions to its processing view; it is not
   presented as successfully cancelled.
5. If cancellation fails, retain the session and show **Cancellation could not
   be confirmed. Try again.** Use outcome-unknown recovery when appropriate,
   rather than prematurely declaring that the session is still active.

#### 6A.3 — Sign-out

1. Apply Phase 5's dedicated sign-out state, with **Signing out...** inside the
   confirmation dialog and no demo-session API calls in the Firebase UI flow.
2. Cover notification-device unregistering, Google sign-out, and Firebase auth
   sign-out as one visible operation. Measure cleanup separately, bound stalled
   waits with explicit outcomes, and retain the intended cleanup semantics.
3. Resolve success from authentication state. An auth-driven redirect after a
   successful sign-out must not appear as a disposal/cleanup failure.
4. A genuine failure while still signed in stays in the dialog with retry.
   Signing in again starts with fresh sign-out and navigation state.

#### 6A.4 — Scan entry, image choice, and submission

| Interaction | Immediate pending message | Confirmed outcome |
| --- | --- | --- |
| Real QR detected | QR detected — checking bin... | Bin details, or an actionable QR/bin error |
| Confirm bin/session | Confirming session... | Ready-to-deposit stage |
| Report Finish | Recording finish... | Image-selection stage |
| Choose prepared image | Saving selection... | Selection ready |
| Continue | Submitting for verification... | Processing stage and stable deposit identity |

1. Overlay QR lookup feedback on the scanner surface and keep the camera paused
   until the lookup resolves. Prevent duplicate captures and pause the camera
   when its tab is hidden as well as when the app is backgrounded.
2. Give the image picker separate loading, empty, failed, selected, saving, and
   ready presentations. A disabled Continue button must have a nearby reason.
3. Use a latest-selection-aware draft-save coordinator. Save the latest choice
   after any earlier save finishes, and ensure Continue waits for that exact
   acknowledged asset/version. Freeze selection during submission or explicitly
   reject further changes until it resolves.
4. Keep the selected draft on failure and offer retry. Do not let session renewal
   and draft writes create silent conflicts; refresh/reconcile versions as needed.
5. Continue submits a prepared source reference in the current application.
   Avoid an **Uploading photo** message unless an actual upload is introduced.

#### 6A.5 — Other resident mutations

- Profile/preferences: **Saving changes...**, then **Changes saved**; retain
  entered values on failure and define editing/Cancel behavior during a write.
- Reward redemption: **Redeeming reward...** in the existing dialog; retain
  request identity on retry and surface the confirmed voucher with **Open voucher**.
- Demo voucher use: **Marking voucher as used...**, then the confirmed used state.
- Keep initial loading independent from action failure so visiting a page does
  not display a failure for an action the user never attempted.

**Primary files:** `lib/shared/widgets/app_button.dart`,
`lib/shared/widgets/app_confirmation_dialog.dart`,
`lib/shared/widgets/app_feedback_banner.dart`, scan screens/picker/camera widgets,
account screens/controllers, rewards screens/dialogs, and command-client state
integration where needed.

**Acceptance / phase gate:**

- [ ] A deliberately delayed request produces visible pending feedback before it resolves.
- [ ] Cancellation and sign-out dialogs remain visible through pending and retry.
- [ ] Repeated taps/Back do not duplicate requests, dialogs, or navigation.
- [ ] Latest image selection is the draft actually submitted.
- [ ] QR lookup, save, redemption, and voucher-use actions identify their pending operation.
- [ ] Genuine success and failure produce one clear outcome without losing user input.

### Phase 6B — Partitioned scan-loading UX with real progress

**Priority:** 2. **Dependency:** Phase 6A pending states and stable submission
identity. Includes a small cross-stack progress contract and worker integration.

#### 6B.1 — Card layout and stage copy

Place a five-segment indicator in the lower portion of the main scan card, with
a current-stage message, completed/current/future segment styling, and elapsed
time. Keep long messages readable at enlarged text sizes.

| Segment | Message while active | Completion evidence |
| --- | --- | --- |
| 1 | Preparing your deposit | Submission is durably acknowledged; queued work remains explicitly labelled as queued |
| 2 | Validating the image | Worker has loaded and validated the committed source |
| 3 | Identifying recyclable items | Detection and initial object reconciliation have completed |
| 4 | Confirming materials | Required specialist/fallback analysis and eligibility preparation are complete |
| 5 | Saving your result | Receipt and applicable wallet/stat changes have committed |

```text
                Confirming materials
       Some items need an additional check.

           [done] [done] [done] [active] [next]
                 Step 4 of 5 · 00:38

                 Continue using EcoLoop
```

- Render **Step N of 5**, not a fabricated time-based percentage.
- Animate the active segment gently; completed segments change only after real
  confirmation. Fast/skipped conditional stages may advance immediately.
- Use **Request received — waiting for verification to start** for queued work.
- Show **Some items need an additional check** only when additional analysis is
  actually selected. Use **Verification is being retried** for a real retry.
- Do not force every deposit through artificial delays to display every message.

#### 6B.2 — Progress contract

1. Define an additive, typed resident progress summary on the owner-readable
   session. Suggested fields are `phase`, `activity`, `revision`, `attemptNumber`,
   `completedStages`, `submittedAt`, `stageStartedAt`, `lastUpdatedAt`, and
   `deadlineAt`. Final outcome remains in the committed receipt.
2. Keep phases distinct from activity (`queued`, `running`, `retrying`,
   `finalizing`) and from client connection state. A stationary stage does not
   prove the connection is lost or processing has failed.
3. Keep business `session.version` separate from `progress.revision`. Progress
   writes must not create confirm/cancel/version conflicts. Update Flutter's
   local/streamed merge logic to accept newer progress at the same business
   version; `_preferredSession` currently prefers equal-version local state.
4. Fence updates by the current worker attempt and an increasing sequence. Ignore
   stale/replayed events. An old attempt cannot overwrite a newer attempt or a
   committed result. A retry can revisit a stage with an explicit retry label;
   it must not invent completion or lose the deposit identity.
5. Update shared snapshot/gateway schemas, parsers, and golden/invalid fixtures.
   Existing documents without progress fields use the generic processing state.
   The existing `jobSubstage` may be mapped explicitly for compatibility.

#### 6B.3 — Backend and worker integration

1. Publish queued/submitted progress when `submitInspection` commits. Persist
   `submittedAt` and `deadlineAt` on the session so reopening retains timing.
2. Add a lightweight worker progress operation/callback independent of artifact
   checkpoints. The current checkpoint API requires an artifact output reference,
   which does not exist during image loading/detection.
3. Emit meaningful stage starts/completions from source validation, detector
   reconciliation, conditional specialist/Gemini work, and finalization. Aggregate
   parallel calls into a meaningful stage rather than rapidly flickering messages
   per object/model. Keep UI wording independent of provider/model names.
4. Use bounded, low-frequency writes for stage transitions/retries, not a write
   per animation frame. Progress publication must not turn an otherwise valid
   inference into a failed deposit; final receipt delivery remains authoritative.
5. Publish final progress with settlement or terminal referral. The final segment
   completes only when the receipt commits. Keep **Awaiting review** distinct from
   **Verified**; held points are never presented as credited.
6. Project only resident-facing status into the session. Residents continue to
   read their session/result rather than subscribing to internal inference jobs.

#### 6B.4 — Long-wait behavior and timing

1. Start a local submitting timer immediately. After acknowledgement, derive
   elapsed time from the server submission timestamp so it survives reopening.
2. Use an initial configurable slow-message threshold of 30 seconds and a stronger
   **This is taking longer than usual; you can continue using EcoLoop** message
   at 60 seconds. Calibrate both using device/backend timings before release.
3. Continue showing the actual stage. Timers change reassurance text, not stage,
   eligibility, completion, or failure. Do not invent an exact remaining-time ETA.
4. If the server deadline passes without a receipt, show **Checking final status**
   and reconcile the existing deposit. Only the backend can declare referral,
   expiry, or failure; maintenance currently refers exhausted processing to review.
5. Keep progress available even when the result stream is temporarily unavailable.
   If a terminal session arrives before its receipt, show **Loading your result**
   with recovery rather than a premature success visual.

**Primary files:** scan session/model/repository/controller/widgets;
`contracts/backend/v1/snapshots.schema.json` and associated contracts/fixtures;
`functions/src/infrastructure/firestore/inspection_store.ts`, `jobs_store.ts`,
`settlement_store.ts`, `maintenance_store.ts`;
`functions/src/transport/internal_jobs.ts`;
`services/vision/src/ecoloop_vision/application/run_job.py`, `inspect_image.py`;
`services/vision/src/ecoloop_vision/infrastructure/job_gateway.py`.

**Acceptance / phase gate:**

- [ ] Five segments and meaningful messages are visible in the main card.
- [ ] Normal, queued, additional-analysis, retry, and referral paths reflect real events.
- [ ] Advancing the device clock alone cannot advance a processing segment.
- [ ] Missing progress fields degrade gracefully; late/replayed events cannot regress a result.
- [ ] Progress does not change business command versions or add material processing delay.
- [ ] Reopening preserves elapsed time; review/empty/rejected outcomes never imply credit.

### Phase 6C — Background continuation and restoration

**Priority:** 3. **Dependencies:** Phases 6A–6B and Phase 4's navigation/leave rules.

#### 6C.1 — Explicit continuation behavior

1. Add **Continue using EcoLoop** during submitted processing, with concise copy:
   **Your deposit will keep processing. You can view its progress from Home.**
2. Leaving, switching tabs, or backgrounding the app stops only screen-specific
   work. Server processing continues without a foreground timer or an on-screen
   scan widget. Do not clear the submitted deposit tracker on Back to Home.
3. Before submission, **Cancel session** means backend cancellation. After
   submission, leaving means continuation. A true stop-verification command is
   a separate future backend feature, not part of this interaction.

#### 6C.2 — App-scoped tracking and persistent card

1. Move tracking out of stage-screen post-frame side effects into an app-scoped,
   authenticated resident-work controller/repository. Views subscribe to it;
   mounting a particular scan stage is not required to keep tracking alive.
2. Show a compact Home progress card independently of the dashboard's other data:
   current stage, elapsed time, and **View progress**. Make it reachable near the
   main scan action and clear of the raised bottom Scan control.
3. On completion, transition the card to the actual outcome and **View result**.
   Keep it visible until the resident views/dismisses that result. Review remains
   discoverable in History after the initial processing card is acknowledged.
4. Selecting Scan while work is active resumes the existing session. Explain why
   another session cannot start if the backend's active-session rule blocks it.

#### 6C.3 — Restore from authoritative references

1. Read the resident's existing `activeSessionId` at startup/sign-in and when the
   app resumes. Use a dedicated scan/work projection reader instead of relying
   on the display-profile model, which currently drops that field.
2. Add a retained resident summary/reference for the latest submitted deposit,
   such as `latestDeposit`, containing session/batch/result identity and decision
   version. Update it on submission, settlement, review resolution, and terminal
   referral. Settlement clears `activeSessionId`, so that pointer alone is
   insufficient for results completed while the app was closed.
   A delayed update for an older batch must not overwrite a newer submitted
   batch's reference; older review outcomes remain discoverable through retained
   owner-scoped notification events and History.
3. Keep result-seen/dismissed state keyed by resident, result identity, and receipt
   decision version. A later review decision can generate a new result update
   without re-showing an old acknowledged version. A new device can discover the
   retained reference. Observe retained owner-scoped update events as well as push
   messages so older review updates remain discoverable without push permission.
4. Restore an active pre-submission session to its committed stage/draft; restore
   submitted work to progress or its latest receipt. Never resubmit merely
   because a screen or app was recreated.
5. A local saved reference may accelerate offline display, but reconcile it with
   the server. Remove expired/cancelled work appropriately and keep another
   account's cached work out of the new resident's UI.
6. On sign-out, dispose resident watchers and hide local cards. Submitted server
   work continues and can be restored on sign-in. Completion while signed out
   must not navigate into the authenticated shell.

#### 6C.4 — Navigation and lifecycle behavior

- Progress/result links carry stable IDs and use Phase 4's parent/back rules.
- A resumed app reattaches to the existing operation/session/result; it does not
  restart the inference or rely on the old route still being mounted.
- Reconcile a completion arriving during route change so navigation occurs once.
- If another deposit is active while a prior result is unseen, prioritize active
  progress and provide access to the prior result through the card/history rather
  than overwriting or confusing the two identities.

**Primary files:** scan controllers/repositories, Home screen/widgets,
`lib/app/providers/app_providers.dart`, router/shell navigation,
`lib/core/data/pending_operation_store.dart` or a small dedicated per-resident
view-state store; session/submission/settlement stores and resident projections.

**Acceptance / phase gate:**

- [ ] Leave processing, use Home/Settings, and return to the same deposit.
- [ ] Background and reopen without creating another submission/job.
- [ ] Kill/restart during processing and restore progress from server references.
- [ ] Kill/restart after server completion and discover the unseen receipt.
- [ ] A review resolved later produces the newer result version once.
- [ ] Sign-out/sign-in and account switching maintain correct resident work state.

### Phase 6D — Recovery and task continuity

**Priority:** 4. **Dependencies:** Stable operation identity and tracking from
Phases 6A–6C; receipt navigation builds on Phase 4.

#### 6D.1 — Explain uncertain operations and reconnection

1. Expose command pending/recovery state through the operation controller. When a
   transport timeout could follow an applied write, show **Checking whether your
   request completed...** and recover the original request ID/payload.
2. Keep a durable pending intent until the server outcome is resolved. Do not
   clear it or generate a new redemption/submission request merely to dismiss an
   error. If a new action is blocked by existing work, show which action is being
   checked and provide **Check status** / **Return to deposit** as appropriate.
3. Audit command-client serialization: foreground actions can wait behind draft
   saves or renewals. Preserve correctness while making that wait visible and
   coalescing redundant renewals/draft updates where possible.
4. Distinguish confirmed failure, an unresolved outcome, cached data, and lost
   connectivity. Derive connection claims from transport/snapshot evidence,
   not simply from a stage taking a long time.
5. Retain the last meaningful progress/content with a **Reconnecting...** or
   **Showing last loaded data** indicator. Restore streams on resume/reconnect
   with bounded retry/backoff. A manual Check status action reads/reconciles;
   it does not create another inspection.

#### 6D.2 — Recoverable scan states

1. Render separate loading/error/empty states for image assets, bin information,
   session, and receipt. Each includes the relevant Retry or return action.
2. Map session-expired, asset-version-changed, already-submitted, processing-paused,
   and version-conflict responses to a useful next step. Refresh authoritative
   state before retrying an invalid transition.
3. For denied camera permission, explain how to enable it and provide an OS
   settings/retry path supported by the platform. Recheck on return to the app.
4. If the result cannot load, preserve the deposit identity and offer **Retry
   result** or History. Do not show a completed check mark with no usable receipt.

#### 6D.3 — Non-interrupting notifications

1. Distinguish foreground receipt delivery from an explicit notification tap
   using `fromBackground`/event origin. Foreground delivery updates state and
   shows **Your deposit result is ready — View result** without changing routes.
2. Route a user-selected notification/banner to the specific deposit receipt.
   Run the shared leave-decision coordinator before leaving a dirty form or an
   active pre-submission session. Declining leaves the update discoverable.
3. Queue a tapped destination until authentication resolves. Deduplicate by event
   identity and decision version; bound/reset per-resident deduplication state.
4. Suppress redundant banners when that exact result version is already visible.
   Respect notification preferences and avoid duplicate in-app/system alerts.
5. Notification permission denial must not break the in-app progress card or
   history refresh. Notification taps are optional entry points, not the only
   way to discover an outcome.

#### 6D.4 — Deposit receipts and complete history

1. Add an owner-scoped deposit/receipt detail destination keyed by batch/result
   identity, reusing the result presentation rather than depending on a live
   scan-stage route. Open it from History, Home, progress cards, and notifications.
2. Show material counts, accepted/excluded lines, points per line and total,
   submission time/bin, review state, and readable explanations. Map reason codes
   such as `processing_deadline_elapsed` into resident copy; keep technical
   references secondary. Provide actual confirmed result data only.
3. Connect the existing history cursor support to **Load more**, with loading and
   retry at the list footer. Retain existing items and scroll position.
4. Define deterministic paging/live-update reconciliation: deduplicate by deposit
   identity and decision version, handle a changed first page, and remove entries
   that no longer match the selected filters. Avoid the current indefinitely
   accumulated `seen` map retaining stale filter membership.
5. Validate date ranges before applying them and show an inline explanation for
   reversed ranges. Preserve filter/query state when opening and returning from
   receipt details. Differentiate no activity from no matching filtered activity.
6. Review loading/order/filter timestamps against actual Firestore document types
   and shared fixtures so paging older records works with the existing dataset.

**Primary files:** command client/pending store and scan failure mapping;
scan/QR screens and repositories; notification coordinator/service;
activity controller/repository/screens/tiles; result widgets; routes and shared
leave-decision integration. Add a focused receipt detail screen/repository method
under the existing activity/scan feature boundary as appropriate.

**Acceptance / phase gate:**

- [ ] A response lost after server commit recovers the same deposit/voucher once.
- [ ] Offline/reconnect and stream failures retain usable content and identities.
- [ ] Foreground notifications cannot steal focus/navigation from a scan or form.
- [ ] Tapped updates open the correct receipt and honor pending edits.
- [ ] More than 25 deposits are reachable without gaps/duplicates in tested paging scenarios.
- [ ] Review updates and filter changes do not leave stale rows/results visible.

### Phase 6E — Broader polish, accessibility, and responsiveness

**Priority:** 5. **Dependencies:** Earlier UX contracts and flows are stable.
Complete the original guide presentation work from Phases 1–3 in this increment
if it has not already shipped.

#### 6E.1 — Partial loading and refresh

1. Split Home's profile, wallet, impact, recent activity, and resident-work card
   into independently usable states. One failed dependency must not remove the
   progress card, navigation actions, or successfully loaded sections.
2. Use stable skeletons/placeholders for first loads, and retain prior content
   with a small updating indicator during refresh. Expose local retry for the
   section that failed. Do not imply cached wallet data is freshly confirmed.
3. Apply the same retained-content pattern to rewards/vouchers/guide refreshes
   where useful. Prevent periodic voucher expiry refresh from blanking the page;
   derive expiry from timestamps and streams without unnecessary full reloads.

#### 6E.2 — Forms and action outcomes

1. Derive profile dirty state from differences against the saved snapshot, not
   simply being in edit mode. Disable Save for unchanged/invalid drafts.
2. Keep validation beside its field, clear obsolete errors when corrected, and
   preserve drafts when network writes fail. Do not label every password/security
   backend error as an incorrect current password.
3. While saving, either freeze that form's controls or preserve a newer draft
   separately from the submitted snapshot. Cancel must not pretend to reverse a
   write already accepted by the backend. Keep the rest of the app usable.
4. Show a concise saved confirmation for profile/preferences. Reward redemption
   retains its confirmed voucher and an accessible **Open voucher** action even
   if the previous page was scrolled away from its top success banner.

#### 6E.3 — Honest result and status presentation

| Outcome | Visual/copy direction | Points presentation |
| --- | --- | --- |
| Verified | Green check and verified receipt | Confirmed awarded total |
| Awaiting review | Clock/review illustration and explanation | Pending/on hold, not earned |
| Empty | Neutral empty-result illustration and next step | Confirmed zero |
| Not eligible | Explanatory information and excluded-material details | Confirmed zero |
| Result unavailable | Recovery icon and Retry result | Unknown, not a guessed zero |

1. Replace the universal completed check/success surface with outcome-aware
   visuals. Keep **Processing**, **Awaiting review**, and **Verified** distinct.
2. Replace resident-facing backend terminology with task language. Keep demo-only
   explanations confined to mock/demo mode, including History's current blanket
   illustrative-data notice.
3. Make the header's notification indicator reflect actual unseen updates rather
   than displaying a permanent red dot. Use the same retained event/result-seen
   state as the result card; do not imply unread notifications without data.
4. For rewards that cannot be redeemed, explain the reason and, when applicable,
   the actual points shortfall rather than relying on a disabled control alone.

#### 6E.4 — Accessibility and motion

- Preserve 48-logical-pixel minimum control targets and readable layout at
  approximately 320/390/480 logical-pixel widths and enlarged text.
- Support light-surface spinner contrast, explicit status text, and screen-reader
  labels for progress/current stage. Announce stage changes once; do not announce
  every elapsed second or animation frame.
- Respect reduced-motion settings for the existing spinning icon as well as the
  new segmented indicator. Provide a static current-stage alternative.
- Keep dialogs, error messages, keyboard-visible forms, and footer actions within
  the usable viewport. Restore focus to the triggering action where appropriate.

#### 6E.5 — Measure and address actual waiting time

1. Use existing Flutter submission/receipt timings and worker stage logs to
   measure tap-to-feedback, submission acknowledgement, queue delay, source load,
   detectors, specialist/fallback calls, artifacts, and settlement.
2. Record representative fast, slow, and additional-analysis cases with the
   runtime/device used. Use the results to tune the 30/60-second reassurance
   thresholds and any expectation-setting copy.
3. Investigate the measured slowest stage first. Detectors already run in
   parallel; avoid treating parallelization as an unimplemented optimization.
   Keep progress writes lightweight and record their added latency.
4. Compare before/after timings for any optimization. Preserve classification,
   review, and settlement semantics while reducing unnecessary waiting.

**Primary files:** Home controller/screens/widgets; account forms/controllers;
rewards/voucher screens; scan/result/scanner widgets; shared feedback/loading
controls; resident top bar; runtime-specific copy; existing timing/logging paths.

**Acceptance / phase gate:**

- [ ] One failed dashboard section does not blank the rest or hide active work.
- [ ] Unchanged forms do not prompt for discard; save success/failure is explicit.
- [ ] Every result has an appropriate visual and accurate points/status text.
- [ ] Refresh, enlarged text, keyboard visibility, and reduced motion remain usable.
- [ ] Timing evidence supports slow-state copy and any performance changes.

## Phase 7 — Cross-stack regression and device verification

Verification happens within each implementation increment, followed by this
final connected acceptance pass. Prefer tests of meaningful behavior and failure
boundaries over tests that duplicate styling or implementation structure.

### 7.1 — Automated acceptance coverage

| Area | Required regression cases |
| --- | --- |
| Original guide fixes | Actual policy/reference-document schema; canonical eligibility; paper category deduplication; cardboard exclusion; glass; examples; material cards and rates section rendering; policy changes |
| Immediate feedback | Delayed futures show pending label/spinner before resolution; pending dialogs resist dismissal; one request for rapid taps; local retry; auth navigation removes sign-out dialog once |
| Sign-out correctness | Initial Firebase Settings has no sign-out error; UI/controller never requests Firebase demo-session data; confirmation cancellation; pending cleanup; genuine failure/retry; auth success; Back after logout |
| Image selection | Rapid A-to-B changes with A's save delayed; Continue submits B only after B is acknowledged; expired asset; save failure; submission/cancellation race |
| Progress contract | Additive fields and old documents; conditional/skipped stages; same session version with newer progress; attempt/sequence fencing; duplicate/out-of-order events; telemetry failure does not fail classification |
| Terminal settlement | Verified/review/empty/rejected/referral paths; one wallet credit; progress cannot overwrite a final receipt; missing receipt is recoverable |
| Continuation | Leave/reopen, app restart, cold start after completion, retained latest-result reference, review decision update, sign-out/sign-in, resident switch |
| Recovery | Lost acknowledgement after applied cancellation/submission/redemption; same-ID recovery; offline reconnect; queued commands; no duplicate credits/vouchers/jobs |
| Notifications | Foreground message does not navigate; tap opens correct receipt; dirty-form decision; duplicate event/version; pending auth; notifications denied but in-app discovery works |
| History | More than 25 rows; footer retry; live review updates during pagination; no stale filtered membership; receipt Back preserves filters/scroll; invalid date range |
| Broader states | Independent dashboard failures; draft preservation and actual dirty detection; accurate outcome visuals/text; refresh retains content |
| Navigation | System pop, tab history, direct-link parents, overlays, guarded forms/scans, no stale scan stages, no authenticated navigation after sign-out |

### 7.2 — Relevant existing suites and planned additions

Flutter suites to extend:

- `test/features/recycling_guide/firebase_guide_test.dart`
- `test/features/recycling_guide/recycling_guide_test.dart`
- `test/app/app_router_test.dart` and `test/app/resident_shell_test.dart`
- `test/features/account/settings_flow_test.dart`
- `test/features/account/firebase_auth_flow_test.dart`
- `test/features/account/account_providers_test.dart`
- `test/features/scan/scan_flow_test.dart`
- `test/features/scan/session_recovery_test.dart`
- `test/features/scan/capture_and_picker_test.dart`
- `test/features/scan/firebase_scan_repository_test.dart`
- `test/features/scan/backend_scan_models_test.dart`
- `test/features/notifications/notification_lifecycle_test.dart`
- `test/features/home/home_screen_test.dart`
- Activity/history and reward suites under their existing feature directories
- `integration_test/resident_journey_test.dart`

Add focused shared-control tests for pending dialogs/buttons and controller tests
for progress merging/resident-work restoration where existing suites cannot
express those behaviors cleanly.

Backend coverage belongs in the existing sessions/submission/jobs/settlement,
maintenance, rewards, notification/outbox, rules, and contract suites. Extend
Python `test_run_job.py`, `test_inspect_image.py`, `test_job_gateway.py`, and
`test_contracts.py` for progress emission and compatibility.

Use controlled delayed futures and scripted worker/transport events for automated
tests; do not depend on real provider timing or a wall-clock one-minute sleep.
Use visual/device checks for the small spacing and animation refinements.

### 7.3 — Verification commands

From the repository root:

```text
flutter analyze
flutter test test/features/recycling_guide test/app test/features/account test/features/scan test/features/rewards test/features/activity test/features/home test/features/notifications test/core
flutter test integration_test/resident_journey_test.dart -d <android-device-id>
```

From `functions/`, run the suites relevant to the changed boundary:

```text
npm run build
npm run test:unit
npm run test:sessions
npm run test:submission
npm run test:jobs
npm run test:settlement
npm run test:maintenance
npm run test:rewards
npm run test:outbox
npm run test:rules
```

From `services/vision/`, using the project's Python environment:

```text
uv run --group test pytest tests/test_run_job.py tests/test_inspect_image.py tests/test_job_gateway.py tests/test_contracts.py
```

Run emulator-backed suites through their existing scripts/configured ports.
Run the resident journey in its expected mock runtime and connected Firebase
acceptance separately with the project's configured test environment. Validate
the real policy shape and intended named Firestore database configuration.

### 7.4 — Connected acceptance journeys

1. **Normal deposit:** QR detection -> visible lookup -> confirm -> Finish ->
   selected/saved image -> submission -> real stage progress -> verified receipt
   -> updated wallet/Home/history, with no repeated operations.
2. **Cancellation:** Open leave dialog -> keep recycling; open again -> delayed
   cancellation -> pending dialog -> confirmed return. Repeat with a genuine
   failure and an acknowledgement lost after commit.
3. **Long verification:** Queue/additional analysis -> 30/60-second reassurance ->
   continue using app -> persistent Home card -> return to progress/result.
4. **Process restoration:** Background/kill during processing; then a separate run
   completing while closed. Reopen into the correct work/result without resubmission.
5. **Review:** Processing -> awaiting review with no credited points -> leave ->
   later decision -> non-interrupting update -> correct receipt and one credit.
6. **Connection loss:** Disconnect before/after submission acknowledgement, during
   cancellation, and during redemption. Reconnect and reconcile original operations.
7. **Concurrent update:** Edit a profile/preferences form while a deposit completes.
   Receiving the notification must not navigate; selecting View result honors edits.
8. **Sign-out:** Idle Settings -> confirm -> pending dialog -> successful signed-out
   state. Exercise failure/retry and sign back in with/without an active deposit.
9. **History:** Browse more than 25 deposits, apply filters, open a receipt, return,
   and receive a review update while a later page is visible.

### 7.5 — Visual, accessibility, and platform checklist

- [ ] Compare all three guide sections against the supplied screenshots.
- [ ] Test approximately 320, 390, and 480 logical-pixel widths and enlarged text.
- [ ] Confirm guide/table, progress card, dialogs, and actions clear the bottom navigation.
- [ ] Check keyboard-visible forms, screen-reader stage announcements, and reduced motion.
- [ ] Test Android three-button Back, swipe-back, and repeated Back during pending operations.
- [ ] Verify accurate verified/review/empty/rejected/unavailable presentation.
- [ ] Verify camera lifecycle, denied permission, and re-entry after OS settings.
- [ ] Verify notification permission denial, foreground delivery, and explicit taps.
- [ ] Record tap-to-feedback and stage/receipt timings on the reference device.

## Delivery sequence, compatibility, and completion

### Implementation increments

| Increment | Deliverables | Exit condition |
| --- | --- | --- |
| 1 — Immediate feedback | Phase 5 plus Phase 6A shared controls, cancellation, QR/actions, selection saves, and other mutation feedback | Immediate pending feedback and correct retry/success behavior |
| 2 — Real scan progress | Phase 6B contract, worker/gateway projection, segmented card, and slow-state messages | Events drive progress across normal/conditional/retry paths |
| 3 — Continuation | Phase 4 navigation prerequisites plus Phase 6C tracking, retained result reference, Home card, restoration | Leave/restart during or after processing resumes the same deposit |
| 4 — Recovery/continuity | Phase 6D and remaining Phase 4 integration | Ambiguous operations recover once; updates preserve the current task; receipts/history are usable |
| 5 — Broader polish | Phases 1–3 and Phase 6E | Guide fixes, independent loading, precise forms/outcomes, accessibility, and timing evidence |
| 6 — Final acceptance | Phase 7 | Required cross-stack checks and device journeys pass |

### Cross-stack compatibility

1. Add contract fields/read compatibility before enabling their producers.
   Existing clients/documents continue to work without progress/latest-result data.
2. Deploy backend support for progress and retained resident-work references,
   then worker progress emission, then enable the richer resident UI. Test old
   and new worker/client combinations during the transition. Enable the
   **Continue using EcoLoop** action with its Phase 6C tracking/restoration path,
   so an earlier progress-only increment does not advertise incomplete behavior.
3. Preserve business session/version, receipt decision, wallet, and command
   idempotency semantics. Progress and presentation state do not award points.
4. Existing processing sessions without new references remain recoverable through
   their owned session/deposit records; use a bounded fallback lookup when needed.
5. Each increment includes its focused verification. Final acceptance combines
   the delivered behavior rather than postponing correctness checks until the end.

### Definition of done

The work is complete when the five original issues and the five approved UX
workstreams meet their phase gates, required automated checks pass, and the
connected journeys have recorded evidence identifying device/runtime mode.

The resident can always tell whether an action was accepted, what work is
currently happening, whether they can leave, where to find its result, and how
to recover when the outcome or connection is uncertain.
