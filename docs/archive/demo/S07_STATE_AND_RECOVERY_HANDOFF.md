# EcoLoop S07 State and Recovery Handoff

## Purpose

This document is a detailed handoff for a new planning or implementation model
taking ownership of **S07 only** in the EcoLoop happy-path Android demo.

It records:

1. The agreed state immediately before S07 began.
2. The exact S07 assignment and acceptance boundary.
3. The actual failures reproduced during S07.
4. The code, configuration, deployment, recovery, and dashboard repairs already
   completed.
5. The state immediately after the first S07 Android attempts.
6. The current repository, cloud, database, and device state.
7. What is still missing before S07 can be marked `CHECKED`.
8. A constrained progression plan for completing S07 without broadening into
   later slices.

This is an evidence and recovery document, not a replacement for the execution
ledger. The authoritative slice ledger remains
[ECOLOOP_HAPPY_PATH_DEMO_PLAN.md](ECOLOOP_HAPPY_PATH_DEMO_PLAN.md), especially
its sections 4.4–4.5, 6, 7, and 8.

---

## 1. Scope and non-negotiable decisions

### 1.1 Product outcome

The target is a genuine Android screen-recording journey using the existing
authenticated resident account:

```text
Home
  -> scan the registered main QR
  -> confirm the session and finish
  -> select Prepared image 10
  -> Continue
  -> genuine hosted Vision inference
  -> automatically verified receipt
  -> atomic wallet/stat/ledger settlement
  -> return Home with the new balance and verified count
```

S07 is not complete because a processing page appeared, because a worker
returned HTTP success, because a review page appeared, or because a backend
record contained recognized lines. The result must be **automatically verified**
and must agree with the committed database effects.

### 1.2 Preservation boundaries

The following must remain unchanged unless a concrete, measured defect requires
a narrowly scoped repair:

- Existing resident account, balance, history, vouchers, authentication, and
  activity behavior.
- Existing QR camera and cached-bin behavior.
- Existing transaction and idempotent settlement implementation.
- The selected image and registered QR.
- Recognition policy, thresholds, model identities, provider roles, and pinned
  policy semantics.
- Real inference for every new deposit.
- Owner-scoped Firestore rules.
- Named Firebase project and named Firestore database.
- Current source asset generation and digest.

Do not:

- Substitute another image.
- Reuse a prior result or cached answer for a new deposit.
- Classify by filename, asset ID, or expected object count.
- Relax thresholds or policy merely to obtain a verified result.
- Convert a review into a credit.
- Add points in Flutter without authoritative settlement.
- Reset, repair, or overwrite historical live stats in S07.
- Implement S08–S15 work as part of this slice.

### 1.3 Exact environment

| Item | Required value |
| --- | --- |
| Git repository | `nayzinminlwin/EcoLoop-theSmartRecycling` |
| Working branch at handoff | `dev` |
| Firebase project | `ecoloop-thesmartrecycling` |
| Firestore database | `ecoloop-db` |
| Resident UID | `zyb5KdlNqVZ1kKWudR57RKb2zti1` |
| Main bin | `bin-demo-main` |
| Main cycle | `bin-demo-main-cycle-001` |
| Main QR payload | `ecoloop://bin/qr-demo-main` |
| Android device | `qgfy7xz9eaci4tvs` |
| Android model | `2312DRAABC` |
| Android package | `sd.idk.ecoLoop` |
| Resident callable region | `us-central1` |
| Tasks/Vision region | `asia-southeast1` |
| Vision queue | `vision-processing` |
| Vision configuration | `demo-vision-v1` |
| Policy | `policy-v1` |
| App mode | Firebase |
| Firestore client database define | `ecoloop-db` |

The current Firebase Flutter invocation is:

```powershell
flutter run -d qgfy7xz9eaci4tvs `
  --dart-define=ECOLOOP_FIREBASE_MODE=firebase `
  --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 `
  --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db `
  --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
```

The `ECOLOOP_APP_CHECK_MODE=demo-debug` define is part of the established run
command. The current runtime configuration uses `ECOLOOP_USE_APP_CHECK` as its
actual boolean switch; App Check warnings were observed, but callable requests
continued to succeed and server enforcement is disabled. Do not treat the
warning as the S07 root cause without a new direct failure.

---

## 2. Exact recording asset and source identity

The happy-path image is fixed:

