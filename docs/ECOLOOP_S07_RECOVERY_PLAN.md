# S07 Recovery Plan — QR Scan → Genuine Image Verification → EcoPoint Deposit

- **Plan ID:** ECOLOOP-S07-RECOVERY-001
- **Date:** 2026-10-21
- **Investigated source:** `3ed08d5` on `dev`; working tree clean at investigation start.
- **Status:** Planning complete; recovery implementation and positive Android credit remain pending.
- **Requirements:** [Happy Path plan](ECOLOOP_HAPPY_PATH_DEMO_PLAN.md), especially §§1, 4.4–4.5, and HP2–HP4.
- **Assignment:** [S07 prompt](ECOLOOP_HAPPY_PATH_AGENT_PROMPTS.txt), lines 307–340.
- **History:** [S07 state and recovery handoff](S07_STATE_AND_RECOVERY_HANDOFF.md).
- **Execution records:** Continue updating §8 of the Happy Path plan. This document supplies the repair sequence; it does not replace that ledger.

## 1. Diagnosis and intended outcome

**S07 is blocked upstream of settlement: incorrect detector geometry corrupts the crops, evidence resolution is incomplete, and fallback calls exhaust their budget.** The backend correctly refuses to credit an uncertain inventory. Changing that refusal would conceal the defect.

The earlier IAM, reconciliation, Gemini crop validation, specialist response normalization, and legacy activity decoding repairs are useful. They are insufficient to establish a correct, automatically credited deposit.

There is also newer production evidence than the handoff describes: **the repaired Vision revision has already been exercised and still returned `review/material_uncertainty`.** Another unchanged app retry is therefore not the next implementation step.

The finished journey must be:

```text
Existing signed-in resident
  → scan ecoloop://bin/qr-demo-main
  → Bin Found → Confirm session → Ready → Finish
  → explicitly select Prepared image 10
  → Continue, with immediate truthful pending feedback
  → genuine inference on the committed trash9 pixels
  → policy-faithful, automatically verified decision
  → one atomic wallet/stat/ledger/capacity settlement
  → visible credited receipt
  → Home already showing the committed balance and verified count
  → main bin available for the next deposit
```

### Scope and completion definitions

S01–S06 retain their completed boundary status. Change their shared code only where the evidence below demonstrates a defect affecting this journey.

There are two explicit gates:

1. **Original S07 correctness gate:** one new genuine Android trash9 deposit, visible verified receipt, positive committed credit, matching accounting, released session/reservation, and correct Home return. Record its actual latency even if slow.
2. **Smooth scan-to-deposit gate requested for this recovery:** responsive forward controls, authoritative Home handoff, and three consecutive genuine deposits on the final candidate, targeting **<7 seconds**, with **every run ≤10 seconds** Continue-to-visible-credited-receipt.

Phases 4–5 deliberately bring the necessary scan-path portions of S11–S13 and repeated deposit verification forward to meet the second gate. Record reusable evidence under those later slices, without declaring their complete scope or S15 passed. Rewards/catalog/redemption remain in their existing assignments.

If genuine provider behavior cannot meet correctness or timing while preserving the agreed image and policy, the exit is a precisely measured product blocker. A plan cannot guarantee an automatic outcome before corrected inference proves it.

## 2. What this investigation actually verified

### 2.1 Current cloud/device/account facts

Read-only gcloud, Firestore REST, Storage REST, and ADB diagnostics were performed during this planning investigation. No new inference request, financial submission, deployment, or live data correction was performed.

| Item | Observed value |
| --- | --- |
| Project / database | `ecoloop-thesmartrecycling` / `ecoloop-db` |
| Resident | `zyb5KdlNqVZ1kKWudR57RKb2zti1` |
| Wallet | Balance **0**, version **0** |
| Stats | `verifiedBatchCount: 0`, `acceptedItemCount: 0` |
| Active session | `null` |
| Main reservation | `binOperations/bin-demo-main`: `phase: available`, owner/session null |
| Main bin/cycle | Enabled, online; `bin-demo-main-cycle-001`; occupancy **80/2000**, displayed 4% |
| Vision revision | `ecoloop-vision-00010-ddl`, 100% traffic |
| Vision image digest | `sha256:dbaf0a12b0df698665973b0f23ecf1ae085d2853f294adce359eac3e05b5fcb1` |
| Vision runtime | `ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com` |
| Source bucket IAM | Runtime has `roles/storage.objectViewer` on `ecoloop-thesmartrecycling.firebasestorage.app` |
| Worker gateway | `us-central1`, revision `workergateway-00011-feb` |
| Tasks queue | `asia-southeast1/vision-processing`, RUNNING; concurrency 1; max attempts 3; retry duration 300s |
| Vision scaling | Service max 1, revision max annotation 10; no explicit min-instance guarantee in readback; container concurrency 1 |
| Android | `qgfy7xz9eaci4tvs`, model `2312DRAABC`, connected and authorized |

These are observations around **05:26–05:28 UTC on 2026-10-21**, not permanent preconditions. Refresh only the values needed before implementation/live acceptance. Preserve the existing 80 SPC contribution; do not reset occupancy to the old baseline.

