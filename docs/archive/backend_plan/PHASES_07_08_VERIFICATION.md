# P07-P08 — Independent Verification, Deployment and Handoff

Read [protocol](EXECUTION_PROTOCOL.md), the [acceptance matrix](ACCEPTANCE_AND_RUNBOOKS.md), and the relevant tester role/skills. QA records observed behavior; it does not silently implement a fix or call an unrun integration check passed.

## P07 — Establish actual acceptance evidence

This verifies existing pretrained hosted APIs and our application logic. No task here trains or fine-tunes a model; expected labels are used only to score results after inference.

**Depends on:** P00-P06 implemented gates. **Spec:** §18 and all referenced AC/TX requirements. **Milestone:** M7.

### BK-P07-A — Accounting, authorization and recovery regression

**Role:** integration executor for backend test additions; Flutter QA for its assigned tests.

**Targets (N/M):** N `../../../functions/tests/emulator/concurrency.test.ts`, `authorization.test.ts`, `../../../functions/tests/unit/reconciliation.test.ts`; M relevant existing `settlement.test.ts`, `rewards.test.ts`, `recovery.test.ts` under `../../../functions/tests`.

1. Run the AC matrix's deterministic records/ledger assertions against emulators, not an in-memory fake that cannot reproduce Firestore transaction retry/read-order behavior.
2. Exercise simultaneous reservations, distinct concurrent spending, same key/different payload, duplicate completion and timeout-versus-completion.
3. Inject dispatcher interruption, artifact-save/response interruption, stale attempt, absent provider and post-commit FCM failure at adapter boundaries.
4. Verify old-cycle correction, no refund, no partial pending reward, exact zero/null handling, no stale reservation release and no negative wallet.
5. Verify cross-owner queries, direct financial/status/role writes, fake worker headers and invalid live identity handling.
6. Inspect committed source entries and versions; success HTTP status alone is insufficient.

**Gate:** all TX-01..09 and directly corresponding AC assertions pass. Record exact IDs and event sequence for one successful and one recovered/held batch.

### BK-P07-B — Frozen real CV evaluation

**Role:** integration executor, with manually reviewed annotations.

**Targets (N/M):** N `../../../services/vision/src/ecoloop_vision/tools/evaluate.py`, `tests/test_evaluation_metrics.py`; M `../../../datasets/evaluation/manifest.json`, `../../../services/vision/model_registry.json`; actual generated report references in `docs/archive/backend_evidence/CV_EVALUATION.md`.

1. Validate the approximately 100-image manifest, annotation completeness, scene-group split and eligible/excluded/empty/difficult coverage. Freeze the evaluation subset before threshold tuning against it.
2. Choose our software's per-class acceptance thresholds/matching settings using the designated configuration examples and record the configuration digest. Provider model weights remain unchanged.
3. Run actual A, B, fusion, applicable D and Gemini comparisons. Saved raw model outputs may be reused for ablation only when image/model/preprocessing/config identity permits a faithful comparison; label truth must never enter the runtime call.
4. Count false objects/duplicates/wrong eligible classes as incorrect predictions. Report exact counts, missed objects, review rates, over-specific labels and class-level results.
5. Evaluate the declared clear supported non-empty subset for useful auto completion; empty/excluded records cannot inflate coverage.
6. Report observed targets: rewarded-classification precision >=95%, exact visible-object count >=90% on clear supported batches, verified auto-completion >=70% on clear supported non-empty batches.
7. Record denominator/sample size and actual failures. If evaluation informs further tuning, disclose that use and preserve an independent basis for final claims.

**Gate:** the actual report, per-case output/digest references and metric tests exist; targets are measured, not copied from published model pages. All-admin fallback is not a passing engine. A failed target is an unresolved milestone requiring real correction/decision, not a documentation edit lowering the threshold.

### BK-P07-C — Android/web journey, permission and offline checks

**Role:** Flutter QA, following `../../../.agent/tester/agent.md` and its Flutter/Firebase/accessibility/reporting skills.

**Targets (N/M):** N `integration_test/backend_resident_journey_test.dart`, `integration_test/backend_recovery_test.dart`, `test/features/notifications/notification_routing_test.dart`; M relevant `test/features/scan/backend_scan_flow_test.dart`, `../../../test/app/app_router_test.dart`, and legacy `../../../integration_test/resident_journey_test.dart` only to keep its explicit mock purpose correct.

1. Verify actual Google login/provisioning, camera QR capture, all intermediate screens, one image choice and explicit Continue on Android and HTTPS web.
2. Verify real Storage -> Tasks -> Cloud Run -> result, positive/zero/review screens, wallet/history, redemption, copy versus simulated use and current expiry state.
3. Verify denial of camera/push permission, invalid QR, full/busy/unavailable bin, foreground/background, offline before/after Continue, browser refresh, stale URL and account switch.
4. Verify actual token receipt and push foreground/background behavior, correct authenticated target routing, combined notification and no duplicate UI display.
5. Check enlarged text, picker accessibility, disabled/busy controls and existing navigation/leave guards.
6. Existing mock test labels/balance expectations are not evidence of Firebase functionality; keep live and mock runs distinguishable.

**Gate:** record device/browser, build/config, exact steps, trace references and safe screenshots. A web build or mocked camera widget does not satisfy actual Android/browser camera/FCM acceptance.