| Field | Value |
| --- | --- |
| Local file | `assets/trash_images/trash9.jpg` |
| Picker label | `Prepared image 10` |
| Asset document | `simulationAssets/asset-demo-0010` |
| Asset version | `sha256-4a5e8b49da2c64c3` |
| Content SHA-256 | `4a5e8b49da2c64c31d61ecf7b695db63054c0bb19ac7eb72020356279fb25661` |
| Dimensions | 715 × 429 |
| Size | 42,148 bytes |
| Storage path | `simulation-assets/asset-demo-0010/sha256-4a5e8b49da2c64c3/source.jpg` |
| Storage generation | `1792435379722099` |

The image has overlapping objects. Earlier bounded composition identified four
eligible plastic-bottle objects, but that local composition did not use the
production Tasks/committed-job path and did not prove automatic verification or
credit.

---

## 3. State immediately before S07

S01–S06 had been completed as bounded implementation slices. Their status was
`CHECKED` for their individual boundaries, not for deployed end-to-end Android
acceptance.

### 3.1 S02: worker findings contract

Before S02, the worker serializer and backend contract disagreed:

- Worker output used pixel-coordinate boxes where the shared findings schema
  required normalized geometry.
- Native provider model IDs such as
  `waste-detection-0momv/6` did not satisfy the generic identifier grammar.
- The gateway accepted/cast findings without enforcing the shared schema.
- A required provider/fallback failure could coexist with recognized objects and
  incorrectly drift toward an eligible success.

S02 repaired the worker-to-backend boundary:

- Serialized normalized boxes on the wire.
- Preserved pixel boxes for crop and overlay use.
- Added bounded provider-model reference grammar.
- Added matching Python and Functions validation.
- Preserved honest uncertainty when required provider work failed.

The focused S02 checks passed:

- `uv run pytest tests/test_contracts.py tests/test_inspect_image.py tests/test_run_job.py`
  — 14 passed.
- `npm.cmd run test:unit -- --run tests/unit/contracts.test.ts`
  — 3 passed.
- `npm.cmd run build`
  — passed.

Commit:

```text
7b6dda4 fix: align worker findings contract
```

### 3.2 S03: immediate durable dispatch

Before S03, `submitInspection` committed the job with
`dispatchState: "pending"` and relied on the one-minute scheduled dispatcher.
This created an unacceptable normal-path delay and made the production path
appear stuck even though the submission had committed.

S03 repaired dispatch by:

- Awaiting the existing deterministic `dispatchJob` implementation after the
  submission transaction commits.
- Retaining scheduled reconciliation as a repair path.
- Preserving deterministic task/job identity and duplicate-dispatch protection.
- Returning the committed operation as pending when enqueue fails, rather than
  creating a second deposit or pretending dispatch succeeded.
- Keeping external Tasks calls outside retried transactions.

Focused checks passed:

- `npm.cmd test -- --runInBand`
  — 24 unit tests passed.
- `npm.cmd run build`
  — passed.

Commit:

```text
fa8221f fix: dispatch inspections immediately
```

S03 deliberately did not claim a live financial submission or device result.

### 3.3 S04: Firebase content and processing result rendering

Before S04, the Firebase path had several incompatible boundaries:

- Firebase scan instructions were not wired.
- The Firebase result decoder required final-only fields even for an initial
  processing document.
- The result card could force-unwrap instructions while that provider was still
  loading.
- The listener did not reliably represent the initial processing record followed
  by the final writer-shaped record.

S04 repaired:

- Resident-readable `scanContent/default` access.
- Timestamp/DateTime-compatible Firebase result decoding.
- Nullable final-only fields for processing state.
- Optional pending lines.
- Listener continuity from processing to final.
- Truthful result-card fallback while instructions load.

Checks passed:

- `flutter test test/features/scan/firebase_scan_repository_test.dart test/features/scan/backend_scan_models_test.dart`
  — 12 passed.
- Affected Flutter analysis — no issues.
- `npm.cmd run test:rules`
  — 5 passed.
- `git diff --check`
  — passed.

Commit:

```text
557c130 fix: support Firebase scan result rendering
```

The old mock `scan_flow_test.dart` still contained two pre-existing literal
`Processing` expectations and was not used as Firebase S04 proof.

### 3.4 S05: verified-only additive settlement

Before S05, settlement could enter the accepted-item mutation branch for a
review result containing recognized items. That could incorrectly increment
verified/accepted statistics.

S05 repaired the root condition:

