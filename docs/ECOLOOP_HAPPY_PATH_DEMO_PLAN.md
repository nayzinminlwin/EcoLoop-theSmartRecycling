# EcoLoop — Happy-Path Demo Recovery Plan

- **Plan ID:** ECOLOOP-HAPPY-PATH-001
- **Date:** 2026-10-21
- **Status:** S01 baseline evidence recorded; continue code implementation at S02. Final app/credit gates remain unproven.
- **Reviewed source:** `11410f2` on `dev`; working tree was clean at review start.
- **Delivery:** Android screen recording using real Firebase, genuine hosted image verification, and the existing resident account.
- **Urgency:** The user's 12-hour context means focused same-day implementation. The user manages their time. Do not request start/current times, a cutoff, timezone, elapsed-time reports or countdown confirmation; none is an implementation prerequisite.
- **Execution policy:** **CLI-first and agent-owned** under §4.5. Reuse completed S01 evidence and already confirmed configuration; ask the user only for an action the agent genuinely cannot perform or a substantive product decision.
- **Authority:** This document replaces the old demo refactor plan as the execution scope for this recording. The old plan, tracker, and evidence remain historical references, not an additional release checklist.

## 1. Agreed outcome and decisions

Make this forward journey work smoothly and repeatedly:

```text
Existing authenticated resident
  → Home with database balance, correct reward progress and verified count
  → Browse rewards with real catalog and existing vouchers
  → Scan registered QR → Bin Found → Confirm → Ready → Finish
  → explicitly select Prepared image 10 (trash9.jpg) → Continue
  → genuine hosted verification → verified receipt with earned points
  → Home already showing the new balance and verified count
  → Browse rewards → redeem an eligible offer
  → committed voucher appears in My vouchers; balance is correct everywhere
```

The user confirmed:

| Decision | Agreed requirement |
| --- | --- |
| Platform | Android screen recording; use the real connected app while recording |
| Account | Existing account; preserve its balance, activity and vouchers |
| Verification image | **Always `assets/trash_images/trash9.jpg` for the happy-path acceptance and recording** |
| Reward progress | Next eligible offer strictly above the current balance; skip offers at the resident redemption limit |
| Example progress | Balance 12; eligible costs 10/25/50/75 → target 25, 48%, 13 points remaining |
| Interaction speed | Approximately 100 ms visual response for local navigation/feedback; separately measure actual server acknowledgment |
| Verification speed | Aim below 7 seconds; **10 seconds maximum** from Continue tap to visible, durably credited receipt |
| Cloud tuning | Targeted paid warm instances, provider parallelism and necessary regional endpoint changes authorized if measurements require them |
| Weight | Prefer correct existing database-derived estimate; a fixed **1.2 kg** display is explicitly acceptable if needed |
| Other features | Keep working features, appearance and behavior; omissions from this journey are not instructions to remove them |
| Back/reopen behavior | No new back-navigation, process-restart or interrupted-session work is required for this recording |

Genuine inference remains mandatory. Selecting a rehearsed image does not authorize cached answers, filename-based classification, fabricated counts, fake credits, or a shorter timer that displays success before settlement.

### 1.1 Recording asset and registered bin

The image mapping was checked against the seed manifest and the live public reference document during planning:

| Field | Value |
| --- | --- |
| Local image | `assets/trash_images/trash9.jpg` |
| Asset document | `simulationAssets/asset-demo-0010` |
| Picker label | `Prepared image 10` |
| Version | `sha256-4a5e8b49da2c64c3` |
| SHA-256 | `4a5e8b49da2c64c31d61ecf7b695db63054c0bb19ac7eb72020356279fb25661` |
| Storage path | `simulation-assets/asset-demo-0010/sha256-4a5e8b49da2c64c3/source.jpg` |
| Storage generation | `1792435379722099` |
| Image | JPEG, 715 × 429, 42,148 bytes |
| Main bin | `bin-demo-main`, `EcoLoop Demo Bin`, `Demonstration Booth` |
| Registered QR | **`ecoloop://bin/qr-demo-main`** |
| QR PNG | `functions/.seed-output/demo-v1/qr/qr-demo-main.png` |
| Printable sheet | `functions/.seed-output/demo-v1/PRINT_QR_CODES.html` |

`trash9.jpg` is not `trash8.jpg`, `trash909.png`, or `asset-demo-0009`. Keep all other existing assets available. Help the operator locate Prepared image 10 without silently choosing or submitting it.

The image contains overlapping objects. Its actual automatic outcome, count and latency have **not** been proven by this planning review. Test this exact image early. If its findings exceed current bounds or remain ambiguous, discuss that concrete result with the user; do not switch images or force a verified outcome.

## 2. What the review actually found

### 2.1 Assessment of the A1–A3 implementation

There is useful backend and UI work to retain, but the claimed progress is ahead of demonstrated integration quality.

- **A1:** Real Android login/Home has recorded device evidence. Explicit database selection, the system clock, canonical wallet path, owner rules and create-only seeding are valuable. Reward progress and several writer-to-reader mappings are still incomplete in current source.
- **A2:** The settlement/reward core gained real transactional improvements. However, `bf1185f` changed 11 files, with only narrow test changes, while the phase promised a much larger independent invariant and client-boundary gate. `A2_INVARIANTS.md` records 3 settlement tests, 3 reward tests and 9 focused Flutter tests, and explicitly leaves device observation outstanding. This is partial implementation evidence, not the planned exit gate.
- **A2 follow-ups:** QR normalization, cached-bin precedence, camera lifecycle ownership and selection persistence were repaired in multiple later commits. Preserve those repairs. The sequence also demonstrates that the visible forward flow was not exercised comprehensively before the phase handoff.
- **A3:** Private source loading, OIDC verification, container contract packaging and runtime configuration are useful. The recorded smoke only established provider access on **trash8.jpg**. It did not establish Tasks → worker → settlement → Flutter receipt on trash9.
- **H2:** The user's “finished” milestone is not supported by the recorded gate: `H2_CLOUD_HANDOFF.md` explicitly says **BLOCKED**, with no durable delivery/settlement trace. Configuration readiness is different from a working transaction.
- **A4/A5:** The old plan postponed essential visible integration until A4. That explains some unfinished screens; it does not make the current broken journey acceptable. Bring the necessary integration and rehearsal work into this plan now.

The problem is a combination of incomplete implementation, incompatible real data shapes, inadequate boundary tests, and unverified deployment integration. This review does not establish that the model choice itself caused the defects.

### 2.2 Confirmed defects and their direct effects

Line references describe the reviewed source; use symbol names if later edits move them.

| ID | Source evidence | Consequence / repair owner |
| --- | --- | --- |
| HP-D01 | `firebase_rewards_repository.dart`: `getVouchers`, `watchVouchers` read/watch the whole `vouchers` collection, then filter locally; `_withResidentCounts` calls `getVouchers` during catalog loading. `firestore.rules:104–106` requires ownership. | Catalog loading is coupled to a query the rules reject, even for an account with no vouchers. Scope every voucher query by `residentId` at Firestore. **HP1** |
| HP-D02 | Rewards transport passes raw Firestore data to `Reward`/`ResidentVoucher`; `JsonReaders.dateTime` accepts strings/maps, not SDK `Timestamp`. Live rewards have `catalogExpiresAt: Timestamp`. | Seeded catalog dates cannot decode. Normalize SDK values in adapters. Audit wallet dates at the same boundary. **HP1** |
| HP-D03 | `rewardCategories` seed uses `displayName`; `RewardCategory.fromJson` requires `label`. Voucher writer stores `merchant`; `ResidentVoucher.fromMap` requires `merchantName`. | Categories fail silently and persisted vouchers cannot decode, even if immediate redemption appears successful. **HP1** |
| HP-D04 | `rewards_store.ts:39` parses `Date.parse(String(reward.catalogExpiresAt ...))`. | The seeded Timestamp becomes `[object Object]`, so real redemption fails offer validation. Fix server decoding too. **HP1** |
| HP-D05 | `firebase_wallet_repository.dart:72` always returns `nextRewardCost: null`; `HomeViewData.rewardProgress` returns 1 for null. | Home incorrectly displays 100% / all levels unlocked independently of the catalog. **HP1** |
| HP-D06 | `walletSnapshotProvider` is a one-shot Future; Home has a separate wallet stream. `homeWalletStreamProvider` uses `ref.read`, and Home combines awaited stream Futures. | Rewards can show stale balance after a deposit; subscriptions are not a clear shared reactive source. Make the happy-path consumers share authoritative wallet updates. **HP1/HP4** |
| HP-D07 | `FirebaseScanRepository.getInstructions` throws; rules have no `scanContent` read rule; `ScanSessionScreen` passes `instructions!` into `DepositResultCard`. | Seeded content exists but is inaccessible through the adapter; final rendering can crash. **HP2** |
| HP-D08 | Initial `depositResults` writer omits `lines` and `updatedAt`; `DepositResult.fromBackendJson` requires both. `watchResult` decodes the initial record before attaching the listener. | Processing projection can fail decoding and terminate observation before the final result exists. **HP2/HP3** |
| HP-D09 | Final result writer omits pinned policy/count fields, while `BackendScanMapper.resultFromJson` substitutes `backend.v1` as policy and a zero trace when absent. | UI is supported by invented contract metadata rather than a complete real result. Align actual writer and reader. **HP2/HP3** |
| HP-D10 | Submission returns after writing a pending job. `dispatchPendingJobs` is scheduled **every 1 minute**; no immediate dispatch is called from submission. | Queue-start delay alone can exceed the complete 10-second requirement. Enqueue immediately after commit; retain cron as repair. **HP3** |
| HP-D11 | `run_job._findings` serializes `item.box` pixels instead of `item.normalized_box`; settlement rejects coordinates outside 0–1. | Real nonempty worker results fail settlement. Reproduced during this review. **HP3** |
| HP-D12 | `findings.schema.json` uses document-ID grammar for `evidence.modelIds`, which rejects actual provider IDs such as `waste-detection-0momv/6`. Gateway only casts findings to a TypeScript type. | Shared schema and real serializer disagree, while the actual HTTP boundary does not enforce that schema. **HP3** |
| HP-D13 | `InspectionResult.inventory_state` checks only objects/fallback presence; detector/provider failures in `outcomes` are ignored. Low-confidence resolution can remain eligible if fallback fails. | Technical/uncertain outcomes can be misrepresented as empty/resolved. Preserve honest failure semantics while fixing the selected happy path. **HP3** |
| HP-D14 | A/B run serially; specialist/crop fallbacks also run serially. Providers/clients are recreated; thread timeouts do not cancel underlying HTTP work. Worker has multiple gateway round trips; Functions are in US while database/Vision are in Singapore. | Existing orchestration is not designed for the requested latency. Measure and optimize the critical path, including actual HTTP deadlines. **HP4** |
| HP-D15 | Settlement updates `verifiedBatchCount` whenever `acceptedCount > 0`, including review plans; it does not update `acceptedItemCounts` consumed by Home weight. | Verified count can include unverified batches; kilograms can stay at zero despite accepted items. Correct verified-only stats and either maintain material counts or use the authorized weight fallback. **HP3/HP4** |

