# Resident Flutter implementation audit

**Audit date:** 16 October 2026  
**Reviewed revision:** `569e537` — `P10 : Complete acceptance documentation and audit.`  
**Baseline:** The current, count-based revision of `FIGMA_USER_APP_TO_FLUTTER_IMPLEMENTATION_PLAN.md`  
**Scope:** Resident Flutter UI, mock services, tests, phase logs, and backend handoff claims

## 1. Overall assessment

**The implementation is a substantial working prototype, but it does not yet satisfy the plan's definition of UI-first completion.** All ten phases have corresponding artifacts, and all 18 planned route patterns are registered. Theme/assets, repository interfaces, count-based models, guide content, account forms, rewards, and the resident shell are present. However, several completed-phase claims describe stronger behavior than the code provides.

The most consequential findings are:

1. **A verified scan clears the production wallet document**, preventing the planned 245 → 255 journey.
2. **After one successful redemption, the next redemption dialog remains busy indefinitely.**
3. **Scan classification ignores the supplied fixtures and material rates** and always produces a hardcoded verified result.
4. **Failed account writes replace the forms with read-error screens**, rather than retaining an editable draft and inline retry.
5. **Live cross-feature updates, dirty-form/cancellation navigation, cold-start deep links, and signed-out data cleanup are incomplete.**
6. **Phase 10 does not implement the complete acceptance journeys**, and the visual implementation has demonstrable gaps beyond the acknowledged missing device review.

The existing 44 tests and web build pass. That is useful evidence of compilation and the behaviors those tests exercise; it is **not evidence that the connected resident journey or all phase checklists pass**. Additional diagnostic tests reproduced multiple defects that the maintained suite misses.

### Assessment by dimension

| Dimension | Assessment |
|---|---|
| Feature/screen scaffolding | Strong coverage; every planned route family has an implementation |
| Mock-only and resident/admin boundaries | Strong; no live Firebase runtime use or resident admin entry point found |
| Count-based migration | Models and derived impact largely migrated; configurable point calculation is not connected to scan |
| Stateful, reactive architecture | Partial; multiple independent caches, Future-only presentation, and incomplete stream lifecycle contracts |
| Happy-path correctness | Blocked by wallet corruption and repeat-redemption state |
| Failure/retry/navigation behavior | Material gaps in scan, forms, routing, and cache invalidation |
| Visual fidelity/responsiveness | Partial; source-derived theme exists, but shell constraints and several source visuals are missing |
| Acceptance evidence | Insufficient for completion; device limitation is disclosed, but test scope also falls short |

These are qualitative judgments against the plan's requirements, not an invented completion percentage.

## 2. Review method and checks performed

Reviewed:

- The complete ten-phase implementation plan and its shared architecture rules.
- All ten files in `docs/dev_logs/`, `FLUTTER_UI_EXECUTION_LOG.md`, `FLUTTER_UI_ACCEPTANCE.md`, and `FLUTTER_MOCK_CONTRACTS.md`.
- The count-refactor preferences document and relevant commit history, including `50f091a` (plan migration), the phase commits, `b134475` (Phases 6–8 integration), and the Phase 9/10 corrections.
- The resident React/CSS source, Flutter composition/router/shell, repositories, controllers, models, fixtures, shared widgets, and maintained tests.

### Checks rerun against the reviewed code

| Check | Result |
|---|---|
| `flutter analyze` | Passed, no issues |
| `flutter test` | Passed, 44 maintained tests |
| `flutter build web` | Passed |
| `dart format --output=none --set-exit-if-changed lib test integration_test` | **Failed**: would reformat `lib/features/scan/presentation/screens/scan_session_screen.dart` |
| `flutter devices` | Windows, Chrome, and Edge listed; no Android/iOS device listed; Windows platform folder is absent |
| Protected Android SHA-256 comparison | All three match the Phase 1 recorded baseline |
| Git comparison of protected files from `07a4879` to HEAD | No differences |
| Runtime Firebase/admin-boundary source search | No Firebase runtime initialization/calls or resident admin control found |
| Additional focused diagnostics | 14 characterization checks confirmed the behaviors listed below |

The format command used `--output=none`; it did not change application code. The device integration suite was not run. No screenshot-based/pixel-level visual acceptance or real offline-browser interaction session was performed during this audit. Visual findings below distinguish code inspection from widget-rendering evidence.

Temporary diagnostic tests were used during the audit and removed afterward. They asserted observed defective behavior to verify the findings; their passing result does **not** mean those behaviors meet acceptance. The maintained 44-test suite remains unchanged.

### Diagnostic observations