- Wallet, ledger, and verified statistics mutate only when the result is
  genuinely `verified`.
- Existing transactionality and idempotent replay fencing remain in place.
- Review results containing recognized lines do not credit.
- Capacity/bin-cycle contribution and reservation/session release remain
  coordinated.

The production-shaped emulator fixture used:

- Explicit `demo-ecoloop`/`ecoloop-db`.
- Normalized worker findings.
- Native provider model IDs.
- Complete pinned policy.
- Opening wallet balance 37.
- Controlled two-bottle result worth 10 points.

Acceptance passed:

- 37 → 47 wallet balance.
- Verified count +1.
- Accepted item count +2.
- Exactly one wallet ledger.
- Replay did not repost.
- Occupancy/cycle contribution was written.
- Reservation/session released.
- Review with recognized lines changed neither balance nor verified count.

Commit:

```text
d8afff9 fix: gate settlement stats on verified results
```

This was a software fixture, not the `trash9.jpg` acceptance.

### 3.5 S06: acknowledged forward scan and selected draft

Before S06:

- Confirm/Finish command responses were discarded.
- Returned session versions were not used immediately.
- Image selection changed only local highlight and was not acknowledged until
  Continue.
- Draft-save completion could race heartbeat or submission.
- Submit returned batch/job/result IDs were discarded.
- Navigation waited for a stream echo rather than using the confirmed response.

S06 repaired the forward path:

- Apply returned session versions immediately.
- Highlight Prepared image 10 immediately.
- Save the selected draft exactly once.
- Await an in-flight draft save on Continue.
- Prevent heartbeat from racing the draft write.
- Submit the acknowledged asset/version.
- Publish returned batch/job/result IDs immediately.
- Subscribe once to the result observer.
- Show truthful pending feedback while awaiting server acknowledgment.

Commit:

```text
244e250 fix: preserve acknowledged scan transitions
```

The focused production-adapter regression covered QR, confirmed stages,
explicit selection, one draft save, submit identity, and result observation.

### 3.6 Starting account and live baseline

The existing resident account was:

```text
UID: zyb5KdlNqVZ1kKWudR57RKb2zti1
```

At baseline, the live account read showed:

- Wallet balance: 0.
- Wallet version: 0.
- Verified batch count: 0.
- Accepted item count: 0.
- Estimated weight: 0.
- Active session: null.
- No active reservation.
- No top-level wallet entries, redemptions, voucher documents, or reward
  requests for this account.

The baseline was read-only. No business data was mutated.

---

## 4. S07 assignment and acceptance contract

The exact S07 assignment was:

1. Establish S02–S06 boundary checks first.
2. Build/deploy only affected compatible Functions/contracts, Vision, and
   scoped rules in dependency order.
3. Reuse artifacts when source/config identity matches.
4. Identify/install the correct Firebase-configured Android candidate.
5. Discover active session/reservation readiness from the recorded UID and
   Firestore references; do not ask the operator to find IDs.
6. Run only this short app workflow:

   ```text
   Scan main QR
   -> Confirm session and finish
   -> select Prepared image 10
   -> Continue
   -> see credited receipt
   -> return Home
   ```

7. Correlate the same job through:

   ```text
   immediate Tasks delivery
   -> private source read
   -> providers
   -> durable artifacts
   -> settlement
   -> Flutter rendering
   ```

8. Verify:

   - Old balance `B` becomes `B + P`.
   - Exactly one credit/ledger is written.
   - Verified count increases by one.
   - Bin/cycle contribution is coherent.
   - Reservation and session release.
   - Home return works.

9. Mark S07 complete only after a genuine automatically verified Android receipt
   and matching committed database effects are visible.

A review/provider-only/mock result cannot close S07.

---

## 5. S07 execution timeline and evidence

### 5.1 Candidate and deployment preparation

The correct Android device was identified:

```text
ADB: qgfy7xz9eaci4tvs
Model: 2312DRAABC
Package: sd.idk.ecoLoop
```

The Firebase-mode debug APK was built, installed, and run with the explicit
project/database defines listed in section 1.3.

Affected Functions/rules/Vision artifacts were reused or deployed in the
required dependency order. No unrelated service was intentionally redeployed.

### 5.2 First real Android attempt: source read failure

The operator performed the intended beginning of the workflow:

- Scanned the main QR.
- Selected Prepared image 10.
- Reached “Identifying your items.”
- Waited more than five minutes.

