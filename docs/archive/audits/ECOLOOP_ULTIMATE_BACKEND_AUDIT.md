# EcoLoop Ultimate Backend and CV Audit

- **Audit ID:** ECOLOOP-AUDIT-001
- **Date:** 2026-10-20, Malaysia time
- **Source revision:** `efa364a` on branch `dev`
- **Authority:** [Backend/CV specification v1.1](../backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md), [implementation plan](../backend/ECOLOOP_BACKEND_IMPLEMENTATION_PLAN.md), and its [phase documents](../backend_plan/)
- **Scope:** Resident Flutter Firebase runtime, Functions, Firestore/Storage rules and indexes, Python vision, Tasks, FCM, maintenance, seeding, deployment, tests, and Phase 00–08 acceptance claims
- **Verdict:** **FAILED — the Firebase resident application and its end-to-end backend are not acceptance-complete.**
- **Evidence/reproduction:** [Audit probe instructions and observed results](../backend_evidence/ultimate_audit/README.md)

## 1. Executive conclusion

The reported Home failure is supported by multiple independent defects. This is not a single remaining Firebase setting:

1. Flutter defaults to calling Singapore Functions, but the deployed resident callables are in `us-central1`.
2. Flutter and the seed tool select Firestore `(default)`, whereas Functions and the configured rules target `ecoloop-db`. Read-only cloud inventory found **only `ecoloop-db`**.
3. After authentication, Home can subscribe after the non-replaying auth event and wait indefinitely for its first profile.
4. The profile writer returns `residentId`/`displayName`; the Flutter decoder requires `id`/`fullName`.
5. Wallet and statistics readers target top-level collections, while the writers use resident subcollections.
6. Rules authorize obsolete session/batch/receipt collection names and omit several collections the real client queries.

Fixing those first blockers will expose further failures in image selection, processing, history, guide, vouchers, accounting, and recovery. Particularly serious findings are:

- A successful 37-point/61-spc settlement **does not increase the bin's occupancy**.
- Technical deadline finalization creates review but **does not complete/release the resident's session and bin reservation**; third-attempt failures can remain `processing` indefinitely.
- Production Tasks target the service root instead of `/tasks/vision`; the Python-to-Functions identity protocols are incompatible.
- The production job runner omits D and Gemini, although the operator probe supplies them.
- No detections, both-detector failure, or failed required fallback can become **`empty`**, with zero occupancy.
- A 0.01-confidence detection can remain reward-eligible even when the other required detector fails.
- The evaluation tool reports **1.0 rewarded precision for one correct eligible prediction plus one false eligible prediction**.

There is useful implementation to retain: pure policy calculations, several transaction/idempotency guards, source digests, durable submission records, repository boundaries, real QR widgets, and deterministic tests. The principal failure is that independently implemented pieces do not agree at their real boundaries. File presence, successful builds, isolated adapter tests, and probe HTTP 200s did not establish an integrated product.

### How to read the findings

- **R — Reproduced:** observed during this audit with the attached diagnostics.
- **C — Code-confirmed:** the writer/reader/control flow directly establishes the defect; no real-device reproduction is claimed.
- **L — Live-observed:** verified by read-only cloud inventory during this audit.
- **G — Gate missing:** required behavior/evidence is absent or insufficient; this is not an invented runtime failure.
- **Critical:** blocks the core journey or undermines material accounting/decision correctness. **High:** breaks a required feature or important security/recovery boundary. **Medium:** materially incorrect, incomplete, or operationally unreliable behavior.

Findings are numbered **UA-001–UA-055**. Related symptoms are grouped to keep the later refactor bounded. Closure criteria describe what must be demonstrated, not merely which file to edit.

## 2. Audit method and limits

The audit read the specification, execution protocol, phase targets, tracker, relevant earlier audits, actual source, tests, deployment scripts, and relevant commit history. Examples of implementation checkpoints inspected include `24d20a1`, `d1b3d62`, `5299b3f`, `b56a527`, `7d3b447`, `ed69196`, `972cda1`, `22bf7d5`, and the P08 documentation commits.

Verification performed:

| Check | Observed result |
| --- | --- |
| Functions build: `npm.cmd run build` | Passed on isolated rerun |
| Functions unit suite: `npm.cmd run test:unit` | 10 files / 20 tests passed |
| Vision: `uv run --frozen pytest -q` | 35 tests passed on isolated rerun |
| `flutter analyze` | No issues found |
| Five audit Flutter diagnostics | 5 passed, **confirming the specified defective behaviors** |
| Firestore audit diagnostic | Completed against `demo-ecoloop` emulator; reproduced accounting/recovery/provisioning failures |
| Actual exported callable `.run()` diagnostics | Reproduced five nested-request parsing failures; no live writes |
| Synthetic vision/evaluation diagnostic | Reproduced empty/failure confusion, degraded eligibility, unused D, fallback bounds, and false precision |
| Read-only Firebase/gcloud inventory | Verified Functions regions, database identity, old Cloud Run revision/environment, queue settings, private invoker bindings, and deployed index inventory |

Several first attempts exhausted this Windows host's memory/pagefile. The build, vision suite, Flutter diagnostic, and low-memory emulator diagnostic subsequently ran successfully. The existing `test:settlement` invocation failed from Node memory exhaustion; this audit does **not** claim that invocation passed. The existing full Flutter suite, every emulator suite, actual Google interaction, camera/FCM delivery, full production journey, paid-provider accuracy, and billing measurements were not rerun.

The live checks changed no cloud resources, accounts, balances, deployments, or secrets. Emulator probes use synthetic records. The vision diagnostic uses generated pixels and injected responses; it is a software-behavior test, not CV accuracy evidence. Production implementation files were not modified by this audit. Initial untracked `../../../.vscode`, `../../../Demo_Screenshots`, `../../../android/build`, and `../../../assets/trash_images` were preserved.

## 3. Why Home cannot reliably load

### 3.1 Actual dependency chain

```text
Firebase Auth succeeds
  -> bootstrapResident callable
  -> FirebaseAccountRepository publishes ready auth event
  -> router enters Home
  -> accountProfileProvider subscribes to ready auth stream
       [can miss the already-published event: permanent loading]
  -> getResidentProfile
       [wrong default Functions region; incompatible profile fields]
  -> wallet stream
       [wrong Firestore database + wrong collection + no matching rule]
  -> stats stream
       [wrong database + wrong collection + no matching rule + wrong fields]
  -> recent deposits
       [wrong database + missing rule/index + incomplete stored DTO]
```

`HomeController.build()` awaits these dependencies sequentially (`lib/features/home/presentation/controllers/home_controller.dart:60–79`). The first hung dependency masks failures in the later dependencies. Consequently, the reported symptom can change from endless loading to generic dashboard failure as individual blockers are repaired.

The user-reported login hotfix is plausible, but the checked-in default region remains inconsistent with the deployed callables. The exact local Dart defines/native hotfix used for that successful login were not available as a reproducible release manifest. Successful credential acquisition also does not establish successful provisioning or usable owner reads.

### 3.2 Cross-layer path inventory

| Concern | Actual writer | Actual Flutter reader | Checked-in client rule |
| --- | --- | --- | --- |
| Database | Functions: `ecoloop-db` | `FirebaseFirestore.instanceFor(app: app)` → `(default)` | Deployment configured for `ecoloop-db` |
| Profile | `residents/{uid}` with `residentId`, `displayName` | Callable, decoder requires `id`, `fullName` | Own resident read allowed |
| Wallet | `residents/{uid}/wallet/current` | `wallets/{uid}` | Nested resident read allowed; top-level wallet denied |
| Stats | `residents/{uid}/stats/current` | `residentStats/{uid}` | Nested resident read allowed; top-level stats denied |
| Session | `depositSessions/{id}` | `depositSessions/{id}` | Rules cover `sessions/{id}` instead |
| Deposit/history | `deposits/{id}` | `deposits`, owner/time query | Rules cover `batches/{id}` instead |
| Result | `depositResults/{id}` | `depositResults/{id}` | Rules cover `receipts/{id}` instead |
| Voucher | `vouchers/{id}` | `vouchers`, including whole-collection reads | No voucher rule |
| Wallet entries | `walletEntries/{id}` | No implemented resident ledger feed | No owner wallet-entry rule |
| Policy | `policies/{id}`, `policyPointers/active` | Same paths, different expected policy fields | Catalog reads allowed |
| Evidence | `vision-artifacts/{job}/{attempt}/...` | Admin/recovery references required | Storage/cleanup expect `inspection-evidence/{uid}/{deposit}/{run}/...` |

