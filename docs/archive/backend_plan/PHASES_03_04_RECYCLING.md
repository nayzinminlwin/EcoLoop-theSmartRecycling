# P03-P04 — Real Vision and the Recycling Vertical Slice

Read [protocol](EXECUTION_PROTOCOL.md), [architecture A4-A6](ARCHITECTURE_AND_CONTRACTS.md), [diagnostics](OBSERVABILITY_AND_DEBUGGING.md), and the unit's specification references. All source paths are repository-relative. Tests and compiled dependencies must exist before their imports are used.

## P03 — Auditable real-image vision pipeline

**Role:** integration executor. **Spec:** §§6-7, 10.5, 18. **Depends on:** P00 model access, P01 contracts/logging. **Milestone:** M3.

### BK-P03-A — Normalize hosted detector and specialist API outputs

**Targets (N/M):** N `../../../services/vision/src/ecoloop_vision/domain/models.py`, `application/ports.py`, `infrastructure/images.py`, `tests/test_normalization.py`; M `adapters/detectors.py`, `adapters/specialist.py` under that package.

1. Define normalized detection/candidate/score-vector/processing-input/result types with exact wire aliases.
2. Call the existing pretrained Roboflow endpoints through API adapters and normalize their returned predictions. Preserve raw labels, source IDs, versions, errors and score semantics; there is no local weight execution.
3. Decode/validate image bytes, retain original dimensions, and invert resizing/letterboxing. Normalize all boxes to original-image `[x1,y1,x2,y2]` coordinates.
4. Respect the hosted API's documented postprocessing. Add only validated returned-detection duplicate filtering where necessary; do not assume our code loads or runs a YOLO model locally.
5. Treat D's multi-label vector as evidence on one crop. Unsupported labels/vocabularies remain explicit.
6. Test adapters against saved **actual** raw response shapes from P00, including format differences and invalid geometry.

**Gate:** normalization tests, real adapter smoke and source/config identities pass. A high raw score cannot silently become calibrated confidence.

### BK-P03-B — Matching, taxonomy and deterministic resolution

**Targets (N):** `domain/matching.py`, `domain/taxonomy.py`, `domain/resolution.py`, `tests/test_matching.py`, `tests/test_resolution.py` in `../../../services/vision` package/test roots.

1. Use geometry-aware one-to-one matching with explicit unmatched candidates and reproducible configuration. A tested assignment algorithm is preferable to blind overlap merging.
2. Preserve touching objects and nested/part relationships correctly; attached cap versus loose cap follows the stated policy.
3. Build explicit raw-label -> canonical/parent mappings and compatibility rules from the actual selected class maps.
4. Keep generic can/glass, unknown/other and unsupported labels from obtaining an unsupported eligible subtype.
5. Resolve reliable single-model detections without requiring another model to support that class.
6. Produce per-object rule IDs/source evidence and statuses. Invalid candidates contribute no count/space; a real excluded object still exists.
7. Test duplicate boxes, unequal box tightness, adjacent objects, unmatched B-only classes, parent/child compatibility, conflicts, false proposals and count aggregation.

**Gate:** deterministic matching/count/label cases pass and an overlay can explain a real sample's grouping. IoU/config values are tuned on development data, not presented as universal truths.

### BK-P03-C — Specialist crops and Gemini's two fallback paths

**Targets (N/M):** M `adapters/specialist.py`, `infrastructure/images.py`, `model_registry.json`; N `adapters/gemini.py`, `tests/test_specialist.py`, `tests/test_gemini.py`.

1. Crop original-image candidates with bounded padding; retain the source object ID and transformation metadata.
2. Invoke D only where its vocabulary can help. Contradictory multi-label evidence remains a conflict rather than multiple objects.
3. Implement server-side `gemini-3.8-flash` crop classification and no-proposal full-image inventory. Consult current SDK/model documentation for schema and thinking controls.
4. Use allowed canonical labels plus unknown, bounded calls/crops/output and explicit per-call deadlines within the job budget.
5. Validate schema, identities, label specificity and applicable geometry. Gemini self-confidence or valid JSON alone is not acceptance.
6. Crop responses label the existing candidate once. Full-image responses create distinct findings under a separately evaluated count protocol.
7. Provider failure, malformed output, unsupported label, exhausted quota and unresolved result produce explicit outcomes/reasons for review.