### 2.3 Why the tests and documentation missed this

Concrete examples:

1. `test/features/rewards/rewards_screen_test.dart` renders a **mock** repository. It cannot detect the real voucher query, Timestamp or merchant-field errors.
2. `functions/tests/emulator/rewards.test.ts` seeds an **ISO string** expiry, unlike the real seed's Timestamp.
3. `functions/tests/emulator/settlement.test.ts` supplies **`box: null`** and a simple `model-a`, unlike real worker coordinates and model IDs.
4. `services/vision/tests/test_run_job.py` has a fake gateway that always accepts completion. Its successful test does not validate what the real backend rejects.
5. Those Functions emulator tests use `getFirestore(app)` without the named database, despite the old plan requiring named-database agreement.
6. The old phase gate scripts and backend integration-test paths listed in the plan were not created. Existing `integration_test/resident_journey_test.dart` is a mock journey with obsolete buttons and a fixed balance, not real Firebase acceptance.
7. Tracker headers still say implementation has not started while rows say implemented; some `FIXED_VERIFIED` rows explicitly have pending live proof. Historical App Check and deadline statements also conflict.

**Planning probes actually run:**

- `uv run --frozen pytest -q tests/test_run_job.py`: **2 passed**, about 9 seconds.
- Feed that test runner's real `_findings` output into `validate_contract('findings', ...)`: **fails on pixel box**. Replacing the box with its existing normalized coordinates exposes a second failure on the provider model-ID grammar. These were diagnostic in-memory probes, not implementation edits.
- Node probe using `firebase-admin` Timestamp: `String(timestamp)` is `[object Object]`; the reward store's date parse is **NaN**.

These demonstrate a coverage gap, not a requirement to discard the working transaction implementation.

### 2.4 Live read-only facts verified during planning

Using explicit project `ecoloop-thesmartrecycling` and database `ecoloop-db`:

- All four rewards exist: snack **10**, cafe **25**, meal **50**, shopping **75**; catalog expiry is stored as Timestamp.
- `scanContent/default` and enabled asset `asset-demo-0010` exist.
- Main bin is enabled, opening occupancy remains 0, cycle is `bin-demo-main-cycle-001`; its reservation is currently available.
- QR mapping `qr-demo-main` is enabled and points to `bin-demo-main`.
- **Processing is currently enabled/ready.** Old seed evidence saying “paused” is no longer current. Do not blindly change this flag based on historical prose.
- Vision revision is `ecoloop-vision-00008-7cs`; submission is `submitinspection-00005-diw`; gateway is `workergateway-00010-tom`.
- Vision runs as `ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com`. Its numeric subject **`108247433586763841561`** matches the live submission/gateway worker setting.
- Tasks invoker `ecoloop-tasks@ecoloop-thesmartrecycling.iam.gserviceaccount.com` has a **different** subject, `111491991281571146990`. The Vision runtime is the gateway caller. Do not replace the correct allowlist with the Tasks identity based on old evidence wording.
- No resident-scoped voucher/issued-time composite index is currently listed. Existing indexes are READY, including the Home deposits owner/updated-time index. Only add the voucher index if the chosen actual query needs it.
- Deployment configuration differs from the checked-in Vision manifest; the observed revision max scale is 10 while the manifest says 1. No minimum-instance guarantee was established by the limited readback. Inspect both service-level and revision-level scaling before tuning.

No cloud writes, deployments, new paid inference requests, resident changes, or voucher redemptions were performed for this planning review. Reference-document reads do not prove that the installed app or its resident-authorized queries work.

## 3. Preserve and narrow the implementation

### 3.1 Keep the useful baseline

Preserve these unless a precise happy-path reproduction requires a small change:

- Working Google login/profile/guide and the app's existing visual design.
- Home Recent Activity, which the user reports is working. Keep its query/order unless the changed settlement payload breaks it; test the new row rather than refactoring the feed.
- Main QR mapping, actual uploaded images, four real offers, named database and canonical resident wallet/stats paths.
- QR payload normalization, successful-bin caching, the stable scanner lifecycle fixes, and explicit image selection.
- Transactional wallet credit/debit, operation identities, single-use vouchers, pinned source generations, private source retrieval and current correct runtime identity.
- Existing back/cancel/reopen, notification and other features. Preserve them through shared-code changes without expanding them into delivery projects.

### 3.2 What is taken from old A4/A5

| Old work | This plan |
| --- | --- |
| A4.1 instructions, result rendering, actual reward/voucher reads, live Home updates | HP1–HP4, essential |
| A4.4 current Functions/Vision/Android candidate, indexes, exact config and artifacts | HP1/HP3 incremental deployment; HP5 final freeze |
| A4.5 real successful deposit and reward journey | HP3 first success; HP5 repeated complete recording rehearsal |
| A5 reproduce exact failures, smallest fix, post-deployment smoke and final artifact handoff | HP5 |
| Full web release, notification delivery/clicks, retention, admin tooling, broad recovery/collection, whole-audit closure, CI expansion, statistical CV evaluation | Deferred from this recording's new work; existing functionality is retained |

This is not a project-wide rewrite or a requirement to close every UA finding before recording. Basic ownership, real committed balances and no duplicate credit/debit remain part of the journey itself.

## 4. Working method and acceptance definitions

### 4.1 Execution discipline

1. Execute one bounded slice at a time using [the copy-paste agent prompts](ECOLOOP_HAPPY_PATH_AGENT_PROMPTS.txt). Read this document's current checkpoint and the relevant phase source; use historical documents for a specific unresolved question. Phases may be partially implemented as the slices cross their dependencies, but only one slice is actively executing.
2. Preserve unfamiliar work. Inspect `git status --short`, `git diff`, and recent commits before editing. Preserve existing signing/native identity. Make necessary scoped configuration repairs through available tools; request a human-only platform/consent action only if tooling cannot perform it.
3. Reproduce the first failing boundary, repair the smallest correct layer, and test the real writer → adapter → UI contract. Do not solve missing data by inventing values.
4. Keep Firebase SDK conversion in adapters. Existing `firebase_converters.dart` and backend `codecs.ts` already provide date helpers. Use them instead of adding Firebase imports to domain models.
5. Use current compatible legacy date reads where necessary. Do not undertake a global Timestamp migration during this window. New/changed queried records must have consistent sort-key types; normalize only the exact affected dataset if required.
6. Keep network calls outside Firestore retry callbacks, reads before writes, and stable financial request identity. Preserve the UID command lock; prevent a background heartbeat from delaying/conflicting with a foreground action.
7. Run memory-heavy Flutter, Python and emulator jobs serially. Use `.cmd` shims for Firebase/npm/gcloud in PowerShell 5.1; the plain `gcloud` command hit this host's execution-policy restriction during review.
8. Update **this document's** execution ledger briefly with the actual fix, relevant check and next action. Reuse existing observations; do not turn the ledger into a new audit task or ask the user to fill it. No additional Markdown evidence hierarchy is required.
9. Commit only if the user authorizes commits for execution. This planning task does not authorize a commit. Record source/diff identity for every deployed candidate regardless.

### 4.2 Measurable gates