### BK-P07-D — Performance, costs and traceability audit

**Role:** integration executor + read-only QA review.

**Targets (N/M):** N `../../../services/vision/src/ecoloop_vision/tools/benchmark.py`, `../../../functions/tools/verify_accounting.ts`; M `../../../functions/tools/inspect.ts`; generated summaries `COST_AND_LATENCY.md` / `ACCEPTANCE.md`.

1. Measure queue wait, our orchestration container's cold/warm latency and memory, Roboflow/Gemini API round trips, total time and private-service invocation behavior. Run a bounded real sample and a small multi-bin concurrent burst. Do not report local model-loading/GPU measurements: the models execute at the provider.
2. Model approximately 1,500 monthly batches using measured provider calls per inspection/crop, retries, cold starts, usage/token counts and current dated prices.
3. Include one-time evaluation/build traffic, artifact storage, Hosting/Firestore/Storage, Gemini and any required Roboflow plan. Record billing currency/rate basis; RM50 is a target, not a precomputed quote.
4. Use cached/fake provider responses for large queue/race stress tests when appropriate; explicitly separate that from measured real model throughput/accuracy.
5. Verify the readonly accounting tool finds synthetic inconsistencies without mutating them. Rebuild/compare stats and ledger-derived totals in an isolated test dataset.
6. QA follows a real trace from Flutter to run artifacts, pinned policy, posting/credit, result and notification intent using documented log filters.

**Gate M7:** AC-01..24 statuses, CV target outcomes, costs, latency, role/rules evidence and remaining defects are indexed honestly. Required missing evidence is NOT_RUN/BLOCKED, not PASSED.

## P08 — Deployed full-scope delivery

**Depends on:** M0-M7. **Spec:** full scope and verification/change control. **Milestone:** M8.

### BK-P08-A — Reproducible CI, deployment and runtime controls

**Role:** integration executor; Flutter developer only for named app changes.

**Targets (N/M):** N `../../../.github/workflows/backend-ci.yml`; M `../../../tools/backend/deploy_vision.ps1`, `../../../infra/cloudbuild.vision.yaml`, `../../../infra/cloudrun.vision.yaml`, `../../../firebase.json`; N `../../../tools/backend/deploy_poc.ps1`.

1. CI checks actual locked Node/Python/Dart contracts/tests and meaningful emulator gates. Real provider calls require a separate explicit, budgeted operator run; do not expose credentials to an untrusted workflow.
2. Use verified action/tool versions and record them. Do not invent commit hashes or SDK versions.
3. Deploy exact implemented Functions, queue configuration, private service identities, indexes/rules and immutable vision image digest to the existing project.
4. Configure production-suitable applicable App Check providers for the actual PoC distribution and verified Android/web identities. Debug providers are explicitly development-only; a real attestation/distribution blocker needs an explicit resolution rather than silent bypass.
5. Check invocation audiences, worker artifact permissions, max instances/concurrency, bounded retry/call budgets, schedules, logging levels and eligible billing controls.
6. Build/deploy Firebase-mode Flutter web with HTTPS, correct public worker config and SPA behavior. Build the intended Android artifact without protected native-file edits.

**Gate:** reproducible scripts use explicit project/environment and preserve private access. No TODO handler, mock resident, debug secret, expected label injection or invalid endpoint is shipped as a required feature.

### BK-P08-B — Fresh-user rehearsal and release manifest

**Targets:** execution evidence `docs/archive/backend_evidence/DEPLOYMENT.md`, `ACCEPTANCE.md`, `ADMIN_HANDOFF.md`; M `../../../README.md` with verified run/deploy/debug instructions.

1. Use a fresh resident account: zero wallet -> real QR/full journey -> genuine image inference -> committed result -> wallet/history -> demo redemption/use.
2. Rehearse review, excluded/empty, full-bin/authorized reset, interruption recovery and notification cases without replacing backend classifications with filenames.
3. Verify reminder and cleanup via controlled test time/evidence while keeping normal 30-day issuance/retention rules.
4. Record image/source bundle and dependency/schema/model/policy/config digests, base revision/dirty status or commit, Hosting URL, service names/regions, Android build identity, schedules and final check results.
5. Document the trace-inspection/replay workflow and actual filters, not placeholder instructions.

**Gate:** demo can be operated and diagnosed from the handoff without a running developer-PC vision server. Full-scope evidence is accessible and limitations are explicit.

### BK-P08-C — Final conformance and friend/admin handoff

**Role:** read-only QA review + integration documentation.

**Targets:** final updates to `docs/archive/backend_evidence/ACCEPTANCE.md`, `ADMIN_HANDOFF.md`, and the execution tracker; focused fix/retest logs if needed.

1. Map every specification requirement/AC case to the actual implementation and evidence.
2. Provide the friend with versioned schema/examples, collection/query access expectations, batch/line-item shape, reason codes, evidence access contract and expected decision version semantics.
3. Clearly identify the later admin approval/collection transport work versus the already tested business domain contract/operator harness.
4. Verify all required unit gates/milestones and defect closures. A deadline does not convert failed CV/security/finance/device gates into pass.
5. Mark M8 complete only after the full accepted resident scope is proven, and archive the exact release manifest.

**Gate M8:** final conformance report, full-scope rehearsal and reproducible deployment/diagnostic handoff are complete. Product/spec changes, if any, have explicit recorded authorization.