| Probe | Confirmed observation |
|---|---|
| Production profile/fixture | Both use Faris Rahman, rather than the plan's Faris Rezza |
| Session creation with unknown bin ID | `createSession('DOES-NOT-EXIST', ...)` succeeds |
| Two scan completions using a flat shared wallet | Wallet becomes `{}`; two activity records exist; bin capacity stays 85% |
| Private reads after sign-out | Profile and wallet streams still return private records |
| Cold reward/voucher detail streams | Return null for existing seeded resources before another call seeds the repository |
| Native date map input | `JsonReaders.dateTime` rejects a `DateTime` value |
| Failed classification | Error escapes through an unhandled derived Future even when the caller catches the original failure |
| Startup deep-link redirect | Requested settings detail is redirected to `/`, then `/home` |
| Demo timestamp formatting | `10:42 +08:00` renders as `2:42 AM` |
| Page at 1200-pixel width | Content is 1160 pixels wide, exceeding the promised 480-pixel frame |
| Guide at 320-pixel width | Material-card RenderFlex overflow occurs with the application theme and ordinary text scale |
| Wrong current password | Password form disappears; generic security read error is shown |
| Injected profile-save failure | Editable form and Save action disappear |
| Second redemption after success | New dialog has `isLoading == true` before submitting |

## 3. Phase-by-phase plan execution

“Partial” means material acceptance requirements remain unmet, even where the phase has substantial code.

| Phase | Verified deliverables | Assessment and remaining gaps |
|---|---|---|
| **1 — Bootstrap/theme** | Riverpod bootstrap, `MaterialApp.router`, dependency setup, offline Inter/SVG assets, centralized tokens | **Mostly delivered.** The final app does not enforce the 480-pixel resident frame; the production header bypasses the supplied brand widget. Final visual acceptance remains open. |
| **2 — Shared components** | Shared inputs/buttons/cards/feedback/modal primitives; repository-independent widgets; focused tests | **Mostly delivered.** Feature implementations frequently bypass these primitives and theme/copy tokens. Enlarged-text/focus/keyboard acceptance is not established by the existing tests. |
| **3 — Mock/data foundation** | Async helper, defensive copies, wallet/activity/account models and interfaces, count fixtures and derived summaries | **Partial.** No shared revision-based store covering all datasets, no opaque ID factory, incomplete map/date/validation contracts, no owner-aware auth cleanup, incomplete scenario mechanism. |
| **4 — Home/history** | Repository-composed Home, derived impact, functioning filter sheet and one-shot history reads | **Partial.** History is not live, route queries are ignored, refresh hides existing content, and date ranges do not apply the fixed demo offset. One-shot History is disclosed as a deviation but was never reconciled with Phase 9's state-coherence requirements. |
| **5 — Guide/rates** | Fixture-backed composed guide, stable ordering, count-rate model, live guide provider, persistence of mock guide updates | **Mostly delivered.** 320-width rendering overflows; no text-scale-aware grid sizing; scan never reuses the rates. The guide's isolated repository work is stronger than its cross-feature integration. |
| **6 — Scan** | Six route stages, QR simulation, transition methods, separate result references, duplicate-completion guard | **Materially incomplete.** Production wallet corruption, hardcoded classification/content/bin data, missing review/reject/full/offline scenarios, missing cancellation policy, incomplete reactive presentation, missing source stage visuals. |
| **7 — Rewards/vouchers** | Fixture-backed catalog, category choices, redemption queue/idempotency, voucher list/detail/copy, owner filtering for voucher reads | **Partial.** Second-redemption UI locks; displayed state is Future-cached; other category/status caches become stale; wallet thresholds read a separate fixture source; cold detail streams do not seed. |
| **8 — Account/settings** | Profile/password/preference operations, validation, settings screens, demo sign-out/resume, profile stream | **Partial.** Mutation errors replace forms, dirty/discard navigation is absent, notification Cancel is absent, password view/edit and visibility behavior is missing, private caches/streams are not cleared. |
| **9 — Router/shell** | Single guarded `GoRouter`, three stateful branches, all route patterns, role guard, parameter helper | **Partial.** Cold-start destination is lost, History queries are unused, bell destination is wrong, branch switches bypass guards and reset saved branch routes, stale scan cache can defeat resume behavior. |
| **10 — Acceptance/handoff** | Fixture tests, two integration-test cases, acceptance/contracts docs, explicit device limitation | **Incomplete acceptance.** Required happy path and adverse journeys are not fully authored, device execution is pending, visual review is pending, contract documentation omits required detail, and formatting currently fails. |

## 4. Findings

Severity: **High** blocks a principal journey or required state/data correctness; **Medium** is a material contract, recovery, or fidelity gap; **Low** concerns documentation/gate hygiene. References use paths and line numbers at the reviewed revision.