### 2.2 Newly discovered post-repair production run

The handoff says a new post-repair run is still missing. Cloud logs and durable artifacts establish that a run did occur on revision `00010-ddl`:

| Field | Value |
| --- | --- |
| Job | `job-78b8d89433089aa2be342c11eab8f24a` |
| Attempt | `attempt-29e4458d684e35110c48a630ada8a445` |
| Session | `session-d50f11b4cea013f873e769100cf3df15` |
| Deposit | `deposit-9f66305fabb46bde29312ca48f8914a5` |
| Result | `result-78b8d89433089aa2be342c11eab8f24a` |
| Trace | `de6b4896e7a57ddd731e48871748a411` |
| Submitted | `2026-10-21T05:13:00.696Z` |
| Result Firestore commit/update time | `2026-10-21T05:14:12.332626Z` |
| Outcome | `review`, `material_uncertainty`, points null; job `succeeded` |
| Session after settlement | Completed; resident reference cleared; reservation released |
| Findings object generation | `1792559639276322` |

Durable artifact:

```text
gs://ecoloop-thesmartrecycling-vision-artifacts/
  vision-artifacts/job-78b8d89433089aa2be342c11eab8f24a/
  attempt-29e4458d684e35110c48a630ada8a445/findings.json
```

The submit field to Firestore update-time difference is approximately **71.64 seconds**; Cloud Run request latency was **66.29 seconds**. These are backend observations, **not device tap-to-receipt measurements**. The reviewed artifacts do not establish what the user saw for this newer run.

For the historical comparison, the earlier run's artifact is `vision-artifacts/job-30e99e19e28e11f4e98ba16184914620/attempt-f4b538936fe912f4810246f1b58d9b67/findings.json` in the same bucket, generation **`1792557312222272`**. It contains the discarded specialist score maps and `invalid_geometry` fallback outcome described in the handoff.

The artifact shows:

- Four detector-derived groups; three detector confidences approximately **0.770, 0.681, 0.481**, and a fourth at **0.984**.
- Specialist scores are now preserved. For `object-0002`, `Plastic Bottle` is **0.9423385262**.
- That specialist evidence still does not appear in the resolved object's model list/rule.
- One Gemini crop result is now valid: `object-0001`, `plastic_bottle`, confidence **0.95**. The prior irrelevant-geometry rejection was repaired.
- Four aggregate failure outcomes remain: two `call_timeout` outcomes and two `budget_exhausted` outcomes.
- Only one crop fallback response is persisted; the other required crop paths did not complete within the orchestration budget.

### 2.3 Confirmed defects and remaining boundary risks

Paths below are relative to the repository. Symbol names are the stable references if lines move.

| ID | Evidence | Effect / required action |
| --- | --- | --- |
| **R1 — wrong coordinate convention** | `services/vision/.../adapters/detectors.py:73–82` passes provider `x/y` into `infrastructure/images.py:87–129`; `original_box` calculates `left=x`, `right=x+width`. Roboflow returns **center-based** `x/y`. | Crops, matching and overlays use shifted/clipped objects. Repair this before obtaining new crop evidence. |
| **R2 — specialist evidence stops at normalization** | `application/inspect_image.py:_needs_specialist` requests D for unresolved **or low-confidence** candidates, but `_apply_specialist_evidence` ignores every candidate already marked eligible/excluded. | The current 0.942 specialist result for an eligible-but-low-confidence candidate is discarded from resolution/provenance. Separate taxonomy eligibility from verification-evidence completeness. |
| **R3 — timeout/retry accounting** | `_invoke_provider` starts a new executor per attempt, abandons running HTTP work on timeout, retries all exceptions, and appends timeout outcomes even if a later attempt succeeds. | Extra physical calls consume the budget; successful recovery can still poison the aggregate inventory. Use real transport deadlines and terminal logical-stage outcomes with separate attempt history. |
| **R4 — serialized required work** | A then B, specialist crops, and Gemini crops run serially; provider clients are recreated per request. | The 30s inference budget can be exhausted before required crops finish. Correctness and latency are coupled here. |
| **R5 — false recovery from a processing projection** | `application/run_job.py:85–90` accepts any non-null `read_current_result()['result']` after completion fails. `jobs_store.ts:readCurrentResult` returns the initial processing projection too. | A rejected/ambiguous completion can be acknowledged without durable settlement, leaving the app processing. Require a matching terminal result. |
| **R6 — incomplete final receipt projection** | `functions/.../settlement_store.ts:96–107` writes policy/count on the deposit but omits `policyVersion` and `totalDetectedObjectCount` on the result. `backend_scan_mapper.dart` derives a count from lines. | Final receipt metadata is incomplete despite permissive decoding. Write the real decision metadata; retain legacy compatibility. |
| **R7 — cross-stream receipt/Home race** | `scan_session_screen.dart` independently consumes session/result streams; `_backToHome` only navigates. Home has separate wallet/stats streams. | Atomic backend writes do not guarantee simultaneous client listener delivery. Prove/gate the credited receipt and first Home frame against authoritative versions. |
| **R8 — false confidence in existing tests** | The current normalization test asserts the wrong shifted coordinates. The specialist repair test checks only score parsing. Activity repository tests omit the injected stats transport. | Passing tests miss the geometry/evidence defect; the activity test never reaches its legacy-row assertion. Replace expectations with provider-shaped independent checks and fix test construction. |

