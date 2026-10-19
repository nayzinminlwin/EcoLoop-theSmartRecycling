# Backend Implementation Execution Tracker

- **Plan:** [ECOLOOP-IMPL-001](../ECOLOOP_BACKEND_IMPLEMENTATION_PLAN.md)
- **Specification:** [ECOLOOP-SPEC-001 v1.1](../ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md)
- **Initial state:** Plan authored; implementation execution has started.
- **Current/next unit:** `BK-P06-B` implemented; Flutter notification lifecycle and account-association tests pass, while real Android/web delivery evidence remains.
- **Current role:** Integration executor; read the execution protocol and actual applicable role instructions before work.
- **Open implementation evidence:** [BK-P00-A readiness](../backend_evidence/READINESS.md) and [environment inventory](../backend_evidence/ENVIRONMENT.md). Public model documentation reviewed during planning is not runtime or acceptance proof.

### Effective scope clarification — specification v1.1

The user confirmed existing pretrained Roboflow APIs only: A `waste-detection-0momv/6`, B `yolo-waste-detection/1`, and crop classifier D `waste-classification-rjo28/2`, subject to actual API access verification. No training, fine-tuning, training-dataset upload/fork, weight download/export or self-hosting task is authorized by this plan.

Cloud Run hosts Python orchestration and returned-box matching/counting. The approximately 100 labeled images are evaluation cases only. A first HTTP API smoke call needs a representative sample and provider access, not that complete set or Google Cloud CLI. Cloud Run/Firebase resource verification remains required for the later deployment units.

The completed P00-A inventory and its factual observations are preserved. The checkpoint below was captured by that executor before this clarification; use the v1.1 scope here and in the updated phase instructions for subsequent work.

## 1. Resume checkpoint

Update this section at every real handoff:

```text
Last updated: 2026-10-19
Executing model / harness: Copilot SDK in VS Code
Role: Integration executor
Base revision / dirty or source-bundle identity: `7f207f6`; only pre-existing untracked `Demo_Screenshots/` and `assets/trash_images/` remain outside the commits
Active unit and status: BK-P06-B IMPLEMENTED; Firebase Messaging registration, permission handling, token refresh, account switching, sign-out unregistration, background initialization, and authenticated target coordination are wired and focused tests pass
Completed prerequisite gates: BK-P00-A through BK-P00-D; BK-P01-A through BK-P01-E2
Current changed files and user-owned changes to preserve: Flutter notification service/coordinator, bootstrap/provider/account lifecycle wiring, backend device-unregister callable/store, and focused notification lifecycle tests; preserve untracked `Demo_Screenshots/` and `assets/trash_images/`
Actual commands/results/evidence: `flutter analyze` passed; focused notification/account tests passed (9 tests); `Set-Location functions; npm run build` passed; `git diff --check` passed. DTD connected successfully but reported no active Flutter app; hot restart was attempted and could not run. Real Android/web delivery evidence was not claimed. See [BK-P06-B dev log](../dev_logs/2026-10-19_Backend_BK-P06-B_Notifications.md).
Relevant trace/request/session/deposit/job IDs: Cloud Run traces `46f078958206d5dc9685f5a6298c8d62` and `0de6e639a7d84d9ab1d55d168764c916`; Cloud Build IDs are recorded in `DEPLOYMENT.md`
Current contract/policy/pipeline/model versions: ECOLOOP-SPEC-001 v1.1; verified Firebase project `ecoloop-thesmartrecycling`, Firestore `ecoloop-db`, Storage bucket `ecoloop-thesmartrecycling.firebasestorage.app`
Unresolved defects / access blockers: OAuth authorized domains remain unverified; real feature adapters, live callable deployment and Flutter Auth integration remain later units
Commit SHA or explicit uncommitted state: BK-P04-A is committed as `56b2f65`; BK-P04-B is committed as `90c1915`; BK-P04-C is committed as `4f3dcd2`; BK-P04-D is committed with live deployment evidence pending; BK-P04-E is committed as `b56a527`/`33baf65`; BK-P04-F is committed as `ce8f639`; BK-P04-G is committed as `5fc2d77`; BK-P04-H is committed as `9d905be`; BK-P04-I1 is committed as `0c180a1`; BK-P04-I2 is committed as `e02a63f`; BK-P04-J is committed as `8ee4cbb`; BK-P04-K is committed as `eee2534`; BK-P04-L is committed as `b88f5fa`; unrelated untracked `Demo_Screenshots` and `assets/trash_images` remain preserved
Next single task and exact read set: Continue with BK-P06-C web worker/Hosting/native permissions; preserve protected Android configuration files and the notification service/provider boundary
```