**Gate:** mock-provider boundary tests plus real crop/full-image smoke evidence; no secret/expected answer leakage. Empty-image acceptance is explicitly validated, not inferred from an empty detector list.

### BK-P03-D — Compose inspection, private probe, replay and overlays

**Targets (N/M):** N `application/inspect_image.py`, `tools/replay.py`, `tests/test_inspect_image.py`; M `main.py`, `tools/probe_models.py`, `Dockerfile` in `../../../services/vision`.

1. Compose A+B -> reconciliation -> deterministic resolution -> applicable D -> required Gemini -> validated findings.
2. Keep this application service independent of FastAPI/Firestore. Inject clock, provider and budget interfaces.
3. The private operator probe runs real pixels and returns findings/artifact references without financial settlement.
4. Replay accepts saved inputs/config/raw responses; writes manifest, normalized detections, matching groups/overlay and resolution decisions.
5. Preserve a consistent input hash/configuration across stages. No stage reads evaluation labels or interprets a helpful filename as a material answer.
6. Emit the D4 vision events with actual latency, counts, fallback usage and errors.

**Gate M3:** actual cloud findings are reproducible/inspectable for a mixed image, an excluded image, an empty/unknown case and fallback examples. This is functional engine evidence, not the later frozen accuracy report.

## P04 — Durable state, accounting and full existing Flutter flow

**Roles:** integration executor for server/Python; Flutter developer for Dart/UI; scoped QA. **Spec:** §§4-11, 15-18. **Milestone:** M4.

### BK-P04-A — Backend session and reservation transitions

**Depends on:** P02 server foundation.

**Targets (N/M):** N `../../../functions/src/application/sessions.ts`, `infrastructure/firestore/sessions_store.ts`, `transport/resident_sessions.ts`, `tests/emulator/sessions.test.ts`; M `../../../functions/src/index.ts`.

1. Implement atomic `scanBinQr`, confirm, finished-throwing, draft selection, renewal and pre-submission cancellation.
2. Enforce one active resident journey and one bin reservation. QR validation uses the enabled mapping and actual capacity/availability.
3. Store simulated access state and owner-private active references. Bin reads expose sanitized availability only.
4. Guard exact state/version and renewal expiry. A lost client cannot keep an unsubmitted lease indefinitely.
5. Serialize draft changes by revision; do not let an older save replace a newer selection or a submitted source.
6. Test two residents/one bin, one resident/two bins, repeated scan IDs, stale renewal, cancellation races and ownership violations.

**Gate:** meaningful emulator race tests and `scan.*` events. Collection/recovery cannot steal a processing reservation without finalizing its existing batch.

### BK-P04-B — Immutable submission and durable dispatch intent

**Depends on:** A and pinned contracts/policy.

**Targets (N/M):** N `../../../functions/src/application/submit_inspection.ts`, `infrastructure/firestore/inspection_store.ts`, `transport/resident_inspections.ts`, `tests/emulator/submission.test.ts`; M `../../../functions/src/index.ts`.

Implement architecture A5.2. Create one batch/job/response for the exact selected asset version, active policy and collection cycle. Record trusted submission/deadline time, trace context and dispatch intent. `recoverOperation` retrieves only the actor's operation.

Test duplicate same-payload Continue, same key/different image, different key/same session, missing/disabled/replaced asset, stale draft, lost response and policy switch during submission.

**Gate:** one immutable business submission and recoverable response. No external queue call inside the transaction.

### BK-P04-C — Fenced worker gateway and attempt state

**Depends on:** B and P03 finding schema.

**Targets (N/M):** N `functions/src/application/jobs.ts`, `infrastructure/firestore/jobs_store.ts`, `transport/internal_jobs.ts`, `tests/emulator/jobs.test.ts`; M `../../../functions/src/index.ts`.