The UI did not produce a final result.

Production correlation found:

| Record | ID |
| --- | --- |
| Session | `session-06b3e69eab097bf3cd57feefd334e6` |
| Job | `job-5dce7ecc77ab795f976ca7e0222e098f` |
| Result | `result-5dce7ecc77ab795f976ca7e0222e098f` |
| Deposit/batch | `deposit-2c7b6de49745b8f6a2d51ddefb4d8070` |
| Trace | `a95314cd6250fe2dc445acab3544d3d2` |

Observed backend facts:

- Session remained in processing.
- Job failed with HTTP 403 reading the committed Firebase Storage source.
- Result/deposit remained processing.
- Wallet and stats were unchanged.
- The job exhausted three attempts.

Root cause:

```text
The Vision runtime service account could invoke the service but could not read
the committed source object from the Firebase Storage source bucket.
```

The missing permission was:

```text
roles/storage.objectViewer
```

on:

```text
gs://ecoloop-thesmartrecycling.firebasestorage.app
```

for:

```text
ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com
```

This was a real production boundary failure, not an Android rendering issue.

### 5.3 Source-read IAM repair

The repair:

- Granted the narrowly scoped source-bucket object viewer role.
- Updated `tools/backend/deploy_vision.ps1` to enforce the permission on future
  deployments.
- Verified the live bucket IAM policy.

Commit:

```text
c616841 fix: grant vision source bucket access
```

The exhausted job was not blindly replayed. Replaying it would have confused
the original terminal attempt with a new financial operation.

### 5.4 Stuck-session recovery and timeout investigation

The operator then reported that a stale “Identifying session” prevented scanning
another bin. This was a genuine operational defect because active-session
protection is intentional, but an expired processing job had not been released.

The planned processing timeout was already present:

```text
PROCESSING_SECONDS = 300
MAX_ATTEMPTS = 3
```

The intended behavior after the deadline was Admin review, session completion,
reservation release, and active-session clearing.

The discovered reconciliation defect was:

- `maintenance_store.ts` queried `running`, `retry_wait`, and `queued`.
- Terminal `failed` jobs were omitted.
- The exhausted failed job therefore never entered the finalization path.
- The resident session and reservation stayed stuck even though processing had
  already terminated.

The repair:

- Included terminal `failed` jobs in reconciliation.
- Deployed only the affected `reconcileBackendState`.
- Ran the supported scheduler/reconciliation path against the actual failed job.

The original failed job was safely finalized:

- Result became `review`.
- Review reason became `processing_deadline_elapsed`.
- Review ticket opened.
- Session completed.
- Reservation became available.
- Resident `activeSessionId` cleared.
- Wallet remained unchanged.
- No duplicate settlement occurred.

Commit:

```text
4eaf89d fix: finalize failed expired scan sessions
```

This repair was intentionally recovery-only. It did not convert a failed job
into a credit.

### 5.5 Second real Android attempt: full production path, honest review

The operator reran the workflow after the source IAM repair. This attempt
completed the production processing chain:

```text
Android submission
-> Tasks delivery
-> source read
-> Vision providers
-> durable findings/artifacts
-> gateway completion
-> settlement decision
-> Flutter final page
```

Correlation:

| Record | ID |
| --- | --- |
| Session | `session-a36488d92dfffc77d1923e0542afbe12` |
| Job | `job-30e99e19e28e11f4e98ba16184914620` |
| Result | `result-30e99e19e28e11f4e98ba16184914620` |
| Deposit/batch | `deposit-36af9d70c3a6b2578647bae5be258e2a` |
| Trace | `6c2b2c139626c9d4acf66dd2d0000dc3` |

Observed result:

- Job state: `succeeded`.
- End-to-end backend elapsed time: approximately 63 seconds.
- Result outcome: `review`.
- Review reason: `material_uncertainty`.
- Awarded points: `null`.
- Detected eligible lines: four plastic-bottle lines.
- Space contribution: 40.
- Wallet balance: unchanged at 0.
- Verified count: unchanged at 0.

This was the correct settlement behavior under the S05 rule. The presence of
recognized lines did not authorize a credit because the final decision was not
verified.

The Android completed page was therefore a completed **review** page, not a
verified credited receipt. It was not valid S07 acceptance.

### 5.6 Durable Vision findings and second repair

The durable Vision findings explained why the result was uncertain:

