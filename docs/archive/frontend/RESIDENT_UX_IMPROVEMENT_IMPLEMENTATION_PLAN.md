# Resident UX Improvement Implementation Plan

- **Date:** 2026-10-22
- **Status:** Implementation plan revised to the user's confirmed exit-first UX.
- **Scope:** New resident-app UX work and its supporting Flutter, Firebase,
  Firestore, shared-contract, and vision-worker changes.
- **Implementation status:** Planned; this document does not claim the features
  or verification below have been completed.

## 1. Approved direction

### Immediate exit is the required behavior

Once a user confirms sign-out or scan cancellation, the interface must take them
to their destination immediately. Backend completion is background work, not a
condition for allowing the user to leave.

| Action | Immediate UI response | Background responsibility |
| --- | --- | --- |
| Confirm Sign out | Close the dialog, enter the app's locally signed-out state, clear resident navigation, and show Login | Complete local auth/provider sign-out and remote cleanup; silently retry unresolved work |
| Confirm Cancel session | Close the dialog, detach from that workflow, stop local camera/renewal/draft activity, and show Home | Persist and apply cancellation, release the matching reservation, reconcile competing writes, and retry silently |
| Dismiss the confirmation / Keep recycling | Close the dialog immediately and remain in the existing workflow | Start no sign-out or cancellation operation |
| Continue using EcoLoop during verification | Leave the progress screen immediately and show Home | Keep server processing and app-scoped status tracking active |

**No pending spinner, disabled modal, backend acknowledgement, or retry error may
hold the user inside either confirmed exit action.** A failure must not reopen
the dialog, restore the abandoned scan screen, or bounce Login back to Home.

### Priority order

1. **Immediate feedback and exit-first actions.**
2. **Partitioned scan loading with meaningful, real progress.**
3. **Background continuation and restoration.**
4. **Recovery and task continuity.**
5. **Broader polish and measured responsiveness.**
6. **Connected verification and rollout.**

### Relationship to the existing fix plan

The earlier guide, navigation, and sign-out bug fixes are tracked in
[`RECYCLING_GUIDE_NAVIGATION_AND_SIGN_OUT_FIX_PLAN.md`](RECYCLING_GUIDE_NAVIGATION_AND_SIGN_OUT_FIX_PLAN.md).
They are integration context, not implementation phases to repeat here. This
document contains only the new UX work. For the sign-out/cancellation behavior
covered here, the newer exit-first rules above are authoritative.

## 2. Interaction and reliability model

### 2.1 Two kinds of action

**Exit-first actions:** Sign out and Cancel session.

```text
Confirm -> local exit intent + immediate destination
                      |
                      +-> durable reconciliation -> retry -> backend resolved
```

The UI honors the user's decision once. The operation coordinator owns completion
after the initiating page/dialog has been disposed.

**Result-dependent actions:** QR lookup, confirming a bin, image selection/save,
submitting inspection, saving preferences, redeeming a reward, or using a voucher.

```text
Tap -> immediate local feedback -> work/recovery -> confirmed outcome
```

These actions acknowledge the tap immediately but do not invent a successful
reservation, receipt, points credit, or voucher. Their local pending state can
use a spinner and meaningful label; exit-first actions navigate instead.

### 2.2 Required background guarantees

- A recorded exit intent is not discarded after a small fixed retry count.
- Retry transient failures silently with exponential backoff, jitter, and a
  capped delay; resume on connectivity, app startup, and app foregrounding.
- After the server durably accepts an intent, server-owned jobs/reconciliation
  continue independently of whether the app is open or the resident is logged in.
- An offline intent first lives on the device. It is uploaded when execution and
  connectivity resume; a backend cannot act on a request it has never received.
  Existing reservation expiry remains a server-side fallback during that gap.
- Auth SDK sign-out is device-side work. A server queue can finish remote cleanup,
  but cannot call the device's Firebase/Google SDK after the app has stopped.
- Keep desired-state intent until reconciliation proves the requested state is
  reached, the target is already terminal, or an equivalent terminal cleanup
  makes further execution unnecessary.
- Persistent faults remain owned by background reconciliation and diagnostics;
  the user is not sent back to finish the exit or asked to keep pressing Retry.

### 2.3 Local responsiveness and lifecycle rules

- Target the destination/acknowledgement on the next frame, approximately within
  100–200 ms on the reference device. No network or provider SDK await belongs
  before exit navigation.
- Pre-stage small local journal records when the confirmation opens and persist
  the confirmed intent promptly. Use durable local storage, not a fire-and-forget
  Future attached to a screen. Checkpoint/restore behavior must be tested at
  actual persistence boundaries.
- A temporary local-storage failure does not trap the user. Keep the in-memory
  exit fence, continue the exit, and retry persistence while the process is alive.
- Duplicate taps produce one intent and one navigation. Late callbacks from the
  old screen cannot navigate, restart work, or change the current account.
- Preserve input and stable layout for ordinary pending actions. Use status text
  in addition to colour/motion, with accessible announcements at meaningful changes.