**Additional worker boundary checks in Phase 3:** `source_loaded` currently references a `source.json` object that neither artifact writer creates; terminal claim parsing requires a non-empty attempt ID even though `already_finalized` can have none. Both need narrow production-path tests before claiming retry-safe completion.

### 2.4 Reproductions run during planning

1. **Geometry probe using the production normalizer:** a provider box `x=357.5, y=214.5, width=715, height=429` for a 715×429 image becomes **`(357.5, 214.5, 715, 429)`**. The center-based result must be **`(0, 0, 715, 429)`**.
2. **Specialist composition probe:** an eligible low-confidence bottle at 0.68 plus a valid specialist score of 0.9423385262 remains `rule.specific_taxonomy`, detector-only model IDs, confidence 0.68. The evidence is parsed but not applied.
3. **Timeout/recovery probe:** first call sleeps beyond a 10ms orchestration timeout, second returns successfully. `_invoke_provider` returns success with **two physical calls and a retained `budget_exhausted:call_timeout` outcome**.
4. From `services/vision`:

   ```powershell
   uv run --frozen pytest -q -p no:cacheprovider tests/test_normalization.py tests/test_gemini.py tests/test_inspect_image.py tests/test_run_job.py
   ```

   **20 passed.** This includes tests that encode the wrong geometry or omit the composition boundary; it is not a correctness pass for S07.
5. From repository root:

   ```powershell
   flutter test --concurrency=1 test/features/activity/firebase_activity_repository_test.dart
   ```

   **3 failed before assertions:** `FirebaseActivityRepository` constructs its default stats transport and accesses `FirebaseFirestore.instance`; no default Firebase app exists in the test. Inject a focused fake `StatsReadTransport` in the fixture.

Roboflow's documented response convention and formulas: [Object detection response format](https://docs.roboflow.com/deployment/legacy/legacy-serverless/object-detection#response-format).

## 3. Fixed inputs and implementation rules

| Input | Value |
| --- | --- |
| QR / bin | `ecoloop://bin/qr-demo-main` / `bin-demo-main` |
| Source | `assets/trash_images/trash9.jpg` |
| Picker / asset | **Prepared image 10** / `asset-demo-0010` |
| Version | `sha256-4a5e8b49da2c64c3` |
| SHA-256 | `4a5e8b49da2c64c31d61ecf7b695db63054c0bb19ac7eb72020356279fb25661` |
| Storage generation | `1792435379722099` |
| Policy / configuration | `policy-v1` / `demo-vision-v1` |
| Detectors A/B | `waste-detection-0momv/6`, `yolo-waste-detection/1` |
| Specialist / Gemini | `waste-classification-rjo28/2`, `gemini-3.8-flash` |

Execute phases in order, one active phase at a time. Run memory-heavy checks serially. The implementation agent owns CLI work, logs, IDs, deployment, install and accounting comparisons; user checks remain normal app actions with a Yes/No answer.

Maintain the current thresholds, matching rules, provider roles, object bounds, source identity, financial idempotency and resident ownership. The earlier **four detections / 20 potential points are observations, not a ground-truth answer**. Correct geometry may alter crops and grouping. Detector B's image-sized box does not independently prove a fourth distinct physical bottle.

Preserve required low-confidence → Gemini behavior. A specialist parsing/evidence repair must not silently become permission to bypass that requirement. Where intended decision semantics are unclear, trace the existing recognition specification and ask a narrowly evidenced product question before changing them.

## 4. Five implementation phases

### Phase 1 — Repair the pixels-to-candidate geometry boundary

**Outcome:** every downstream provider sees the intended object crop, and replay evidence can be trusted.

**Primary files:**

```text
services/vision/src/ecoloop_vision/adapters/detectors.py
services/vision/src/ecoloop_vision/infrastructure/images.py
services/vision/src/ecoloop_vision/domain/matching.py                 # inspect; change only for a demonstrated defect
services/vision/tests/test_normalization.py
services/vision/tests/test_matching.py
services/vision/tests/test_inspect_image.py
```

#### Step-by-step instructions

1. Record HEAD/diff and the live revision. Retrieve the two existing `findings.json` artifacts by their recorded object generations. Retain only sanitized raw responses, input identity and provenance needed for regression fixtures.
2. Establish the provider convention using the documented center-based formula. Find every caller of `original_box` before selecting the smallest repair:
   - Prefer an explicit center → corner conversion at the Roboflow adapter boundary if `original_box` remains a generic top-left transform.
   - If changing the helper itself, name/document its convention and update all callers consistently. Do not subtract half-width twice.
3. Apply conversion **before** scaling/letterbox inversion and clipping:

   ```text
   providerLeft   = centerX - width / 2
   providerTop    = centerY - height / 2
   providerRight  = centerX + width / 2
   providerBottom = centerY + height / 2
   ```

   Invert any actual letterbox padding/scale once; map to original pixels; clip to original image bounds. Reject non-finite, zero-area and inverted geometry rather than manufacturing a valid box.