1. Detector inference resolved four eligible plastic-bottle objects.
2. Specialist providers returned real confidence data under a `predictions`
   confidence map.
3. The specialist adapter only read `class_scores` or `scores` and discarded
   the provider's actual `predictions`.
4. Gemini crop fallback returned geometry that was not used for crop
   classification, but the adapter rejected the response because of that
   irrelevant geometry.
5. The crop fallback then exhausted its budget.
6. The aggregate inventory state became uncertain.
7. Finalization correctly produced `review/material_uncertainty`.

The repair was intentionally narrow:

- Crop-mode Gemini validation no longer rejects a valid crop classification only
  because of unused returned geometry.
- Full-image geometry validation remains intact.
- Specialist normalization now converts provider `predictions` confidence maps
  into the internal score vector.
- Recognition policy, thresholds, model identities, expected object count, and
  settlement rules were not changed.

Focused Vision checks:

```text
16 tests passed
```

Commits:

```text
e9a596c fix: preserve vision fallback evidence
8e335ec docs: record S07 vision repair
```

Deployed Vision identity:

| Field | Value |
| --- | --- |
| Revision | `ecoloop-vision-00010-ddl` |
| Image digest | `sha256:dbaf0a12b0df698665973b0f23ecf1ae085d2853f294adce359eac3e05b5fcb1` |
| Region | `asia-southeast1` |
| Source bucket | `ecoloop-thesmartrecycling.firebasestorage.app` |
| Artifact bucket | `ecoloop-thesmartrecycling-vision-artifacts` |
| Runtime account | `ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com` |
| Tasks account | `ecoloop-tasks@ecoloop-thesmartrecycling.iam.gserviceaccount.com` |
| Gateway URL | `https://workergateway-tl2e2dp5xq-uc.a.run.app` |
| Vision URL | `https://ecoloop-vision-tl2e2dp5xq-as.a.run.app` |
| Model config | `demo-vision-v1` |
| Policy | `policy-v1` |
| Gemini | `gemini-3.8-flash` |
| Detector 1 | `waste-detection-0momv/6` |
| Detector 2 | `yolo-waste-detection/1` |
| Specialist | `waste-classification-rjo28/2` |

### 5.7 Dashboard/Home failure after the review run

After the review run, the operator reported:

```text
We could not load your dashboard
```

The first diagnostic capture showed:

- `getResidentProfile` callable succeeded.
- App Check warnings were present but non-fatal.
- The generic Home error hid the dependency that failed.

A targeted diagnostic build logged each Home dependency. The Android logs
showed:

```text
[HomeController] profile loaded
[HomeController] wallet loaded
[HomeController] summary loaded
[HomeController] recent deposits failed: AppFailure(invalidData)
```

The stack trace identified:

```text
JsonReaders.string(json, 'traceId')
DepositTransaction.fromBackendJson
FirebaseActivityRepository.watchDepositsPage
```

The live deposits query itself was valid and returned owner-scoped records.
Firestore indexes were ready, including the `ownerId + updatedAt` index.
The failure was local decoding, not rules or query authorization.

The offending legacy review deposit did not contain `traceId`. The domain model
already represented `traceId` as nullable, but the backend adapter incorrectly
required it.

The repair:

- Changed `traceId` decoding from required string to nullable string.
- Added a regression fixture for a legacy deposit without `traceId`.
- Removed temporary Home diagnostic logging before commit.
- Rebuilt and installed the Firebase APK.
- Verified the connected Android widget tree rendered:
  - `Available EcoPoints`
  - `Recent recycling`
  - no dashboard error.

Commit:

```text
6f58ca1 fix: keep dashboard readable with legacy deposits
```

The S07 ledger was updated with this repair. S07 remains open because this
dashboard fix does not prove a verified trash9 credit.

---

## 6. State immediately after S07 attempts

### 6.1 What is proven

The following production boundaries are now proven or repaired:

- Correct QR/session forward path reaches submission.
- Prepared image 10 can be selected and submitted with an acknowledged asset
  version.
- Immediate dispatch code exists and was exercised by the live job path.
- Tasks delivery occurred.
- Vision can read the committed Firebase Storage source after IAM repair.
- Vision providers were invoked.
- Durable findings and artifacts were written.
- Gateway completion was accepted.
- Settlement correctly rejected an uncertain review for credit.
- Failed terminal jobs can now be reconciled and released.
- Home can decode existing legacy review rows and render dashboard content.

### 6.2 What is not proven