## 3. Relevant code findings

| Area | Current implementation issue | Implementation anchor |
| --- | --- | --- |
| Sign-out ordering | Remote notification cleanup and Google sign-out are awaited before Firebase sign-out. A failure earlier in the chain prevents later steps. | `lib/features/account/data/firebase_account_repository.dart`, `signOut` |
| Auth routing | Route guards use the SDK/repository auth state. Navigating to Login alone can immediately redirect back while the old auth state still says signed in. | `lib/app/router/route_guards.dart`; account repository auth publication |
| Cancellation | Screen-owned cancellation awaits backend completion before leaving. Version conflicts or a lost acknowledgement can block departure. | `lib/features/scan/presentation/screens/scan_session_screen.dart`, leave handling |
| Processing cancellation | The store can cancel a processing session, invalidate its job, and convert processing records to review. The new intent worker must reconcile this consistently with settlement rather than assume processing cannot be cancelled. | `functions/src/infrastructure/firestore/sessions_store.ts`, `cancelSession`; settlement/job stores |
| Existing operation storage | There is one ordinary pending command per resident and serialized command execution. A durable exit queue must not be blocked behind an unrelated ambiguous command. | `lib/core/data/pending_operation_store.dart`; `lib/core/firebase/command_client.dart` |
| Post-logout cleanup | Resident callables require auth. Simply retrying the current authenticated unregister/cancel call after SDK logout will fail. | `functions/src/transport/request.ts`; notification/session callables |
| Progress | `jobSubstage` is parsed but not connected to the loading UI; artifact checkpoints occur near the end and require an output reference. | Scan model/screen; Python worker; `jobs_store.ts` |
| Restoration | The active tracker is screen-driven/in-memory, and settlement clears `activeSessionId`. | Scan controller; `settlement_store.ts` |
| Task interruption | Foreground notifications route to History; asset/result failures can become unexplained empty/loading states; history lacks Load more and receipt links. | Notification coordinator; scan screen; activity controller/screen |

These findings identify integration points. Recheck surrounding code when each
phase starts so already-delivered fixes are reused rather than implemented twice.

## Phase 1 — Immediate feedback and exit-first actions

**Priority:** First implementation increment. Exit-first behavior includes durable
reconciliation in this phase; it is not postponed to the general recovery phase.

### 1.1 App-scoped exit coordinator and durable intent queue

1. Add an app-scoped coordinator for `signOut` and `cancelSession` desired-state
   intents. Its lifetime must outlive dialogs, routes, and resident page disposal.
2. Store a stable intent ID, operation type, target identity, owner, installation,
   auth/registration generation, creation time, state, retry metadata, and server
   acceptance/completion references. Keep payload identity immutable on retries.
3. Keep this exit queue separate from the existing single pending mutation slot,
   or extend the journal with an explicit priority/dependency model. Do not erase
   an unresolved submission/redemption to make room for cancellation or logout.
4. Apply the in-memory local exit fence immediately, initiate local persistence,
   and navigate without awaiting remote calls. Reconcile the original operation
   in the background rather than retrying with a new identity on every attempt.
5. Restore recorded intents before normal session/workflow restoration. A scan
   marked locally abandoned must not be automatically resumed by an old snapshot.
6. Model local exit, server acceptance, and server resolution separately. Internal
   states can include `locally_exited`, `awaiting_delivery`, `accepted`,
   `retry_wait`, and `resolved`; none is a reason to restore the old screen.
7. Retry recoverable work silently, coalesce duplicate intents, and record
   diagnostics for persistent faults. Server reconciliation recovers accepted
   jobs if a task lease expires or a queue delivery is exhausted.

### 1.2 Sign-out: Login immediately, cleanup behind it

#### Visible behavior

1. Confirm closes the dialog and replaces resident navigation with Login on the
   next frame. Do not show a blocking Signing out dialog or transition screen.
2. Cancel/dismiss simply closes confirmation without changing auth or navigation.
3. No sign-out cleanup error returns the user to Settings, reopens the dialog, or
   displays the old red sign-out failure label on Login.

#### Local auth fence and real SDK cleanup

1. Add a local signed-out intent/fence to the auth coordinator. Router guards,
   repository access, and notification/workflow coordinators respect it before
   the underlying SDK has emitted its signed-out event.
2. Clear resident route history, detach resident listeners, hide cached resident
   content, and suppress late sign-in/provisioning/profile callbacks from the
   old auth generation. Login must not bounce back to Home.
3. Start Firebase local sign-out promptly and independently of notification
   unregistering or Google-provider cleanup. Failure in one cleanup step must
   not prevent the others from running.
4. Persist the exit fence and unfinished local cleanup so restart stays at Login
   even if the SDK still restores the previous account. Retry actual SDK cleanup
   when the device process can run it.
5. Fence cleanup by auth generation. A delayed old `signOut()` retry must never
   sign out a later explicit login, including a new login to the same UID.
   Serialize old local credential removal with installing new credentials and
   discard superseded cleanup callbacks only when their work is resolved.