Some paths differ from the specification as well. A deliberate equivalent physical layout can work, but this implementation has incompatible physical layouts, field names, and authorization contracts simultaneously. **Adding permissive rules or copying records into both layouts would conceal rather than resolve the competing sources of truth.**

## 4. Startup, authentication, commands, and account isolation

### UA-001 — Functions region is inconsistent with the deployed callable endpoints

**Critical · C/L · P02/P08 · AC-01/23**

`RuntimeConfig` defaults to `asia-southeast1` (`lib/core/config/runtime_config.dart:30–35`), used by `firebase_clients.dart:42–45`. Resident `onCall()` exports and `workerGateway` have no region/global options. Live inventory places them in **`us-central1`**, with scheduled handlers in Singapore. The deployment/build helpers supply no region override. A default Firebase build calls endpoints in the wrong region.

**Closure:** one explicit region contract shared by exported handlers, clients, build helpers, and release evidence; invoke the deployed bootstrap/profile/session/reward exports from both platforms.

### UA-002 — App, seed tool, and Functions select different Firestore databases

**Critical · C/L · P02/P08 · AC-01/23**

`lib/core/firebase/firebase_clients.dart:41` omits `databaseId`../..`functions/tools/seed.ts:203–216` uses `getFirestore(app)`; composition explicitly uses `ecoloop-db` (`functions/src/composition.ts:21`). `firebase.json:2–5` deploys rules/indexes there. Live `gcloud firestore databases list` returned **only `ecoloop-db`**. The seed command's database setting is not honored. Emulator tests also commonly use `(default)`, masking the live selection.

**Closure:** explicit database identity in every runtime/tool/test, checked against the existing resource; seed and read the same canonical records. Inventory any records from past runs before migration.

### UA-003 — Rules and read paths are disconnected from the implemented business records

**Critical · C · P02/P04/P05 · AC-22/23**

`firestore.rules:81–97` authorizes `sessions`, `batches`, and `receipts`, whereas the implemented stores/client use `depositSessions`, `deposits`, and `depositResults`. There are no owner read rules for top-level `wallets`, `residentStats`, `vouchers`, or `walletEntries`. The fallback denies them. Even after selecting the right database, required reads still fail.

**Closure:** test every real app query against rules and backend-produced records, including empty owner feeds, cross-owner rejection, results, vouchers, and ledger reads. Do not use obsolete `batches` fixtures as proof of `deposits` access.

### UA-004 — Ready auth state is lost to late subscribers; initialization/retry state can become stale

**Critical · R/C · P02 · AC-01/12/23**

`FirebaseAccountRepository.watchAuthState()` returns a broadcast-only stream (`firebase_account_repository.dart:185, 216–250`). Home's `accountProfileProvider` starts profile observation only after a new auth event (`account_providers.dart:18–41`). The router can enter Home after ready was published, leaving this new subscriber waiting forever. The diagnostic subscribed after successful sign-in and observed a timeout. `_initialState` caches its first result/failure permanently; `_provision()` returns the cached ready state without republishing it. There is no in-flight provisioning fence, and auth-listener/sign-in provisioning can overlap or finish after account changes.

**Closure:** current-state-plus-updates semantics, serialized/UID-fenced provisioning, recoverable failed bootstrap, and cold-start/late-Home/sign-out/re-sign-in/account-switch tests using production-style auth event timing.

### UA-005 — Backend profile records cannot be decoded by Flutter

**Critical · R · P02/P05 · AC-01/23**

`accounts_store.ts:93–103` writes `residentId` and `displayName`../..`getResidentProfile` returns that object unchanged (`resident_accounts.ts:26–35`). `ResidentProfile.fromJson()` requires `id` and `fullName` (`resident_profile.dart:27–33`). `FirebaseAccountRepository.getProfile()` passes the response directly to it. The actual writer shape was rejected in the Flutter diagnostic.

**Closure:** one tested DTO mapping at the transport/data boundary; fresh and existing users load Home/profile using actual bootstrap output, not a hand-authored alternate fixture.

### UA-006 — Most callables do not unwrap the request envelope sent by the real client

**Critical · R · P02/P04/P06 · AC-02/03/10/18**

`CommandClient._call()` sends `{schemaVersion, operation, requestId, payload}` (`command_client.dart:125–136`). Session, inspection, and account transports read operation fields directly from `request.data`. Rewards alone has an `operationPayload()` helper. Exported-handler diagnostics with the real envelope failed with `qrPayload is required`, `sessionId is required`, `operationId is required`, missing preferences, and missing device fields.

**Closure:** validate/unpack a single shared request contract across all exports; exercise actual handler invocation through a callable emulator/client, including errors and recovery.

### UA-007 — Profile update and preferences-read callables are missing

**High · C · P05 · §§11–12**

Flutter calls `updateResidentProfile` and `getResidentPreferences` (`firebase_account_repository.dart:311–329, 353–363`). Neither is implemented/exported in `functions/src/index.ts:1–26`. The backend store has no profile-update operation. Thus the advertised account editing/preferences flow cannot work even after envelope fixes.

**Closure:** implement and export the required owner-validated operations or consistently use the approved authorized read contract; verify edited names survive later Google logins.

### UA-008 — Firebase callable errors are converted into generic retryable outages

**High · R/C · P02/P04/P05 · §11.4**

Transports throw `HttpsError`, but `CommandClient` understands domain errors only inside a successful response envelope. A real `FirebaseFunctionsException` falls through to `backend.transportUnavailable`, `retryable: true` (`command_client.dart:140–170`). The Flutter diagnostic reproduced this for `permission-denied`. Offer changes, insufficient balance, invalid QR, ownership rejection, and terminal conflicts lose their actual semantics. `scanFailureCopy()` largely recognizes old mock keys (`scan_controller.dart:119–134`), and sign-in maps almost every provider error to one generic failure.

**Closure:** map callable code/details into stable safe errors with correlation IDs; test each business rejection via the actual transport, and distinguish it from ambiguous network failure.

### UA-009 — Durable pending-intent storage is not a safe recovery coordinator

**High · C · P02/P04/P05 · TX-07/§16.1**

`CommandClient` uses one pending slot per UID, without a shared mutex across the many separately constructed clients. Concurrent renewal/submission/selection can race on read/save/clear. A pending different payload blocks a new action, but startup has no recovery coordinator and `_attempt()` reissues before reading committed state. `_recover()` clears on any nonretryable failure; a not-found recovery can occur before an ambiguous original invocation finishes. Generic recovery identifies a request string without operation scope; session receipts key only by request hash and compare payload, not operation name (`sessions_store.ts:150–187, 291–293`).

**Closure:** serialize intents or use operation-scoped durable records with compare-and-clear; recover at reopen, preserve ambiguous intents until conclusive resolution, and exercise renewal-vs-submit/lost-response/account-switch races.

### UA-010 — UID-dependent repositories and screen state are not consistently reset

**High · C · P02/P05 · §12.1/16.1**

`scanRepositoryProvider` captures `currentUser.uid` without observing UID changes (`app_providers.dart:186–205`). Active scan/completion state is app-scoped and never bound to UID. `homeWalletStreamProvider` uses `ref.read(walletRepositoryProvider)` rather than watching its invalidation (`home_controller.dart:41–43`). Security/preferences providers observe only the unchanged repository object. Other owner repositories listen to a non-replaying UID stream, compounding UA-004. Cached records/subscriptions can remain associated with A after sign-out or B sign-in, even where backend rules prevent unauthorized remote access.

**Closure:** explicit ready-UID composition, disposal and clearing of all owner-derived state, old-event fencing, and A → sign-out → B tests with real providers rather than repository-only fixtures.