S07 still lacks the one required positive proof:

- A new post-repair Android submission using `trash9.jpg`.
- Vision final outcome `verified`.
- Non-null awarded points from the committed policy decision.
- Wallet transition from old balance `B` to `B + P`.
- Exactly one ledger entry for that new deposit.
- Verified count +1.
- Matching accepted item/material stats.
- Coherent bin-cycle capacity contribution.
- Reservation/session release for the new verified deposit.
- Visible Android verified receipt.
- Home showing the new authoritative balance after return.

The current live resident wallet remains:

```text
balance: 0
version: 0
verifiedBatchCount: 0
acceptedItemCount: 0
```

The prior review run did not and must not change those values.

### 6.3 Current repository state

Current HEAD:

```text
6f58ca17a920774ceb5d5061b8e0611642ae554d
fix: keep dashboard readable with legacy deposits
```

Relevant recent history:

```text
6f58ca1 fix: keep dashboard readable with legacy deposits
8e335ec docs: record S07 vision repair
e9a596c fix: preserve vision fallback evidence
73e1ca5 docs: record S07 review outcome
4eaf89d fix: finalize failed expired scan sessions
c616841 fix: grant vision source bucket access
244e250 fix: preserve acknowledged scan transitions
d8afff9 fix: gate settlement stats on verified results
557c130 fix: support Firebase scan result rendering
fa8221f fix: dispatch inspections immediately
7b6dda4 fix: align worker findings contract
```

The working tree was clean after the dashboard repair commit.

---

## 7. Evidence classification

The next model must keep these evidence types separate.

### 7.1 Implementation evidence

Examples:

- Unit tests.
- Emulator settlement fixture.
- Static analysis.
- Contract validation.
- Source-level IAM/deployment script change.

Implementation evidence proves code behavior in its test environment. It does
not prove the current deployed candidate or Android recording.

### 7.2 Regression evidence

Examples:

- S02 normalized findings tests.
- S03 immediate dispatch tests.
- S04 processing-to-final Firebase adapter tests.
- S05 verified/review settlement tests.
- S06 production-adapter forward-path test.
- Legacy deposit without `traceId` fixture.

Regression evidence proves a previously demonstrated boundary will be caught if
it regresses. It does not prove a new live transaction.

### 7.3 Deployed evidence

Examples:

- Vision revision and image digest.
- Live IAM binding.
- Live queue and endpoint identity.
- Deployed Functions/rules build.
- Cloud logs showing Tasks, providers, artifacts, and gateway completion.

Deployed evidence proves what cloud artifact/configuration exists. It does not
prove that the Android device rendered the same transaction.

### 7.4 Device evidence

Required for S07:

- Exact package and APK candidate.
- Exact Firebase defines.
- Android tap sequence.
- Device-observed pending and final UI.
- Visible verified receipt.
- Home return with new balance.

The Android review page was device evidence, but it was negative evidence for
S07 acceptance because its final status was review.

### 7.5 Financial/database evidence

Required for positive acceptance:

- Before and after wallet snapshots.
- New result/deposit/batch ID.
- New ledger entry count and identity.
- Wallet version transition.
- Verified statistics transition.
- Bin-cycle/capacity contribution.
- Session and reservation final state.
- Replay/idempotency check where relevant.

Admin or gcloud reads are useful for diagnosis, but owner-scoped Android query
and rules behavior must remain valid. A backend-only credit is not a device
acceptance.

---

## 8. Current known risks and non-root causes

### 8.1 App Check warning

The device logged:

```text
No AppCheckProvider installed
```

and used placeholder tokens. Callable operations such as profile/bootstrap
continued to succeed, and App Check enforcement is disabled in the current
environment. This has not been correlated with the Home or Vision failure.
Do not change App Check configuration as a speculative repair.

### 8.2 Mobile scanner initialization warning

One later diagnostic run logged:

```text
MobileScannerException(controllerInitializing,
The MobileScannerController is still initializing.
Await the previous call to start() or disable autoStart before starting manually.)
```

This occurred during a diagnostic app restart and was not the cause of the
production S07 review result or dashboard failure. Do not broaden S07 into
camera lifecycle work unless the exact S07 forward workflow reproduces it.

### 8.3 Flutter test harness initialization

The standalone command:

```text
flutter test test/features/activity/firebase_activity_repository_test.dart
```