1. Implement claim/checkpoint/renew/fail/read-current-result operations with IAM service authentication.
2. Claim at most three logical executions within the five-minute budget. Duplicate delivery cannot create an unlimited attempt count.
3. Use attempt/lease fencing; bind exact batch/source/policy/config and allowed artifact prefix.
4. Checkpoint validated stage outputs for safe reuse. Queue headers are diagnostics, not identity.
5. Return already finalized state without rerunning models. Reject expired/stale attempts with a safe state/reason.
6. Test concurrent claims, retry after a lost callback response, expired lease, deadline cutoff and a forged queue-header request.

**Gate:** only the active allowed execution can propose finalization. The production identity validator cannot be bypassed by emulator convenience flags.

### BK-P04-D — Cloud Tasks dispatcher and outbox repair

**Depends on:** C and P00 private Cloud Run deployment.

**Targets (N/M):** N `../../../functions/src/infrastructure/cloud_tasks.ts`, `transport/dispatch.ts`, `tests/unit/dispatch.test.ts`, `tests/emulator/outbox.test.ts`; M `../../../functions/src/index.ts` and scoped `../../../tools/backend/deploy_vision.ps1` configuration.

1. Enqueue from committed pending jobs, using deterministic task identity and actual region/audience.
2. Configure the task invoker service account, private Cloud Run invoker grant and queue concurrency aligned with the one-instance budget.
3. Persist successful dispatch metadata. Treat known duplicate task creation as recovery, not another business submission.
4. Handle crash-before-enqueue, enqueue-success/metadata-failure and missing delivery through state-based reconciliation.
5. Bound queue/backoff/deadline settings coherently with application attempts; a queue may redeliver, but business attempt guards remain authoritative.

**Gate:** a saved job reaches private Cloud Run through Tasks, including an injected interrupted-dispatch recovery. No public unauthenticated worker route.

### BK-P04-E — Atomic automatic settlement and review contract

**Depends on:** C and pure policy engine.

**Targets (N/M):** N `../../../functions/src/application/finalize_inspection.ts`, `infrastructure/firestore/settlement_store.ts`, `tests/emulator/settlement.test.ts`, `tests/unit/finalization_plan.test.ts`; M `transport/internal_jobs.ts`.

Implement architecture A5.3 and the specification's TX-01..09 exactly:

- All transactional reads precede writes; artifacts/model calls/FCM are outside retried callbacks.
- Verify source, active attempt, deadline, decision version and pinned configuration.
- Compute accepted/excluded/unresolved/null/empty semantics from validated findings and policy.
- Post one initial capacity effect, including a marker for zero-space outcomes; credit positive verified points once; update stats only for accepted verified quantities.
- Publish canonical batch/lines, stable result projection, open review ticket if needed and a durable notification intent.
- Complete session/release only matching active references. Late results after review cannot auto-credit.
- Provide tested review-resolution/collection domain functions or shared helpers for the later controlled harness; no public admin approval transport.

Required tests include 37/61, cardboard 0/15, empty 0/0, review 30, unreadable null/50, repeat completion, two callbacks, callback versus deadline, old attempt, missing artifact and old-cycle correction -2 after paper-bag resolution.

**Gate:** emulator accounting assertions inspect actual ledger/records, not only HTTP success. There is exactly one credit/posting and no unrelated reservation release.

### BK-P04-F — Python job runner and narrow backend integration

**Depends on:** D/E and independent inspect service.

**Targets (N/M):** N `../../../services/vision/src/ecoloop_vision/infrastructure/job_gateway.py`, `artifacts.py`, `application/run_job.py`, `tests/test_run_job.py`, `tests/test_job_gateway.py`; M `main.py`.

1. Implement the authenticated task handler using attached service identity and verified gateway audience.
2. Claim before work; obtain exact input/config and allowed artifact scope from the gateway.
3. Verify source version/digest, run/reuse stages, write artifact bundles and submit findings with the fenced attempt identity.
4. Track remaining job time before/after each stage. Use bounded provider timeouts; HTTP cancellation is not proof a blocking model thread stopped.
5. Finalize/fail coherently, and acknowledge task success only after durable backend acceptance or recovered terminal state.
6. On ambiguous callback failure, retry/recover the same completion. Do not start another deposit or rerun an already accepted result.