### UA-011 — The fixed mock clock still drives real Home and history

**High · C · P02/P05 · §§10.1/12.2**

`appClockProvider` remains `AppClock()` (`app_providers.dart:58`), whose default is 2024-05-20 (`core/mock/app_clock.dart:26–28`). Firebase bootstrap does not override it. Home and `HistoryController` consume it; only selected rewards paths use `systemAppClockProvider`. Today/last-seven-days filters and relative dates therefore remain tied to 2024 in the real runtime. Calendar construction also uses device-local dates rather than consistently applying the Malaysia display offset.

**Closure:** one real advancing clock/time-zone boundary selected by composition; verify Malaysian date boundaries on a device with another time zone and preserve intentional mock clocks.

## 5. Recycling journey, read models, guide, and catalog

### UA-012 — Image picker selection never saves the server draft required for submission

**High · C · P04 · AC-03/12**

`ScanSessionScreen` only sets local `_selectedAssetId` when a button is selected (`scan_session_screen.dart:351–359`). `_advance()` submits directly (`603–627`); no production caller saves that selection first. `inspection_store.ts:106–109` requires the exact server draft ID/version. A newly selected image is rejected. Selection is lost on app restart. Continue remains enabled whenever not busy (`414–422`), even with no image or failed catalog load.

**Closure:** versioned draft persistence and recoverable selection, visibly disabled Continue until valid, and selection-A→B/reopen/renewal/concurrent-save tests through the backend.

### UA-013 — Firebase scan instructions are unimplemented and completed-result rendering can crash

**High · C · P04 · FLOW-01/AC-23**

`FirebaseScanRepository.getInstructions()` throws (`firebase_scan_repository.dart:83–85`). Intermediate UI silently uses fallback strings, but completed rendering passes `instructions!` (`scan_session_screen.dart:326–327`). A decoded completed result with unavailable instructions reaches a null assertion. Result/catalog stream errors are often read only as `.valueOrNull`, obscuring recovery failures.

**Closure:** usable real-mode content, explicit loading/error states, and verified/review/empty/excluded result widgets tested with missing or delayed content.

### UA-014 — Reopen recovery has no server active-session discovery

**High · C · P04 · AC-11/12**

`ActiveScanSessionController.build()` starts null; `ScanScreen.initState()` consults only that in-memory state (`scan_controller.dart:52–79`, `scan_screen.dart:37–45`). There is no read/watch of the resident's backend `activeSessionId` at app start. Scanning a different bin returns `active_session_exists` with no resume identity/action. A browser-restored exact session URL may work after other fixes, but normal Android reopening does not discover the journey or saved draft.

**Closure:** owner-private active-session recovery from the server plus durable intent recovery, with cancellation/expiry/processing outcomes taking precedence over stale routes.

### UA-015 — Session expiry and QR admission have broken edge paths

**High · C · P04 · AC-02/11/TX-08**

In `sessions_store.ts:204–218`, an expired active session calls `expire()`, which queues writes, then continues with transaction reads. Firestore requires all reads before writes, so this expired-session rescan path fails. Reclaiming another expired bin reservation clears only its reservation (`231–234`), leaving the old session/resident reference dangling. Invalid QR prefixes can produce an empty document ID rather than a stable `invalid_qr`. Same-bin recovery checks only a suffix-derived mapping's bin ID, not its enabled flag/full payload (`211–213`).

**Closure:** transaction-safe expiry cleanup, matching owner/session reference updates, exact enabled QR validation on new and recovery paths, and malformed/disabled/expired competing-resident emulator cases.

### UA-016 — History/result DTOs and stored timestamps do not match their readers

**High · R/C · P04/P05 · AC-04/05/06/12**

Submission creates a result without `lines` or `updatedAt`; its watcher immediately decodes it using required fields (`inspection_store.ts:162–166`, `deposit_result.dart:74–100`). The Flutter diagnostic reproduced rejection of this queued result. Deposits lack `binLocation` and `traceId`, required by `DepositTransaction.fromBackendJson()`; they also lack `updatedAt` until finalization, so processing rows disappear from an `orderBy(updatedAt)` feed. Writers persist ISO strings despite the required Firestore Timestamp contract, while range filters/cursors send `Timestamp` (`firebase_activity_repository.dart:51–70`, rewards voucher cursor `78–80`). Activity occurrence is incorrectly derived from mutable `updatedAt`, moving historical deposits when reviewed. Result projection omits canonical total/policy; the mapper invents a policy value and derives totals from lines.

**Closure:** distinguish processing/final DTOs and occurrence/completion/resolution times; use one stored timestamp type; decode real stored records for processing, unreadable, empty, review, correction, and mixed batches. Unknown totals must remain unknown.

### UA-017 — History indexes, pagination, and live-window behavior are incomplete

**High · C · P05 · §11.3**

`firestore.indexes.json` defines `batches`/`receipts` time indexes, not the actual `deposits` owner/status/`updatedAt` queries. Voucher owner/issued-time indexes are absent too. The history controller exposes a cursor but has no load-more operation; presentation never consumes the page API (`history_controller.dart:52–147`). `watchDepositsPage()` ignores its `after`, accumulates every previously seen row, never removes rows that cease matching a status filter, and grows beyond the requested recent limit (`firebase_activity_repository.dart:170–193`). The cursor is returned even for a short final page. Later corrections outside the observed first page cannot be relied on to update loaded history.

**Closure:** real query/index matrix, stable occurrence-time cursor types, bounded live first-page behavior, working load-more/reset, and status-transition/removal/new-row/tie/end-of-feed tests.

### UA-018 — Guide adapter expects a different policy and content schema than seeding supplies

**High · C · P05 · AC-24/§12.3**

`firebase_recycling_guide_repository.dart:98–110` reads `acceptedClasses` and a `rates` list. Policies contain `acceptedObjectClasses` and category/class maps. It expects policy-keyed `guideContent`, `guideMaterials`, and `guideSteps` documents, but the seed creates none. `watchGuide()` reads the active pointer once and watches an immutable old policy (`61–69`), so activating a new version cannot switch it. Material-category filtering cannot by itself render the exact five accepted object classes/exclusions.

**Closure:** seed and compose actual educational content against the current policy; watch pointer changes and verify the five classes/rates/cardboard exclusion while historical receipts retain pinned policy.

### UA-019 — Seed is incomplete, nonreproducible, and can overwrite business state on rerun

**High · C · P02/P05/P08 · §10.7/AC-24**

Beyond UA-002/018, `seed-manifest.example.json:95–108` supplies one coffee reward at 10 points, not the specified four stable reward IDs at 10/25/50/75. Categories are `plastic`/`paper`, whereas router reward filters accept `food`/`shopping`. Required registry/runtime configuration/guide inputs are absent. Sources depend on untracked `assets/trash_images/`../..`writeDocument()` compares a few ID/version fields, then merges all values (`seed.ts:160–187`): rerunning resets occupancy/opening data and can modify reward/policy values without a new version. A collected bin's cycle change causes a partial seed conflict after earlier writes, rather than a coherent migration.

**Closure:** explicit complete seed manifest, owned asset distribution, immutable policy/offer comparison, and rerun checks after earning/collection that preserve every business fact. Record migration behavior for existing live/seeded records.

## 6. Rewards, vouchers, settlement, and recovery

### UA-020 — Replayed redemption receipts omit fields required by Flutter

**High · C · P05 · AC-10/15/TX-07**

`rewards_store.ts:79–83` stores only a subset of the returned receipt. `redemptionFromRequest()` cannot recover missing `walletVersion`, issue/redemption times, title, merchant, or terms (`147–159`). Flutter requires wallet version and otherwise reconstructs timestamps/current-offer text (`firebase_rewards_repository.dart:140–190`). It calls `getReward()` and voucher queries before reissuing/recovering a committed redemption, so an unavailable offer/read can prevent receipt recovery.

**Closure:** persist/recover the original complete committed receipt before current-offer validation; inject response loss, then edit/disable the catalog and confirm the same voucher, timestamps, terms, debit, and wallet version.

