# Dev Log: Backend - BK-P04-D Cloud Tasks Dispatcher and Outbox Repair

**Date and Time :** 2026-10-19 11:50  
**Agent:** Copilot SDK in VS Code  
**Moderator:** Alex  
**Status:** Work in Progress — implementation complete; live deployment gate pending

## 1. Objective

Connect committed `inferenceJobs` with `dispatchState: "pending"` to
authenticated Cloud Tasks delivery, preserving deterministic task identity and
recovering interrupted enqueue metadata writes.

## 2. Reference Documents

- `docs/backend_plan/PHASES_03_04_RECYCLING.md` — BK-P04-D
- `docs/backend_plan/EXECUTION_PROTOCOL.md`
- `docs/backend_plan/ARCHITECTURE_AND_CONTRACTS.md` — A5.2, A7, A8
- `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` — §§5.4, 9, 10.5, 15

## 3. Changes Made

- **Files Created:**
  - `functions/src/infrastructure/cloud_tasks.ts`
  - `functions/src/transport/dispatch.ts`
  - `functions/tests/unit/dispatch.test.ts`
  - `functions/tests/emulator/outbox.test.ts`
  - `functions/vitest.dispatch.config.ts`
  - `functions/vitest.outbox.config.ts`
- **Files Modified:**
  - `functions/src/index.ts`
  - `functions/src/infrastructure/firestore/inspection_store.ts`
  - `functions/package.json`
  - `tools/backend/deploy_vision.ps1`
  - `docs/backend_plan/EXECUTION_TRACKER.md`
- **Impact to other modules:** Submission jobs now pin the inspection
  configuration version. A scheduled dispatcher reconciles pending jobs using
  the same deterministic task identity and does not create another business
  submission.

## 4. Technical Decisions & Deviations

- The task name is deterministic from the committed job ID. A known
  `ALREADY_EXISTS` response is treated as recovery, allowing an
  enqueue-success/metadata-failure retry to persist dispatch metadata without
  duplicating work.
- Task payloads contain only the committed job ID and trace ID. The worker
  retrieves source, policy, configuration, deadline, and attempt fencing from
  Firestore rather than trusting queue payload instructions.
- Tasks use an OIDC token with the configured invoker service account and the
  actual private Cloud Run URL as the audience. Queue headers remain
  non-authoritative.
- The deployment script grants `roles/run.invoker` to the task service account
  and configures one concurrent dispatch with a three-attempt, five-minute
  retry bound. Runtime function configuration must provide
  `ECOLOOP_WORKER_SERVICE_URL`, `ECOLOOP_WORKER_AUDIENCE`, and
  `ECOLOOP_TASK_INVOKER_SERVICE_ACCOUNT`.

## 5. Phase 4 Deliverables

| Deliverable | Completion | Description |
|-------------|-------------|-------------|
| Deterministic enqueue | ✅ | Stable task identity and committed job payload |
| OIDC/private delivery configuration | ⚠️ | Service-account token, audience, invoker grant, and queue bounds are wired; live grant/delivery evidence requires deployment inputs |
| Outbox repair | ✅ | Pending reconciliation and duplicate-task recovery |
| Failure recovery tests | ✅ | Enqueue failure leaves intent pending; duplicate creation repairs metadata |
| Emulator/unit gate | ✅ | Build, one dispatch unit test, and three outbox emulator tests passed |

## 6. Next Steps / Known Issues

- Live Cloud Tasks delivery through the deployed private Cloud Run service
  still requires the configured Cloud Run URL/audience, task-invoker service
  account, queue/secrets, authenticated project access, and an actual
  task-delivery trace. This is deployment evidence rather than an emulator
  claim.
- BK-P04-E follows after the live dispatch gate: atomic settlement, review
  routing, capacity postings, and finalization fencing.