4. Replace the current shifted-coordinate test expectation. For the existing 287×174 → 574×348 fixture, `x=143.5, y=87, width=50, height=40` must yield **`(237, 134, 337, 214)`**.
5. Add provider-shaped assertions for:
   - Full-image box → full-image corners, not the lower-right quarter.
   - Exact saved A box `481.5,219.5,117,389` → **`(423,25,540,414)`** on 715×429.
   - Image-edge clipping, scale changes, and any supported letterbox path.
   - NaN/infinity/zero-area rejection.
   - Normalized wire geometry derived from the corrected original-pixel box.
6. Replay only the saved detector responses through normalization/matching and render a diagnostic overlay/crops using the exact image. Inspect whether each group represents one candidate and whether the image-sized B detection overlaps/contains several A candidates.
7. Preserve existing matching thresholds. Do not force a merge, suppress a detection, or assert four real objects to make the example pass. Record any remaining count/localization ambiguity for Phase 2.
8. Use the old specialist/Gemini crop responses only to demonstrate historical behavior. **They were produced from the old, wrong crops and cannot validate classifications of the corrected crops.** Fresh live crop evidence is required later.

**Checks:** run the focused normalization, matching and inspection tests. The geometry assertions must fail on the original source and pass after the repair. No live financial mutation is needed.

**Exit gate:** documented provider coordinates, crop bytes/metadata, overlay and normalized findings agree. Candidate count remains evidence-derived. Update the Happy Path ledger with R1 and the actual check result.

### Phase 2 — Complete verification evidence within a real, bounded deadline

**Outcome:** required evidence is applied to the correct candidate, all required stages have honest terminal outcomes, and timeout handling cannot itself force a false review or false success.

**Primary files:**

```text
services/vision/src/ecoloop_vision/application/inspect_image.py
services/vision/src/ecoloop_vision/domain/resolution.py
services/vision/src/ecoloop_vision/adapters/{detectors,specialist,gemini}.py
services/vision/src/ecoloop_vision/application/run_job.py
services/vision/tests/{test_inspect_image,test_specialist,test_gemini,test_run_job}.py
```

#### Step-by-step instructions

1. Write a compact branch table from the existing policy/specification: specific high-confidence candidate, specific low-confidence candidate, unresolved taxonomy, conflicting evidence, required provider failure, and empty-detector fallback. Identify which provider stages are required in each case.
2. Correct the distinction between **class eligibility** and **verification completeness**:
   - A bottle can have an eligible taxonomy while still needing confidence/fallback evidence.
   - Apply/retain specialist evidence for the low-confidence candidates that requested it, rather than rejecting it solely because `eligibility != unresolved`.
   - Keep detector confidence and specialist/Gemini confidence distinguishable; do not overwrite a detector score with an unrelated provider score merely to cross 0.85.
   - Attach the model ID, raw/canonical label, rule and candidate identity for evidence actually used. Preserve disagreement as uncertainty.
   - Keep mandatory Gemini work mandatory. Record why each required stage was invoked or satisfied.
3. Normalize the actual specialist response shape, including malformed/missing/empty `predictions`, invalid probabilities, and a specific versus generic class. An empty score map must not be logged as successful verification evidence.
4. Tighten crop fallback identity/schema around its intended role:
   - One existing candidate, exactly one finding with count 1 when resolved.
   - Valid label and required confidence under the existing threshold.
   - Candidate identity must match; multiple findings are not silently truncated to `findings[0]`.
   - Crop response geometry remains irrelevant to localization; retain the corrected detector box.
   - Full-image geometry and its existing consistency requirements remain separate and strict.
5. Replace thread-abandonment timeouts with supported SDK/HTTP deadlines. Inspect the installed `inference-sdk` and `google-genai` APIs and configure their real transport timeout/retry behavior. Use one absolute monotonic inspection deadline and bounded remaining time per physical call.
6. Permit retries only for evidenced transient transport/provider failures, within the remaining deadline. Do not retry authentication, schema or candidate-identity failures. Count SDK-internal retries as physical calls too.
7. Separate **attempt diagnostics** from **terminal logical-stage outcomes**:
   - A timed-out attempt remains in history.
   - A successfully recovered, fully validated required stage is not permanently failed by that earlier timeout.
   - Exhausted required work remains uncertain even if some objects have eligible labels.
   - Late responses cannot mutate the finalized decision or start untracked work after the job returns.
8. Add the minimum concurrency needed to stop serial budget starvation: independent A/B calls concurrently; bounded independent candidate work, with per-candidate stage order retained. Gather results by stable role/object ID before deterministic resolution. Phase 4 tunes the measured pool size; do not start unlimited crop calls.
9. Keep the existing overall correctness deadline initially; reserve time for artifacts and gateway settlement. Recompute remaining budget after claim/source loading. Do not lower confidence thresholds or increase the five-minute business deadline to cover slow orchestration.
10. Add composition regressions using controlled provider responses for:
    - Eligible 0.68 candidate + real-shaped D score 0.942 → evidence retained, correct mandatory next stage.
    - Gemini crop 0.95 on the matching candidate → validated evidence, original geometry retained.
    - Required fallback failure on one candidate → overall uncertain and no credit eligibility.
    - First transient attempt times out, later succeeds → no stale terminal failure; attempt history preserved.
    - Both attempts fail, permanent error, budget depletion and late completion → bounded call counts and honest uncertainty.
    - Three low-confidence candidates all receive their required work; none disappears through list slicing, wrong indexing or shared mutable outcomes.