### F01 — High: verified scan clears the production wallet

**Evidence:** `lib/features/scan/data/mock_scan_repository.dart:181–215`; `lib/app/providers/app_providers.dart:24–40`.

The production store supplies a **flat** wallet map. During verification, `walletDocument` references that same map when no envelope is present. The subsequent `wallet..clear()..addAll(walletDocument)` clears both references, then adds the now-empty map back into itself.

**Reproduction:** Use the default flat wallet, create a session, confirm, report finish, start verification, and complete verification. Inspect `store.wallet`: it is `{}`, not a document with balance 255. The diagnostic repeated the flow and confirmed activity insertion still occurs while the wallet remains empty.

**Impact:** Wallet decoding subsequently fails because required fields are missing. Home's live wallet observation receives an error, and the connected scan → Home → Rewards journey cannot satisfy acceptance. Existing scan repository tests instantiate `MockScanRepository` **without a shared store**, so they never exercise the defective branch (`test/features/scan/mock_scan_repository_test.dart:7–35`).

**Required correction:** Update a copied document or mutate the working flat map without clearing an alias. Add a shared-store journey assertion for balance 255, version increment, one transaction, replay, and rollback.

### F02 — High: a successful redemption permanently leaves the screen busy

**Evidence:** `lib/features/rewards/presentation/screens/rewards_screen.dart:153–215`.

`_redeem` sets `_redeeming = true`, but resets it only in failure handlers. The success path closes the dialog and never clears the flag. `_openRedemption` also does not reset it.

**Reproduction:** With enough points for two different rewards, redeem one successfully, then open another eligible reward. The new dialog immediately receives `isLoading: true`; Confirm and Cancel are disabled. The second call is also rejected by `_redeem`'s busy guard. A diagnostic widget test confirmed this with a 1000-point repository override.

**Impact:** The promise that every eligible reward can be redeemed through a consistent flow is not met across repeated attempts in one screen lifetime.

**Required correction:** Reset mutation state reliably after success and when opening a new attempt; verify two different sequential redemptions through the UI.

### F03 — High: scan configuration and count-based point rules are not connected

**Evidence:** `lib/features/scan/data/mock_scan_repository.dart:30–79, 152–179, 189–214`; `assets/mock/scan/`; `lib/features/recycling_guide/domain/models/material_rate.dart:33`.

- Bin details, instructions, and QR payload are embedded in the repository rather than loaded from the scan fixtures.
- Result outcome, material, count, explanation, and ten awarded points are hardcoded. Verification does not read `classification_scenarios.json` or the guide's `pointsPerItem`/eligibility rules.
- Review and rejection outcomes are modeled and have display branches, but the mock scan workflow cannot produce them.
- Capacity is assigned 85 on every successful completion instead of applying the configured increase to the current capacity. Repeated deposits never fill the bin.
- `createSession` checks the one hardcoded bin's availability but accepts any supplied `binId`. `confirmSession` does not recheck bin availability.

**Impact:** Changing guide rates or scan fixtures does not change earned points or classification. This is not merely a visual simplification: the current plan explicitly requires `itemCount × pointsPerItem` and deterministic adverse scenarios. The Phase 6 log's “fixture assets” exist, but their existence does not demonstrate fixture-backed runtime behavior.

**Required correction:** Seed shared bin/instruction/classification/rate records, validate the requested bin, calculate credit using eligible configured count rules, and exercise verified/review/rejected/full/offline outcomes.

### F04 — High: dirty-form and unfinished-scan navigation policy is absent

**Evidence:** `lib/app/presentation/resident_bottom_navigation.dart:10–18`; account detail screens; `lib/features/scan/presentation/screens/scan_session_screen.dart:199–202`. No `PopScope`, `WillPopScope`, or route `onExit` hook was found in `lib/`.

The plan requires discard/continue and cancel/continue decisions on Back **and branch changes**. Profile/password/preference screens navigate away directly, while bottom navigation calls `goBranch` directly. Scan's Cancel button immediately cancels without confirmation or error handling; leaving via another branch does not cancel or prompt.

The bottom navigation also calculates active-scan state from the **currently visible path**. After switching from a ready-stage scan to Home, selecting Scan sees `/home`, concludes that no scan session is active, and resets to the scanner. Home/Settings also request `initialLocation: true` on every selection, rather than only on reselect, losing nested-branch position.

**Required correction:** Introduce one navigation decision policy for dirty forms and active scans, and base resume decisions on session state/saved branch state. Test system Back, top Back, branch changes, and reselect separately.

### F05 — High: displayed state is not coherently live across features