6. A fresh explicit sign-in is the only way to leave the locally signed-out
   state. Do not let old auth events implicitly clear the fence.

#### Remote cleanup after authentication has gone

1. Capture the exact old notification registration binding/epoch and any already
   confirmed cancellation intents before detaching resident state.
2. Add server-owned, idempotent cleanup intent acceptance and processing. Use an
   installation/registration-scoped cleanup handle issued at registration, so
   revoking that old binding can be delivered after local auth is cleared.
3. The handle authorizes only revocation of that exact registration version;
   it is not a retained Firebase refresh token or permission for resident reads,
   rewards, or general writes. Validate it on the cleanup endpoint and store its
   server-side resolution so duplicate delivery is harmless.
4. A new device/account registration has a new epoch. Old cleanup cannot disable
   the new binding, revoke all account sessions, or stop another device's work.
5. Once accepted, queue/reconcile remote cleanup until the binding is inactive
   or already replaced. Maintain a lease/expiry fallback for stale registrations
   that never deliver cleanup because the client stays offline indefinitely.
6. If a scan cancellation was already confirmed before sign-out, retain and
   deliver that intent too. Sign-out by itself does not silently cancel a
   submitted deposit; submitted work can continue and be found after sign-in.

### 1.3 Scan cancellation: Home immediately, release in the background

#### Visible behavior

1. Confirm closes the dialog and navigates Home immediately. Do not wait for
   `cancelSession`, version refresh, or operation recovery before leaving.
2. Stop local renewals, camera activity, queued advances, and draft-save scheduling
   for the abandoned session. Ignore late old-screen responses for UI routing.
3. Suppress active-session auto-resume for that specific ID while cancellation is
   pending. A delayed active-session snapshot must not pull the user back in.
4. At most show a short optional Home acknowledgement such as **Session closed**.
   It acknowledges leaving the workflow, not a claim that remote resources are
   already released. Background retries remain silent and nonblocking.

#### Backend convergence

1. Introduce an idempotent cancellation-intent acceptance path. Capture desired
   cancellation for the session, then let a server-owned worker reconcile current
   version/state. The UI does not loop on stale `expectedVersion` conflicts.
2. Issue a narrow per-session cancellation handle when creating the session so
   an offline queued cancellation can still be delivered after later sign-out.
   Scope it to cancelling that owned session; it cannot start/alter other work.
3. Once accepted, persist the cancellation request before acknowledgement and
   process it independently of the client. Preserve intent across worker failures;
   retry with backoff and a scheduled reconciler rather than abandoning at a
   small retry-count limit.
4. Release only the matching session's reservation and resident active pointer.
   An old retry must not clear a newer session or release another bin reservation.
5. Treat already-cancelled, expired/released, or already-terminal targets as
   resolved where appropriate. Preserve the exit decision instead of returning
   `invalid_transition` as a user-facing failure.
6. Coordinate cancellation with in-flight draft saves, renewal, and submission.
   Once the cancellation request is accepted, stale commands cannot revive that
   session. Resolve an uncertain submission identity before creating extra work.
7. For processing work, fence/invalidate the active job attempt so a late worker
   cannot settle a cancelled job. Define an explicit cancelled/closed outcome
   across session, batch, job, and receipt models instead of misleadingly showing
   an ordinary awaiting-review result merely because cancellation occurred.
8. Serialize cancellation and settlement transactionally. If cancellation wins,
   no new credit/settlement may happen afterwards. If settlement already committed,
   preserve its receipt/credit and resolve remaining session cleanup; leaving the
   workflow does not reverse an already-earned transaction.
9. Keep server reservation expiry as an independent release fallback. If the user
   starts a new scan while old cleanup is pending, reconcile the old cancellation
   as part of session acquisition when possible. Otherwise show feedback for the
   new request without reopening the old workflow or pretending a bin is free.

### 1.4 Immediate acknowledgement for result-dependent actions

These controls remain usable and honest while they wait for required results.
They do not inherit the optimistic exit rule for points, receipts, or vouchers.

| Interaction | Immediate local feedback | Required outcome |
| --- | --- | --- |
| QR captured | QR detected — checking bin... overlay | Actual bin/reservation result |
| Confirm session | Confirming session... | Confirmed committed session stage |
| Report Finish | Recording finish... | Image-selection stage |
| Choose image | Immediate selection highlight, then Saving selection... | Latest selected asset/version acknowledged |
| Continue | Submitting for verification... | Stable batch/job/result identity |
| Save profile/preferences | Saving changes... | Saved values or preserved draft/error |
| Redeem reward | Redeeming reward... | Confirmed voucher and wallet result |
| Use demo voucher | Marking voucher as used... | Confirmed voucher status |

1. Extend `AppButton` with readable spinner-plus-pending-label content and correct
   contrast. Apply it to these actions, not as a blocking step for exit-first ones.
2. Pause QR capture during lookup and while the scanner's tab is hidden. Expose
   camera/loading/error/empty states rather than a frozen unexplained surface.