11. For the image-sized detector B candidate, examine corrected localization and fresh provider evidence. If existing rules cannot establish a distinct object/count, preserve review and report the concrete policy/localization blocker. Do not invent a new inventory rule or count for trash9.

**Checks:** focused provider/inspection/job tests, then the existing complete Vision suite once the affected checks pass. These are implementation proof; historical raw-response replay is not new inference.

**Exit gate:** correct evidence application, honest terminal statuses, transport-enforced bounded calls, deterministic concurrency, and no required-work starvation. If automatic verification remains blocked by genuine image/policy ambiguity, obtain that specific decision before proceeding to a claimed positive gate.

### Phase 3 — Close worker → settlement → receipt/Home contracts and prove first credit

**Outcome:** a real successful inference cannot be lost at completion, mistaken for processing success, or displayed with stale/uncommitted wallet values.

**Primary files:**

```text
services/vision/src/ecoloop_vision/application/run_job.py
services/vision/src/ecoloop_vision/infrastructure/{artifacts,job_gateway}.py
functions/src/infrastructure/firestore/{jobs_store,settlement_store,maintenance_store}.ts
functions/src/transport/internal_jobs.ts
functions/tests/emulator/{jobs,settlement,maintenance}.test.ts
lib/features/scan/data/{firebase_scan_repository,backend_scan_mapper}.dart
lib/features/scan/presentation/screens/scan_session_screen.dart
lib/features/home/presentation/controllers/home_controller.dart
test/features/{scan,activity}/
```

#### Step-by-step instructions

1. Fix completion ambiguity: recover only a matching terminal result with a settled decision version and coherent terminal job state. A processing projection must continue through the supported failure/retry/reconciliation path. Add a regression where `complete` fails and `readCurrentResult` returns `outcome: processing`; assert it is not acknowledged as success.
2. Test a duplicate task after finalization through the **real gateway parser**. Handle `already_finalized` before requiring active-attempt fields; return/read the durable terminal result without another inference or credit. Keep active attempts strictly fenced by subject, attempt, lease and deadline. Carry the actual lease expiry into the worker's remaining-time calculation alongside the business deadline; reserve settlement time inside both bounds, using supported fenced renewal only when genuinely needed for healthy work.
3. Make `source_loaded` refer to an artifact actually written, or represent it as a truthful stage record without a fictitious object. Keep the established `vision-artifacts/{job}/{attempt}/` namespace. Ensure findings/overlay upload completion precedes finalization and that failed uploads cannot produce a credited receipt.
4. Populate the final result projection from the actual settlement plan/job:
   - `policyVersion`, `totalDetectedObjectCount`, accepted count if exposed, decision version/time, trace and lines.
   - Preserve the existing creation time; use a separate actual decision/update time.
   - Include committed wallet version/balance and verified-count version/target if using receipt metadata for the client handoff. All such values must come from the same settlement transaction.
   - Apply compatible metadata behavior to review/expired final results. Keep processing fields honestly pending and legacy optional fields readable.
5. Retain the S05 transaction rules. Use the actual `_findings` serializer output and shared schema at the backend boundary; then execute the real Firestore settlement store against `demo-ecoloop/ecoloop-db`:
   - Opening balance 37 + the controlled 10-point fixture = 47.
   - One credit ledger, wallet version +1, verified batches +1, accepted count matches eligible lines.
   - Matching capacity/cycle update and released session/reservation.
   - Replay leaves all totals unchanged.
   - Review with recognized lines leaves wallet/verified stats unchanged.
   - Decision/result metadata matches across writer and reader.
6. Add a focused reconciliation regression for the actual exhausted-failed-job case fixed by `4eaf89d`. Use explicit named emulator configuration and the production settlement store. Run reconciliation twice; assert one final review and release, no credit, and a newer matching-ID reservation is not released by old work.
7. Preserve the current forward UI and add tests for the affected concurrency boundaries:
   - No renewal starts during a foreground command/draft save/submit. An already-running renewal must finish before choosing the next authoritative version; keep the UID command lock.
   - Continue awaits the save of the **currently selected** asset/version, not a Future for a previous selection. A rapid selection change must never submit unacknowledged pixels.
   - Keep returned processing IDs immediately; use a matching session response/version when available. Never allow an older stream snapshot to navigate back a stage.
   - Observe session-completed/result-processing and result-final/session-processing ordering without showing a premature final card or enabling conflicting commands.