**Evidence:** `history_controller.dart:67–104`; rewards/voucher controllers; `app_providers.dart:80–86`; `scan_controller.dart:8–14`; `scan_session_screen.dart:184–191`.

- History loads once and does not subscribe to deposits. An already-loaded History controller is not invalidated when scan completes, so revisiting it can show old data until manual refresh.
- Rewards uses the cached `walletSnapshotProvider`, unlike Home's wallet stream. A wallet already read in Rewards can stay stale after a scan.
- Redemption invalidates only `rewardsProvider(_selectedCategory)` and `vouchersProvider(null)`. Previously loaded other categories and filtered voucher lists remain stale.
- Scan session presentation uses a non-auto-disposed Future family, not the declared session/result/bin streams. If completion finishes after leaving the screen, `_complete` skips invalidation because `mounted` is false. Reopening an already-cached processing session can keep observing the old stage.
- `RewardsScreen` and `VouchersScreen` copy query parameters into local state only at initialization; they do not reconcile updated widget parameters, making query changes/browser history unreliable when the state object is reused.

**Impact:** The Phase 9 shared-state integration checklist is not satisfied by having reactive methods available in interfaces; the displayed consumers must actually observe them or receive comprehensive invalidation.

**Required correction:** Connect displayed owner data to live providers, switch filter subscriptions safely, and invalidate by affected data rather than only the current screen's selected family key.

### F06 — High: account write failures replace editable forms with read errors

**Evidence:** `profile_controller.dart:17–22`, `security_controller.dart:17–22`, `notification_preferences_controller.dart:18–25`, and their screens.

All three controllers reuse the initial-read `AsyncValue` for mutations, setting it to `AsyncLoading`, then replacing it with `AsyncError` on failure. Consequently:

- A failed profile save hides the form and Save button behind “We could not load your profile.” A read Retry is available, but immediate inline save retry is not.
- A wrong current password hides the password fields behind “Security information is unavailable.” The intended current-password field error is never rendered because that field exists only in the data branch. There is no Retry action on this error screen.
- Failed notification saves replace all switches with text and provide no usable retry control. Draft values remain in private widget fields but cannot be edited/submitted in that state.

The first two behaviors were reproduced with widget tests. This contradicts the logs' retry-safe forms implication and the plan's explicit separation of saved/read data from mutation state.

**Related omissions:** Notifications has no Cancel action. Security opens directly into the password form rather than offering the planned view → Change password flow, and its fields have no visibility toggles. No dirty-state discard prompts exist.

**Required correction:** Keep last saved data and draft visible while tracking submitting/error/success separately; map typed failures to the right field; provide retry without reconstructing the form.

### F07 — High: startup auth restoration loses the requested deep link

**Evidence:** `lib/app/router/route_guards.dart:47–54`; `app_router.dart:190–204`.

While auth is unresolved, every destination redirects to `/`. Once auth resolves, `/` redirects to `/home`. The original URI is not stored or encoded anywhere. The Phase 9 audit correction therefore delays access, but does not preserve the cold-start destination.

**Reproduction:** Before the initial auth snapshot resolves, request `/settings/profile`: guard result is `/`; after resolution, the root result is `/home`. The same logic discards resource IDs and query parameters.

**Required correction:** Preserve and restore the full pending URI after successful auth resolution, with explicit handling for signed-out/role-denied cases. Test cold starts, not just navigation after the app has already loaded.

### F08 — Medium: route parsing exists but History does not use it

**Evidence:** `app_router.dart:66–82`; `route_parameter_parsers.dart:24–29, 43–50`; `history_controller.dart:70–78`; `history_screen.dart:67–85`.

The router validates some History query strings, then constructs `const HistoryScreen()` without supplying a parsed filter. The controller reads its own default filter; `RouteParameterParsers.historyFilter` is only exercised in a helper test. Applying a sheet filter does not update the URL either.

Thus `/history?status=review&from=2024-05-01&to=2024-05-20` does not apply the advertised route contract. `calendarDate` also uses permissive `DateTime.tryParse` rather than strict `YYYY-MM-DD`/calendar validation, and inverted ranges are not normalized at the route boundary.

**Separate definite mismatch:** `resident_top_bar.dart:19–22` sends the bell to notification preferences, while both the source and plan explicitly require **bell → History**. The Phase 9 checklist's bell mapping is not implemented.

**Required correction:** Wire parsed filters into controller state, synchronize applied filters back to the URI, validate calendar ranges, and correct the bell destination.

### F09 — Medium: mock stream delivery/lifecycle contract is only partially implemented

**Evidence:** `mock_data_store.dart:32–47, 75–103`; repository `watch*` implementations; `app_providers.dart`.