3. Coordinate latest image selection: coalesce rapid changes, acknowledge the
   latest asset, and let Continue use that exact saved draft. Disable conflicting
   changes during submission and retain selection on failure.
4. Provide nearby reasons for disabled actions and explicit saved/redemption
   success. Keep the actual selected-image/source-reference flow; do not claim
   an upload if no image upload is happening.
5. Use single-flight guards and stable request IDs for ordinary mutations. Keep
   operation state independent of initial page loading.

### 1.5 Primary implementation areas

- `lib/features/account/data/firebase_account_repository.dart`
- Account auth/sign-out controllers and Settings confirmation handling
- `lib/app/router/route_guards.dart` and app-scoped auth/work coordinators
- Scan screens/controllers/repositories and shared leave-decision integration
- `lib/core/data/pending_operation_store.dart` and `command_client.dart`
- A focused durable exit-intent journal/coordinator under the existing core/app structure
- Notification registration/unregistration service and server stores
- Session creation/cancellation, job fencing, settlement, maintenance, and task dispatch
- Shared command/snapshot contracts and Flutter domain models for cancellation

### 1.6 Acceptance gate

- [ ] With remote calls deliberately unresolved, Confirm Sign out reaches Login immediately.
- [ ] With remote calls deliberately unresolved, Confirm Cancel session reaches Home immediately.
- [ ] Dismiss starts no exit operation and closes the confirmation immediately.
- [ ] Slow/failing cleanup cannot reopen old routes or show blocking exit errors.
- [ ] A persisted exit survives restart; cancelled work is not auto-resumed.
- [ ] Retry after lost acknowledgement resolves one original intent without duplicate effects.
- [ ] Accepted server intents complete without an open app or signed-in client.
- [ ] Old auth/device/session cleanup cannot affect a newer login, registration, or scan.
- [ ] Cancellation and settlement races produce one consistent final outcome.
- [ ] Other buttons acknowledge their action immediately without inventing backend results.

## Phase 2 — Partitioned scan loading with real progress

**Dependency:** Phase 1 operation identity, cancellation fencing, and ordinary
submission feedback. This phase concerns deposits the user has not cancelled.

### 2.1 Main-card layout and messages

Add a five-segment indicator at the bottom of the main scan card, with current
stage copy and elapsed time. Keep it readable at enlarged text sizes.

| Segment | Active message | Completion evidence |
| --- | --- | --- |
| 1 | Preparing your deposit | Submission durably acknowledged |
| 2 | Validating the image | Committed source loaded and validated |
| 3 | Identifying recyclable items | Detection and initial reconciliation complete |
| 4 | Confirming materials | Required specialist/fallback checks complete |
| 5 | Saving your result | Receipt and applicable ledger/stat updates committed |

```text
                Confirming materials
       Some items need an additional check.

           [done] [done] [done] [active] [next]
                 Step 4 of 5 · 00:38

                 Continue using EcoLoop
```

- Use **Step N of 5**, not an invented time percentage.
- Explicit queued copy: **Request received — waiting for verification to start**.
- Show additional-analysis or retry messages only when those paths actually run.
- A segment advances from a real event. Fast/unused conditional stages may skip
  through immediately; do not add artificial waits to display every message.
- A cancellation removes the abandoned workflow from progress/resume presentation;
  it does not leave a fake spinner following the user Home.

### 2.2 Progress data and event publication

1. Add an optional typed progress summary to the owner-readable session, including
   phase, activity, progress revision, attempt number, completed stages, submission
   time, stage start/update times, and deadline. Receipt outcome remains separate.
2. Separate business `session.version` from `progress.revision`. Update Flutter
   local/stream merging so newer progress at the same business version is accepted.
3. Fence progress by the active attempt, ordered event sequence, cancellation
   state, and final receipt. Old/replayed events cannot revive or regress work.
4. Publish queued state on submission. Add lightweight progress callbacks/API
   independent of artifact checkpoints, which require a later artifact reference.
5. Emit source validation, detection, conditional material checks, retry, and
   finalization transitions from the worker/backend. Aggregate parallel calls
   into stages instead of flickering labels per object/model.
6. Keep writes low-frequency and bounded. Lost progress telemetry may temporarily
   leave generic progress, but must not fail an otherwise valid classification.
7. Complete the final segment only with a committed receipt. Review, empty,
   rejected, and cancelled outcomes retain their own meaning and points status.
8. Extend contracts, fixtures, parsers, and mocks. Old documents without progress
   fields display a compatible generic processing state. Residents read their
   projected session/result, not internal inference-job records.

### 2.3 Long waits and stream failures

1. Show local submitting feedback immediately, then derive elapsed time from the
   server submission timestamp so reopening does not reset it.
2. Start with configurable reassurance at 30 seconds and stronger **This is taking
   longer than usual; you can continue using EcoLoop** copy at 60 seconds. Tune
   with measured timings rather than treating them as completion guarantees.