8. Keep one result subscription. Where a preliminary `get()` delays attaching snapshots, use the existing confirmed/cache state followed directly by the listener; preserve owner checks. Display an actual result-listener failure as a recoverable read error instead of an indefinite spinner. Retrying the read must not submit again.
9. At verified receipt readiness, reconcile to the authoritative wallet version/balance and verified count from settlement. Prefer active resident-scoped wallet/stats streams. If a snapshot is behind, show truthful finalizing feedback until it catches up, with a recoverable read-error state rather than endless waiting. Do not calculate `oldBalance + points` locally as proof of settlement.
10. Ensure Home's first useful frame consumes that confirmed current state. Reuse Home's existing live wallet/stats where possible; add only the necessary handoff/version guard. Reward-progress and full Home/Rewards unification remain assigned to S09.
11. Fix the activity test harness by injecting a `StatsReadTransport` fixture alongside `reads`. Run all three existing tests, including the missing optional `traceId` case. Add a new writer-shaped verified activity row to prove Home remains readable; preserve the owner query/order.
12. Deploy only the compatible changed Functions/contracts/rules and Vision; identify the Android candidate. Follow Phase 4's deployment safeguards without first doing broad performance tuning.
13. Run **one new genuine Android trash9 deposit now**, with the opening wallet/stats/cycle snapshot and correlated logs. Before this attempt, install the minimal monotonic Continue-tap → first usable credited-receipt timing hooks, including any draft wait, and retain the submit/result correlation IDs; Phase 4 expands the component spans. Use the Phase 5 accounting assertions. If it verifies, record the original S07 correctness gate and its actual timing immediately. If it reviews, inspect this run's fresh corrected-crop artifacts and repair the first failed boundary before another attempt.

**Exit gate:** first real verified Android credit with matching DB effects and Home return, plus meaningful worker completion/replay/recovery regressions. Any missing positive proof remains explicit; backend-only success is insufficient.

### Phase 4 — Reduce the measured critical path and freeze a compatible candidate

**Outcome:** the now-correct flow has enough measured headroom for a smooth recording.

**Primary files:** Phase 2 provider/orchestration files; `infrastructure/job_gateway.py`; hot Functions stores/transports; `tools/backend/deploy_vision.ps1`; `infra/cloudrun.vision.yaml`; Flutter scan timing/handoff code. Regional client changes are conditional.

#### Step-by-step instructions

1. Add/complete compact structured spans, keyed by request/session/job/attempt/trace and candidate where relevant:
   - Continue tap, draft ready, submission acknowledgment.
   - Submit transaction/commit, durable enqueue, task request start, claim.
   - Source load/hash, A/B separately, each D/Gemini physical attempt and logical outcome.
   - Artifact serialization/uploads, checkpoints, completion transaction/commit.
   - Result listener delivery, wallet/stats caught up, first credited receipt frame and first Home frame.
2. Measure device elapsed time with one monotonic clock starting **at Continue**, including any pending draft wait. Do not restart it at submission acknowledgment. Keep server-local durations separate; log timestamps across machines are correlation evidence, not a device stopwatch.
3. Capture the normal `vision.inspection_completed` event on every return path, including nonempty success/review. Propagate logging context explicitly into provider executor tasks; current provider log records lack the job context carried by orchestration logs. Record byte counts/candidate identity/durations without secrets.
4. Build a before/after span table. The latest negative trace already shows where to investigate:
   - Task HTTP request start → first application activity was roughly 15s; measure startup/initialization contribution directly.
   - A/B took approximately 1.41s + 1.10s serially.
   - Three specialist calls took approximately 1.00s + 0.79s + 0.30s serially.
   - Gemini physical calls logged 16.21s, 9.38s and 6.66s, with timeout/retry overlap and only one saved fallback result. They cannot be added as independent sequential spans.
   - Several US gateway calls, sequential Firestore reads and artifact uploads add further latency. Isolate each before changing infrastructure.
5. Tune bounded concurrency from Phase 2 using actual provider quotas and semantics. Reuse suitable clients/connections/tokens; keep deterministic result order. Never remove required candidates/evidence to hit the target.
6. Reduce measured overhead: independent Firestore reads in `getAll`/parallel groups while keeping reads before writes; reuse audience-specific unexpired gateway tokens; avoid duplicate source downloads and gateway calls only where their durable purpose is retained. Parallel independent artifact uploads only if both are confirmed before settlement.
7. If cold starts materially consume the budget, apply one authorized warm Vision instance and only the measured hot Functions. Inspect both service/revision scaling and traffic afterward. **`deploy_vision.ps1` currently hardcodes `--min=0`; parameterize/preserve the intended setting so deployment does not undo warming.** Use `.cmd` invocations on this PowerShell host.
8. If US↔Singapore round trips still prevent the target, co-locate the worker gateway with Vision/database first:
   - Deploy a compatible Singapore gateway endpoint/export before changing callers; retain the US endpoint during cutover.
   - Configure its runtime identity allowlist and exact token audience; update Vision gateway URL/audience together.
   - Prove claim/checkpoint/complete/fail/readCurrentResult still use the same named database and worker identity.
   - Move resident endpoints only if their measured contribution still requires it. Update `FirebaseClients` region selection and all affected callables compatibly; a Dart region define alone does not override the current hardcoded region.