**Gate:** private Tasks -> Cloud Run -> private gateway -> Firestore succeeds with actual pixels; a repeated delivery produces no extra accounting. Logs span all boundaries with one source trace.

### BK-P04-G — Explicit enum compatibility migration

**Depends on:** v1 contracts. **Role:** Flutter developer.

**Targets (M):**

```text
lib/features/scan/domain/models/deposit_result.dart
lib/features/activity/domain/models/deposit_transaction.dart
lib/features/scan/presentation/screens/scan_session_screen.dart
lib/features/scan/presentation/widgets/deposit_result_card.dart
lib/features/activity/presentation/widgets/deposit_activity_tile.dart
lib/features/activity/presentation/screens/history_screen.dart
```

Add supported `processing`/`empty` states in their applicable enums and update every exhaustive switch without collapsing final destinations or inventing positive credit. Unknown future states show recovery/unsupported copy.

**Gate:** `flutter analyze` and directly affected existing tests pass. The real backend has a defined empty receipt presentation before nullable/mixed quantities are wired.

### BK-P04-H — Batch lines, nullable counts and accepted-only impact

**Depends on:** G. **Role:** Flutter developer. This is one named compatibility cluster; complete all listed model/consumer changes before its gate.

**Targets:** N `lib/core/domain/deposit_line_item.dart`; M `lib/features/scan/domain/models/deposit_result.dart`, `lib/features/activity/domain/models/deposit_transaction.dart`, `lib/features/scan/presentation/widgets/deposit_result_card.dart`, `lib/features/activity/presentation/widgets/deposit_activity_tile.dart`, `lib/features/activity/data/mock_activity_repository.dart`; N `test/core/domain/batch_models_test.dart`; M relevant `test/features/scan/scan_flow_test.dart` assertions.

1. Add authoritative lines and nullable total, policy/decision/trace metadata, and explicit backend factories/mappers.
2. Preserve pure legacy mock construction where useful; a strict real backend decoder must not silently fall back to legacy fixture assumptions.
3. Display mixed materials and accepted/excluded lines; unknown count uses explanatory text, not `null pcs` or fabricated zero.
4. Keep positive reward strip only for a committed positive credit. Empty/excluded are completed zero receipts, review is held.
   Log the non-secret receipt/trace reference when rendering the accepted outcome; a compact debug-only copyable reference may use the existing result component without adding a new route.
5. Compute impact from accepted verified line counts. A legacy display material getter must never drive mixed-batch business calculations.
6. Fix both known weight/count consumers (mock summary and activity tile) coherently with nullable/mixed data.

**Gate:** pure model/golden tests plus widget checks for mixed, pending/null, zero/empty and legacy mock cases; static analysis is clean for the whole cluster.

### BK-P04-I1 — Session/bin/asset read models

**Targets (N/M):** M `lib/features/scan/domain/models/deposit_session.dart`, `smart_bin.dart`; N `simulation_asset.dart` in that models directory; N `test/features/scan/backend_scan_models_test.dart`.

Represent draft version, committed input, job/substage/deadline/result references and raw spc versus display projection. Unknown or unsupported snapshots fail safely. Session `completed` with review does not remain an unfinished journey.

**Gate:** parse v1 examples and preserve nullable/count/availability semantics; no SDK objects in domain models.

### BK-P04-I2 — Real scan gateway/mapper implementation

**Depends on:** I1, BK-P02-C3 command client, server commands.

**Targets (N):** `lib/features/scan/data/backend_scan_mapper.dart`, `firebase_scan_repository.dart`, `test/features/scan/firebase_scan_repository_test.dart`.

Implement the new production command/read/watch surface, typed mappings and best-effort observed-stage cache. The class can remain unbound to the old repository interface until K's atomic interface cutover. Do not add fake legacy completion implementations merely to satisfy the old interface.

