# Phase 6 Backend Audit

**Audit date:** 2026-10-19  
**Scope:** BK-P06-A through BK-P06-E  
**Authority:** [Phase 5/6 service plan](../backend_plan/PHASES_05_06_SERVICES.md), [execution protocol](../backend_plan/EXECUTION_PROTOCOL.md), and specification v1.1  
**Reviewed revisions:** `462d211`, `d50c105`, `58cc848`, `905ac04`, `1df3bd5`

## Executive finding

Phase 6 has substantial implementation coverage and the backend build plus focused unit/emulator checks pass. It should **not be promoted from `IMPLEMENTED` to `COMPLETE`** yet. The remediation refactor is recorded in [PHASE_06_REFACTOR.md](PHASE_06_REFACTOR.md); remaining items are explicitly marked below.

## Evidence reviewed

- BK-P06-A through BK-P06-E entries in [EXECUTION_TRACKER.md](../backend_plan/EXECUTION_TRACKER.md).
- BK-P06 development logs in [docs/archive/dev_logs/](../dev_logs/).
- Notification, account, scheduling, job, settlement, maintenance, rewards, and inspection sources under `../../../functions/src`.
- Focused tests under `../../../functions/tests/unit` and `../../../functions/tests/emulator`.
- [D7 observability requirements](../backend_plan/OBSERVABILITY_AND_DEBUGGING.md), especially the read-only inspection contract.
- `../../../functions/package.json`, `../../../firestore.indexes.json`, and the committed Phase 6 revisions.

## What is verified

- [x] BK-P06-A has durable notification intent claiming, preference/device re-read, bounded retries, invalid-token disabling, and provider acceptance tracking.
- [x] BK-P06-B has permission-gated registration, token refresh handling, account-switch/sign-out unregistration, background initialization, and authenticated/deferred navigation.
- [x] BK-P06-C has a pinned web worker, VAPID build input, SPA fallback, worker headers, and limited Android permissions. Protected Android Gradle/Google Services files were preserved.
- [x] BK-P06-D has pending dispatch reconciliation, stale lease handling, expected-cycle collection fencing, and an emulator-default operator harness.
- [x] BK-P06-E has a 03:00 `Asia/Kuala_Lumpur` schedule, bounded daily batch size, reminder idempotency, no-refund voucher expiry, and a readonly inspection command entrypoint.
- [x] `../../../functions` build passed.
- [x] Backend unit tests passed: 19 tests.
- [x] BK-P06-E maintenance emulator tests passed: 2 tests.
- [x] Existing job, outbox, and settlement emulator gates passed during implementation.
- [x] Pre-existing untracked `../../../Demo_Screenshots` and `../../../assets/trash_images` were preserved.

## Findings and remediation checklists

### 🔴 High — Deadline recovery duplicates settlement/accounting logic

**Files:** [maintenance_store.ts](../../../functions/src/infrastructure/firestore/maintenance_store.ts), [settlement_store.ts](../../../functions/src/infrastructure/firestore/settlement_store.ts)

`reconcileJob` directly updates `deposits`, `depositResults`, `reviewTickets`, and `notificationEvents`. The BK-P06-D plan explicitly requires recovery through the existing job/settlement services and prohibits a second accounting implementation. This path can drift from settlement fields, review semantics, capacity handling, and notification intent shape.

- [x] Move terminal deadline/exhaustion finalization behind a shared settlement/service operation.
- [x] Ensure scheduled recovery uses settlement-owned result/review/notification writes and decision versions.
- [ ] Add a recovery test proving timeout-vs-completion races cannot create divergent result, review, capacity, wallet, or notification state.

### 🔴 High — Retention cleanup does not recheck resolution eligibility before deletion

**Files:** [maintenance_store.ts](../../../functions/src/infrastructure/firestore/maintenance_store.ts)

`purgeDiagnostics` queries `state == "eligible"` and then deletes the Storage generation using data from the original query snapshot. It does not transactionally re-read the current artifact record, verify that the associated batch is resolved, verify the 30-day rule from resolution, or confirm that the source version is not shared/referenced immediately before deletion. The current test uses an artifact with no resolution metadata and therefore does not prove the required safety rule.

