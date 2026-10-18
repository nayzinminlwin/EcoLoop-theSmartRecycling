# Backend Implementation Execution Tracker

- **Plan:** [ECOLOOP-IMPL-001](../ECOLOOP_BACKEND_IMPLEMENTATION_PLAN.md)
- **Specification:** [ECOLOOP-SPEC-001 v1.1](../ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md)
- **Initial state:** Plan authored; implementation execution has started.
- **Current/next unit:** `BK-P01-A` (P00-D scaffolding implemented; labeling remains an evaluation gate).
- **Current role:** Integration executor; read the execution protocol and actual applicable role instructions before work.
- **Open implementation evidence:** [BK-P00-A readiness](../backend_evidence/READINESS.md) and [environment inventory](../backend_evidence/ENVIRONMENT.md). Public model documentation reviewed during planning is not runtime or acceptance proof.

### Effective scope clarification — specification v1.1

The user confirmed existing pretrained Roboflow APIs only: A `waste-detection-0momv/6`, B `yolo-waste-detection/1`, and crop classifier D `waste-classification-rjo28/2`, subject to actual API access verification. No training, fine-tuning, training-dataset upload/fork, weight download/export or self-hosting task is authorized by this plan.

Cloud Run hosts Python orchestration and returned-box matching/counting. The approximately 100 labeled images are evaluation cases only. A first HTTP API smoke call needs a representative sample and provider access, not that complete set or Google Cloud CLI. Cloud Run/Firebase resource verification remains required for the later deployment units.

The completed P00-A inventory and its factual observations are preserved. The checkpoint below was captured by that executor before this clarification; use the v1.1 scope here and in the updated phase instructions for subsequent work.

## 1. Resume checkpoint

Update this section at every real handoff:

```text
Last updated: 2026-10-18
Executing model / harness: Copilot SDK in VS Code
Role: Integration executor
Base revision / dirty or source-bundle identity: `7f207f6`; only pre-existing untracked `Demo_Screenshots/` and `assets/trash_images/` remain outside the commits
Active unit and status: BK-P01-B COMPLETE
Completed prerequisite gates: BK-P00-A inventory; BK-P00-B hosted provider probe; BK-P00-C private Cloud Run probe; BK-P00-D manifest/schema identity validation
Current changed files and user-owned changes to preserve: `functions/package.json`, `functions/package-lock.json`, `functions/tsconfig.json`, `functions/vitest.config.ts`, `functions/src/index.ts`, `functions/src/domain/types.ts`, `functions/src/domain/errors.ts`, `functions/tests/unit/workspace.test.ts`, and this tracker; preserve untracked `Demo_Screenshots/` and `assets/trash_images/`
Actual commands/results/evidence: `npm install`, `npm run build`, `npm run test:unit`, compiled `lib/index.js` module load, and `git diff --check` passed in `functions/`. npm reported 34 dependency audit findings (30 moderate, 2 high, 2 critical); no audit remediation was applied because it is outside this unit.
Relevant trace/request/session/deposit/job IDs: Cloud Run traces `46f078958206d5dc9685f5a6298c8d62` and `0de6e639a7d84d9ab1d55d168764c916`; Cloud Build IDs are recorded in `DEPLOYMENT.md`
Current contract/policy/pipeline/model versions: ECOLOOP-SPEC-001 v1.1; hosted A `waste-detection-0momv/6`, B `yolo-waste-detection/1`, D `waste-classification-rjo28/2`, Gemini `gemini-3.8-flash`; evaluation `evaluation-2026-10-18-v0`
Unresolved defects / access blockers: Provider monetary pricing/quota references, OAuth authorized domains, and process memory profile remain open; evaluation inventory has 15 candidates but 0 labeled/frozen images
Commit SHA or explicit uncommitted state: BK-P01-A committed as `5a3c14d`; BK-P01-B is ready to commit
Next single task and exact read set: BK-P01-C; read `PHASES_00_02_FOUNDATION.md` BK-P01-C, this tracker checkpoint, specification sections 8-11, and `functions/src/domain/types.ts`
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
| BK-P01-C | Typed ports, operation identity and pure policy | NOT_STARTED | - |
| BK-P01-D | Structured/redacted diagnostics in three runtimes | NOT_STARTED | - |
| BK-P01-E1 | Node/Python schema validation and packaging | NOT_STARTED | - |
| BK-P01-E2 | Dart envelope/error contract | NOT_STARTED | - |
| BK-P02-A | Existing-project Firebase rules/indexes/emulators | NOT_STARTED | - |
| BK-P02-B | Idempotent account bootstrap and claims | NOT_STARTED | - |
| BK-P02-C1 | Flutter Firebase dependencies/clients/options | NOT_STARTED | - |
| BK-P02-C2 | Explicit composition and advancing system clock | NOT_STARTED | - |
| BK-P02-C3 | Durable command client/pending intent recovery | NOT_STARTED | - |
| BK-P02-D | Actual Google adapter/sign-in flow | NOT_STARTED | - |
| BK-P02-E | Routing and UID-scoped composition | NOT_STARTED | - |
| BK-P02-F | Repeatable bins/policy/images/QR/catalog seeding | NOT_STARTED | - |
| BK-P03-A | Actual-output normalization and image transforms | NOT_STARTED | - |
| BK-P03-B | Matching/taxonomy/deterministic resolution | NOT_STARTED | - |
| BK-P03-C | Specialist and both Gemini fallback paths | NOT_STARTED | - |
| BK-P03-D | Composed inspection/replay/overlays | NOT_STARTED | - |
| BK-P04-A | Session/reservation transitions | NOT_STARTED | - |
| BK-P04-B | Immutable submission/durable job | NOT_STARTED | - |
| BK-P04-C | Worker gateway/fenced attempts | NOT_STARTED | - |
| BK-P04-D | Authenticated Tasks/outbox repair | NOT_STARTED | - |
| BK-P04-E | Atomic settlement/review/capacity contract | NOT_STARTED | - |
| BK-P04-F | Python worker/gateway/artifact integration | NOT_STARTED | - |
| BK-P04-G | Explicit enum compatibility migration | NOT_STARTED | - |
| BK-P04-H | Mixed lines/nullable quantities/impact UI | NOT_STARTED | - |
| BK-P04-I1 | Session/bin/asset read models | NOT_STARTED | - |
| BK-P04-I2 | Firebase scan gateway/mapper | NOT_STARTED | - |
| BK-P04-J | Camera and controlled picker widgets | NOT_STARTED | - |
| BK-P04-K | Atomic production scan interface/UI cutover | NOT_STARTED | - |
| BK-P04-L | Lease/navigation/reopen recovery | NOT_STARTED | - |
| BK-P05-A | Wallet/history pagination and owner data | NOT_STARTED | - |
| BK-P05-B | Home accepted-count summaries and guide | NOT_STARTED | - |
| BK-P05-C | Google-aware profile/security/preferences | NOT_STARTED | - |
| BK-P05-D | Atomic redemption and demo consumption backend | NOT_STARTED | - |
| BK-P05-E | Reward confirmation/receipt UI integration | NOT_STARTED | - |
| BK-P05-F | Voucher use and time-correct status lists | NOT_STARTED | - |
| BK-P06-A | Durable notification dispatcher | NOT_STARTED | - |
| BK-P06-B | Android/Flutter device/message lifecycle | NOT_STARTED | - |
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