### UA-021 — Issued voucher records cannot be decoded and demo/single-use metadata is inconsistent

**High · C · P05 · AC-17**

Backend vouchers write `merchant`, not required `merchantName`, and omit `remainingUses` (`rewards_store.ts:66–71`; `resident_voucher.dart:56–73`). Consumption never updates remaining uses. The immediate Flutter redemption receipt constructs `ResidentVoucher` without `demo: true`, defaulting it to false (`firebase_rewards_repository.dart:154–167`); demo actions are consequently inconsistent with backend issuance. Seed terms are absent, yielding empty snapshot terms instead of the required clear demo terms.

**Closure:** one complete voucher/receipt DTO, explicit demo terms, issuance with one remaining use and atomic consumption to zero; decode issue/use/replay/expiry records directly from the backend.

### UA-022 — Voucher/catalog reads are unscoped or unbounded; pagination/expiry handling is not wired

**High · C · P05 · §§11.3/13/16.1**

`getVouchers()`/`watchVouchers()` download `vouchers` and filter UID locally (`firebase_rewards_repository.dart:223–229, 295–304`). Correct owner rules reject such queries; local filtering is not authorization. Every catalog read calls that full voucher read to reconstruct redemption counts (`328–347`), so an unreadable voucher collection also prevents reward browsing. The page method exists but the UI uses full-list providers; it filters one arbitrary raw page by derived status and uses a Timestamp cursor against string issue dates. `VouchersScreen` polls every 30 seconds, including while retained offstage, with no next-expiry/foreground lifecycle handling. Backend limits count an unbounded redemption query instead of the planned resident reward counter; wallet transaction serialization helps correctness but does not supply the missing bounded counter/read model.

**Closure:** owner-scoped query transports, transactional counters/read projections, usable paginated tabs with complete status semantics, and foreground/next-expiry refresh. Verify category/count changes without needing an unrelated catalog update.

### UA-023 — Initial and corrected capacity postings never update occupancy projections

**Critical · R · P04/P06 · AC-04/08/09/14/TX-02/04**

`settlement_store.ts:105–151` creates the initial `capacityEntries` record but never updates the bin's `occupiedSpc`/`capacityPercent` or the cycle contribution total. `resolveReview():175–196` reads the bin and writes a correction entry but updates neither current nor historical cycle totals. The emulator diagnostic settled the specified 37/61 batch into a bin opening at 10 spc: **the bin stayed at 10, instead of 71**. A 30→28 review correction similarly left it unchanged.

**Closure:** atomically update ledger, original-cycle total, and current-bin projection when applicable; preserve overflow and old-cycle corrections. Independently reconcile these values after duplicate finalization and collection.

### UA-024 — Impact statistics lack the accepted class/category counts Home needs

**High · R/C · P04/P05 · AC-04/08/§12.2**

Bootstrap/settlement maintain `acceptedItemCount`, but Flutter derives impact from `acceptedItemCounts` keyed by material (`accounts_store.ts:113–115`, `settlement_store.ts:136–140`, `firebase_activity_repository.dart:210–229`). No writer produces that map. The 37/61 diagnostic recorded one batch/six accepted items, with no category counts; estimated impact therefore stays zero after path repair. Review approval updates neither stats nor accepted-count projections. Stats increments are also coupled to positive points rather than accepted verified items, which fails a valid future zero-rate policy.

**Closure:** canonical per-class/material accepted counts, exactly-once automatic/review effects, and rebuild checks against accepted lines; verify 2 bottles + 3 cans + 1 bag produce six items and **0.145 estimated kg**.

### UA-025 — Timeout and attempt-exhaustion recovery do not finish the journey

**Critical · R · P04/P06 · AC-11/12/13**

`finalizeExpiredJob()` records review with **0 spc**, no initial capacity marker, and no session/reservation/resident-reference release (`settlement_store.ts:200–237`). The diagnostic left the session and reservation `processing` and `activeSessionId` populated; no capacity entry existed. `JobsStore.fail()` marks the third attempt `failed` (`jobs_store.ts:181–186`), but `reconcileJobs()` queries only `running`, `retry_wait`, and `queued` (`maintenance_store.ts:60–65`): a third-attempt failure remained `failed` + batch `processing` after reconciliation. The worker's ambiguous-completion check treats any non-null result, including the original processing projection, as recovered success (`run_job.py:72–78`).

**Closure:** all terminal technical paths invoke one coherent review settlement with usable provisional inventory or the pinned unreadable allowance, capacity marker, completed session, and guarded releases. Recover only a confirmed terminal decision; race-test timeout/completion/third failure.

### UA-026 — Review resolution is not the required reusable settlement contract

**High · R/C · P04/P06 · AC-08/09/TX-04/07**

`resolveReview()` has expected decision version but no request identity/fingerprint/committed replay. It marks a ticket resolved even if recalculation still yields review, and does not validate final findings identity/schema. It omits stats, new outcome/credit notification, total count, updated reasons/explanation, final settlement/capacity states, and resolution-history metadata (`settlement_store.ts:155–198`). The diagnostic credited 13 points but retained zero stats and no version-2 event. Collection replay checks the now-changed current cycle before checking the existing event (`maintenance_store.ts:299–327`), so retrying the same completed collection with its original expected cycle fails instead of recovering it. Prior cycles are not closed.

**Closure:** controlled-harness resolution/collection contracts with idempotent intent, final decisions, coherent projections/history/events and cycle lifecycle. Duplicate/competing review decisions must neither credit twice nor close an unresolved ticket.

### UA-027 — Pinned policy is silently replaced/partially ignored

**High · C · P04/P06 · AC-24/TX-09**

Missing policy records silently fall back to `initialPolicy()`../..`policyFrom()` merges only class/rate maps and discards custom `defaultSpcPerRecognizedItem`, `unresolvedSpcPerCandidate`, and `unreadableBatchSpc` (`settlement_store.ts:84, 175–176, 256–265`). Referencing a version does not prove immutable content; UA-019 allows same-version seed updates. Grouping policy lines solely by class also zeroes resolved members' class-space contribution when another member of that same class is unresolved (`domain/policy.ts:78–99, 144–151`).

**Closure:** validate and load the exact immutable submitted policy, including all allowances; fail recoverably on missing/corrupt versions. Test mixed resolved/unresolved findings within one class and policy changes between submission, failure, and review.

### UA-028 — Trusted finalization does not validate the contract it is meant to enforce

**Critical · R/C · P01/P04 · §11.2/TX-03**

`internal_jobs.ts:44–65` checks that findings is an object, then casts it; `finalize_inspection.ts` simply forwards it. The shared validator is not called by production handlers. Duplicate object IDs, inconsistent `empty` plus visible objects, invalid labels/eligibility/geometry, and excessive finding counts are not rejected. The pure diagnostic double-counted the same object ID as 10 points/20 spc and accepted `empty` with a bottle as 0/0. This is a trusted-worker contract failure, not a claim that residents can directly invoke settlement.

**Closure:** schema plus semantic validation at the trusted boundary, distinct physical candidate IDs, inventory consistency, policy-derived eligibility, and bounded payloads; malformed worker output must never post accounting.

## 7. Tasks, worker identity, source retrieval, and vision

### UA-029 — Worker authentication protocols are incompatible and cold initialization is ordered incorrectly

**Critical · C · P04/P08 · AC-22/23**

Python uses the attached service account's Google OIDC identity token (`job_gateway.py:25–28, 106–114`). Functions uses Firebase Auth `verifyIdToken()` and requires a Firebase `workerService` custom claim (`internal_jobs.ts:72–81`). These are different token issuers/audiences/identity systems. Submission defaults the worker to literal `worker-service`/`trusted-issuer`, also present in the observed Functions environment, which cannot match the attached service identity. On a cold gateway invocation, `getAuth()` is called before `getComposition()` initializes the default Admin app.

**Closure:** explicit narrow service-to-service IAM/OIDC verification with actual issuer/audience/service identity, composition before SDK use, and a real private Cloud Run→gateway claim/checkpoint/complete proof. Invalid identity/header tests must exercise this HTTP verifier.