- [x] Require explicit resolution time and `purgeAfterAt = resolvedAt + 30 days`.
- [x] Re-read/claim the current artifact before generation-scoped deletion and record the resulting state.
- [x] Refuse deletion for shared-source-marked or structurally invalid artifacts.
- [ ] Add the remaining retention fixtures for pending review, resolution at 29 days, newer artifact generation, and shared source retention; exact resolution+30-day eligibility now has injected-clock coverage.
- [x] Record a durable deletion/audit event with the exact path and generation.

### 🟠 Medium — D7 readonly inspection is incomplete and not redacted

**Files:** [inspect.ts](../../../functions/tools/inspect.ts), [maintenance_store.ts](../../../functions/src/infrastructure/firestore/maintenance_store.ts), [OBSERVABILITY_AND_DEBUGGING.md](../backend_plan/OBSERVABILITY_AND_DEBUGGING.md)

D7 requires a redacted timeline for a session/deposit/job including session, job/attempts, batch decision, ledger/capacity entries, receipt/ticket, dispatch, and notification intent states. The current command accepts only `--batch-id` or `--resident-id`, does not inspect session or attempt subcollections, does not include wallet/capacity/receipt/dispatch state, and prints raw Firestore documents without a redaction layer. The command is readonly, but it is not yet the specified D7 diagnosis report.

- [x] Accept session, deposit, and job identifiers.
- [x] Assemble session/job/attempt, decision, ledger/capacity, ticket, and notification state within bounded reads.
- [x] Redact tokens, voucher codes, and provider payload fields.
- [x] Add bounded limits and stable JSON output.
- [ ] Document the supported commands and output contract in the tool/evidence documentation.

### 🟠 Medium — Gemini-only fallback and processing availability controls are not implemented as a Phase 6 gate

**Files:** [inspection_store.ts](../../../functions/src/infrastructure/firestore/inspection_store.ts), [maintenance_store.ts](../../../functions/src/infrastructure/firestore/maintenance_store.ts), [schedules.ts](../../../functions/src/transport/schedules.ts)

Submission checks a global `processingAvailability/global` document, but the reviewed Phase 6 implementation does not define runtime availability reasons, provider-specific Gemini-only limits, or a routing policy that sends unresolved cases to review. No Phase 6 test demonstrates pause-new-scans behavior or Gemini-only degradation behavior.

- [x] Define paused/disabled availability reason handling and persist Gemini-only provider mode metadata.
- [ ] Implement provider-specific limits and route unresolved Gemini-only cases to review.
- [ ] Add injected availability/provider tests proving new submissions pause while already-submitted work remains recoverable.
- [ ] Record the operational runbook/configuration for re-enabling processing.

### 🟠 Medium — Queue, worker, and billing controls are only partially configured

**Files:** [schedules.ts](../../../functions/src/transport/schedules.ts), [cloud_tasks.ts](../../../functions/src/infrastructure/cloud_tasks.ts), deployment configuration

The daily scheduler has timeout, memory, concurrency, min/max instance settings, but the Phase 6 requirement also calls for measured bounded calls, queue/concurrency/instance limits, runtime availability reasons, and billing controls. No committed Cloud Tasks queue rate/concurrency configuration, worker runtime limits, or measured billing evidence was found.

- [ ] Commit or document Cloud Tasks rate, retry, dispatch-deadline, and concurrency limits.
- [ ] Record worker Cloud Run concurrency, max instances, timeout, and minimum instances.
- [ ] Record the billing controls and measured cost/latency evidence for scheduled and worker paths.
- [ ] Verify deployed configuration rather than relying only on source defaults.

### 🟠 Medium — Required recovery/operator test surface is incomplete

**Files:** `../../../functions/tests/emulator`, [operator.ts](../../../functions/tools/operator.ts)