- The store broadcasts only profile/wallet/deposits, not the planned shared revision/event stream across all persisted datasets. Scan, guide, rewards, and account metadata maintain separate change controllers.
- Transactions emit profile, wallet, and deposits on every success even when values are unchanged. No snapshot deduplication exists.
- Scan watchers emit immediately without `MockApi` or the required delayed/error-injectable initial read.
- `watchReward`/`watchVoucher` project before `_ensureSeeded`; a cold subscriber sees null for a real fixture resource. The diagnostic confirmed both cases.
- Several streams attach their broadcast change listener only after awaiting/yielding the initial read, leaving a subscription handover gap in which writes can be lost.
- Providers do not register store/repository/router disposal with `ref.onDispose`. The account/rewards repositories also lack a public cleanup implementation for their controllers. `RouteGuards.dispose` exists, but the factory-created guard has no explicit ownership cleanup path.

**Required correction:** Establish one commit/revision source, subscribe before reading the initial projection, deduplicate, consistently delay initial snapshots, seed detail watchers, and make disposal ownership explicit.

### F10 — High: sign-out guards routes but does not clear private observations or cached form state

**Evidence:** `mock_account_repository.dart:41–76, 186–218`; wallet/activity/rewards repositories; non-auto-disposed account controllers/providers.

`signOut` flips a repository boolean and emits auth/session changes. It does not emit null to profile/wallet/security/preference watchers, empty owner lists, or invalidate owner-scoped presentation providers. Profile/wallet reads after sign-out still return the resident's private records; this was reproduced.

Auth UID and role are also hardcoded, not projected from mutable mock identity/claims. Activity owner and voucher owner are fixed strings. Redemption counts filter by reward ID but not resident ID (`mock_rewards_repository.dart:274–276`), and idempotency lookup is not owner-scoped (`135–138`). This falls short of the explicitly requested mock UID/role-change and unsubscribe semantics, even though the route guard checks role `user` correctly.

**Required correction:** Centralize active identity, scope all projections/counts/idempotency to it, emit signed-out empty/null states, and clear user-scoped form/provider caches and branch stacks. Preserve canonical process data for Continue demo.

### F11 — Medium: required deterministic scenarios and named read failures are missing

**Evidence:** `mock_scenario.dart`; `mock_api.dart:19–40`; `app_providers.dart`; `README.md:13–20`.

The plan requires normal plus empty activity, read/write failure once, invalid QR, full bin, review, rejection, zero balance, empty rewards, and no vouchers. The implemented enum contains normal, empty activity, generic read-failure once, and three specific write-failure cases.

- No arbitrary named-read failure mechanism exists: `MockApi.read` receives `operation` but does not pass it to failure selection.
- Several required scenarios cannot be selected or represented by the existing configuration.
- No shared scenario/MockApi provider is wired into the composition root; repositories construct independent normal instances by default.
- No code reads `MOCK_SCENARIO`. The README acknowledges test-only overrides, but the documented launch define is ineffective for selecting adverse manual scenarios.

The plan permits provider/test injection instead of a dart-define; the issue is the incomplete required selections and operation targeting, not the absence of the define alone.

**Required correction:** Implement the full deterministic scenario contract, named-operation failure injection, and a documented selectable composition path for manual acceptance.

### F12 — Medium: fixed +08:00 display and date-range semantics are not implemented

**Evidence:** `app_clock.dart:1–7`; `app_formatters.dart`; `home_greeting.dart:22–31`; `history_controller.dart:21–45`; `assets/mock/metadata.json`.

Parsing an ISO timestamp with `+08:00` produces a UTC instant. Formatting it directly does not restore Kuala Lumpur wall-clock time. The diagnostic confirmed the fixture's `2024-05-20T10:42:00+08:00` displays as **2:42 AM**.

History uses `DateTime(now.year, now.month, now.day)` in the host timezone, rather than the injected demo offset. On a UTC host, Today excludes deposits in the first eight hours of the Kuala Lumpur day. Metadata's locale/offset are not wired into presentation.

**Required correction:** Keep domain instants UTC, apply +480 minutes to a presentation copy, and convert demo calendar boundaries to UTC for repository filters. Test an instant near midnight and tests on a different host timezone.

### F13 — Medium: SDK-free model/map/validation contract is incomplete

**Evidence:** `json_readers.dart`; stored models in account/activity/wallet/guide/scan; `auth_state.dart`; `smart_bin.dart`.