### UA-030 — Worker cannot fetch the actual committed private source asset

**Critical · C/L · P04 · SCOPE-02/AC-03/23**

`load_committed_source()` requires `ECOLOOP_ASSET_URL_TEMPLATE` and performs unauthenticated `urlopen()` (`run_job.py:27–39`). Claim source contains ID/version/hash, not the seeded exact Storage object path/generation/filename. Seeded sources require authenticated Storage reads and variable filenames. Deployment supplies neither this template nor a signed/authenticated source interface; live Cloud Run has only provider model/secrets configured.

**Closure:** server-authorized immutable Storage retrieval using the exact submitted object identity/generation, bounded decode and digest verification. No public-token workaround for private evidence/source authorization.

### UA-031 — Task URL, delivery time budget, and retry repair do not form a working queue path

**Critical · R/C/L · P04/P06 · AC-10/13**

`createTaskRequest()` uses `workerServiceUrl` verbatim and hardcodes a 30-second dispatch deadline (`cloud_tasks.ts:130–173`). The deployment contract insists this URL equals the service root; FastAPI exposes only `POST /tasks/vision` (`main.py:40`). The diagnostic confirmed no route suffix is added. The synchronous job includes source retrieval, provider budget, artifacts, and gateway calls beyond that 30 seconds. A stale/`retry_wait` job retains `dispatchState: dispatched`; the dispatcher queries only pending and always uses one lifetime task name, so the reconciler does not repair an exhausted/lost delivery. Bounded scans of only the first pending/nonterminal candidates can starve later work; one dispatcher exception can prevent recovery/expiry work (`application/maintenance.ts:13–15`).

**Closure:** separate service audience from task route; coordinate task, lease, provider, and five-minute budgets; implement fenced due retry delivery/repair without duplicate business submission; test a slow cold request and exhausted queue delivery.

### UA-032 — Production job inference is a reduced pipeline compared with the operator probe

**Critical · C · P03/P04 · SCOPE-02/AC-04/06/21**

`run_job._default_runner()` supplies only detectors (`run_job.py:90–100`). The operator endpoint supplies detector, D, and Gemini providers (`main.py:89–102`). Therefore probe success does not prove production D/crop/full-image fallback. `providerMode/configurationVersion` are labels only; the runner does not load a pinned registry/configuration or implement `gemini_only`../..`ProbeConfig.from_environment()` requires both provider keys even for resolved CV-only work. The probe's `enable_roboflow=False` still leaves detectors enabled.

**Closure:** one shared, versioned provider composition used by Tasks and controlled probe/replay, with truthful capability flags and explicit required/optional-provider outage behavior.

### UA-033 — Provider failures and missing proposals can be silently classified as empty or auto-eligible

**Critical · R · P03/P04 · AC-06/07/13/21**

`InspectionResult.inventory_state` uses object/fallback presence alone (`inspect_image.py:55–59`). Empty detector output without fallback, both detector failures, and a required full-image fallback exception all returned **`empty`** in the diagnostic. Stage errors are not carried into `_findings()` as review constraints. When one detector fails and the other yields an eligible label, the batch can still be considered resolved. The diagnostic preserved an eligible bottle at confidence **0.01** despite B failure. There is no separately validated empty-scene rule.

**Closure:** explicit inventory/technical-decision state machine; no proposals always attempt the required path or hold review; required model failures cannot enable an unevaluated reward pipeline. Empty must require affirmative validated evidence.

### UA-034 — D specialist outputs never influence object resolution

**High · R · P03 · §7.4**

`inspect_image.py:126–146` collects normalized specialist scores but never applies them to `objects`. A generic can plus a 0.99 `aluminium_can` specialist response remained unknown/unresolved in the diagnostic. D applicability is merely “any unresolved group” within a pre-sliced first-eight-group window, not vocabulary-aware useful-crop selection.

**Closure:** validated class-specific specialist evidence updates the existing candidate without adding counts; select only applicable unresolved crops and test unsupported subtypes/multi-label conflicts.

### UA-035 — Gemini production prompt, allowed labels, object identity, and bounds are inconsistent

**High · R/C · P03 · §7.5**

The provider prompt asks for `metal_can`, `paper`, `cardboard`, `other` (`adapters/specialist.py:31–35`); validation requires canonical `aluminium_can`, `paper_item`, `paper_bag`, `cardboard_item`, etc. (`adapters/gemini.py:10–18`). The diagnostic rejected requested `metal_can`. Crop requests reuse a full-image inventory prompt without candidate/mode context. Multiple objects for one crop are accepted and only the first is applied. `max_objects` bounds list length, not summed counts: **one entry with count 1,000,000 was accepted**, and materialization loops over it. Full-image identities/duplicate objects are not validated; absent boxes are fabricated as the whole image. Conversely an empty returned inventory always becomes review rather than a validated empty path.

**Closure:** mode-specific versioned prompts and matching schemas, total physical-object/output limits, exactly one crop decision, unique full-image inventory, truthful nullable geometry, and independently validated empty/count acceptance.

### UA-036 — Recognition confidence, taxonomy, and attached-part rules are not validation-backed

**High · R/C/G · P00/P03/P07 · CV-AC-01..03**

No per-class acceptance thresholds exist in resolution. Any specific label can establish eligibility; cross-model confidence is projected as `max(score)` (`resolution.py:50–63, 85`) despite incompatible score calibration. Taxonomy is a small global string map rather than model/version-specific validated class semantics. Most excluded classes/loose caps remain unknown. Attached-cap merging is restricted to cross-model candidates and plastic bottles (`matching.py:40–43, 67–87, 104–114`); a cap and bottle from the same detector cannot be merged, and glass attachments are not covered. Frozen annotation evidence is absent.

**Closure:** registry-backed class maps and measured per-path thresholds/count/part rules; retain uncertainty for unvalidated classes and demonstrate useful automatic coverage rather than assuming provider labels establish accuracy.

### UA-037 — Provider timeout/retry controls do not actually bound underlying calls

**High · C · P03/P04/P06 · §§5.4/7.5/16.2**

`_invoke_provider()` creates a thread executor per call, times out its Future, then shuts down with `wait=False` (`inspect_image.py:350–379`). A running provider call continues and a retry may overlap it. SDK clients are configured without coordinated actual HTTP timeouts/retries. Permanent auth/configuration failures are retried like transient errors. Default 30-second total/sequential A+B budgets can consume the available time before both outputs/fallback; a truncated detector map can also reach direct `detector_results['B']` access. `run_job` measures remaining time before source load and never renews the 90-second worker lease. Temporary source files are not removed.

**Closure:** actual request-level timeout/retry configuration, bounded in-flight work/call quotas, failure classification, remaining-budget recomputation, and lease-safe execution measured through Tasks.

### UA-038 — Findings, checkpoints, accepted attempts, and artifacts are not durably tied together

**High · R/C · P01/P04 · §§7/9/10.5**

`run_job._findings()` serializes pixel `item.box`, not `normalized_box` (`run_job.py:103–128`); model IDs containing `/` also violate the findings schema's ID regex. Validation is bypassed, hiding these mismatches. The source checkpoint references `source.json` without writing it. Finalizer validates only artifact prefix strings, does not persist accepted findings/artifact references/model/config digest, and does not mark the attempt succeeded. The emulator diagnostic left an accepted attempt `claimed`. Review tickets lack the detailed evidence linkage required for handoff. When no artifact bucket is configured, production can use temporary local artifacts and still publish their paths.

**Closure:** persist real generation/digest-backed artifacts before terminal decision, canonical validated normalized findings, accepted run/attempt/config linkage and successful attempt state; fail production startup for ephemeral artifact mode. Reanalysis/replay must retain their own identity.

## 8. Notifications, retention, security, and operational controls

### UA-039 — Retention is disconnected from the artifacts actually produced

**High · C · P06 · AC-20**