3. A timer can change reassurance text, never stage, completion, or eligibility.
   Distinguish actual retry events from a long-running stage.
4. After the server deadline, reconcile the existing operation/result. Do not
   locally invent failure or resubmit. Respect backend referral/recovery policy.
5. If the session is terminal before the receipt stream resolves, show **Loading
   your result** with recovery rather than premature success.
6. Introduce the Continue using EcoLoop control when Phase 3's persistent tracking
   is wired; a progress-only release must not advertise incomplete continuation.

**Primary areas:** scan session/model/repository/controller/widgets;
`contracts/backend/v1/`; `inspection_store.ts`, `jobs_store.ts`,
`settlement_store.ts`, `maintenance_store.ts`, `internal_jobs.ts`;
Python `run_job.py`, `inspect_image.py`, and `job_gateway.py`.

**Acceptance gate:**

- [ ] Segments/messages reflect actual queued, running, additional-analysis, and retry paths.
- [ ] Timers alone cannot advance progress or manufacture completion.
- [ ] Same-version session updates can deliver newer progress.
- [ ] Old attempts and cancelled work cannot publish a newer visible active state.
- [ ] Missing telemetry/doc fields degrade gracefully without blocking receipt delivery.
- [ ] Elapsed time survives reopening; only confirmed eligible credit is shown as earned.

## Phase 3 — Background continuation and restoration

**Dependencies:** Phases 1–2, integrated with the existing navigation rules.

### 3.1 Leave verification without cancelling it

1. Provide **Continue using EcoLoop** with concise copy explaining that the
   submitted deposit continues processing and can be found on Home.
2. Navigate immediately. Disposing a screen or switching tabs does not cancel
   server processing, lose its ID, or stop app-scoped observation.
3. Keep **Continue using EcoLoop** and **Cancel session** semantically distinct:
   continuation retains active work; confirmed cancellation records an exit intent
   and suppresses that workflow while background cancellation converges.

### 3.2 App-scoped resident-work controller and Home card

1. Move tracking out of stage-screen post-frame side effects into an authenticated,
   app-scoped controller/repository. Observe current session, receipt, and relevant
   resident update references independently of the scan route.
2. Add a compact Home card with current stage, elapsed time, and **View progress**.
   It must load independently of unrelated dashboard sections.
3. On completion, show the actual outcome and **View result** until seen/dismissed.
   A review remains available in History after that initial card is acknowledged.
4. The controller checks local cancellation tombstones before displaying or
   restoring server active-session references. Cancellation retries are owned by
   the exit coordinator, not presented as an active scan to resume.
5. A new Scan resumes legitimate active work or begins a new request. If an old
   abandoned reservation is still releasing, resolve it through Phase 1's backend
   cleanup/acquisition path rather than forcing the old workflow back onscreen.

### 3.3 Restore progress and unseen results

1. Read server `activeSessionId` at startup, sign-in, and foregrounding via a
   dedicated resident-work reader. Apply local auth/exit fences first.
2. Retain a latest submitted deposit reference/summary containing stable session,
   batch, result, and decision identity. Settlement clears `activeSessionId`, so
   that field alone cannot discover completion while the app was closed.
3. Maintain the retained reference in submission, settlement, cancellation,
   referral, and review-resolution paths. An older review update must not replace
   a newer submitted batch's reference; retain owned update events for discovery.
4. Track seen/dismissed state per resident, result ID, and decision version.
   A later review decision becomes a new update without re-announcing old versions.
5. Restore an active draft to its committed stage, submitted work to progress,
   and newly completed work to its receipt. Never resubmit because the app restarted.
6. Local cached references can accelerate display; reconcile them with owned
   server records. Observe retained events too so push permission is not required.
7. On sign-out, hide resident cards/listeners immediately. Submitted noncancelled
   work continues on the server and can be restored after explicit sign-in.
   Background exit intents still belong to their original generation/targets.

**Primary areas:** scan/work controllers and repositories; Home widgets;
app providers/router/lifecycle integration; per-resident seen-state persistence;
resident session/latest-result projections in backend transaction paths.

**Acceptance gate:**

- [ ] Leave progress, use other pages, and return to the same submitted deposit.
- [ ] Restart during processing restores that deposit without another job.
- [ ] Restart after completion discovers the unseen result.
- [ ] A cancelled workflow never auto-resumes, including after offline cancellation.
- [ ] A later review decision becomes discoverable once per version.
- [ ] Sign-out/account switch does not leak cards or run old cleanup against new work.

## Phase 4 — Recovery and task continuity

**Dependencies:** Durable exit semantics from Phase 1 and work/progress tracking
from Phases 2–3. This phase broadens recovery for result-dependent actions.

### 4.1 Unknown outcomes and reconnection

1. Expose ordinary command recovery state. After an ambiguous submission or
   redemption timeout, show **Checking whether your request completed...** and
   recover the original request ID/payload rather than issuing a new transaction.
2. Keep the original durable intent until resolved. Explain when an unrelated new
   operation waits for earlier work, while confirmed exit actions still navigate.