The first execution reads BK-P00-A, the protocol, specification §§1-3/7/20 and the actual environment. Do not mark any implementation unit complete merely because its plan text exists.

## 2. Unit ledger

Use `NOT_STARTED`, `IN_PROGRESS`, `IMPLEMENTED`, `VERIFIED`, `COMPLETE`, `BLOCKED` or `FAILED` per the protocol. Evidence links/IDs replace the dash after execution.

| Unit | Deliverable | Status | Evidence / blocker |
| --- | --- | --- | --- |
| BK-P00-A | Instructions, tooling and existing-resource inventory | COMPLETE | [READINESS.md](../backend_evidence/READINESS.md); access blockers recorded |
| BK-P00-B | Existing hosted A/B/D/Gemini API access and output probe | VERIFIED | [MODEL_ACCESS.md](../backend_evidence/MODEL_ACCESS.md); all hosted calls succeeded; provider cost not yet measured |
| BK-P00-C | Private Cloud Run packaging and measured probe | VERIFIED | [DEPLOYMENT.md](../backend_evidence/DEPLOYMENT.md), [COST_AND_LATENCY.md](../backend_evidence/COST_AND_LATENCY.md); final revision and real independent probe verified |
| BK-P00-D | Evaluation test-image manifest/provenance and preparation | IMPLEMENTED (scaffolding) | [evaluation README](../../datasets/evaluation/README.md), [manifest](../../datasets/evaluation/manifest.json), and [schema](../../datasets/evaluation/annotations.schema.json); 15 inventoried, 0 labeled, no accuracy claim |
| BK-P01-A | Canonical schemas and golden/invalid corpus | COMPLETE | `contracts/backend/v1/`; JSON parse/corpus gate passed; decisions CD-001–CD-005 |
| BK-P01-B | TypeScript workspace/domain entities | COMPLETE | `functions/`; `npm run build`, Vitest smoke, and compiled module load passed |
| BK-P01-C | Typed ports, operation identity and pure policy | COMPLETE | `functions/src/application/ports.ts`, domain identity/policy, 6 focused tests; build passed |
| BK-P01-D | Structured/redacted diagnostics in three runtimes | COMPLETE | Node/Python/Flutter loggers and focused redaction/context tests passed; no active app available for hot restart |
| BK-P01-E1 | Node/Python schema validation and packaging | COMPLETE | Node 10 tests, Python 5 tests, packaged schema lookup, and cross-runtime rejection cases passed |
| BK-P01-E2 | Dart envelope/error contract | COMPLETE | Pure Dart envelope/error parser, correlation identities, UTC timestamp validation, focused analyze/tests passed |
| BK-P02-A | Existing-project Firebase rules/indexes/emulators | COMPLETE | [FIREBASE_FOUNDATION.md](../backend_evidence/FIREBASE_FOUNDATION.md); emulator Firestore/Storage rules gate passed (5 tests) |
| BK-P02-B | Idempotent account bootstrap and claims | COMPLETE | [ACCOUNT_BOOTSTRAP.md](../backend_evidence/ACCOUNT_BOOTSTRAP.md); Auth/Firestore emulator and regression gates passed |
| BK-P02-C1 | Flutter Firebase dependencies/clients/options | COMPLETE | [FLUTTER_FIREBASE_CLIENTS.md](../backend_evidence/FLUTTER_FIREBASE_CLIENTS.md); pub get, analyze and 75 Flutter tests passed |
| BK-P02-C2 | Explicit composition and advancing system clock | COMPLETE | [BOOTSTRAP_CLOCK.md](../backend_evidence/BOOTSTRAP_CLOCK.md); analyze and 81 Flutter tests passed |
| BK-P02-C3 | Durable command client/pending intent recovery | COMPLETE | [COMMAND_CLIENT.md](../backend_evidence/COMMAND_CLIENT.md); analyze, focused C3 tests and 91-test Flutter suite passed |
| BK-P02-D | Actual Google adapter/sign-in flow | BLOCKED | [GOOGLE_ACCOUNT_ADAPTER.md](../backend_evidence/GOOGLE_ACCOUNT_ADAPTER.md); fake adapter/auth tests and 93-test Flutter suite passed; real Android/web smoke blocked by unavailable app and unverified OAuth/SHA configuration |
| BK-P02-E | Routing and UID-scoped composition | IMPLEMENTED (follow-up) | [ROUTING_UID_COMPOSITION.md](../backend_evidence/ROUTING_UID_COMPOSITION.md), [PHASE_2_AUDIT_AND_FIXES.md](../backend_evidence/PHASE_2_AUDIT_AND_FIXES.md); UID profile lifecycle fixed and focused tests pass; callable/real platform blockers remain |
| BK-P02-F | Repeatable bins/policy/images/QR/catalog seeding | COMPLETE | [SEEDING.md](../backend_evidence/SEEDING.md); Functions build, dry-run, and Firestore/Storage emulator seed gate passed |
| BK-P03-A | Actual-output normalization and image transforms | IMPLEMENTED | Normalized models, provider adapters, image transforms, explicit pixel plus normalized finding geometry, regression tests, and live raster matrix; final accuracy evidence remains pending |
| BK-P03-B | Matching/taxonomy/deterministic resolution | IMPLEMENTED | Geometry-aware reconciliation, taxonomy/eligibility resolution, cap handling, count-safe fallback materialization, regression tests, and live composed outputs; development-set threshold tuning remains pending |
| BK-P03-C | Specialist and both Gemini fallback paths | IMPLEMENTED | Bounded crops, strict fallback validation, crop-result application, full-image finding materialization, explicit provider/invalid/review outcomes, tests, and live crop/full-image review cases |
| BK-P03-D | Composed inspection/replay/overlays | IMPLEMENTED | Composed operator path, stage diagnostics, bounded timeout/retry controls, replay fingerprint/manifests/overlays, live provider matrix, and local operator HTTP smoke; excluded-case and final acceptance evidence remain pending |
| BK-P04-A | Session/reservation transitions | VERIFIED | [BK-P04-A dev log](../dev_logs/2026-10-19_Backend_BK-P04-A_Sessions.md); build, 5 emulator tests, and 10 unit tests passed |
| BK-P04-B | Immutable submission/durable job | VERIFIED | [BK-P04-B dev log](../dev_logs/2026-10-19_Backend_BK-P04-B_Submission.md); build, 4 submission emulator tests, 5 session regressions, and 10 unit tests passed |
| BK-P04-C | Worker gateway/fenced attempts | VERIFIED | [BK-P04-C dev log](../dev_logs/2026-10-19_Backend_BK-P04-C_WorkerGateway.md); build, 4 worker emulator tests, 4 submission tests, 5 session tests, and 10 unit tests passed |
| BK-P04-D | Authenticated Tasks/outbox repair | IMPLEMENTED | [BK-P04-D dev log](../dev_logs/2026-10-19_Backend_BK-P04-D_Dispatch.md); build, dispatch unit, and 3 outbox emulator tests passed; live Cloud Tasks/Cloud Run delivery is pending configured deployment inputs |
| BK-P04-E | Atomic settlement/review/capacity contract | IMPLEMENTED | [BK-P04-E dev log](../dev_logs/2026-10-19_Backend_BK-P04-E_Settlement.md); build, 3 settlement emulator tests, and 11 unit tests passed |
| BK-P04-F | Python worker/gateway/artifact integration | IMPLEMENTED | [BK-P04-F dev log](../dev_logs/2026-10-19_Backend_BK-P04-F_JobRunner.md); 32 vision tests passed, including authenticated gateway, artifact, deadline, and ambiguous-completion recovery coverage; live private task delivery remains pending |
| BK-P04-G | Explicit enum compatibility migration | VERIFIED | [BK-P04-G dev log](../dev_logs/2026-10-19_Backend_BK-P04-G_EnumCompatibility.md); `flutter analyze` passed and 29 directly affected activity/scan tests passed |
| BK-P04-H | Mixed lines/nullable quantities/impact UI | VERIFIED | [BK-P04-H dev log](../dev_logs/2026-10-19_Backend_BK-P04-H_BatchLines.md); 32 affected model/activity/scan tests and clean `flutter analyze` |
| BK-P04-I1 | Session/bin/asset read models | VERIFIED | [BK-P04-I1 dev log](../dev_logs/2026-10-19_Backend_BK-P04-I1_ReadModels.md); focused model and scan regression tests plus clean `flutter analyze` |
| BK-P04-I2 | Real scan gateway/mapper implementation | VERIFIED | [BK-P04-I2 dev log](../dev_logs/2026-10-19_Backend_BK-P04-I2_ScanGateway.md); callable/read/watch adapter tests and scan regressions pass |
| BK-P04-J | Controlled camera and asset picker widgets | VERIFIED | [BK-P04-J dev log](../dev_logs/2026-10-19_Backend_BK-P04-J_CapturePicker.md); widget tests cover selection, duplicate capture, permission denial, and disposal |
| BK-P04-K | Atomic production scan interface/UI cutover | VERIFIED | [BK-P04-K dev log](../dev_logs/2026-10-19_Backend_BK-P04-K_AtomicScanCutover.md); `flutter analyze` and focused mock/Firebase/model/capture scan tests passed; no active Flutter app was available for hot restart |
| BK-P04-L | Lease/navigation/reopen recovery | VERIFIED | [BK-P04-L dev log](../dev_logs/2026-10-19_Backend_BK-P04-L_Recovery.md); complete scan suite, recovery/controller tests, router tests, pending-operation tests, and clean `flutter analyze` passed; no active Flutter app was available for hot restart |
| BK-P05-A | Wallet/history pagination and owner data | IMPLEMENTED | [BK-P05-A dev log](../dev_logs/2026-10-19_Backend_BK-P05-A_WalletHistory.md); Firebase wallet/activity adapters, canonical updatedAt cursor pagination, excluded status presentation, version-aware activity merging, UID-triggered provider rebinding, and focused tests pass; emulator/index/live evidence and hot-restart remain |
| BK-P05-B | Home accepted-count summaries and guide | IMPLEMENTED | [BK-P05-B dev log](../dev_logs/2026-10-19_Backend_BK-P05-B_HomeGuide.md); residentStats-derived estimates, current-policy guide composition, cardboard eligibility protection, and focused tests pass; emulator/live policy evidence remains |
| BK-P05-C | Google-aware profile/security/preferences | IMPLEMENTED | [BK-P05-C dev log](../dev_logs/2026-10-19_Backend_BK-P05-C_AccountSettings.md); provider metadata, Auth-managed identity, owner-safe preference writes, profile invariants, and focused tests pass; live Auth/sign-out lifecycle evidence remains |
| BK-P05-D | Atomic redemption and demo consumption backend | IMPLEMENTED | [BK-P05-D dev log](../dev_logs/2026-10-19_Backend_BK-P05-D_Rewards.md); callable transaction implementation, idempotency recovery, wallet ledger debit, offer/version checks, demo voucher issue/use, build, and unit tests pass; emulator evidence remains |
| BK-P05-E | Reward confirmation/receipt UI integration | IMPLEMENTED | [BK-P05-E dev log](../dev_logs/2026-10-19_Backend_BK-P05-E_RewardsFlutter.md); Firebase offer/version/cost wiring, durable command usage, committed voucher display, owner-scoped counts, focused widget/contract tests, and `flutter analyze` pass; live/emulator agreement and hot restart remain |
| BK-P05-F | Voucher use and time-correct status lists | IMPLEMENTED | [BK-P05-F dev log](../dev_logs/2026-10-19_Backend_BK-P05-F_VoucherLifecycle.md); demo metadata, durable simulated use, committed detail refresh, copy independence, and time-aware status projections pass focused tests and analysis; emulator/live agreement remains |
| BK-P06-A | Durable notification dispatcher | IMPLEMENTED | [BK-P06-A dev log](../dev_logs/2026-10-19_Backend_BK-P06-A_Notifications.md); Firestore intent claim/complete state machine, current preference/device re-read, combined result/credit summaries, safe target IDs, bounded retry, invalid-token disabling, scheduled transport, build, and focused tests pass; emulator/provider delivery evidence remains |
| BK-P06-B | Android/Flutter device/message lifecycle | IMPLEMENTED | [BK-P06-B dev log](../dev_logs/2026-10-19_Backend_BK-P06-B_Notifications.md); Firebase Messaging service, permission-gated registration, token refresh, sign-out/account-switch unregistration, top-level background initialization, safe authenticated history routing, deduplication/deferred deep-link coordination, backend unregister callable, analysis/build, and 9 focused tests pass; real Android/web delivery evidence remains |
| BK-P06-C | Web worker/Hosting/native permissions | NOT_STARTED | - |
| BK-P06-D | Reconciler/deadlines/operator contract | NOT_STARTED | - |
| BK-P06-E | Reminder/expiry/retention/cost/readonly diagnosis | NOT_STARTED | - |
| BK-P07-A | Transaction/authorization/recovery regression | NOT_STARTED | - |
| BK-P07-B | Frozen real CV evaluation | NOT_STARTED | - |
| BK-P07-C | Actual Android/web/permission/offline acceptance | NOT_STARTED | - |
| BK-P07-D | Performance/cost/accounting/trace audit | NOT_STARTED | - |
| BK-P08-A | Reproducible CI/deployment/runtime controls | NOT_STARTED | - |
| BK-P08-B | Fresh-user full-scope rehearsal/release manifest | NOT_STARTED | - |
| BK-P08-C | Final conformance and admin handoff | NOT_STARTED | - |