Queries are owner-scoped; after response loss recover the same submission/session. Data streams include result/line projections and suppress stale versions for the same session. Dispose caches/observers on owner change.

**Gate:** adapter tests against fake/emulator transports parse actual shapes, preserve intent identity and never invoke client completion. Production wiring is verified in K, not claimed here.

### BK-P04-J — Controlled camera and asset picker widgets

**Targets (N):** `lib/features/scan/presentation/widgets/qr_capture_view.dart`, `simulation_asset_picker.dart`, `test/features/scan/capture_and_picker_test.dart`.

1. Encapsulate real camera capture and lifecycle using the selected QR plugin. Emit decoded text, stop/debounce while a command is active and release on background/offstage.
2. Picker is controlled single selection; second choice replaces the first. Selection has no navigation or inference side effect.
3. Expose test seams for captured text/permission states, not a production “pretend scan succeeded” path.
4. Reuse ScannerStage, theme and accessible selection semantics. Keep Continue in the parent flow.

**Gate:** widget/port tests cover selection, duplicate capture callbacks, camera denial and disposal. Real platform permission checks remain required in P07.

### BK-P04-K — Atomic scan interface and UI cutover

**Depends on:** I2/J and completed backend worker path. **Role:** Flutter developer. Named migration cluster: bounded read pack and one full compatibility gate.

**Targets (M):** `lib/features/scan/domain/repositories/scan_repository.dart`, `lib/features/scan/data/mock_scan_repository.dart`, `firebase_scan_repository.dart`, `lib/features/scan/presentation/screens/scan_screen.dart`, `scan_session_screen.dart`, `lib/features/scan/presentation/controllers/scan_controller.dart`, `lib/app/providers/app_providers.dart`; N/M `test/features/scan/backend_scan_flow_test.dart` and directly affected existing mock tests.

1. Replace production QR lookup/create pair with `scanBinQr(payload, requestId)`. Bind the real repository only after its interface is complete.
2. Define watch-assets, save-selection, renewal and submit methods with version/identity requirements. Retire client completion from the production interface; mock-only helpers may remain clearly isolated.
3. Update the mock adapter coherently. It may synthesize a test asset catalog from existing classification scenarios; no fabricated backend truth enters Firebase mode.
4. Connect the camera; preserve stable pending request ID on transport failure instead of the current catch-block reset.
5. Retain all existing stages. On Item Detected show asset names, saved single choice and Continue; synchronize the latest choice/version before submission.
6. On Identifying Material observe the backend stream. Remove `_sync`/controller behavior that calls local `completeVerification` for the real journey.
7. Render the real receipt/review outcome and follow state changes without auto-advancing on image choice.

**Gate:** mocked/emulator full-flow tests plus a real Storage image through Cloud Run show coherent UI and records. No call to the old client-credit path exists in Firebase mode. Record the full trace bundle for AC-04 and a review case.

### BK-P04-L — Navigation, lease lifecycle and reopen recovery

**Depends on:** K.

**Targets (M/N):** M `lib/app/router/app_router.dart`, `lib/features/scan/presentation/controllers/scan_controller.dart`, `scan_session_screen.dart`, `lib/core/data/pending_operation_store.dart`; N `test/features/scan/session_recovery_test.dart`; M `test/app/app_router_test.dart`.

1. Keep synchronous stage peek as an optional observed-state hint, or inject a small cache. Missing cache means loading until the owned server snapshot resolves.
2. Preserve deep links, cancellation guards, branch visibility and post-frame canonicalization. No business mutations run from a redirect/build loop.
3. Renew only the active foreground unsubmitted session; stop on offstage/background/sign-out. Processing is server-owned.
4. Resume valid drafts/selection, recover submitted work and show explicit expiry/conflict. Never navigate backwards due only to an older cached revision.
5. Verify account switches, loss of network around Continue, app restart during processing, review completion release, and typed stale/future-stage URLs.

**Gate M4:** every required screen is present; real processing/settlement is durable; retries/closing the app do not create another deposit or reward; unknown data is not mistaken for a missing session.