3. Retain meaningful progress/content with a small **Reconnecting...** or **Showing
   last loaded data** indicator. Infer connection status from actual transport/
   snapshot evidence, not a stage merely taking a long time.
4. Retry ordinary reads/recovery with bounded backoff and a manual Check status
   action that reads/reconciles; it does not create another inspection.
5. Keep silent exit retry policy separate from visible ordinary mutation errors.
   Never reintroduce cancellation/sign-out failure dialogs through a shared error
   handler or require the user to complete their background cleanup.

### 4.2 Recoverable scan states

1. Render separate loading, error, and empty states for image assets, bins,
   session, and receipt. A missing asset list must not silently hide the picker
   and leave Continue disabled without explanation.
2. Map expired session, unavailable asset version, already-submitted, processing
   paused, and command-version conflict into useful next actions. Reconcile state
   before retrying transitions; do not revive locally abandoned sessions.
3. Offer camera permission guidance and an available OS settings/retry path.
   Recheck permission after returning from device settings.
4. Preserve result identity on load failure with **Retry result** or History access.

### 4.3 Non-interrupting notifications

1. A foreground event updates state and shows **Your deposit result is ready —
   View result** without changing routes. Do not steal focus from scans/forms.
2. A deliberate banner/notification tap opens the exact owned receipt. Honor the
   existing unsaved-edit decision before leaving a form; declining leaves the
   update discoverable. Exit confirmations themselves follow Phase 1 immediately.
3. Queue tapped destinations until a fresh authenticated state is available.
   Respect the local signed-out fence even if an old auth callback still exists.
4. Deduplicate per event/result/version and resident; suppress redundant alerts
   for the version already visible. Reset/bound per-resident deduplication state.
5. Retained in-app updates work without push permission. Registration cleanup
   retries cannot disable a newer binding or deliver old-account navigation.

### 4.4 Receipt access and complete History

1. Add an owner-scoped receipt destination keyed by deposit/result identity,
   independent of a live scan-stage route. Reuse presentation across Home,
   History, progress cards, and notifications.
2. Show confirmed material counts, accepted/excluded lines, points breakdown,
   bin/time, review/cancelled states, and resident-readable reasons. Keep unknown
   amounts unknown rather than guessing zero.
3. Wire the existing pagination cursor into **Load more** with footer pending/
   retry state, retaining existing items and scroll position.
4. Reconcile live first-page updates and older pages by identity/decision version.
   Remove rows that no longer match filters; do not retain stale membership in
   an indefinitely accumulated seen map.
5. Validate reversed date ranges inline. Preserve query/filter state and scroll
   when opening/returning from receipts. Distinguish an empty history from an
   empty filtered result.
6. Verify actual Firestore timestamp/filter/order types and the chosen cursor
   boundary so existing older records remain reachable without gaps/duplicates.

**Primary areas:** ordinary command recovery; scan error mapping/screens;
notification service/coordinator; activity controller/repository/screens/tiles;
receipt models/widgets/routes and existing leave-decision integration.

**Acceptance gate:**

- [ ] Lost acknowledgements recover the original deposit/voucher once.
- [ ] Reconnection preserves content and transaction identity.
- [ ] Ordinary recovery cannot block or undo a confirmed exit.
- [ ] Foreground notifications never navigate automatically.
- [ ] Explicit updates open the correct receipt and respect edits/auth fences.
- [ ] More than 25 deposits are reachable; live updates do not leave stale filtered rows.

## Phase 5 — Broader polish and measured responsiveness

**Dependency:** Core exit, progress, restoration, and recovery behavior is stable.

### 5.1 Independent loading and refresh

1. Separate Home profile, wallet, impact, recent activity, and active-work states.
   One failure must not hide the progress card, usable sections, or main actions.
2. Use stable first-load placeholders; retain prior content with a small updating
   indicator and section-local retry. Do not imply cached values are current.
3. Apply retained-content refresh to rewards/vouchers where useful. Avoid
   periodic voucher-expiry refresh blanking the page or resetting scroll.

### 5.2 Forms and ordinary action outcomes

1. Determine dirty state from actual saved/draft differences. Disable Save for
   unchanged/invalid values, not merely because the user opened edit mode.
2. Keep validation beside fields, clear obsolete errors when corrected, preserve
   failed drafts, and map actual failures rather than calling every security
   error an incorrect password.
3. Define in-flight editing: freeze that form or keep newer edits separate from
   the submitted snapshot. Form Cancel resets a draft; it does not claim to undo
   an already-accepted save.
4. Show brief **Changes saved** feedback and accessible redemption success with
   **Open voucher**, even when the page's top success banner is offscreen.

### 5.3 Accurate outcomes and status

| Outcome | Presentation | Points |
| --- | --- | --- |
| Verified | Green check and confirmed receipt | Confirmed awarded total |
| Awaiting review | Clock/review explanation | Pending/on hold |
| Empty | Neutral result and next step | Confirmed zero |
| Not eligible | Excluded-material explanation | Confirmed zero |
| Cancelled/closed | Neutral closed-session status if viewed in History | Actual terminal data, never an invented award |
| Result unavailable | Recovery action | Unknown until read succeeds |