| Surface | Required correctness | Timing acceptance |
| --- | --- | --- |
| Home | Current DB balance, actual verified-batch count, agreed reward target/progress; Recent Activity retained | Warm navigation responds around 100 ms; new committed values already present on first useful Home frame after receipt |
| Rewards entry | Four seeded offers render with categories/art/cost; My vouchers shows only this resident's real records | Immediate route response; preloaded catalog feels instant. Measure cold data load separately; aim ≤1 second on recording network |
| Redemption | Exactly one debit and one voucher, real immutable receipt metadata, matching persisted voucher | Immediate pending feedback; target ≤1 second warm, investigate >2 seconds. Never show success before commit |
| Scan stage buttons | Bin Found → Ready → image selection retains correct authoritative session/version | Around 100 ms visual response; report server-acknowledged stage timing separately |
| Verification | Selected pixels actually processed; verified result agrees with committed ledger/wallet/stats | **Continue tap → usable credited receipt <7 seconds target; no rehearsed acceptance run >10 seconds** |
| Return after redeem | Same new balance on Rewards and Home; latest voucher present without restart/pull-to-refresh | First useful frame uses confirmed current state |

For stage buttons, an immediate next-stage shell may show a truthful “Confirming…” pending state. Dependent actions stay disabled until the previous server transition is acknowledged. Optimistic UI must not claim a successful reservation, verification or point balance.

Measure end-to-end elapsed time on the device with one monotonic clock. Measure each server/provider span locally and correlate by IDs; do not subtract unsynchronized device/server timestamps. Separately record provider-only time, queue delay and post-inference settlement/UI delay. A provider call below 7 seconds is not an end-to-end pass.

### 4.3 Reward progress and empty states

Let eligible offers be active, unexpired, valid demo offers below this resident's issuance limit. Used and expired vouchers still count toward an issuance limit.

```text
nextCost = minimum eligible pointsCost strictly greater than currentBalance
progress = currentBalance / nextCost, clamped to 0..1
remaining = nextCost - currentBalance
```

If there is no higher eligible offer but affordable eligible offers remain, show 100% with suitable unlocked wording. If no eligible offers remain, show a truthful “No further rewards available” state rather than implying fresh redemption eligibility. A failed catalog read must not masquerade as 100% progress. Balance and other Home sections remain usable while catalog data loads.

### 4.4 Slice execution and evidence contract

The user requested smaller executable assignments after discussing the previous implementation gap. [ECOLOOP_HAPPY_PATH_AGENT_PROMPTS.txt](ECOLOOP_HAPPY_PATH_AGENT_PROMPTS.txt) supplies **S01–S15**, plus setup, repair and independent-review prompts. The prompts refine execution order; this document remains the authority for requirements and acceptance. Its phase file lists are starting points, not permission for unrelated edits.

For every assigned slice:

1. **Before editing:** state the failing behavior, actual input/environment, fixed acceptance check and smallest intended read/edit set. Run or observe the relevant failure. If the original defect is already fixed, verify it and avoid reimplementing it.
2. **Execute one outcome:** keep changes limited to the assigned boundary and its necessary callers. Focus effort on repairing the code and checking it; project-time bookkeeping is not part of a slice.
3. **Use production-shaped proof:** test actual serializer/adapter/query/store behavior. A fake gateway accepting arbitrary findings, ISO dates replacing seeded Timestamps, or Admin reads replacing resident rules queries cannot establish the corresponding boundary.
4. **Report evidence separately:** implementation, regression check, deployed candidate and device observation are distinct. State `NOT_RUN` or `BLOCKED` for each missing layer. Local slice acceptance does not mark its parent phase or the full journey PASS.
5. **Checkpoint and stop:** update §8 with the slice, changed paths, command/results, build/revision and safe IDs when applicable, exact missing proof and next dependency. Return the short handoff below, then wait for the next assigned slice. No automatic execution of all remaining prompts.
6. **Own diagnostics and CLI work:** follow §4.5 before asking for help. For a device-only visual check, provide a short normal-use workflow and accept Yes/No. Obtain technical IDs, logs and backend comparisons yourself. A disconnected device does not block independent code work.

Required handoff:

```text
Slice / fix / changed files:
Relevant check and result:
App check, if needed: short steps + expected visible result; user replies Yes/No.
Actual blocker, if any, and what the agent already tried:
Next code action:
```

The executor should check actual artifacts and failure boundaries after real credit/redemption and before final acceptance. A separate read-only REVIEW chat is optional if the user wants one; creating another chat or returning an audit form is not a prerequisite for implementation. Keep any review bounded to the journey.

### 4.5 Latest user correction — autonomous execution and minimal human work

**This section overrides earlier administrative prerequisites and historical checklist wording.** The user wants the agent to develop/refactor, do its own technical checks, then supply a short app workflow for a Yes/No result.

- **No clock questions.** Do not ask for the original start time, current time, timezone or remaining hours. No countdown tracking, deadline reconstruction or mandatory time-budget reports. Keep measuring actual application/provider latency, which is a feature requirement.
- **Reuse known inputs.** Project/database/regions, service identities, seed data and recorded account values are already supplied. Read actual CLI values yourself when the current repair needs a refresh; do not ask the user to reconfirm them. Do not repeat the full S01 inventory before each slice.
- **Run the work yourself.** Use available shell/SDK/REST/ADB tools for source changes, tests, builds, installation, live reads, logs, deployment, queue/configuration changes and necessary scoped IAM repairs in the existing project. Request the exact command through the tool's approval mechanism when required, then execute and inspect it yourself. Do not replace an executable command with instructions for the user to run it or navigate Console.
- **Permission failure is a diagnosis to act on.** Inspect the actual denial, identify the required resource-scoped binding or impersonation setting, request command execution approval if needed, and run the appropriate CLI command using the available authorized principal. Use the normal private Tasks integration when workstation ingress/impersonation is irrelevant. Ask for human help only after tools genuinely lack the required access or need interactive login/consent. Do not broaden IAM grants indiscriminately.
- **Try the existing authentication path.** A missing local ADC file does not mean cloud access is unavailable. Existing authenticated `gcloud.cmd` credentials already support trusted Firestore/Storage REST diagnostics; `functions/tools/seed_transport.ts` demonstrates the transport. Keep tokens in memory, not chat/logs. Use resident SDK/rules checks for resident-read acceptance; trusted diagnostic access is not a replacement for those checks.
- **Account discovery belongs to the agent.** Start from the app UID recorded in S01; inspect available app/auth logs or ADB if needed. The CLI principal is not automatically the app resident. Ask which visible account the user intends only if actual conflicting evidence makes that choice ambiguous; never ask the user to find a technical UID.
- **Session discovery belongs to the agent.** Read `residents/{uid}.activeSessionId`; follow it to `depositSessions/{id}`. If null/dangling/inconsistent, query this owner's nonterminal sessions as needed. Follow session `binId` to `binOperations/{binId}` and the bin; follow job/result references or an owner/session-scoped query to `inferenceJobs`, `deposits` and `depositResults`. The agent obtains the stage, lease, job and result IDs directly. Never ask the user to inspect an invisible session, find its ID, scan every QR, or fill out a reservation/processing checklist.
- **An existing session is not an automatic stop.** Determine its actual state. Resume/monitor healthy in-flight work; use the supported fenced expiry/cancellation/reconciliation path for a proven expired or abandoned demo reservation. Preserve committed effects and matching-ID guards. If a repair needs permission, request the exact command and execute it yourself. Do not reset collections/wallets or blindly cancel a genuinely running job to clear the screen.
- **Missing device access is local to device proof.** Read ADB yourself, build/install when possible, and continue code/tests/cloud repairs while no phone is attached. Only when the candidate is ready for a visual check ask the user to connect/unlock the phone, approve the native prompt, or open the supplied build. Do not hold S02–S06 for a disconnected device.
- **Human check = ordinary app use.** Supply roughly 3–5 short actions and the visible expected result; accept “Yes, works” or “No.” On No, inspect logs/backend yourself and ask for visible error text or a screenshot only if needed and unobtainable through tools. The agent records proof and updates the ledger. Backend IDs, IAM values, timestamps, log collection and database reconciliation are never the user's homework.
- **Keep substantive decisions distinct.** Ask if the fixed image/policy, chosen account, exhausted reward limits or a nontrivial historical financial-data correction genuinely requires a changed user decision. Routine scoped CLI/configuration actions do not require another configuration questionnaire. Existing approval tooling still applies; request executable command approval rather than a manual console checklist.

For the recorded S01 result, missing countdown information and an unattached phone are **not** baseline blockers. The null active-session reference was already read. Preserve the genuine 30-second trash9/fallback finding and fix the relevant code next; no additional S01 questionnaire is needed.

## 5. Implementation order

Use the S01–S15 order in the prompt file, bringing the minimum real scan/credit slice ahead of most Home/Rewards polish. HP0–HP5 below remain requirement groups, not six large chat assignments. S01 evidence is already sufficient to continue at S02. Attempt the first genuine deployed trash9 credit as soon as S02–S06 code prerequisites pass; record its application latency immediately.

