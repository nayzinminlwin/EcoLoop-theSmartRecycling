# EcoLoop Backend Implementation Plan

- **Plan ID:** ECOLOOP-IMPL-001
- **Version/date:** 1.1 / 2026-10-18
- **Execution target:** GPT-5.6 Luna, using the repository's applicable role instructions
- **Authority:** [ECOLOOP-SPEC-001 v1.1](ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md)
- **Status:** Hosted-API scope clarified; actual implementation progress is maintained in the execution tracker
- **Delivery target:** Full agreed software PoC in seven days, including validation

## 1. Start here

This is the entry point for the backend work. The specification defines product behavior; this plan defines its implementation order, code boundaries, verification, and evidence.

**Model scope:** call the existing pretrained Roboflow A/B/D APIs with server-side API keys. Cloud Run runs our orchestration, not model weights. There is no model training, fine-tuning, dataset-upload/export or self-hosting task. The approximately 100 labeled images are evaluation test cases only; a representative sample is sufficient for the first API probe.

Read [Execution protocol](../backend_plan/EXECUTION_PROTOCOL.md) before changing code. Then read the current unit, its direct prerequisites, and the cited specification sections. Use [Execution tracker](../backend_plan/EXECUTION_TRACKER.md) to resume after a context reset.

| Document | Purpose |
| --- | --- |
| [Execution protocol](../backend_plan/EXECUTION_PROTOCOL.md) | Role files, scope, context budgets, commands, logs, checkpoint and handoff rules |
| [Architecture and contracts](../backend_plan/ARCHITECTURE_AND_CONTRACTS.md) | Lean clean architecture, module ownership, wire contracts, transactions, Flutter migration |
| [Observability and debugging](../backend_plan/OBSERVABILITY_AND_DEBUGGING.md) | Structured debug output, end-to-end IDs, event catalog, replay and defect diagnosis |
| [P00-P02: Foundation](../backend_plan/PHASES_00_02_FOUNDATION.md) | Actual model feasibility, contracts, instrumentation, Firebase/authentication |
| [P03-P04: Recycling](../backend_plan/PHASES_03_04_RECYCLING.md) | Real vision orchestration, durable jobs, accounting, existing Flutter scan journey |
| [P05-P06: Resident services](../backend_plan/PHASES_05_06_SERVICES.md) | Read models, rewards, vouchers, notifications, recovery and maintenance |
| [P07-P08: Verification/release](../backend_plan/PHASES_07_08_VERIFICATION.md) | CV evaluation, Android/web checks, costs, deployment and rehearsal |
| [Acceptance and runbooks](../backend_plan/ACCEPTANCE_AND_RUNBOOKS.md) | Requirement-to-test matrix, runnable workflows, operator/admin handoff |
| [Execution tracker](../backend_plan/EXECUTION_TRACKER.md) | Actual status, evidence, defects, decisions and next bounded task |

Paths shown as code in the phase documents are **implementation targets**, not assertions that those files already exist. New files are created only when their unit is executed. Existing files are patched in place after inspection.

## 2. Execution design for GPT-5.6 Luna

The [published model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna.md), checked on 2026-10-18, lists a 1,050,000-token context window, 922,000 maximum input tokens, and 128,000 maximum output tokens, and describes a cost-sensitive model tier. The executing harness may impose lower limits.

The work therefore uses small **reasoning and verification boundaries**, even when more context is technically available:

- Execute one uniquely identified `BK-Pxx-*` unit at a time.
- Normally touch 3-6 production/configuration/test files; explicitly named migration clusters may be larger.
- Target an active read pack of roughly 15,000-30,000 tokens for ordinary units. This is guidance, not a model capability claim.
- Use explicit transaction recipes, golden contracts, known expected values, and observable exit gates.
- Checkpoint before changing subsystem, role, or context. A large context window does not replace evidence.
- When supported, use increased reasoning effort for transaction/fencing, authorization, schema migration and routing work; routine adapters can use ordinary effort.
- Keep current provider/runtime documentation beside the relevant task. The published model's February 2026 knowledge cutoff predates some selected model/provider details.

## 3. Technical direction