1. Replace the universal completed success visual with outcome-aware presentation.
2. Use task language instead of backend/provider terminology. Keep mock-only copy
   in mock mode, including blanket illustrative-data notices.
3. Make the header's notification dot represent real unseen updates from the
   existing retained event/seen state rather than always showing red.
4. Explain unavailable rewards, including the actual points shortfall where
   relevant, rather than relying on a disabled button alone.

### 5.4 Accessibility and motion

- Keep 48-logical-pixel tap targets and layouts usable at approximately 320,
  390, and 480 logical-pixel widths and enlarged text.
- Preserve spinner contrast, explicit status text, keyboard-visible forms, and
  readable dialogs. Restore focus appropriately for dismissals.
- Announce stage/action changes once, not every elapsed second or animation tick.
- Respect reduced motion for the existing spinning icon and the segmented bar.
- Exit-first navigation must remain immediate with accessibility services enabled.

### 5.5 Actual latency and reliability measurements

1. Capture confirm-to-destination for exit actions separately from background
   acceptance/completion time. Track exit-intent age, retry count, and unresolved
   reconciliation without presenting failures as reasons the user cannot leave.
2. Measure QR lookup, submission acknowledgement, queue delay, image validation,
   detection, additional material analysis, artifact writes, and settlement using
   existing Flutter/worker timing hooks plus missing boundaries.
3. Establish representative fast, slow, and additional-analysis samples and tune
   reassurance thresholds. Progress writes must add negligible overhead.
4. Optimize measured bottlenecks. Detectors already run in parallel; preserve
   classification and settlement correctness rather than applying generic changes.

**Primary areas:** Home widgets/controllers; account forms; reward/voucher screens;
scan/result/scanner widgets; shared loading/feedback controls; notification dot;
existing timing/logging and new exit-reconciliation metrics.

**Acceptance gate:**

- [ ] A failed dashboard section does not blank the page or hide active work.
- [ ] Forms detect actual changes and show clear saved/error states.
- [ ] Visuals, cancellation state, and points text agree with actual outcomes.
- [ ] Refresh, keyboard, enlarged text, screen reader, and reduced motion stay usable.
- [ ] Exit navigation timing and background completion are measured independently.

## Phase 6 — Connected verification and rollout

### 6.1 Regression matrix

| Boundary | Required cases |
| --- | --- |
| Exit navigation | Confirm Sign out reaches Login and Cancel session reaches Home while every remote Future remains unresolved; dismiss starts no request; duplicate taps navigate once |
| Silent failure | Transient cleanup/cancellation failures never reopen dialogs or old screens, bounce auth routes, or demand user retry |
| Persistence | Restore confirmed persisted intents and local signed-out/abandoned fences before auth/workflow restoration; exercise process death around journal checkpoints |
| Background ownership | Server accepts an intent, then the app closes/signs out; backend completes via retry/reconciliation without resident auth remaining active |
| Authentication | Delayed old auth/provisioning callbacks cannot undo logout; old SDK cleanup cannot sign out a new auth generation; no broad all-device logout side effect |
| Cleanup handles | Exact owner/session/registration scope, replay, replaced/expired target, post-logout delivery, and no access to unrelated operations |
| Cancellation races | Draft/renew/submission concurrent with cancel; reservation belongs to a newer session; cancellation-versus-settlement has one consistent terminal outcome |
| Queue behavior | Offline delivery, lost acknowledgement, duplicate intent, worker lease loss, task retry exhaustion followed by scheduled recovery, no silent dropping after a fixed attempt count |
| Ordinary feedback | Pending label/selection before delayed results; latest draft submitted; one redemption/voucher; failures preserve input |
| Progress | Real queued/conditional/retry events; same business version with newer progress; telemetry loss; stale attempt; cancellation/terminal receipt overrides progress |
| Continuation | Leave/reopen; restart while processing; completion while closed; latest result; later review; account switch; locally abandoned work never auto-resumes |
| Recovery/notifications | Lost commit acknowledgement; reconnect; foreground delivery leaves route untouched; tap opens owned receipt and honors edits/fence |
| History/polish | More than 25 records, paging/live filters, receipt Back state, independent dashboard failures, real dirty forms, accessible outcomes |

### 6.2 Relevant tests

Extend meaningful existing suites under:

- `test/app/` for routing, optimistic auth fences, and navigation lifetime.
- `test/features/account/` for sign-out/auth generation and Settings interactions.
- `test/features/scan/` for cancel intent, draft/submission races, progress, and restoration.
- `test/features/notifications/` for binding generations and non-interrupting updates.
- `test/features/home/`, `test/features/activity/`, and `test/features/rewards/`.
- `test/core/` plus focused new exit-journal/coordinator/shared-control tests.
- `integration_test/resident_journey_test.dart` and focused connected exit journeys.
- Functions sessions/jobs/settlement/maintenance/rewards/notification/rules/contracts
  suites, plus dedicated exit-intent acceptance, worker, and reconciliation tests.