| Phase | Execution priority | Deliverable |
| --- | --- | --- |
| **HP0 — Reuse baseline and trash9 findings** | Already recorded; refresh only repair-relevant facts | Known account/cloud/seed state and genuine fallback timeout |
| **HP1 — Correct Home, catalog and redemption** | S08–S10; earlier if an independent repair is appropriate | Working database-backed reward journey and Home progress |
| **HP2 — Repair forward scan presentation** | S04/S06, then S07 app check | Correct content, selected draft, processing/result observation and fast UI response |
| **HP3 — Real immediate inference and credit** | S02/S03/S05, then S07 | First real trash9 automatic credited result through Tasks and Flutter |
| **HP4 — Meet latency and seamless refresh** | S09/S11–S13 as measured | Fast pipeline and coherent Home/Rewards after both mutations |
| **HP5 — Rehearse, freeze and record** | S14/S15 after the core journey works | Identified APK/backend and concise final app rehearsal |

Prioritize the first real credited result, then rewards correctness and measured speed. When a check fails, diagnose/fix its actual boundary without asking the user to repeat administrative validation. Reuse passing evidence, keep reports brief and leave the user ready to record. Missing real feature proof remains explicit; missing project-time bookkeeping is irrelevant.

### HP0 — Freeze baseline and expose trash9 risks

**Objective:** establish the actual recording state and identify image/provider blockers before hours of UI work.

**Read set:** §1–4 above, `seed-manifest.demo.json`, current runtime/client config, `request.ts`, `run_job.py`, `inspect_image.py`, latest relevant deployment configuration.

- [ ] Reuse the S01 source/build/account evidence. Read ADB/package metadata yourself only when preparing a device build/check. An unattached Redmi Note 13 (`qgfy7xz9eaci4tvs` historically) does not block code implementation. No project-clock or network questionnaire.
- [ ] Use the recorded resident UID and read its wallet, stats, session and issuance data through existing authorized CLI/REST tooling. Apply §4.5's session lookup; do not ask the user to locate hidden state. Ask only if the intended visible account is genuinely ambiguous. No wallet reset.
- [ ] Reuse the completed five-bin/cycle, six-QR, four-offer and exact asset verification. Refresh only data needed for the current operation, such as the main bin reservation. Check actual stored values yourself and preserve deliberate full/offline/disabled scenarios. Create only a specifically missing reference after a scoped preview.
- [ ] Read deployed config selectively: resident/gateway region, named database, Vision URL/audience, gateway URL/audience, runtime subject, buckets, queue settings, secret **version references**, scaling and traffic. Preserve correct current identity settings.
- [ ] Reuse the captured Processing regression and genuine trash9 timeout. Obtain further IDs/logs through tools when a repair requires them. Do not request an app survey before implementing these already-reproduced defects.
- [ ] Reuse the completed genuine **trash9** diagnostic; do not rerun it merely to complete baseline paperwork. Run another bounded composition only when changed code or a specific unresolved inference question justifies it. Use existing managed access and inspect the actual result yourself.
- [ ] An initial diagnostic may use no retries, A/B once each, and at most four specialist plus four crop-fallback calls (or the bounded full-image branch). Keep the total explicit; stop on credentials/model/schema failures rather than retrying them blindly.
- [ ] If private workstation access is blocked, use an existing approved same-project diagnostic context if available. Otherwise record the provider diagnostic as pending and use the first real HP3 submission for that proof. Do not spend this phase building a separate diagnostic service or waiting on Tasks-account impersonation; the actual submission already uses the existing Tasks integration.
- [ ] Record whether trash9 can plausibly take the supported automatic branch. The image outcome remains unproven until HP3 settles it. If real findings expose a policy/object-limit obstacle, bring it to the user now.

**Exit:** the recorded baseline and first failures identify the next code repair. S01 already provides this; proceed to S02. Device observation and full Tasks proof belong to the later working-candidate checks. Use CLI/approval tooling yourself for access problems and continue independent code work if a genuinely human-only action remains.

### HP1 — Correct Home, catalog and redemption

**Objective:** Browse rewards actually works from Home, and the server-issued voucher survives its later database read.

**Primary files:**

```text
lib/features/rewards/data/firebase_rewards_repository.dart
lib/features/rewards/presentation/controllers/{rewards_controller,vouchers_controller}.dart
lib/features/rewards/presentation/screens/rewards_screen.dart
lib/features/home/presentation/controllers/home_controller.dart
lib/features/home/presentation/widgets/wallet_summary_card.dart
lib/features/wallet/data/firebase_wallet_repository.dart
lib/app/providers/app_providers.dart
lib/core/firebase/firebase_converters.dart
functions/src/infrastructure/firestore/{rewards_store,codecs}.ts
functions/tests/emulator/{rewards,rules}.test.ts
firestore.indexes.json (only if actual query requires it)
```

#### HP1.1 Read models and reactive data

- [ ] Normalize raw Firestore dates at reward/voucher/wallet adapter boundaries. Support current Timestamp and actual legacy ISO records; keep strict domain validation of required values.
- [ ] Map category `displayName → label` and voucher `merchant → merchantName`. Preserve real title, terms, code, demo flag, offer version, status, remaining uses and dates. A fresh receipt and its persisted-document read must represent the same voucher.
- [ ] Replace **all** full-collection voucher reads/listeners with owner-constrained Firestore queries. Prefer one shared owner-scoped stream, sorted by issue time in the client for this small demo dataset, avoiding an unnecessary index dependency. Count all relevant owner-issued vouchers, not merely the visible first page.
- [ ] Decouple public catalog rendering from repeated voucher fetches. Combine the catalog with the shared owner's issuance state; do not execute one voucher query per offer/update.
- [ ] Sort/filter catalog and categories consistently using stored active/expiry/sort fields. Keep existing reward art and layout.
- [ ] Give Home and Rewards one shared reactive wallet source for the ready UID, including Timestamp normalization. Preserve compatible one-shot APIs for other callers if needed.
- [ ] Derive the next-reward progress per §4.3 from the real catalog and resident issuance state. Keep a loading/unavailable distinction instead of treating null catalog data as “all unlocked.”
- [ ] Keep wallet/profile/stats/recent activity rendering independent from optional reward-target loading. Use reactive provider dependencies rather than reconstructing several sequential one-shot reads.
- [ ] Preload the small real catalog and owner voucher state while Home is shown. Reuse same-owner loaded state on navigation and refresh through listeners. This is real-data caching, not a static mock catalog.

#### HP1.2 Redeem and display its committed state

- [ ] Fix server offer-date parsing with the existing `timestampToInstant` helper. Check all date-dependent fields on the actual redemption path, not only Flutter decoding.
- [ ] Preserve the existing wallet transaction and idempotency key. Remove the redundant client `getReward`/voucher read before submitting an already displayed `rewardId`, `offerVersion` and cost. The backend remains the authority for eligibility and price.
- [ ] Use committed receipt wallet balance/version and voucher metadata immediately; reconcile them with the shared database streams. Do not debit locally before the server commit or fabricate issue times/demo status.
- [ ] Sort My vouchers deterministically so the newly issued voucher appears first, and ensure available/used/expired metadata remains consistent when opening it.
- [ ] Reserve an eligible offer on the existing account for the actual recording. Do not consume all four one-per-resident offers during testing. If all offers are already exhausted, ask the user before changing limits or account strategy.
- [ ] Preserve clipboard-only copy and existing simulated-use behavior. A single narrow regression can confirm use still causes no second wallet debit; broad voucher lifecycle expansion is not a phase requirement.

**Proof:**

- [ ] Seed a reward with the **production seed's Timestamp and fields** in the named emulator database; redeem from a nonzero wallet. Independently assert exact debit, one voucher/ledger, matching metadata and same-request replay.
- [ ] Exercise owner-scoped query + current rules using resident client credentials, with another resident's voucher present. An Admin SDK read alone is not query proof.
- [ ] Add a focused Firebase-adapter/Home-Rewards test with real Timestamp values, seed category fields, persisted voucher fields and live wallet changes. Keep the existing mock screen test as a regression, not release evidence.
- [ ] Agent: inspect balance/offer eligibility, build/install and verify backend effects yourself. User app check: **Home → Browse rewards → confirm the four offers appear**; later **choose the supplied eligible offer → Redeem → My vouchers**. Accept Yes/No and collect technical evidence yourself.

**Exit:** visible Home/reward behavior correct, real seeded expiry accepted, real issued voucher readable. If lack of earned funds blocks the live mutation, record that exact dependency and close it immediately after HP3; do not label redemption verified from UI mocks.

**Dependency handoff:** a funds-only blocker may leave HP1's live-redemption checkbox pending while execution advances to the next first-credit prerequisite. Keep HP1 explicitly partial, identify the next active slice, and return to that checkbox after real earnings. This prevents a circular requirement to redeem before earning.

### HP2 — Repair forward scan presentation

**Objective:** every pre-submit stage works, then processing can remain subscribed until a final result arrives.

**Primary files:**

```text
lib/features/scan/data/{firebase_scan_repository,backend_scan_mapper}.dart
lib/features/scan/domain/models/{scan_instructions,deposit_result,deposit_session}.dart
lib/features/scan/presentation/controllers/scan_controller.dart
lib/features/scan/presentation/screens/{scan_screen,scan_session_screen}.dart
lib/features/scan/presentation/widgets/{simulation_asset_picker,deposit_result_card}.dart
functions/src/infrastructure/firestore/{inspection_store,settlement_store}.ts
firestore.rules
test/features/scan/{firebase_scan_repository,backend_scan_models,scan_flow}_test.dart
```