Workers create `vision-artifacts/...`, whereas cleanup accepts only `inspection-evidence/{uid}/{deposit}/{run}/...` (`jobs_store.ts:8, 97`; `maintenance_store.ts:247`). No production writer creates `diagnosticArtifacts` eligibility records with object generation, resolution time, and purge deadline. Therefore normal artifacts never reach this cleanup path. A deletion failure becomes `purge_pending` and a crash can leave `purging`, but the next query selects only `eligible` (`209–257`). Eligibility checks do not re-read the owning batch/ticket's resolution state.

**Closure:** one artifact manifest/layout produced by normal automatic and review settlement, resolution+30-day eligibility, unresolved/source protection, and recoverable generation-scoped cleanup claims/failures.

### UA-040 — Device registration does not establish unique current token ownership

**High · C · P02/P06 · AC-18/§10.2**

`registerDevice()` simply merges `residents/{uid}/devices/{deviceId}` (`accounts_store.ts:78–82`). It never deactivates conflicting owners/tokens. The dispatcher scans every user's devices and lets iteration order choose an owner per device ID (`notifications_store.ts:173–187`), not the latest trusted registration; the same token under different IDs remains eligible for multiple owners. Client account-switch unregistration may execute after Auth already changed, so its callable acts on the new UID. Async auth callbacks are unfenced and errors are not handled by the stream's upstream `onError` callback. `signOut()` awaits unregistration before signing out, so network/permission failures can block sign-out (`firebase_account_repository.dart:394–398`).

**Closure:** transactional installation/token ownership, best-effort sign-out cleanup without blocking auth, serialized account-switch/token refresh, safe permission failures, and A/B same-device plus multiple-device tests.

### UA-041 — Notification dispatch can permanently strand events and omits legitimate devices/current voucher checks

**High · C · P06 · AC-18/19**

An event moves to `sending` with no lease/reclaim path; candidate queries exclude `sending` (`notifications_store.ts:50–54, 146–152`). A crash or unexpected send exception leaves it there forever. Dispatcher stops after the first successful device (`application/notifications.ts:38–43`), omitting the resident's other legitimate devices. Reminder dispatch rereads preferences/devices but not voucher availability/expiry: a voucher used after event creation can still receive the reminder. Settlement event records omit decision version, causing outbound version `0` (`settlement_store.ts:121–124`; `notifications_store.ts:158`).

**Closure:** fenced expiring send claims, per-device bounded delivery bookkeeping, current voucher-state checks, and source-versioned logical events. Crash/send/retry tests must not touch accounting.

### UA-042 — Notification UI ignores voucher targets and uses the wrong router context

**High · C · P06 · AC-18/19/23**

`NotificationCoordinator` is installed through `MaterialApp.router.builder`, above its router child (`eco_loop_app.dart:12–17`). It calls `GoRouter.of(this.context)` rather than the provided router (`notification_coordinator.dart:63–65`), so that context has no inherited GoRouter from the child. It discards every non-deposit target, ignores the actual deposit target ID, navigates on foreground receipt as well as user-open, and only checks that *some* UID is signed in, not that the target belongs to that user. Owner rules limit fetched data but do not make this a verified recipient-routing contract.

**Closure:** use the composed router, distinguish foreground presentation/open intent, fetch/verify target ownership under current ready UID, and route authorized deposit/voucher targets after login without duplicate navigation.

### UA-043 — Web background notifications can be duplicated and have no implemented target-click handler

**Medium · C/G · P06 · AC-18/23**

FCM sends a notification payload, which its web SDK normally displays automatically in the background; `web/firebase-messaging-sw.js:20–32` also calls `showNotification()` for it. The custom notification has data but no `notificationclick` handler/link routing into the Flutter target. Actual browser delivery/click behavior was never accepted. This is separate from the Flutter coordinator issue.

**Closure:** choose one background display path, implement safe click/open behavior with the correct worker scope, and observe one notification plus one authorized navigation on deployed HTTPS web.

### UA-044 — Provisioning trusts client identity metadata and does not reliably assign/refresh role claims

**High · R/C · P02 · AC-01/22/§12.1**

`bootstrapAccount()` accepts requested email over authenticated email (`application/accounts.ts:30`). The emulator diagnostic provisioned `forged@example.invalid` instead of the trusted identity email. Existing profiles' Auth email/avatar mirrors are never reconciled. `ensureRoleClaim()` sets role only when the second `getUser()` claims differ from the first, so a new user with unchanged `{}` claims gets **zero role writes** (`accounts_store.ts:117–122`, reproduced). In that rare changed-claims path, merging the older claims over current claims can restore stale privileged values. Flutter refreshes claims before bootstrap, not after, and falls back to the response role.

**Closure:** derive identity mirrors from verified Auth, preserve only resident-editable names, assign missing trusted role without stale-claim overwrite, and refresh/fence readiness after provisioning. Test partial Auth/Firestore provisioning failure and concurrent admin-claim changes.

### UA-045 — Production App Check cannot be enabled through the implemented client

**High · C/G · P02/P08 · §15/AC-22**

`FirebaseClients.initialize()` throws if App Check is requested outside debug emulator mode and has no web or production provider activation (`firebase_clients.dart:57–65`). Resident callables neither enforce nor validate App Check. Deployment's `-AppCheckConfigured` is merely a switch and does not implement or verify attestation. An enforced console policy would break this client; leaving it off does not satisfy the specification.

**Closure:** actual Android/web production provider integration, suitable distribution/attestation setup and callable enforcement, plus valid/invalid attestation platform evidence.

### UA-046 — Authorization vocabulary, privileged writes, and private-data projections are inconsistent

**High · C · P02/P04/P06 · AC-22**

Rules check `admin == true`, while the canonical claim is `role: admin` (`firestore.rules:13–15`, `storage.rules:13–16`). Firestore allows admin direct writes to job subcollections (`99–105`) despite the required trusted-worker-only attempt boundary. Storage permits owners to detailed inspection evidence rather than only the safe outcome projection (§15), while actual worker evidence is under an entirely unruled prefix. Preferences accept any boolean map, with no exact supported-key validation, and request/schema/ID/platform/token bounds are mostly unchecked; the production shared validator is unused. Many resident handlers check only Auth presence rather than the agreed trusted-role/provisioning boundary.

**Closure:** explicit role and owner access matrix across client rules/IAM/transports; deny direct privileged attempt/accounting writes, expose only authorized safe evidence, and validate exact request/version/field bounds.

### UA-047 — Availability and cost controls do not meet the admission/degradation contract

**High · R/C/G · P04/P06/P07 · AC-21/§16.2**

QR reservation never reads processing availability; only Continue does (`sessions_store.ts:199–253`, `inspection_store.ts:111–119`). The emulator diagnostic still reserved `binFound` while globally paused. Missing configuration defaults to enabled. `providerMode: gemini_only` neither expresses Gemini-only unavailability nor changes worker behavior. There are no enforced measured per-provider call/fallback quotas or all-in cost controls. Provider retries and `--no-cpu-throttling` deployment require explicit measured cost treatment. Queue concurrency/attempt settings are live-observed, but do not establish the RM50 target or 50-batch/day throughput.

**Closure:** authoritative admission availability, explicit provider capabilities/quotas/reasons, recoverable existing work and measured bounded workload/cost model; billing alerts must not be represented as hard caps.

### UA-048 — Deployment helpers are incomplete and can deploy stale/misconfigured artifacts

**High · C · P08 · M8**

`deploy_poc.ps1` deploys Functions without building them, and `firebase.json` has no build predeploy hook: stale/missing `functions/lib` can be shipped. It demands a root worker URL that does not match the task route. `deploy_vision.ps1:95–96` sets only provider model/artifact bucket, replacing the runtime env contract without required gateway/source settings. It grants bucket-wide `storage.objectAdmin`, uses mutable `latest` secrets, and does not assemble a schema/config/dirty-source manifest. CLI deployment omits the YAML's health/liveness probes; `--no-cpu-throttling` changes billing assumptions. Existing-project input is accepted even though public Flutter/worker Firebase options are hardcoded to this one project. Ingress/IAM/enqueue/token-creation permissions and named-database readiness are not fully verified by the wrapper.