- Python `test_run_job.py`, `test_inspect_image.py`, `test_job_gateway.py`, and
  `test_contracts.py` for stage callbacks, fencing, and compatible payloads.

Use deferred futures, injected clocks, scripted streams, and worker failures.
Verify navigation before resolving remote futures. Do not use a real minute-long
sleep or live provider latency as an automated test oracle.

### 6.3 Verification commands

Repository root:

```text
flutter analyze
flutter test test/app test/core test/features/account test/features/scan test/features/notifications test/features/home test/features/activity test/features/rewards
flutter test integration_test/resident_journey_test.dart -d <android-device-id>
```

From `functions/`, run relevant existing suites and add targeted scripts/configs
for new exit processing if the existing sessions/maintenance suites cannot cover it:

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

From `services/vision/`:

```text
uv run --group test pytest tests/test_run_job.py tests/test_inspect_image.py tests/test_job_gateway.py tests/test_contracts.py
```

Use existing emulator/test-runtime configuration and the intended named database.
Verify the resident mock journey separately from connected Firebase behavior.

### 6.4 Connected acceptance journeys

1. **Sign-out exit:** Delay/fail remote cleanup, confirm, reach Login immediately,
   receive no bounce/error, then verify background resolution and fresh login.
2. **Cancellation exit:** Delay/fail cancellation, confirm, reach Home immediately,
   use other pages, and verify eventual release with no restored old workflow.
3. **Offline exit and restart:** Confirm while offline; after the intent checkpoint,
   restart and restore Login/Home fences; reconnect and reconcile silently.
4. **Accepted server intent:** Accept cancel/registration cleanup, terminate the
   app or clear local auth, and verify the server finishes without client retries.
5. **Old-versus-new work:** Sign in/register a new generation or start a new scan
   while old cleanup resolves; verify it cannot remove the new account/binding/work.
6. **Cancellation race:** Race cancellation with submission and settlement; verify
   one valid terminal outcome, no late revival, and no duplicated or reversed credit.
7. **Long verification:** Real stage changes, queue/additional analysis, reassurance,
   continue using app, persistent card, and return to the same receipt.
8. **Background completion/review:** Restart after completion and discover result;
   later review decision updates once without stealing focus from an edited form.
9. **Ordinary recovery:** Lose an acknowledgement after redemption/submission
   commits; recover the same transaction rather than creating another one.
10. **History/accessibility:** Browse multiple pages, open/return from receipts,
    preserve filters, and check keyboard, text scale, screen reader, and reduced motion.

## Delivery order and compatibility

| Increment | Deliverable | Exit condition |
| --- | --- | --- |
| 1 | Immediate-exit coordinator, local auth/abandon fences, durable exit journal, server intent acceptance/retry, cancellation convergence, and ordinary action feedback | Confirmed exits navigate immediately even when cleanup fails; background resolution is independently reliable |
| 2 | Progress contracts, worker events, segmented card, and slow-state copy | Real events drive loading and terminal outcomes stay authoritative |
| 3 | Continue using EcoLoop, app-scoped work tracking, Home card, restart/result restoration | Leaving and reopening retains the same noncancelled deposit |
| 4 | Broader mutation recovery, non-interrupting updates, receipts, and complete History | Current tasks survive failures/updates and outcomes are discoverable |
| 5 | Partial loading, form/status polish, accessibility, timing improvements | Feedback is consistent and measured across resident flows |
| 6 | Connected verification | Required automated and device journeys pass |

1. Add compatible intent/progress/cancellation contracts and server support before
   enabling clients that depend on them. Preserve old document fallback behavior.
2. Provision cleanup/cancellation handles for existing registrations/sessions while
   the user is authenticated, with a defined expiry/reconciliation fallback for
   legacy targets. Do not assume an ordinary authenticated callable works after logout.
3. Deploy server acceptance/worker/reconciler, then client exit-first coordination.
   UI-only navigation without the durable completion path does not satisfy Phase 1.
4. Deploy progress producers before the richer indicator, and complete persistent
   tracking before exposing Continue using EcoLoop.
5. Keep business versions, auth generations, registration epochs, progress
   revisions, and receipt decisions distinct. Preserve transaction idempotency.
6. Verify each increment locally and across its changed boundaries; the last
   increment connects those verified behaviors instead of deferring all testing.

## Definition of done

- Confirmed sign-out always takes the user to Login immediately.
- Confirmed scan cancellation always takes the user to Home immediately.
- Neither action requires the user to stay, retry, or return to complete cleanup.
- Recorded intents survive normal lifecycle boundaries, retry silently, and
  converge to a valid backend terminal state without affecting newer work.
- Noncancelled verification has honest stage progress and reliable continuation.
- Recovery, notifications, receipts, and polish meet the five phase gates.
- Automated checks and connected device evidence are recorded with runtime mode,
  navigation timing, and background-completion observations.