| Layer | Decision |
| --- | --- |
| Flutter | Existing Riverpod + GoRouter + feature/domain/repository layout; concrete Firebase adapters at the data/composition boundary |
| Trusted business backend | TypeScript, Firebase Functions 2nd generation, Node.js 22 baseline verified against current support |
| Vision | Lightweight Python/FastAPI orchestration on Cloud Run; hosted Roboflow model API clients, image crops, returned-box matching/counting and Gemini fallback |
| Contracts | Versioned JSON Schemas and shared golden JSON; runtime-specific types/decoders tested against them |
| Data | Firestore canonical records and explicit read projections; private versioned Storage artifacts |
| Work delivery | Durable job/outbox state, Cloud Tasks authenticated invocation, fenced worker attempts |
| Debuggability | Structured events from the first real probe; request/session/batch/job/attempt correlation across runtimes |

Keep the architectural investment proportional. Use one cohesive repository adapter per feature, one composition root per runtime, and pure functions for policy/accounting. Avoid a generic ORM, one use-case class per getter, service locators inside widgets, or an additional Flutter state-management framework.

## 4. Phase dependency map and milestones

```text
P00 actual feasibility + dataset preparation
  -> P01 contracts / domain / diagnostics
  -> P02 Firebase + Google identity
  -> P03 independent real vision pipeline
  -> P04 integrated recycling / settlement / Flutter flow
  -> P05 remaining resident services
  -> P06 notifications / recovery / scheduled services
  -> P07 independent acceptance evidence
  -> P08 deployed release and handoff
```

Dataset preparation begins in P00 and continues alongside the build. Independent preparation may proceed during an external-access blocker; a dependent milestone cannot be claimed until the blocker is resolved.

| Phase | Milestone | Evidence required |
| --- | --- | --- |
| P00 | **M0 — Feasible hosted inference integration** | Existing A/B/D API access, real returned predictions, Gemini request, private Cloud Run orchestration probe, initial cost/memory evidence |
| P01 | **M1 — Stable contracts and diagnostics** | Node/Python schemas and golden cases, Dart envelopes, pure policy tests and redacted traces; full Dart batch decoding is gated in P04 |
| P02 | **M2 — Real resident identity/data foundation** | Existing-project configuration, rules tests, Google UID bootstrap with zero wallet, Android/web auth evidence |
| P03 | **M3 — Real auditable vision engine** | Normalization/matching/specialists/fallback, unique-object findings, replay/overlay artifacts from actual pixels |
| P04 | **M4 — Full recycling vertical slice** | Every screen retained; explicit image Continue; real job; 37-point/61-spc reference logic; review and retry invariants |
| P05 | **M5 — Complete resident business features** | Live wallet/history/guide/profile, atomic redemption, unique voucher and simulated use |
| P06 | **M6 — Operable PoC** | Real Android/web FCM, reminders, recovery, expiry, safe diagnostic cleanup, controlled operator contracts |
| P07 | **M7 — Measured acceptance** | CV targets, AC-01 through AC-24, race/failure tests, 50-batch/day sizing and RM50 cost model |
| P08 | **M8 — Rehearsed deployed delivery** | Explicit release configuration, deployed Android/web evidence, image/config digests, runnable handoff and known limitations |

### 4.1 Seven-day target schedule

| Day | Main implementation focus | Required checkpoint |
| --- | --- | --- |
| 1 | P00 and P01; start dataset labeling and Firebase configuration | Model/provider feasibility known; contracts and trace vocabulary usable |
| 2 | P02 and P03 | Real sign-in and independently executable cloud vision pipeline |
| 3 | P04 | Real full-screen recycling journey with server-owned settlement and review |
| 4 | P05 | Earn -> wallet/history -> redeem -> consume demo voucher |
| 5 | P06 | Push, recovery, reminders, retention and operator verification |
| 6 | P07 | Frozen CV results and system acceptance, with defects identified early |
| 7 | P08 and focused fixes/retests | Deployment freeze, fresh-user rehearsal and complete evidence index |

This is the requested target, not proof that unknown model access or accuracy will cooperate. Full scope remains required. Log blocked gates and resolve actual incompatibilities; do not replace real inference with fixture answers, skip scheduled services, or silently lower targets to meet the date.

## 5. Scope and existing-code constraints

Execution is backend integration work corresponding to Goals 3-4. Follow the role-file resolution in the protocol; Goal 1-2 mock restrictions still apply to the retained mock runtime.

### 5.1 Explicit implementation ownership