**Closure:** build/reproduce exact source and generated artifacts, validate the full bidirectional URL/audience/environment contract, apply and inspect intended runtime/IAM controls, and emit a current immutable release manifest.

### UA-049 — Live deployment is still the early operator-probe release

**Critical · L/G · P04/P08 · SCOPE-05/AC-23/M8**

At audit time Cloud Run `ecoloop-vision` served revision **`ecoloop-vision-00004-wgj`**, image tag **`21fbb5fa3e28`**, not the current P04–P08 job-runner code. Environment contained only `ECOLOOP_GEMINI_MODEL` and provider secret references: no worker gateway, source contract, or artifact bucket. Live ingress was `all`; service IAM was private with task/operator invokers. Service-level max scale was 1 but the revision template still declared 10; effective controls need deliberate reconciliation. Functions existed but in the mismatched regions from UA-001. No source-faithful full resident deployment is established by these resources.

**Closure:** deploy after source-level fixes, inspect actual revision/digest/config/IAM, then capture a fresh UID→QR→Storage→Tasks→worker→settlement→Home/history→redeem/use→push trace on Android and web.

### UA-050 — Diagnostic tooling does not provide a trustworthy end-to-end trace/rebuild

**Medium · C/G · P01/P06/P07 · §16.3**

Flutter `AppLogger` is defined but unused by application paths. Most Functions operations do not use the structured logger; traces are regenerated at each envelope rather than consistently propagated through commands/settlement. `MaintenanceStore.inspect()` hashes result IDs with a small FNV-style hash (`maintenance_store.ts:114–127, 426–430`), while settlement uses SHA-256: it reads the wrong `depositResults` document. Session-only inspection does not discover associated job/batch. Redaction masks `voucherCode` but not the voucher record's `code`; resident fields and raw exception text also need a deliberate safe output contract. Replay ignores saved matching configuration and does not verify the input against a saved identity (`replay.py:19–24, 80–97`).

**Closure:** observed correlated command/job/attempt/decision events, correct bounded ID traversal and safe redaction, faithful config/input replay, and a support operator locating the actual receipt/evidence without editing data.

### UA-051 — Accounting verifier is incomplete and produces false review discrepancies

**High · C · P07 · §§10.1/12.2/18.4**

`verify_accounting.ts:44–55` compares all deposit awards with only ledger credits whose `sourceType === deposit`; review credits use `deposit_review`, so legitimate reviewed deposits are reported inconsistent. It does not reconcile capacity entries/bin/cycle occupancy, per-class stats, wallet version sequence, vouchers/debits, or rebuild projections. Missing/non-numeric values silently become zero. No implemented rebuild procedure establishes the required recoverability of these projections. Its fixture gate proves only that one synthetic discrepancy can be printed.

**Closure:** independent canonical ledger/capacity/stat/voucher reconciliation and isolated rebuild/compare; distinguish missing/corrupt data from zero and detect UA-023/024 while accepting correct review settlement.

## 9. Evaluation, verification process, and documentation reliability

### UA-052 — CV metric implementation can falsely pass acceptance

**High · R/C · P07 · CV-AC-01..03**

`evaluate.py:165–168` calculates rewarded precision as all correct matched labels / all matched predictions. It ignores unmatched false rewarded objects, eligible-only filtering, and whether the batch was actually rewarded. The diagnostic's one correct + one false eligible prediction returned **1.0**, where rewarded precision should be **0.5**. `autoCompleted` is inferred from matching, not a verified runtime outcome, ignores extra unmatched predictions, and is not restricted to the declared supported positive subset (`116–133, 159–174`). Wrong-label/IoU matching selection can alter results; class-level/ablation/full-image count and uncertainty/overspecificity reports are incomplete. A labeled manifest without predictions can be marked `READY`, with no threshold-pass result. There are still zero frozen labeled cases in the recorded project evidence.

**Closure:** independently specified metric denominators and rewarded/verified runtime outcome inputs; test false positives, duplicates, exclusions, review, extra predictions, misses, and scene-group leakage. Then run the required frozen A/B/fusion/D/Gemini comparisons with sample sizes and measured targets.

### UA-053 — Existing acceptance tests prove isolated fixtures, not the required integrated paths

**High · C/G · P02–P08 · AC-01..24**

Rules tests use `batches` fixtures (`functions/tests/emulator/rules.test.ts:51–54, 70–79`) instead of backend-created deposits. Store tests bypass callable packing/auth verification. Flutter tests inject hand-authored transports/read rows and never pass real backend-created documents through the app decoders. Settlement tests assert returned 37/61 and entry counts but never bin/cycle occupancy (`settlement.test.ts:72–87`). Deadline tests assert review but not released sessions/provisional space. Only the mock `integration_test/resident_journey_test.dart` exists; the planned backend journey/recovery integration tests do not. Thus green tests coexist with the reproduced critical failures.

**Closure:** cross-boundary contract tests, real client rules/queries, complete post-transaction invariants, production-style auth timing, worker HTTP identity tests, and actual Android/web release acceptance. Assertions must be derived from independent expected behavior, not the current implementation's omissions.

### UA-054 — Schema/version and object-class information is fabricated or lost at conversion boundaries

**High · R/C · P01/P04/P05 · §§6/10/19**

`BackendScanMapper` overwrites incoming schema/kind with supported constants (`backend_scan_mapper.dart:24–52`), invents policy version `backend.v1` and an all-zero trace, and treats explicit null total like an absent value when deriving counts (`55–66`). `DepositLineItem` stores only material category, then serializes every paper class as `paper_item`; the Flutter diagnostic changed `paper_bag` to `paper_item` on round trip (`deposit_line_item.dart:25–45, 73–79`). Cardboard becomes unknown material when serialized. Backend uses `excluded`, whereas `DepositOutcome` only recognizes `rejected` (`domain/policy.ts:154`; `deposit_result.dart:5–18`), so a legitimate excluded result becomes unsupported UI. Mixed summaries also use only the first line's label/category in several DTO convenience fields.

**Closure:** preserve canonical class separately from reward category, retain explicit null/version/trace meaning, choose one documented enum alias/migration contract, and run round-trip/unsupported-version/empty/excluded/mixed golden cases through real writers and readers.

### UA-055 — CI, tracker, and prior conformance statements are not reliable completion gates

**High · C/G · P07/P08 · M0–M8**

CI runs unit suites and only the five rules emulator tests; it omits the financial/session/recovery emulator configs, a real Firebase-mode contract journey, and platform builds. Path filters omit `contracts/**`, `datasets/**`, indexes, infrastructure, and deployment tools; push runs only for `main`, while this audit is on `dev` (`backend-ci.yml:3–30, 90–103`). The master plan/architecture still show ignored `BACKEND_MODE`/`APP_ENV` defines, while runtime accepts `ECOLOOP_FIREBASE_MODE`; a copied release command can fail the mode guard. The tracker has a stale resume checkpoint, most milestone rows `NOT_STARTED`, and an empty defect ledger despite blocked units and earlier audits. P08 acceptance calls many scenarios “conditionally passed” where actual required behavior is broken, not merely unmeasured.

**Closure:** required executable CI boundaries, matching trigger paths/branches, current runtime commands and release manifest, and requirement statuses derived from independent tests. An implemented file, passing fixture, or blocked human smoke gate cannot substitute for missing software integration.

## 10. Phase and acceptance reassessment

### 10.1 Phases 00–08

| Phase | Audit assessment | Principal evidence/failures |
| --- | --- | --- |
| P00 feasibility | Historical API/Cloud Run smoke exists; evaluation preparation incomplete | Current live image is this early release; registry/class/cost/frozen-label requirements remain open |
| P01 contracts/domain/diagnostics | Useful isolated components; runtime enforcement/information preservation fail | UA-028, 038, 050, 052, 054 |
| P02 Firebase/identity | Integrated milestone failed | UA-001–011, 019, 044–046 |
| P03 vision | Deterministic suite passes; decision/fallback correctness failed | UA-032–038, 052 |
| P04 recycling | Full vertical slice failed | UA-006, 012–017, 023–033, 038 |
| P05 resident services | Required reads/account/guide/reward/voucher integration failed | UA-003–011, 016–024 |
| P06 operations | Schedules/helpers exist; terminal recovery, retention, device/delivery boundaries fail | UA-025–026, 031, 039–047, 050 |
| P07 verification | Acceptance not established; some existing metrics/assertions are unsound | UA-051–055; no real backend integration tests/frozen CV report |
| P08 release | Failed to establish a current usable integrated release | UA-001–002, 029–031, 045, 048–049, 055 |