- [ ] Implement `getInstructions` from `scanContent/default`; add the specific authenticated reference-read rule. Use the existing seeded text. Remove the completed-card null assertion and keep content loading from blocking result rendering.
- [ ] Define the minimal actual processing projection: IDs/owner/outcome/nullable points and optional final lines/time. Decode it successfully. Keep the listener alive until the complete final document arrives; no invented classification time or zero-points “processing success.”
- [ ] Complete the writer/reader contract for final result policy, count, trace, lines, explanation and decision time. Preserve pinned source/policy identities rather than mapper-generated stand-ins.
- [ ] Use the session returned by successful QR/transition commands immediately in local observable state. Subscribe directly to snapshots rather than waiting on redundant `get()` then a fresh listener before showing the same confirmed state.
- [ ] Keep the working QR camera and cached bin behavior; change them only if a newly captured error is specifically there.
- [ ] Show an immediate selected-state highlight for Prepared image 10. Keep explicit selection; do not trigger inference until Continue.
- [ ] Persist the selected draft while the user is on the selection screen, retain its save Future/acknowledged session version, and let Continue await that save if necessary. Skip a second identical save on Continue. Ensure a heartbeat cannot race this write or submit a stale version.
- [ ] Retain the IDs returned by submission immediately and attach the result listener once. Show truthful submitting/processing state without waiting for the session stream to echo it merely to navigate.
- [ ] Make buttons acknowledge taps around 100 ms. A pending stage shell can respond immediately while its server transition finishes; dependent commands remain gated by the confirmed version.
- [ ] If provider verification is not yet working, stop at a truthful processing/error state. UI-only fake completion is not HP2 evidence.

**Proof / exit:** Android QR → Bin Found → Confirm → Ready → Finish → Prepared image 10 → Continue reaches a submitted processing state with correct IDs. A production-shaped processing record followed by a final record renders without a stream failure or missing-instructions crash. Non-provider stage timings are recorded.

### HP3 — Real immediate inference and credit

**Objective:** the selected pixels produce the first real automatically verified, credited trash9 receipt.

**Primary files:**

```text
functions/src/transport/{resident_inspections,internal_jobs,dispatch}.ts
functions/src/infrastructure/cloud_tasks.ts
functions/src/infrastructure/firestore/{inspection_store,jobs_store,settlement_store}.ts
functions/src/application/finalize_inspection.ts
contracts/backend/v1/findings.schema.json
services/vision/src/ecoloop_vision/application/{run_job,inspect_image}.py
services/vision/src/ecoloop_vision/infrastructure/{job_gateway,contract_validation,artifacts}.py
services/vision/src/ecoloop_vision/adapters/{detectors,specialist,gemini}.py
functions/tests/emulator/{submission,jobs,settlement}.test.ts
services/vision/tests/test_run_job.py
```

#### HP3.1 Immediate real transport

- [ ] After successful submission transaction commit, call the existing deterministic `dispatchJob(jobId, now)` immediately and await durable enqueue. Keep the scheduled dispatcher as repair; it is not the normal start path.
- [ ] Handle enqueue failure as an already-committed submission with the same IDs and pending repair, not a reason to create another deposit. No untracked fire-and-forget work after callable return.
- [ ] Ensure the submission runtime has the queue URL/audience/invoker settings and enqueue/act-as permissions; those were previously only needed by the scheduled dispatcher.
- [ ] Preserve the distinct Tasks invoker and Vision runtime identities. Verify actual Tasks delivery and gateway claim/source retrieval in logs using the submitted job ID.
- [ ] Do not infer readiness from revision `Ready=True` or a standalone provider probe. Source fetch, claim, artifact write and completion must succeed for this job.

#### HP3.2 Worker → backend → Flutter agreement

- [ ] Serialize normalized geometry in `_findings`; retain pixel coordinates only for internal crops/overlays. Use null only where geometry is honestly unavailable.
- [ ] Give provider model references an appropriate bounded schema instead of document-ID grammar. Preserve native IDs, including version separators, and validate the actual serialized output in both Python and the backend HTTP boundary. Do not weaken all document-ID validation.
- [ ] Compute inventory/eligibility from required provider outcomes and unresolved objects. Detector failure or required fallback failure cannot become empty or confidently eligible. Preserve no-credit review for genuine uncertainty.
- [ ] Fix the branch actually exercised by trash9. Preserve A/B reconciliation and required low-confidence → Gemini behavior. If the selected branch needs full-image fallback, provide the genuine consistency check or keep it unverified; do not silently accept the currently missing check.
- [ ] Keep model IDs, thresholds and policy semantics unless the user approves a concrete measured change. No training, labeling project, hidden-object guessing, hard-coded expected count, image substitution or result reuse across new deposits.
- [ ] Make checkpoints refer to artifacts actually written. Keep the existing working evidence prefix shared by claim/writer/settlement for this release; do not introduce an unrelated namespace migration.
- [ ] Treat only a terminal durably completed result as recovery from an ambiguous completion; the existing processing projection is not success.

#### HP3.3 Correct credit and dashboard stats

- [ ] Keep the existing atomic additive wallet credit. Start the test from the account's actual nonzero/zero balance `B`; verify `newBalance = B + awardedPoints`, never replacement with awardedPoints.
- [ ] Post one credit/ledger/decision for the deposit. Keep pinned-policy math, current-cycle occupancy and matching reservation release.
- [ ] Increment verified-batch stats **only for verified accepted batches**, not a review batch containing some recognized objects. A zero-rate verified batch may still be verified; no assumption that review is verified because `acceptedCount > 0`.
- [ ] Maintain accepted material/class counts if using the real weight estimate. If existing historical stats are inconsistent, prepare a read-only comparison for this resident and ask before applying a scoped rebuild. Do not overwrite the existing count with “1” or reset activity.
- [ ] Include the final writer fields required by the HP2 decoder. Observe the actual receipt and result status in Flutter, not just a successful worker HTTP response.

**Proof / exit:**

- [ ] Corrected real worker serializer passes the shared schema, including actual provider model IDs and non-null geometry.
- [ ] Production-store settlement test with normalized worker output, nonzero opening wallet and real policy asserts additive credit, verified count, one ledger, occupancy and released session. Include one review example proving verified count does not increase.
- [ ] One genuine Android trash9 submission travels immediately through Tasks → private source read → providers → durable artifacts → settlement → visible verified receipt. Record safe IDs and DB before/after values.
- [ ] Positive credited outcome is required for this selected happy path. A safe review result is useful diagnostics but does not close this gate.

If this does not work by the allocated checkpoint, show the user the exact failed operation and remaining work. Do not spend the remaining window making review appear as points earned.

### HP4 — Meet latency and seamless refresh

**Objective:** optimize the working real path and remove stale views, without reworking unrelated lifecycle behavior.

**Primary files:** HP1/HP2 providers and screens; `inspect_image.py`, provider adapters, `job_gateway.py`, source/artifact adapters; `request.ts`, gateway options and hot Firestore stores; `runtime_config.dart`, `firebase_clients.dart`, deployment scripts and `infra/cloudrun.vision.yaml` as needed.

#### HP4.1 Measure before tuning

- [ ] Instrument compact timings for tap, draft-ready, submit commit/enqueue, task start, claim/source read, A/B, fallback, artifact write, completion commit and rendered receipt. Carry request/session/job/attempt/trace IDs; do not dump private payloads.
- [ ] Measure sequential provider contribution, gateway round-trip/transaction time, cold starts and listener delivery independently. Do not attribute every 2-second pause to Flutter animations.
- [ ] Inspect actual trash9 candidate and fallback counts. One logical provider stage may make several calls/retries; count physical calls.

#### HP4.2 Apply targeted optimizations

1. **Run independent A/B calls concurrently**, then reconcile in deterministic order. Independent crop calls may use a small bounded pool when the measured branch needs them. Preserve every required finding; no truncation to force the object limit.
2. Configure real SDK/HTTP timeouts and bounded transient retries within an absolute remaining budget. Reuse suitable provider HTTP clients, Storage clients and audience-specific identity tokens within their valid lifetimes. Do not rely on abandoning a thread as cancellation.
3. Reuse selected immutable source bytes within a process if helpful, keyed by verified path/generation/digest. Every **new** deposit still performs genuine inference. Evidence/finalization remain durable before credit.
4. Read independent Firestore documents together (`getAll`/parallel reads as appropriate), preserving transaction reads-before-writes and financial invariants. Remove duplicate direct reads and unnecessary serial gateway hops only with a real replacement for their purpose.
5. Keep one authorized warm Vision instance during rehearsal/recording if cold-start measurements require it. Warm only measured hot Functions, not every export. Read back service/revision scaling and exact traffic; an HTTP health ping does not guarantee provider warm-up.
6. If US↔Singapore latency still consumes the budget, use the user-authorized targeted regional change. Prefer first co-locating the worker gateway with Vision/database; then hot resident commands if necessary. Follow the coordinated procedure below.