failed before reaching the new legacy-row assertion because the existing
`FirebaseActivityRepository` test construction accesses
`FirebaseFirestore.instance` without initializing a default Firebase app.

The error was:

```text
No Firebase App '[DEFAULT]' has been created
```

`dart analyze` passed and the live Android decoder repair was verified. The
test-harness setup issue is real but should be fixed only if needed for the
S07 evidence package, with a focused harness change rather than weakening
production code.

### 8.4 Timing

The second live production run took approximately 63 seconds backend elapsed
time. This exceeds the later HP4 target, but S07's immediate priority is the
correct verified decision and accounting. Do not claim the timing gate passed.
Do not begin S11/S12 latency optimization while S07's positive verified receipt
is still missing unless the S07 recovery is blocked specifically by timing.

### 8.5 Review is not a bug by itself

The S05 settlement rule intentionally prevents a review with recognized lines
from crediting. The second run's review outcome is therefore useful evidence:
it demonstrates that settlement safety works. The problem is upstream decision
uncertainty, not a reason to loosen settlement.

---

## 9. Required next progression to finish S07

This is the recommended bounded continuation. It must remain S07-only.

### Step 1: Confirm candidate identity

Before a new app run, read back:

- Current Git HEAD.
- Vision revision `ecoloop-vision-00010-ddl` and digest.
- Source-bucket IAM binding.
- Functions/rules source/config identity.
- Device ID and package.
- Firebase project/database defines.

Reuse the existing candidate only if those identities match. If source or
configuration changed, rebuild/deploy the affected artifact and record the new
identity.

### Step 2: Resolve live readiness without operator searching

Using UID `zyb5KdlNqVZ1kKWudR57RKb2zti1`, read:

- `residents/{uid}.activeSessionId`.
- Referenced `depositSessions`.
- Referenced reservation.
- Relevant `binOperations`.
- Existing jobs/results/deposits.

If a stale session exists, use the supported fenced reconciliation/recovery path.
Do not delete arbitrary records and do not replay an exhausted job as if it were
new.

The ready state should be:

```text
activeSessionId: null
no unavailable stale reservation
main bin/cycle ready for a new controlled submission
```

### Step 3: Record the opening financial snapshot

Capture, without mutation:

- Wallet balance `B`.
- Wallet version.
- Verified batch count.
- Accepted item count.
- Current cycle/capacity values.
- Existing wallet-entry count or relevant owner-scoped ledger state.

The next result must be compared against this exact snapshot.

### Step 4: Run the short Android workflow

The operator-facing instructions should remain only:

1. Scan the main QR.
2. Confirm the session and finish.
3. Select Prepared image 10.
4. Tap Continue.
5. See the final receipt.
6. Return Home.

Ask only whether it worked, `Yes` or `No`. The model should retrieve technical
IDs and logs independently.

### Step 5: Capture the transaction chain

Immediately record:

- Session ID and confirmed session versions.
- Asset ID/version.
- Submission batch/deposit ID.
- Job ID.
- Attempt ID(s).
- Result ID.
- Trace ID.
- Task delivery/start timestamps.
- Source generation/digest read.
- Provider call/outcome records.
- Durable findings/artifact references.
- Final decision/status/reason.
- Settlement acknowledgement.
- Flutter result rendering time.
- Home return time.

Keep provider timing, backend timing, and device rendering timing separate.

### Step 6: Assert positive acceptance

For the same new deposit:

```text
result.status == verified
pointsAwarded == P > 0
walletAfter.balance == walletBefore.balance + P
walletEntryCountForDeposit == 1
verifiedBatchCountAfter == before + 1
acceptedItemCountAfter matches committed lines
cycle/capacity contribution matches committed result
reservation released
session completed
resident.activeSessionId == null
```

Then verify the Android receipt visibly shows the credited result and Home
renders the authoritative new balance/count.

### Step 7: If the result is review again

Do not change settlement or manually credit the account.

Instead:

1. Read the exact durable findings for the new job.
2. Identify the first failed provider/fallback boundary.
3. Compare the deployed revision/digest to source.
4. Determine whether the review is due to:
   - Actual policy uncertainty.
   - Provider response normalization.
   - Fallback validation.
   - Budget exhaustion.
   - Source/artifact mismatch.
   - Gateway contract rejection.
   - Deployment/configuration drift.
5. Repair only that demonstrated S07 boundary.
6. Add a regression that would have caught it.
7. Deploy the affected artifact.
8. Repeat the same affected app check.