### 10.2 AC-01–AC-24

“Failed” below means a concrete implementation violation was found. “Blocked” means the required independent measurement/platform evidence is absent. These do not erase narrower passing unit tests.

| AC | Current audit status | Relevant findings / required observation |
| --- | --- | --- |
| 01 new Google resident | Failed | UA-001–007, 044; zero bootstrap wallet exists in the writer but cannot establish usable owner Home |
| 02 real QR/full stages | Failed | UA-003, 006, 013–015, 047 |
| 03 single image/Continue | Failed | UA-012, 016, 030 |
| 04 mixed 37/61 | Failed | Returned arithmetic reproduced; bin occupancy/stat category/read integration fails, UA-023–024 |
| 05 confident exclusion | Failed | Canonical excluded outcome not decoded; production recognition/evidence incomplete, UA-032–036, 054 |
| 06 empty vs no detections | Failed | UA-033, 035 |
| 07 whole-batch hold | Failed | Required-model/fallback failure can bypass hold; UA-028, 033 |
| 08 review correction | Failed | Returned 13/28 arithmetic reproduced; projection/stats/event/idempotency contract fails, UA-023–027 |
| 09 collection before review | Failed | No historical-cycle projection correction; collection replay/lifecycle incomplete, UA-023, 026 |
| 10 repeated/ambiguous operations | Failed | Request/recovery/replay/finalization gaps, UA-006, 009, 020, 025, 028, 031 |
| 11 exclusivity/expiry | Failed | Store has useful atomic admission guards; expired rescan/terminal lock release fail, UA-014–015, 025 |
| 12 reopen | Failed | UA-004, 009–010, 012, 014, 016, 025 |
| 13 exhausted recovery | Failed | UA-025, 029, 031, 033, 037 |
| 14 full/overflow/reset | Failed | Occupancy never advances and collection replay/lifecycle incomplete, UA-023, 026 |
| 15 redeem 37→12 | Failed | Backend debit skeleton exists; real catalog/voucher/replay/read path fails, UA-019–022 |
| 16 concurrent spending | Partial / integration blocked | Wallet transaction serialization exists; complete source/rules/query/counter/intent gate not established, UA-009, 022, 053 |
| 17 voucher use/expiry | Failed | Backend owner/demo/status/time checks exist; DTO/remaining use/read/UI contract fails, UA-021–022 |
| 18 notifications | Failed / real delivery blocked | UA-006, 040–043 |
| 19 reminder | Failed / real delivery blocked | Current voucher check/routing missing, UA-041–043 |
| 20 retention | Failed | UA-038–039 |
| 21 availability | Failed | UA-032–033, 037, 047 |
| 22 authorization | Failed / live attestation verification blocked | UA-003, 028–029, 040, 044–046 |
| 23 Android/web | Failed / platform rehearsal blocked | Integrated app/runtime/deployment defects; no current full-scope platform acceptance |
| 24 policy versions | Failed | UA-018–019, 027, 054 |

CV-AC-01/02/03, the all-in RM50 target, measured queue/latency/memory/throughput, actual device push, and full M8 rehearsal remain **blocked/unestablished**. The evaluator must be corrected before future CV results can be trusted.

## 11. Reconciliation with earlier audits and commits

Earlier reports were not treated as proof. Some explicitly warned that integration remained incomplete; those caveats were valid. The distinction is that many current failures are **implemented behavior defects**, not simply missing screenshots or credentials.

| Earlier statement / remediation | Current source-backed assessment |
| --- | --- |
| P02 role `resident` normalized to `user` | Default response role is normalized, but role claim assignment/refresh still fails; UA-044 |
| P02 shared UID-driven profile provider fixed | Subscription replacement exists, but its auth source does not replay current state; UA-004/010 |
| P02 profile/preferences DTOs remain open | Still open, plus missing endpoints; UA-005/007 |
| P03 Gemini fallback now applied | Crop/full-image materialization exists; prompt/limits/decision gates and production composition remain broken; UA-032–035 |
| P03 D composition implemented | D scores are still evidence-only; UA-034 |
| P04 atomic settlement/capacity locally verified | Financial credit/entry counts pass some tests; current/cycle occupancy never changes; UA-023 |
| P04 production image selection/reopen locally verified | UI does not save the required draft and normal reopen has no server discovery; UA-012/014 |
| P05 redemption export/recovery fixed | `redeemReward` alias and reward lookup in recovery now exist; do **not** reopen the obsolete missing-alias finding. Request unpacking elsewhere and incomplete replay receipt remain; UA-006/020 |
| P05 lifetime `.limit(1)` / available-state guard fixed | Query no longer truncates at one and use requires available; remaining bounded counter/projection/query issues are UA-022 |
| P05 required rewards emulator/policy tests added | Files now exist; no missing-file allegation is retained. Their boundary coverage is insufficient; UA-053 |
| P06 deadline logic moved into settlement | Boundary relocation occurred, but terminal effects are incomplete; UA-025 |
| P06 generation-scoped cleanup implemented | Guard code exists; normal worker artifacts do not create compatible cleanup records; UA-039 |
| P07 metric/accounting tooling implemented | Tool presence is real; acceptance arithmetic/coverage are defective, UA-051/052 |
| P08 reproducible controls implemented | Script syntax/build checks did not prove route/identity/env/runtime integration; UA-048/049 |

## 12. Inputs for the later bounded refactor plan

The next plan must respect the requested maximum of **five agent phases** and **three human phases**. This audit is the defect baseline; a later plan should assign every finding to one owner, dependency, and executable closure gate.

### Required dependency decisions

1. Choose/document the existing named database, actual canonical physical collection layout, field/timestamp/enum contracts, service regions, and migration rules before editing individual adapters. Preserve existing wallets/ledger/operation IDs; do not reseed/reset live business state.
2. Establish a single usable fresh-resident identity/Home slice with actual exported commands, rules, and backend-produced records. This supplies a genuine base for subsequent end-to-end checks.
3. Repair server settlement/cycle/stat/recovery invariants before allowing real CV decisions to credit points. Add independent invariant assertions that catch the reproduced failures.
4. Make production Tasks, source retrieval, service identity, artifacts, and the full vision pipeline one tested path; establish conservative failure behavior before accuracy tuning.
5. Close resident services, notifications/retention/diagnostics and reproducible release acceptance with explicit evidence. Software work must not be labeled “human configuration” when the necessary adapter/handler is absent.

### Human-only inputs to consolidate into at most three work groups

| Work group | Required inputs/evidence |
| --- | --- |
| Existing cloud/platform identity and configuration | Confirm actual login hotfix/build defines, OAuth/SHA/domains, App Check distribution/attestation, service IAM/audiences, VAPID/Hosting and scoped deployment credentials; inventory existing records before migration |
| CV evaluation and cost decisions | Reviewed labeled scene-grouped development/frozen images, model vocabulary validation, real provider access/pricing/usage and dated all-in budget inputs |
| Independent release rehearsal | Fresh-account Android and HTTPS-web camera/auth/journey/recovery/redeem/use/push acceptance; observed current release digest/config and controlled reminder/cleanup evidence |

### Completion rule for the refactor

A finding closes only when its original failing path is retested, the relevant cross-layer records agree, and evidence identifies the source/build/config under test. The strongest first regression fixtures are the attached diagnostics: **late Home subscription, real envelope packing, 37/61 occupancy, review stats/events, third-attempt recovery, failed-provider non-emptiness, false-positive rewarded precision, and canonical DTO round trips**.

**Final audit status: FAILED.** There is enough evidence to build a focused refactor plan, but no basis to call Phase 00–08 an integrated, fully accepted Firebase release.