- Several stored classes have JSON methods but no required `fromMap`/`toMap`: examples include `ResidentProfile`, `WalletDocument`, `DepositTransaction`, `DepositSession`, `DepositResult`, `SmartBin`, and guide records. Rewards models implement more of this contract.
- Required `parseDateValue`/`encodeDateValue` helpers are absent. `JsonReaders.dateTime` accepts strings/Timestamp-parts but rejects native `DateTime`, accepts timezone-free strings, and does not enforce integer/range constraints on Timestamp parts.
- Nonnegative wallet/version, valid item counts, status/points consistency, bin capacity bounds, HTTPS-only nullable URL fields, and document-ID/embedded-ID equality are not comprehensively validated.
- `AuthState` has no JSON serialization or invariant enforcement; inconsistent signed-in/UID/role combinations can be constructed.
- `SmartBin.acceptedMaterials` is a caller-supplied mutable list. A final list reference does not make the model immutable.

**Impact:** “Firestore-ready” is a useful architectural direction, but the documented SDK-free adapter contract is not complete or validated. This work belongs to the current plan's seams; it is not deferred live Firebase integration.

**Required correction:** Complete map/JSON APIs, date normalization, model validation, owner/document mapping checks, and immutable collection handling; cover malformed data with typed failures.

### F14 — Medium: the 480-pixel shell and narrow-width acceptance fail

**Evidence:** `eco_loop_app.dart`; `resident_shell.dart`; `shared/widgets/app_page.dart:19–30`; guide grid `recycling_guide_screen.dart:71–86`; reward grid `rewards_screen.dart:264–275`.

No ancestor constrains the final resident shell to a centered maximum width. At a 1200-pixel viewport, the diagnostic measured 1160-pixel page content after horizontal padding. Header and bottom navigation stretch too. This contradicts README, acceptance-doc, and Phase 1 claims.

A guide render at **320 pixels with ordinary text scaling** produced material-card overflow: fixed `childAspectRatio: 3.2` makes single-column cards too short for their contents. Neither guide nor reward grids considers text scale. Conversely, adding the missing 480-pixel constraint alone would make the rewards grid's two-column threshold of 560 unreachable, permanently removing the source's two-column reward layout.

**Required correction:** Constrain the whole shell, then use content-aware/card-height-aware breakpoints and enlarged-text behavior. Verify 320/390/480 widths after the constraint is in place.

### F15 — Medium: distinct source visuals are replaced by generic placeholders

**Evidence:** source `App.tsx:107–135`, `index.css:20–22`; `bin_session_visual.dart`; `scan_session_screen.dart:85–151`; `resident_top_bar.dart`; `resident_bottom_navigation.dart`; `reward_card.dart`.

This is a source/code comparison, not a pixel-diff claim:

- All session stages render the same 150-pixel pale bin/delete icon. The source's dark 250-pixel stage surface, internal-camera detected visual, rotating classification visual, and success/check treatment are not reproduced.
- Result UI has no planned “Back to home” action, and the scanner lacks its source/plan Cancel action. Result count is embedded in explanation text rather than displayed from `itemCount` alongside material.
- Header uses plain `Text('EcoLoop')` rather than the supplied brand/leaf mark and does not reproduce the notification indicator.
- The bottom Scan circle has no upward offset/source raised-border/shadow treatment, despite the log's raised-affordance claim.
- Reward cards ignore `artKey`; every card uses the same gift-art block. Redemption feedback is a SnackBar rather than the specified source-style success banner.
- Guide/reward surfaces use several raw colors, dimensions, Material icons, and local fixed labels instead of the extracted theme/copy/icon primitives.

Functional extension screens are legitimate plan-approved additions. These omissions concern original resident design responsibilities and unrecorded fidelity changes.

**Required correction:** Restore the key source silhouettes/state visuals, route actions, art-key mapping, and branding; explicitly record any accepted visual deviations with review evidence.

### F16 — Medium: scan read and failure paths can hang or leak errors

**Evidence:** `scan_session_screen.dart:46–54, 108–114, 199–202`; `mock_scan_repository.dart:136–142`; scan failure mappings.

Bin/result `FutureBuilder`s display a spinner whenever there is no data, including a terminal error. They never render an error/Retry/recovery action. The bin Future is constructed in `build`, causing repeated reads on rebuilds.

`completeVerification` attaches `whenComplete` for cleanup but ignores the Future returned by it. When verification fails, that derived Future also fails without a handler. A zoned diagnostic confirmed an escaped error even when the caller awaited and caught the original Future.

Cancel awaits a write without catching failures. Invalid QR/transition failures use `invalidData` rather than their specific available error codes, and the UI collapses distinct scan failures to generic copy.

**Required correction:** Own read/mutation state in the controller, render explicit recoverable failures, clean up completion futures without unhandled branches, and preserve typed failure distinctions.