**Regional-change procedure:** deploy the compatible new regional endpoint before switching callers; preserve the working old endpoint during rehearsal. Update every affected URL/audience, worker env, server region option and client selection together. If resident commands move, either route the hot operations explicitly or deploy the entire client-used resident surface compatibly. `FirebaseClients.initialize` currently ignores `config.region` and hardcodes `RuntimeConfig.residentFunctionsRegion`; changing only a Dart define will not work. Test login/bootstrap and all happy-path callables after the change. Keep the named database/data, QR IDs, wallet and Storage sources in place. Do not delete old endpoints or force a broad migration before recording.

**Budget:** engineer the normal path toward roughly 6–7 seconds total, leaving headroom to the 10-second ceiling. The exact allocation is measured, not assumed: submission + queue, claim/source, concurrent A/B, required fallback, artifacts/settlement, UI delivery. A short UI timeout alone does not make inference faster. If genuine provider time cannot meet the ceiling, report the measured limitation and ask the user before changing recognition policy or the target.

#### HP4.3 Seamless return state

- [ ] Keep shared wallet/stats/catalog/owner-voucher subscriptions active through the forward journey. Home/Rewards must not retain an old one-shot wallet.
- [ ] On terminal deposit success, use committed wallet/version information or confirm the authoritative wallet snapshot has caught up before presenting the receipt as ready to return. Do not merely add points in local UI state.
- [ ] On redemption, publish the committed receipt/voucher and new wallet version to the same owner-scoped state, then reconcile with Firestore. Prevent older cached snapshots replacing newer versions.
- [ ] Verify Home's verified count and progress recalculate after deposit and debit. Preserve Recent Activity behavior and inspect its new row.
- [ ] Use accurate database-derived weight if its maintained counts are ready. Otherwise use the user-authorized 1.2 kg display with an estimated/sample label; this is the only authorized fixed dashboard value. It must not drive points or settlement.
- [ ] Keep same-owner last-good content during a short refresh to avoid recording-wide flicker; new confirmed balances still replace old values promptly.

**Proof / exit:** successive trash9 runs meet §4.2; first useful Home frame after receipt has the correct new balance/count, and Rewards offers redemption using that same balance. Record every timing, including slow runs. Full repeated acceptance belongs to HP5.

### HP5 — Rehearse, freeze and record

**Objective:** deliver the exact app/backend combination the user will record.

- [ ] Build/deploy only affected Functions, Vision and rules/indexes in dependency order. Build Functions/contracts before deployment; wait for any newly required index to be READY.
- [ ] Record implementation source/diff identity, actual Functions regions/revisions, Vision image digest/revision, processing configuration/model registry identity, secret version references and exact Android build defines.
- [ ] Build/install the identified Android APK using the existing signing/distribution. Record file path/hash/package and distinguish it from an older installed app. Confirm Google login still works after shared client changes.
- [ ] Run targeted automated gates in §6. Fix concrete failures; do not start broad unrelated test infrastructure or repeated whole-suite runs after the relevant gates are green.
- [ ] Rehearse **three consecutive new trash9 deposits** on the final candidate/device/network. Each must genuinely infer and credit once. Record all three Continue→receipt timings: target <7 seconds, each ≤10 seconds. Record median/max rather than claiming a statistical p95 from three samples.
- [ ] For each, verify additive balance, verified count +1, result/ledger identity, bin-cycle contribution and available reservation afterward. Reusing the same source is acceptable; reusing another deposit's decision as a new prediction is not.
- [ ] Perform the complete Home → Scan → credited receipt → Home → Browse rewards → committed redeem → My vouchers journey. Reserve an unused eligible offer for the recording; emulator tests cover repeated financial cases without consuming live issuance limits.
- [ ] Verify at least one existing voucher and the newly issued voucher from database-backed reads. Opening/copying it must preserve existing behavior; only simulate use if the user elects to include that action.
- [ ] Give the user the exact candidate and a short ordinary-use workflow; accept Yes/No for the visible result. Capture logs/backend evidence yourself, fix a reported failure and recheck that path. Any runtime-affecting change invalidates its affected timing/correctness observation.
- [ ] Freeze the candidate and complete the operator sequence below. Keep warm instances for the agreed recording window; record exact restoration commands and restore the prior min settings after the user confirms recording is finished.

**Exit:** all required rows in §8 are PASS with actual observations; user has the exact APK, QR, image selection, available offer and recording sequence. A provider-only probe, mock integration test or backend-only screenshot cannot substitute for this gate.

## 6. Minimal verification set

Use existing scripts; the old `test:demo:a1`–`release` names are not implemented and should not be pasted as working commands. Create only focused missing tests that catch the observed real failures.

| Check | Existing command / required addition |
| --- | --- |
| Functions build/packaged contracts | From `functions`: `npm.cmd run build` |
| Relevant unit logic | From `functions`: `npm.cmd run test:unit` |
| Reward Timestamp + atomic debit/receipt | Extend existing emulator tests; `npm.cmd run test:rewards` |
| Actual owner voucher query and scan content rule | Extend rules test; `npm.cmd run test:rules` |
| Session/draft/submission regression | `npm.cmd run test:sessions`, `npm.cmd run test:submission` |
| Task/worker/settlement changes | `npm.cmd run test:dispatch`, `npm.cmd run test:jobs`, `npm.cmd run test:settlement` |
| Worker findings contract/provider orchestration | From `services/vision`: `uv run --frozen pytest -q` after focused development checks |
| Dart | `flutter analyze`; targeted existing Home/Rewards/Scan repository/widget tests with `--concurrency=1` |
| New focused Firebase UI boundary coverage | Proposed `test/happy_path/home_rewards_test.dart` and `test/happy_path/scan_journey_test.dart`; create before invoking. Use production adapters and backend-shaped records, not only `Mock*Repository` overrides |
| Actual release acceptance | HP5 device rehearsal + correlated read-only DB verification on the exact deployed candidate |

Repair directly affected emulator fixtures to explicitly use `demo-ecoloop` / `ecoloop-db` and reject accidental live execution. Do not run their recursive cleanup against real data. The existing tests are useful after their fixture shapes match production.

The essential new assertions are:

1. Seed-shaped Timestamp catalog/category → real Flutter adapter → rendered offers; owner-scoped real query succeeds under rules.
2. Same backend-issued voucher read after redemption → same title/merchant/demo/status/dates; balance debit happens once.
3. Real processing projection → final projection does not kill the result listener.
4. Actual worker `_findings` serializer → shared schema → production settlement, with normalized boxes and native provider IDs.
5. Opening wallet 37 + a controlled two-bottle 10-point software fixture = 47, with one ledger and verified count +1; a review batch changes neither credited balance nor verified count. This is a software fixture, **not an expected answer for trash9**.
6. Committed wallet/stats changes propagate to Home and Rewards without explicit refresh, and correct reward progress recalculates.

No new general recovery framework or giant cross-project acceptance runner is needed. Keep mocks for fast UI regressions and use actual deployed observation to establish the recording path.

## 7. Recording sequence and user discussions

### 7.1 Exact operator sequence

1. Agent builds/installs the candidate and checks current database balance, verified count and offer eligibility. User opens the app and signs into the existing account only if a native login prompt requires it.
2. Agent verifies any warm-service/configuration readiness with CLI and lets real app data load. User is not asked to confirm cloud values.
3. Start recording. Show Home balance/progress/count and retained Recent Activity.
4. Optionally open Browse rewards first to show the catalog and current vouchers; use normal Home navigation to start the deposit sequence.
5. Scan the main printed/displayed QR. Confirm the bin, then press **Confirm session** and **I pressed the finish button**.
6. Explicitly select **Prepared image 10** (`trash9.jpg`, `asset-demo-0010`); press Continue once.
7. Show the real processing screen and verified receipt. Use **Back to home**; show that points and verified count are already updated.
8. Press **Browse rewards**, choose the still-eligible rehearsed offer, confirm redemption, and show the new database-backed My vouchers entry and decreased balance.
9. Open the issued voucher if desired. Copy/use actions are preserved; simulated use is optional for this recording.
10. Stop recording before any retake preparation. Preserve resulting legitimate transactions and advise which offers remain eligible.

### 7.2 Ask only for an unavailable action or substantive decision

Already answered: Android recording, existing account, trash9 only, next-above-balance progress, urgent focused implementation, and agent-run CLI/IAM/deployment work under available command approvals. Do not ask the user to repeat these confirmations.

Ask the user promptly if:

- Actual trash9 findings cannot pass the current honest automatic policy or object bound, or genuine provider time cannot meet 10 seconds after measured tuning.
- The existing recording account has exhausted all eligible rewards. Do not reset vouchers, raise limits, add funds or switch accounts silently.
- An existing historical wallet/stats discrepancy needs a scoped data repair. Supply the affected IDs and proposed calculation first.
- A required permission/secret/model-access operation still cannot be completed after using available CLI credentials and requesting the exact executable command approval. Explain the actual denial and request only the unavoidable login/owner/consent action; continue independent repairs.

Ordinary authorized adapter, query, UI, dispatch, scoped IAM/configuration and measured tuning actions are agent-owned; use command approval when required. Broad policy changes, a new demo image or a different account strategy require a real user decision. App acceptance requests stay short and visible; never ask for hidden session status, technical IDs or project-clock information.