9. Keep runtime versus Tasks identity distinct. Retain source read permission, artifact access, private ingress and committed source generation. Regional tuning does not move the database or reset existing records.
10. Make the candidate reproducible: source/diff identity, packaged contracts, immutable Vision digest/revision/traffic, actual model/config fingerprint, Functions revisions/regions, rules version, SDK lockfiles, exact APK hash/package/build defines and configured secret version references. Include model identities in the fingerprint used to distinguish recognition configurations.
11. Run only the affected checks, deploy in dependency order, then perform a new genuine measured deposit. If it fails a correctness assertion, return to that boundary; prior-build observations do not validate the changed runtime.
12. Record the actual prior min-instance settings and exact restoration commands. Keep warm capacity through acceptance/recording, then restore after the user confirms recording is finished.

**Engineering budget, not assumed performance:** aim roughly for 1s submission/queue, 0.5s claim/source, 1.5s concurrent A/B, 2s required fallback work, and 1s artifacts/settlement/UI, leaving headroom to 7–10s. Adjust allocations from measured data; a 16s required provider call cannot be made a timing pass by a faster UI.

**Exit gate:** real post-change credit remains correct and device timing is within the requested ceiling with measurable headroom. If provider time still makes ≤10s impossible, present the concrete span/call evidence and required decision rather than silently changing the model/image/policy.

### Phase 5 — Verify the complete scan-to-deposit loop repeatedly on Android

**Outcome:** the exact final candidate is proven, repeatable, responsive and ready for recording this portion of the journey.

#### Step-by-step instructions

1. Recheck only readiness-sensitive state: resident active session, matching reservation, main bin/cycle capacity, current processing configuration, queue, Vision traffic, connected Android package/build. Follow session → job/result references yourself if work exists. Resume healthy work or use fenced reconciliation for proven failed/expired work.
2. Capture the opening **actual** balance `B`, wallet version `V`, verified count `C`, accepted count `A`, cycle contribution and occupancy `O`. Use current values, not the zero baseline printed earlier in this plan.
3. Start agent-owned device/log/span capture. The operator-facing workflow is only:
   1. Open Home and scan the main QR.
   2. Confirm the session, then press the finish button.
   3. Select **Prepared image 10**, then press Continue once.
   4. See the verified credited receipt and press **Back to home**.
   5. Confirm Home shows the updated EcoPoints and verified count — **Yes/No**.
4. Correlate this exact new job through durable enqueue, Tasks invocation, committed generation/hash read, fresh providers, durable artifacts, gateway completion, settlement, Flutter receipt and Home. New acceptance deposits must run inference; offline replay is solely regression/diagnostic proof.
5. Assert the following using the same deposit/result/job and before/after snapshots:

   ```text
   job.state == succeeded
   result.outcome == verified
   result.decisionVersion >= 1
   result.policyVersion == committedJob.policyVersion
   result.pointsAwarded == P > 0
   sum(eligible committed line points) == P
   walletAfter.balance == B + P
   walletAfter.version == V + 1
   exactly one deposit_credit wallet entry for this deposit
   ledger.pointsDelta == P
   ledger.balanceAfter == walletAfter.balance
   ledger.walletVersion == walletAfter.version
   statsAfter.verifiedBatchCount == C + 1
   statsAfter.acceptedItemCount == A + sum(eligible committed line counts)
   one initial capacity entry; delta == committed result space contribution
   same-cycle occupancyAfter == O + delta
   cycle contribution increases by delta once
   session.stage == completed
   resident.activeSessionId == null
   matching reservation phase == available, owner/session == null
   visible Android receipt agrees with this committed result
   first useful Home frame shows that authoritative balance and verified count
   ```

   New count and `P` come from the actual verified decision. Do not hardcode four bottles/20 points. Accepted material counts/weight are asserted only if maintained by this change; weight presentation retains its S09 assignment.
6. Confirm supported same-operation/terminal-read recovery does not issue another credit; prove duplicate delivery/completion mutation behavior in the emulator. Do not manufacture a second live business operation to test a replay, or resurrect an exhausted failed job.
7. Repeat with **three consecutive new deposits on the final candidate**, including the first run if it used exactly this candidate/configuration. Readiness and capacity must be sufficient; each prior deposit must release the bin. Capture every result, including slow/failed ones.
8. For each run record local tap-to-feedback timings and Continue-to-usable-credited-receipt. Approximate 100ms feedback is a UI metric; server acknowledgments are recorded separately. Target <7s, every accepted run ≤10s. Report all three durations, median and maximum; do not infer p95 from three samples.
9. If any run fails, diagnose from its first failed boundary and fresh artifact. Preserve legitimate transactions and reviews. After a runtime correction, repeat the affected final-candidate sequence; do not select three unrelated successes across different deployments.
10. Update the Happy Path ledger with the original S07 gate, the expanded smooth-flow gate, precise artifacts/IDs, actual before/after accounting, all timings and visible receipt/Home observation. Mark S07 `CHECKED` only from its positive correctness evidence. Record remaining later-slice work accurately.

**Exit gate:** three consecutive real verified credits on the frozen candidate, each exactly once, all ≤10s, responsive forward controls, correct immediate Home return, and readiness for the next deposit. Rewards/redemption and whole-demo acceptance retain their separate gates.

## 5. Verification commands and deployment notes

Use existing scripts below from their specified directories, serially. Extend focused tests before invoking newly required assertions. Emulator fixtures must explicitly use `demo-ecoloop/ecoloop-db` and refuse live cleanup.