## 3. Milestone ledger

| Milestone | Status | Actual evidence / date |
| --- | --- | --- |
| M0 Feasible hosted inference integration | NOT_STARTED | - |
| M1 Contracts/domain/diagnostics | NOT_STARTED | - |
| M2 Real resident identity/data foundation | NOT_STARTED | - |
| M3 Auditable real vision | NOT_STARTED | - |
| M4 Full recycling vertical slice | NOT_STARTED | - |
| M5 Complete resident business features | NOT_STARTED | - |
| M6 Operable notifications/recovery/maintenance | NOT_STARTED | - |
| M7 Measured acceptance | NOT_STARTED | - |
| M8 Rehearsed deployed full-scope delivery | NOT_STARTED | - |

## 4. Dependency and configuration decisions

Record technical decisions as `DEC-001`, etc. Include context, chosen value/version, evidence, impacted units and whether the specification changes. Model/provider substitution, altered product behavior or weaker acceptance targets require explicit resolution, not only a tracker note.

| Decision | Topic | Status | Evidence / impacted units |
| --- | --- | --- | --- |
| DEC-001 | Existing project/apps/region and protected-file readiness | Verified with deployment API follow-up | BK-P00-A evidence; project/apps/package, Firestore/Storage locations, billing, Owner access and candidate Cloud Run region verified |
| DEC-002 | Existing hosted A/B/D API version access and affordability | Access/deployment verified; affordability pending pricing evidence | [MODEL_ACCESS.md](../backend_evidence/MODEL_ACCESS.md), [COST_AND_LATENCY.md](../backend_evidence/COST_AND_LATENCY.md); no weight/export prerequisite |
| DEC-003 | Compatible package/tool locks | Pending verification | BK-P00/P01/P02 |
| DEC-004 | Canonical schema/transport details | Pending implementation | BK-P01-A/E1/E2 |
| DEC-005 | Measured thresholds/matching/fallback/call limits | Pending development-set evidence | BK-P03/P07 |
| DEC-006 | Live IAM/App Check/browser/device configuration | Pending actual verification | BK-P02/P04/P06/P08 |
| DEC-007 | Existing pretrained Roboflow API inference only | Settled by user clarification; no runtime probe claimed | Spec/plan v1.1; continue from P00-B, preserving P00-A evidence |

## 5. Defect/blocker ledger

| ID | Requirement / symptom | Severity / status | Reproduction/evidence | Owner / next unit |
| --- | --- | --- | --- | --- |
| None recorded by execution yet | - | - | - | - |

Use confirmed evidence, not guesses. A planning observation such as the fixed mock clock is an implementation task until an actual relevant execution verifies its failure path.

## 6. Dataset and budget progress

```text
Prepared / labeled / frozen images:
Eligible-class and difficult/empty/excluded coverage:
Manifest/config digests:
Actual real-provider calls and validation spend:
Observed cost per batch/crop/fallback:
Projected 1,500-batch month, included services/rate date/currency:
Monthly target: RM50
Unresolved provider plan/access requirements:
```

## 7. Evidence and handoff index

Link actual template-based dev/QA/fix logs, compact `docs/backend_evidence/` reports, source/build manifests, private diagnostic references and release artifacts here. Keep private credentials and raw sensitive payloads out of this tracker.