## 8. Execution ledger — maintain in this single document

### 8.1 Current checkpoint

```text
Phase: S01 technical baseline sufficient under revised scope; continue implementation at S02
Execution mode: autonomous CLI-first; user manages time; no countdown information is required
Reviewed source: 11410f2f82f330546bc11e192decfe114e7108a1, dev
Working-tree baseline: clean source tree at S01 start; only the two execution-plan files were pre-existing untracked files
Recording account: likely existing account `zyb5KdlNqVZ1kKWudR57RKb2zti1` (`nayzinminlwin22@gmail.com`, display name `Nay Zin`) identified from the authorized Firebase account; wallet balance 0/version 0, verified batch count 0, accepted item count 0, estimated weight 0, activeSessionId null; no top-level redemptions/vouchers/rewardRequests/walletEntries found
Device/build/network: adb device list remains empty; candidate `build/app/outputs/flutter-apk/app-debug.apk`, package `sd.idk.ecoLoop`, version `1.0.0+1`, debug APK metadata inspected; install and device/network observation NOT_RUN
Required image: asset-demo-0010 / trash9.jpg / Prepared image 10
Current code blockers: scan Processing rendering failure; trash9 composition timed out during Gemini fallback. Device observation is deferred to a working candidate. Missing local ADC is not proof that existing gcloud/REST diagnostic access is unavailable.
Next action: S02 worker/output/decision repair using recorded evidence; do not repeat S01 or wait for clock/device/configuration confirmation
Runtime target: ecoloop-thesmartrecycling / ecoloop-db / Android Firebase mode
Regional baseline: resident/gateway us-central1; Vision/Tasks/database asia-southeast1
Current implementation evidence: S01 read-only seed verification and bounded provider composition only; no business-data mutation
```

### 8.2 Phase record

| Phase | Status | Source/build identity | Actual test/device evidence | Remaining blocker / next action |
| --- | --- | --- | --- | --- |
| HP0 | PASS | `11410f2` / S01 technical baseline | Existing source, live seed/QR/account reads and genuine trash9 timeout suffice for the revised baseline gate. Full journey remains unverified. | Proceed S02; attach device only when a working build needs an app check |
| HP1 | NOT_STARTED | — | — | Correct Home/catalog/voucher/redemption boundaries |
| HP2 | NOT_STARTED | — | — | Complete forward scan/read models |
| HP3 | NOT_STARTED | — | — | First real automatic credited trash9 result |
| HP4 | NOT_STARTED | — | — | Timing and seamless shared state |
| HP5 | NOT_STARTED | — | — | Final candidate rehearsal and recording |

Allowed status: NOT_STARTED, IN_PROGRESS, BLOCKED, PASS. PASS means the stated gate was actually observed. A partial phase can record its completed substeps without claiming the whole gate.

#### Slice record

Slice gates are narrower than phase acceptance. `CHECKED` means the slice's stated boundary proof exists; it does not imply deployed/device proof for another boundary. `PARTIAL` preserves useful work with explicitly missing proof. A relevant runtime change makes earlier affected evidence `STALE` until rechecked. Track one active slice and retain precise dependencies for blocked slices.

##### Original S01 evidence — retained verbatim

The following original row includes administrative missing items from the previous instructions. They are historical notes, **not current prerequisites**. The live readback already found a null active-session reference. Lack of countdown information/device attachment does not block S02. Its genuine inference timeout remains an unresolved code/performance finding, not a successful credit.

| Slice | Phase coverage / outcome | Status | Proof / missing evidence |
| --- | --- | --- | --- |
| S01 | HP0 baseline and exact image risk | PARTIAL | `npm.cmd run seed:verify:live` passed with `writes: []`, `conflicts: []`; five live bins/cycles and four live offers were read, with main/near-full/full/offline/disabled states matching the manifest. Exact asset-demo-0010 mapping verified (`trash9.jpg`, SHA-256 `4a5e8b49da2c64c31d61ecf7b695db63054c0bb19ac7eb72020356279fb25661`, 715x429, 42148 bytes, storage generation `1792435379722099`); QR verification passed with `cloudRecordsVerified: true` and six decoded payloads, including `ecoloop://bin/qr-demo-main`. Deployed runtime proof: project `ecoloop-thesmartrecycling`, database `ecoloop-db`, resident/gateway `us-central1`, dispatch/Tasks `asia-southeast1`, queue `vision-processing` RUNNING with max concurrency 1 and max attempts 3, worker/vision endpoint identities recorded from deployed config; Vision service has maxScale 10 but minScale 0. Likely recording account `zyb5KdlNqVZ1kKWudR57RKb2zti1` was read: wallet 0/version 0, verified batches 0, accepted items 0, estimated weight 0, active session null, no top-level redemption/voucher/request/wallet-entry documents; no reservation was created. Candidate APK metadata: `build/app/outputs/flutter-apk/app-debug.apk`, package `sd.idk.ecoLoop`, version `1.0.0+1`, debug; install/device/network NOT_RUN because `adb devices -l` is empty. Real failure reproduced in `test/features/scan/scan_flow_test.dart`: two cases found 0 `Processing` widgets (lines 100 and 156); rewards screen test passed. Bounded genuine composition on trash9 completed with no job/credit: 2 detector calls, 4 resolved eligible plastic-bottle objects, 715x429 input, 30005 ms elapsed; Gemini crop fallback exhausted/timed out, so object count and automatic qualification remain uncertain. Missing: original T0/cutoff, connected recording device and installed observation, account sign-in confirmation on device, eligible-offer reservation, complete resident-side live journey, and deployed end-to-end Tasks proof. Provider run used local approved credentials but was not the production task/committed-job path; defer that proof to S07. No business-data mutations. |

##### Current slice status — supersedes the original S01 administrative status