The plan names `tests/emulator/recovery.test.ts` and requires interrupted dispatch, crash-after-artifacts, lost finalization response, stale callback, timeout-vs-completion, collection-before-review, precise recovery/collection events, and a paused-service scenario. The committed tests are jobs/outbox/settlement plus the small maintenance suite; there is no dedicated recovery suite covering the complete gate. Recovery logging is represented mainly by state fields, not a precise structured audit event stream.

- [ ] Add `recovery.test.ts` covering every named recovery race and operator scenario.
- [ ] Add precise structured recovery and collection event records with run/trace/job/attempt/decision identifiers.
- [ ] Add a paused-service test and distinguish cold scale-to-zero from an intentionally disabled bin.
- [ ] Test operator collection before review resolution and verify all transaction invariants.

### 🟡 Low — Firestore composite indexes are not recorded for maintenance queries

**Files:** [firestore.indexes.json](../../../firestore.indexes.json), [maintenance_store.ts](../../../functions/src/infrastructure/firestore/maintenance_store.ts)

Maintenance queries combine status/state with expiry or eligibility timestamps. The committed index file has no entries for voucher expiry or diagnostic artifact retention. Firebase may request an automatically generated index at runtime, but deployment readiness is not proven and scheduled maintenance can fail in production without an index.

- [x] Add the required voucher-expiry and diagnostic-retention composite indexes.
- [ ] Run the daily maintenance queries against the target project/emulator with index validation.

### 🟡 Low — Tracker state and ledger contain a duplicate BK-P06-E row

**File:** [EXECUTION_TRACKER.md](../backend_plan/EXECUTION_TRACKER.md)

The unit ledger contains two BK-P06-E rows: one marked `IMPLEMENTED` and a second `NOT_STARTED`. This contradicts the protocol’s single-unit lifecycle and makes the phase status ambiguous.

- [x] Remove or merge the duplicate row.
- [ ] Set BK-P06-A through BK-P06-E to `VERIFIED` or `COMPLETE` only after the outstanding gates in this audit are evidenced.
- [ ] Update the resume checkpoint with this audit and the remaining blockers.

## Gate assessment

| Gate | Assessment | Evidence |
|---|---|---|
| Notification lifecycle and durable intent behavior | **Partially verified** | Focused unit/emulator tests; real push delivery remains unverified |
| Android/web messaging delivery | **Not verified** | Browser/device permission, token, and deployed push receipt remain outstanding |
| Reconciliation/deadline invariants | **Partially verified** | Jobs/outbox/settlement tests pass, but recovery path duplicates settlement logic and lacks the named recovery suite |
| Daily reminder/expiry | **Partially verified** | Injected-clock maintenance tests pass; deployed schedule and real push receipt remain outstanding |
| 30-day retention | **Not verified** | No true resolution+30-day eligibility test; deletion recheck is incomplete |
| D7 readonly diagnosis | **Partially verified** | Emulator smoke passes, but required timeline and redaction coverage is incomplete |
| Cost/availability controls | **Not verified** | Source-level daily scheduler limits exist; queue/provider/billing/deployment evidence is missing |

## Recommended completion order

- [ ] Fix the high-severity settlement-boundary and retention-fencing issues.
- [ ] Implement the complete D7 inspection report and redaction.
- [ ] Add the dedicated recovery/maintenance emulator coverage and structured audit events.
- [ ] Define provider availability/Gemini fallback and deploy queue/runtime/billing controls.
- [ ] Add/verify Firestore indexes and clean the duplicate tracker row.
- [ ] Capture real browser/device push, deployed scheduler, Storage retention, and production readonly diagnosis evidence.
- [ ] Re-run the full Phase 6 acceptance gates, update the tracker to `COMPLETE`, and record the final commit/deployment identifiers.

## Audit conclusion

Phase 6 is **implemented in broad strokes but not fully compliant or acceptance-complete**. The current evidence supports keeping BK-P06 units at `IMPLEMENTED`/`VERIFIED` as appropriate, not claiming the full Phase 6 milestone complete. The checklists above are the required follow-up work.