Do not count a second review as progress toward S07 acceptance except as
diagnostic evidence.

### Step 8: If positive credit occurs

Perform a replay/readback safety check only through the existing supported
mechanism. Confirm that no second wallet entry or second balance increment was
created. Then update section 8 of the execution ledger with:

- Exact candidate identity.
- New safe IDs.
- Actual before/after values.
- Backend and device timings.
- Verified receipt/Home observation.
- Any remaining timing limitation.

Only then may S07 become `CHECKED`.

---

## 10. Explicit stop conditions

Stop the S07 execution and report the exact blocker if:

- The Android device disconnects and no available tooling can restore it.
- Human-only native consent or login is genuinely required.
- The current candidate cannot be identified reliably.
- The source asset generation/digest differs from the agreed asset.
- A product decision is required to change recognition policy, thresholds,
  expected object count, or account strategy.
- Production provider behavior remains genuinely uncertain after the bounded
  repair and the evidence shows a policy/product decision rather than a code
  mismatch.

Do not stop merely because:

- App Check logs contain the known non-fatal warning.
- A prior terminal failed job exists; reconcile it safely.
- A previous review result did not credit; that is expected.
- A dashboard legacy row lacks optional `traceId`; the decoder repair is now
  committed.

---

## 11. Commit and change inventory

The S07-related implementation and documentation history is:

| Commit | Change |
| --- | --- |
| `7b6dda4` | Align worker findings contract |
| `fa8221f` | Dispatch inspections immediately |
| `557c130` | Support Firebase scan result rendering |
| `d8afff9` | Gate settlement stats on verified results |
| `244e250` | Preserve acknowledged scan transitions |
| `c616841` | Grant Vision source-bucket access and enforce it in deployment |
| `4eaf89d` | Finalize failed expired scan sessions |
| `73e1ca5` | Record the first S07 review outcome |
| `e9a596c` | Preserve Vision fallback evidence |
| `8e335ec` | Record Vision fallback repair and deployed revision |
| `6f58ca1` | Keep dashboard readable with legacy deposits |

The most important current source surfaces are:

- [settlement_store.ts](../../../functions/src/infrastructure/firestore/settlement_store.ts)
- [maintenance_store.ts](../../../functions/src/infrastructure/firestore/maintenance_store.ts)
- [inspection_store.ts](../../../functions/src/infrastructure/firestore/inspection_store.ts)
- [schedules.ts](../../../functions/src/transport/schedules.ts)
- [run_job.py](../../../services/vision/src/ecoloop_vision/application/run_job.py)
- [inspect_image.py](../../../services/vision/src/ecoloop_vision/application/inspect_image.py)
- [gemini.py](../../../services/vision/src/ecoloop_vision/adapters/gemini.py)
- [specialist.py](../../../services/vision/src/ecoloop_vision/adapters/specialist.py)
- [deploy_vision.ps1](../../../tools/backend/deploy_vision.ps1)
- [deposit_transaction.dart](../../../lib/features/activity/domain/models/deposit_transaction.dart)
- [firebase_activity_repository.dart](../../../lib/features/activity/data/firebase_activity_repository.dart)
- [home_controller.dart](../../../lib/features/home/presentation/controllers/home_controller.dart)

---

## 12. One-paragraph handoff summary

At the start of S07, S02–S06 had repaired the worker contract, immediate
dispatch, Firebase processing rendering, verified-only settlement, and the
acknowledged forward scan path, but no real Android credit had been proven. The
first S07 Android attempt reached processing and failed because the Vision
runtime lacked source-bucket read permission; that IAM boundary was repaired.
The exhausted job then exposed a reconciliation defect that excluded terminal
failed jobs, which was repaired and safely finalized without credit. The second
Android attempt reached the complete production chain in about 63 seconds, but
Vision correctly produced `review/material_uncertainty` because crop fallback
validation and specialist prediction normalization discarded usable evidence;
both were repaired and Vision revision `ecoloop-vision-00010-ddl` was deployed.
After that run, Home failed only because a legacy review deposit omitted optional
`traceId`; the decoder was repaired, the APK was rebuilt/installed, and Android
Home was verified to render normally. The only remaining S07 acceptance gap is a
new genuine Prepared image 10 run that produces an automatically verified
receipt, one atomic credit, verified count +1, released session/reservation, and
matching Home values. Do not mark S07 complete from the prior review, and do not
loosen recognition or settlement policy to force success.