### F17 — Medium: fixtures are not the single canonical runtime source

**Evidence:** `app_providers.dart:24–40, 61–74`; `mock_scan_repository.dart`; `mock_rewards_repository.dart`; `mock_wallet_repository.dart:30–58`; fixture files.

- Profile and opening wallet are duplicated inside app composition rather than loaded from their fixtures. Metadata is declared as an asset but not used to seed app clock/locale/offset.
- Activity is lazily loaded and calls `store.replaceDeposits(items)` when its provider initializes, rather than loading all fixtures once before service reads/writes. A scan-first startup can insert data before this later seed replacement; rebuilding the provider can also replace changed activity.
- Sessions/results, rewards/redemptions/vouchers, and guide data are held in separate repository caches, not the shared canonical raw store. Scan mutates result/session/bin state before its wallet/activity transaction. Redemption's voucher/redemption insertions occur outside the wallet transaction. Thus the claim of a single atomic multi-document store is stronger than the implementation.
- No `createDocumentId` exists. Sessions, redemptions, and vouchers use numeric-counter-derived IDs, contrary to the opaque string allocation requirement.
- Wallet thresholds reread the bundled catalog instead of the actual rewards repository's current catalog. Injected/changed catalog data can disagree with Home; costs are not sorted before selecting the first higher value.

**Fixture mismatches against the current plan:**

| Requirement | Actual |
|---|---|
| Faris Rezza / `rezza@example.com` | Faris Rahman / `faris@example.com` in fixture and production composition |
| BIN-004 Cedar Residence · Ground Floor; plastic/aluminium | Central Market · North entrance; plastic/aluminium/paper in scan repository and fixture |
| BIN-002 and BIN-007 records matching history | No corresponding bin records in `bins.json` |
| Today's opening PET record: 2 pcs / +10 | `DEP-001`: 4 pcs / +20 |

The activity totals of 12 verified deposits, 26 items, and 1.04 kg **do** pass. An extra rejected seed record is documented and useful; it is not itself a defect. Historical glass credits also need an explicit historical-rule explanation if acceptance is to validate all earned points against the current guide, which intentionally has no glass-rate row.

**Required correction:** Seed once into the shared store, allocate opaque IDs, move related mutation state inside one commit boundary, derive projections from the same records, and reconcile intentional fixture changes with the plan.

### F18 — High: Phase 10 acceptance coverage is materially short of the required journeys

**Evidence:** plan:1035–1049; `integration_test/resident_journey_test.dart`; `test/fixtures/mock_fixture_integrity_test.dart`; feature tests.

The primary integration case covers Home → guide → scan → Home → Settings → opening Profile. It does **not** exercise History after scan, reward redemption to 155, opening the issued voucher, editing the profile, or verifying the updated name back on Home. It also does not assert final impact 13/1.09 kg or explicitly verify the processing visual. The other integration case only covers a malformed voucher link.

Required review/rejection, named-operation retries, dirty navigation, unfinished-scan cancellation, sign-out/protected-link/resume, and boundary-data journeys are not implemented as connected acceptance cases. Existing feature tests do not substitute for all of these:

- Scan repository tests do not use the shared store or produce review/reject outcomes.
- Settings widget tests render the landing page; they do not test editing, failed-save recovery, discard, or preference persistence.
- Fixture integrity tests do not check all bin/session references, rate-derived points, or reward/voucher expiry despite broader documentation claims.

There are also unexecuted assertion problems: the malformed-voucher integration case expects text **“Vouchers”**, while `VouchersScreen` renders **“My vouchers”**; the happy-path Settings check expects one “Settings” widget although the shell and page both render it. The maintained shell test correctly uses `findsWidgets` after entering Settings.

**Required correction:** Expand the acceptance source to match the required journeys, repair assertions, and run it on a supported target. The absence of a connected Android/iOS target is honestly disclosed and is not treated as an implementation fault. The missing test content exists independently of that environment limitation.

### F19 — Low: completion logs and backend handoff need reconciliation

**Evidence:** execution log, phase logs, acceptance/contracts documents, format check.

- The consolidated execution log has no Phase 6 section, even though a Phase 6 dev log exists. Phase 8 appears after Phase 9. This impedes sequential traceability.
- Phase 10 correctly marks device execution pending, and the dev log also records manual visual checks pending. However, deliverable checkmarks and “offline checks complete” language overstate the missing acceptance coverage, current format failure, and unresolved functional gaps.
- `FLUTTER_MOCK_CONTRACTS.md` claims all reads/writes and initial streams use the delayed API, which is false for several detail/scan streams. It describes configured scan points despite hardcoded credit.
- The handoff lists method names rather than the required complete signatures, omits the complete document-path contract, several stored entity shapes, scan fixture sources, exact enums, and actual unsubscribe/auth cleanup limitations.
- The current plan itself retains a count-migration arithmetic error at line 827: “265 → 165” after one baseline deposit. Phase 6 and Phase 10 correctly specify **245 → 255 → 155**. The source findings also describe an older impact figure, while the React artifact currently displays 3.2 kg. These documentation inconsistencies should not be turned into erroneous implementation expectations.