- Integration executor: `functions/`, `services/vision/`, `contracts/backend/`, `infra/`, `tools/backend/`, backend root configuration, scoped CI and related documentation/tests.
- Flutter developer role: explicitly listed resident `lib/`, `test/`, `integration_test/`, `web/`, dependency and permitted manifest changes.
- Flutter QA role: its assigned Flutter tests/reports under its role instructions.
- Admin frontend remains owned by the friend/web role; this plan prepares contracts and does not edit `apps/admin-web/`.

The protected files remain:

```text
android/build.gradle.kts
android/app/build.gradle.kts
android/app/google-services.json
```

Existing `android/app/build.gradle.kts` already applies the Google Services plugin and has an application ID different from its namespace. Verify Firebase registration against the actual application ID; do not infer it from the namespace. Automated configuration tools must not overwrite protected files.

### 5.2 Known migration points

1. `lib/app/bootstrap.dart` always loads mock data today; add explicit runtime composition.
2. `app_providers.dart` contains hardcoded mock identity/balance; Firebase mode must bind current UID and real adapters.
3. `ScanScreen` simulates QR and clears `_requestId` on errors; replace this with actual capture and recoverable intent identity.
4. `ScanCompletionController` calls client-side mock completion; Firebase mode must observe server job/result state.
5. Router stage peeks are synchronous hints today; unknown cache must mean loading, not a missing/expired session.
6. Deposit/result models are single-material; migrate to batch lines, nullable unknown totals, `processing`/`empty` states, and explicit zero outcomes.
7. `AppClock()` currently fixes time to May 2024; real mode needs a clock whose `now` advances on every read.
8. Profile/security mocks allow email/password behavior that must become Google-provider-aware.
9. Existing integration tests assume mock identity, balance and older labels; preserve their purpose while adding distinct live-backend evidence.

## 6. Definition of a completed unit

A unit is complete only when:

1. Its named implementation exists and imports only implemented dependencies.
2. Its narrow checks have actually run, with output/limitations recorded.
3. Its specification/AC references and diagnostic events are covered.
4. Its dev/QA/fix log uses the applicable repository template.
5. Its tracker row includes changed files, evidence, defects and next unit.
6. Its milestone is not represented as passed by a mock, placeholder or unexecuted manual check.

Read the commit rules in the protocol. Commit only when permitted by the executing harness and moderator; record actual commit status rather than manufacturing a commit checkpoint.

## 7. Requirement coverage index

| Specification area | Primary phases | Diagnostic / proof reference |
| --- | --- | --- |
| §§2-3 scope/architecture, SCOPE-01..08 | P00, P01, P08 | Runtime registry, deployment manifest, full-scope acceptance index |
| §§4-5 FLOW-01, sessions/jobs | P02, P04, P06 | `scan.*`, `job.*`, AC-02/03/10/11/12/13 |
| §§6-7 taxonomy/vision | P00, P01, P03, P07 | Per-run artifacts, CV-AC-01..03, AC-04/05/06/07 |
| §§8-9 capacity/finance, TX-01..09 | P01, P04, P05, P06, P07 | Ledger/capacity events, AC-08/09/14/15/16/24 |
| §§10-11 data/operations | P01, P02, P04, P05 | Schemas, converters, query/index registry and contract tests |
| §§12-14 resident features/notifications | P02, P05, P06 | Owner streams, redemption/use events, AC-01/17/18/19 |
| §§15-16 access/reliability/cost | P02, P04, P06, P07, P08 | Rules/IAM checks, recovery and cost/latency reports, AC-20/21/22/23 |
| §17 admin handoff | P04, P06, P08 | Versioned review/collection contracts, controlled operator evidence |
| §§18-20 acceptance/change control | Every phase, especially P07-P08 | [AC matrix](../backend_plan/ACCEPTANCE_AND_RUNBOOKS.md), tracker and report index |

## 8. First executor instruction

```text
Execute BK-P00-A from docs/archive/backend_plan/PHASES_00_02_FOUNDATION.md.
Read docs/archive/backend_plan/EXECUTION_PROTOCOL.md and the applicable existing role
instructions first. Treat ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md as authority.
Inspect current git status and the exact named prerequisites. Record readiness
and blockers; do not invent project IDs, credentials, model access, or test passes.
Update the execution tracker and a template-based dev log before handing off.
```