| Directory | Command | Purpose |
| --- | --- | --- |
| `services/vision` | `uv run --frozen pytest -q tests/test_normalization.py tests/test_matching.py tests/test_inspect_image.py tests/test_gemini.py tests/test_specialist.py tests/test_run_job.py tests/test_job_gateway.py tests/test_contracts.py` | Affected geometry/evidence/deadline/worker boundaries |
| `services/vision` | `uv run --frozen pytest -q` | Complete existing Vision regressions after the affected checks pass |
| `functions` | `npm.cmd run build` | TypeScript and packaged shared contracts |
| `functions` | `npm.cmd run test:unit` | Relevant domain/contract logic |
| `functions` | `npm.cmd run test:settlement` | Atomic verified/review/replay/result writer boundary |
| `functions` | `npm.cmd run test:jobs` | Claims, fences, completion/recovery read behavior |
| `functions` | `npm.cmd run test:maintenance` | Added exhausted-failed-job release regression |
| `functions` | `npm.cmd run test:dispatch` | Immediate deterministic dispatch when changed |
| `functions` | `npm.cmd run test:sessions`, then `npm.cmd run test:submission` | When session/submission response/version behavior changes |
| Repository root | `flutter test --concurrency=1 test/features/scan/firebase_scan_repository_test.dart test/features/scan/backend_scan_models_test.dart test/features/activity/firebase_activity_repository_test.dart` | Production-adapter and legacy activity regression boundaries |
| Repository root | `flutter analyze` | Changed Dart integration |
| Repository root | `git diff --check` | Final patch consistency |

Add the phase-specific ordering/version/receipt widget tests beside the existing scan tests and run those exact new paths too. Existing mock-only flow tests are useful regressions, not proof of deployed Firebase settlement.

Useful read-only cloud/device commands, from repository root:

```powershell
git status --short
git log --oneline -12
adb devices -l
gcloud.cmd run services describe ecoloop-vision --project=ecoloop-thesmartrecycling --region=asia-southeast1 --format="yaml(status.latestReadyRevisionName,status.traffic,spec.template.spec.containers[0].image,metadata.annotations,spec.template.metadata.annotations)"
gcloud.cmd functions describe workerGateway --gen2 --project=ecoloop-thesmartrecycling --region=us-central1 --format="yaml(serviceConfig.revision,serviceConfig.uri,serviceConfig.minInstanceCount)"
gcloud.cmd tasks queues describe vision-processing --project=ecoloop-thesmartrecycling --location=asia-southeast1
gcloud.cmd storage buckets get-iam-policy gs://ecoloop-thesmartrecycling.firebasestorage.app --project=ecoloop-thesmartrecycling
```

Firestore diagnostics should reuse `functions/tools/seed_transport.ts`'s gcloud-token-in-memory REST approach or the existing inspection tooling. Follow actual references instead of guessing result IDs. Owner-authorized Android/rules proof remains distinct from these trusted diagnostic reads.

Build/install command shape, retaining current resident region unless a measured coordinated cutover changed it:

```powershell
flutter build apk --debug --dart-define=ECOLOOP_FIREBASE_MODE=firebase --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
adb -s qgfy7xz9eaci4tvs install -r build/app/outputs/flutter-apk/app-debug.apk
```

Run these as separate steps and inspect each result. `ECOLOOP_APP_CHECK_MODE` is retained from the established invocation; `ECOLOOP_USE_APP_CHECK` is the actual current boolean switch. Known non-fatal App Check warnings do not explain the verified geometry/budget failure.

## 6. Bounded failure handling and final handoff

| Failure after a phase | Next action |
| --- | --- |
| Source 403 recurs | Read the actual runtime/bucket/generation/IAM; repair that scoped mismatch before providers. |
| Corrected crops still review | Inspect fresh per-candidate evidence and terminal outcomes; distinguish code/transport failure from actual uncertainty. |
| Whole-image/overlapping detection cannot establish a distinct count | Preserve review and present the image/overlay/provider evidence for a recognition-policy decision. |
| Complete fails and current result is processing | Keep the same job identity; supported retry/failure/reconciliation, never acknowledge processing as settlement. |
| Wallet credits but receipt fails | Diagnose result writer/adapter/listener ordering; do not create another deposit to repair a read. |
| Receipt works but Home is stale | Inspect authoritative wallet/stats versions and first-frame handoff; repair that boundary without local synthetic credit. |
| Correct path exceeds 10s | Use the Phase 4 span table and scoped tuning; report remaining provider limitation if unchanged policy cannot meet the target. |
| Native consent/device connection is unavailable | Finish independent code/cloud checks, then request only that human-only action for device proof. |

At each phase handoff report: repaired boundary and paths, relevant checks/results, source/diff and deployed identity where applicable, exact remaining proof, and the next phase. Commit only under an explicit execution authorization; this planning document does not authorize a commit.

The recovery is complete when the final-candidate evidence establishes both the original positive S07 credit and the requested smooth repeated scan-to-deposit loop. The immediate next implementation action is **Phase 1: fix center-based detector geometry and its misleading regression expectations**.