| Slice | Phase coverage / outcome | Status | Proof / missing evidence |
| --- | --- | --- | --- |
| S01 | HP0 technical baseline and exact image risk | CHECKED | Reuse the preserved live seed/QR/account/configuration checks and genuine timeout above. App/Tasks/credit proof is still required in S07; no clock or repeated configuration confirmation is needed. |
| S02 | HP3 worker findings and honest decision boundary | CHECKED | Reproduced the contract mismatch: worker `_findings` emitted pixel-coordinate boxes while `findings.schema.json` requires normalized coordinates, and native provider IDs such as `waste-detection-0momv/6` were rejected by the generic identifier grammar; the gateway previously cast findings without shared-schema validation. Repaired `services/vision/.../run_job.py` to serialize `ResolvedObject.normalized_box`, added bounded provider-model ID grammar and ordered/normalized geometry semantics, validated findings at the Functions gateway before settlement, and rechecked model IDs in settlement. Provider/fallback outcomes now make inventory `uncertain`, preventing recognized objects from becoming an eligible/resolved success when a required provider path failed. Focused checks: `uv run pytest tests/test_contracts.py tests/test_inspect_image.py tests/test_run_job.py` — 14 passed; `npm.cmd run test:unit -- --run tests/unit/contracts.test.ts` — 3 passed; `npm.cmd run build` — passed. Deployed candidate/device observation: NOT_RUN. Next dependency: S03 immediate durable dispatch; retain S02 local proof and validate deployed transport later. |
| S03 | HP3 immediate durable dispatch | CHECKED | Reproduced before repair: `submitInspection` committed `inferenceJobs/{jobId}` with `dispatchState: "pending"` and relied on the one-minute scheduled dispatcher; no immediate `CloudTasksDispatcher.dispatchJob` call existed. Repaired the callable to await the existing deterministic dispatcher after the submission transaction commits, retaining the scheduled reconciliation path. Enqueue failures are logged with job/batch/trace context and return the already-committed operation as `pending` for repair; no second deposit is created. Added focused helper tests for successful dispatch and enqueue failure, while existing dispatcher tests cover deterministic task identity, replay/recovery, and pending-state preservation. Checks: `npm.cmd test -- --runInBand` — 24 unit tests passed; `npm.cmd run build` — passed. Deployed Tasks delivery/device observation: NOT_RUN. Missing: deployed callable trace proving immediate task creation and a real device receipt. Next dependency: S04 result rendering/processing boundary. |
| S04 | HP2 content and processing/final result rendering | CHECKED | Reproduced the Firebase boundary failures: `FirebaseScanRepository.getInstructions()` threw `StateError('Scan instructions are not wired for Firebase yet')`; Firebase result decoding required final-only `updatedAt`, policy, decision and trace fields and could not represent the committed processing record; and the completed result card force-unwrapped a still-loading instructions provider. Repaired `scanContent/default` resident-readable access, current Firebase date/Timestamp-compatible processing decoding with nullable final-only fields, optional pending lines, and a listener path that accepts the initial processing document and later final writer-shaped update. Replaced the result-card null crash with a truthful display fallback only when instructions are temporarily unavailable; final result data remains sourced from the writer. Added Firestore rules coverage for authenticated `scanContent` reads and unauthenticated denial. Checks: `flutter test test/features/scan/firebase_scan_repository_test.dart test/features/scan/backend_scan_models_test.dart` — 12 passed; `flutter analyze` on affected scan files — no issues; `npm.cmd run test:rules` — 5 passed; `git diff --check` — passed. Existing `scan_flow_test.dart` still has two pre-existing mock-copy expectations for literal `Processing` (0 widgets at lines 100 and 156); it is not used as S04 Firebase proof and no unrelated mock UX change was made. Hot restart/device observation: NOT_RUN (no active Flutter app connection). Missing: deployed Firebase resident read and real Android processing/result observation; defer device proof to S07. Next dependency: S05 settlement/stat boundary. |
| S05 | HP3 additive settlement and verified stats | CHECKED | Reproduced the settlement defect: a review plan with recognized items entered the `acceptedCount > 0` mutation branch, which could increment verified and accepted-item stats even though no verified result existed. Gated wallet, ledger and stats mutation on `plan.status === "verified"` while preserving the existing transaction/idempotent replay path. Expanded the actual Firestore settlement emulator fixture to explicit `demo-ecoloop/ecoloop-db` with a complete pinned policy and worker-shaped normalized boxes/native provider IDs. Acceptance checks pass: opening balance 37 becomes 47 for two plastic bottles worth 10 points; verifiedBatchCount becomes 1, acceptedItemCount becomes 2, exactly one wallet ledger and capacity entry are written, replay is idempotent, occupancy/cycle contribution and reservation/session release are correct; a review containing recognized items leaves balance, ledger, verified count and accepted-item count unchanged. Deployed/device observation: NOT_RUN. Next dependency: S06 confirmed forward transitions and selected draft. |
| S06 | HP2 confirmed forward transitions and selected draft | CHECKED | Reproduced the remaining forward-path gap: Firebase command results for Confirm/Finish were discarded, image selection only changed local highlight and was not acknowledged until Continue, draft-save completion could race heartbeat/submission, and submit returned batch/job/result IDs were discarded while navigation waited for a stream echo. Repaired the screen to apply returned session versions immediately, highlight and persist the selected asset once, await an in-flight draft save on Continue, suppress renewal while that write is pending, submit with the acknowledged asset/version, publish returned processing IDs immediately, and reuse the existing single result observer for pending-to-final updates. Focused production-adapter regression coverage: pending/result listener and owner/cache behavior remain passing; Flutter analysis/tests and device observation are recorded separately below. Deployed/device observation: NOT_RUN. Next dependency: S07 first real Android trash9 credit and receipt. |
| S07 | HP2/HP3 first real credited trash9 receipt | IN_PROGRESS | Reproduced the deployed Android failure with the exact Prepared image 10 path: Tasks delivery and Vision invocation occurred, but revision `ecoloop-vision-00009-ff4` failed its committed source read with HTTP 403 because `ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com` had no object-read binding on `ecoloop-thesmartrecycling.firebasestorage.app`. Applied the narrowly scoped `roles/storage.objectViewer` grant and added it to `tools/backend/deploy_vision.ps1`; source read permission was verified in the live bucket policy. Confirmed the intended 300-second deadline/Admin-review path was present but had a reconciliation gap: terminal `failed` jobs were excluded from the maintenance query, leaving the processing result and resident active session stuck. Repaired and deployed `reconcileBackendState` to include failed jobs; the existing job was finalized as review with `processing_deadline_elapsed`, its review ticket was opened, reservation released, and `activeSessionId` cleared without credit or duplicate settlement. A new Android run then completed the full Tasks → source read → providers → artifacts → settlement path in about 63 seconds, but the committed result was `review` with `material_uncertainty`, `pointsAwarded: null`, and four detected plastic-bottle lines; durable findings showed Gemini crop `invalid_geometry`/budget exhaustion and the specialist adapter had discarded provider `predictions` scores. Repaired crop fallback validation and specialist score normalization, passed 16 focused Vision tests, and deployed revision `ecoloop-vision-00010-ddl` (digest `sha256:dbaf0a12b0df698665973b0f23ecf1ae085d2853f294adce359eac3e05b5fcb1`). The subsequent live dashboard failure was traced to a legacy review deposit missing `traceId`; `DepositTransaction.fromBackendJson` incorrectly required that optional model field, so Home failed after profile, wallet, and summary had already loaded. Changed the decoder to preserve a null trace ID, added a legacy-row regression fixture, rebuilt and installed the Firebase APK, and verified the connected Android Home tree rendered `Available EcoPoints` and `Recent recycling` without the dashboard error. The S07 acceptance remains open pending a new genuine automatically verified trash9 receipt; the repository activity test file still requires its existing Firebase test harness initialization when run standalone. |
| S08 | HP1 seeded rewards and owner voucher reads | NOT_STARTED | — |
| S09 | HP1/HP4 reactive wallet and Home progress | NOT_STARTED | — |
| S10 | HP1 real redeem and persisted voucher | NOT_STARTED | — |
| S11 | HP4 provider critical-path latency | NOT_STARTED | — |
| S12 | HP4 measured cloud/region latency, if necessary | NOT_STARTED | — |
| S13 | HP4 final forward feedback and seamless refresh | NOT_STARTED | — |
| S14 | HP5 exact candidate and independent gap review | NOT_STARTED | — |
| S15 | HP5 final repeated rehearsal and recording | NOT_STARTED | — |

### 8.3 Final acceptance

| Gate | Result | Safe IDs / values / actual observation |
| --- | --- | --- |
| Home balance equals canonical DB wallet | NOT_RUN | — |
| Reward progress uses agreed eligible target | NOT_RUN | — |
| Verified count equals correct DB verified stats | NOT_RUN | — |
| Weight estimate or authorized labeled 1.2 kg display | NOT_RUN | — |
| Recent Activity retained and new receipt readable | NOT_RUN | — |
| Browse rewards from Home renders four seeded offers | NOT_RUN | — |
| Existing and newly issued owner vouchers load from DB | NOT_RUN | — |
| Redeem → one debit / one voucher / correct persisted metadata | NOT_RUN | — |
| All seeded bin/QR/cycle relationships valid; main bin ready | NOT_RUN | — |
| Every forward scan stage responds smoothly | NOT_RUN | — |
| Three real trash9 deposits verified and credited once each | NOT_RUN | — |
| Continue→receipt timings: target <7s, every run ≤10s | NOT_RUN | run 1: —; run 2: —; run 3: —; median/max: — |
| Home correct immediately after result; Rewards uses new balance | NOT_RUN | — |
| Home/Rewards correct immediately after redemption | NOT_RUN | — |
| Exact final APK/backend/config identity recorded | NOT_RUN | — |
| User-observed final journey and recording handoff | NOT_RUN | — |

## 9. References and executor start prompt

Historical context:

- [Old complete refactor plan](ECOLOOP_DEMO_REFACTOR_PLAN.md)
- [Historical execution tracker](demo_refactor/EXECUTION_TRACKER.md)
- [Seed/QR evidence](demo_refactor/evidence/SEEDING_AND_QR.md)
- [A2 invariants](demo_refactor/evidence/A2_INVARIANTS.md) and [scan handoff](demo_refactor/evidence/A2_SCAN_HANDOFF.md)
- [A3 transport evidence](demo_refactor/evidence/A3_VISION_AND_TRANSPORT.md)
- [H2 blocked infrastructure handoff](demo_refactor/evidence/H2_CLOUD_HANDOFF.md)

Official documentation consulted for the targeted fixes:

- [Firestore: rules are not filters](https://firebase.google.com/docs/firestore/security/rules-query) — owner constraints must be in the query.
- [Functions runtime/scaling options](https://firebase.google.com/docs/functions/manage-functions#modify_minimum_instances) — tune measured hot services and inspect deployed settings.
- [Cloud Run minimum instances](https://cloud.google.com/run/docs/configuring/min-instances) — service/revision settings and idle billing; keep warm capacity scoped to the recording window.
- [Functions locations](https://firebase.google.com/docs/functions/locations) — explicit client/server location agreement and coordinated regional changes.

```text
Execute docs/ECOLOOP_HAPPY_PATH_DEMO_PLAN.md under the latest §4.5 correction.
Use docs/ECOLOOP_HAPPY_PATH_AGENT_PROMPTS.txt and execute only the assigned slice,
continue at S02 because S01 baseline work is already recorded. Follow S02–S07 before the remaining
Home/Rewards work. Apply the execution-and-evidence contract in §4.4.
The user has replaced the old broad demo-refactor execution scope.
Do not ask for start/current/cutoff times or repeat known CLI confirmations.
Run technical diagnostics, IAM/configuration commands, builds and deployment yourself,
using exact tool command approvals where required. User app checks are short Yes/No workflows.
Use the existing Android account and trash9.jpg / asset-demo-0010 only for live happy-path acceptance.
Preserve working features and current correct cloud identities.
Fix real catalog/voucher/date, scan-result and worker/dispatch boundaries first.
Make every new deposit run genuine inference and add points atomically to the old DB balance.
Target ~100 ms visual response and <7 s Continue→credited receipt, maximum 10 s.
Use bounded measured tuning, including authorized warm/regional changes when necessary.
Keep evidence/checkpoints in this document; ask about concrete policy/account/data-repair blockers.
Do not call a phase passed from mocks or provider-access smoke alone.
```