**Required correction:** Use an explicit implemented/verified/pending matrix, add the missing phase entry, document intentional deviations, repair stale arithmetic, and describe actual contract/lifecycle gaps before backend integration begins.

## 5. Count-based migration assessment

The midway correction was substantially applied to the data layer and is not a reason to remove derived kg summaries:

- `DepositTransaction` and `DepositResult` store integer `itemCount`, not stored transaction weight.
- `MaterialRate` uses integer `pointsPerItem`; its local `pointsFor` multiplication is count-based.
- `MaterialWeightConstants` matches the locked conversion factors: plastic 0.025, aluminium 0.015, paper 0.050, glass 0.200 kg/item.
- Activity derives verified kg from counts; the opening 26 items / 1.04 kg dataset is verified by tests.

**The remaining migration gap is behavioral integration:** scan does not invoke the configured rate calculation. A hardcoded two-item/+10 fixture happens to match the desired baseline but does not demonstrate the required rule. The current plan's 255/155 arithmetic should be authoritative over its stale 265/165 sentence. The older React kg-based point examples should not be reintroduced as requirements.

The preferences document and current execution plan also differ on educational guide emphasis and suggested glass rates. Resolve that documentation precedence explicitly; do not infer an extra resident glass-rate row where the current plan expressly excludes it.

## 6. What is genuinely implemented well

- Clear feature-first organization and repository interfaces; presentation generally accesses repositories through Riverpod.
- Mock-only operation and resident/admin separation are preserved.
- Offline font/icon assets and a substantial theme/shared-widget foundation are present.
- Source placeholder functionality was expanded into real bounded guide, catalog, voucher, profile, password, and preference surfaces.
- Home derives summary/recent data from activity repositories instead of separate hardcoded totals.
- Guide data is repository-backed, sorted, and immutable in its composed lists; mock updates persist for later reads.
- Rewards repository has meaningful same-repository serialization, eligibility checks, expiry checks, voucher ownership filtering, and idempotency behavior under its tested conditions.
- All route patterns are centralized; the shell uses distinct stateful branches, and the guard correctly requires signed-in role `user`.
- Protected Android configuration is intact. SHA-256 values match:
  - `android/build.gradle.kts`: `13A662F4ADCAB37EEF0CD7F5FE61B5144EDF2B252EEF99DA7F2E9CCE8C542092`
  - `android/app/build.gradle.kts`: `0B3842D2BEE62AE3992642D449FAB99B69006A39606D6942FAECEDD3F5169FA6`
  - `android/app/google-services.json`: `41D6F3137C47DB4A18D827EBBDBA4E1757C8A82102485080D893E35270840C92`
- Separate phase commits and follow-up audit commits provide useful implementation history. The device/runtime limitations are generally recorded honestly.

## 7. Recommended closure order

1. **Repair main-journey correctness:** F01 wallet aliasing, F02 redemption reset, F06 form mutation state, and F16 scan error handling. Verify these with shared-store/UI regression cases.
2. **Unify runtime data and rule execution:** F03/F17 shared fixture seeding, configurable count rates/outcomes, opaque IDs, and atomic related mutations. Add the full scenario controls in F11.
3. **Complete lifecycle and navigation:** F04/F05/F07–F10 dirty/cancel decisions, preserved cold links, real query consumers, live providers, owner cleanup, and deterministic session resume.
4. **Complete adapter seams and presentation semantics:** F12/F13 timestamps, offset-aware boundaries, map serialization, validation, and immutable data.
5. **Restore visual acceptance:** F14/F15 shell width, 320-width overflow, text scale, distinct scan stages, branding/art, and source-style actions/feedback.
6. **Close acceptance with evidence:** F18 complete journeys and boundary cases, run available checks and the supported-device suite, perform recorded visual/offline review, then reconcile F19 documentation.

**Completion gate:** Mark the resident UI complete only when the connected normal journey reaches **245 → scan +10 → 255 → snack −100 → 155**, creates exactly one deposit and voucher, updates profile across surfaces, survives retry/navigation/sign-out correctly, and the required alternative scenarios and visual widths have recorded results. A clean analyzer, 44 passing tests, and a web build alone do not establish that gate.
