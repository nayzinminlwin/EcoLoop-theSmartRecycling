# Observability, Debug Printing, and Fault Localization

**Goal:** Starting from a user's visible failure or receipt, locate the exact operation, model run, decision and accounting effects without guessing or reproducing every subsystem.

## D1. Implement diagnostics before feature integration

The first real model probe and first resident command must already emit structured events. Add a small `AppLogger`/server logger abstraction, not scattered `print()` statements.

| Runtime | Output |
| --- | --- |
| Flutter debug/emulator | Human-readable, throttled `debugPrint` lines from structured event data |
| Functions | Firebase/Cloud Logging structured JSON, preserving application event fields |
| Python Cloud Run | One JSON object per event to stdout; trace correlation and actual exception stack at error boundary |
| Tests | In-memory event collector, assertions on important committed/failure events, deterministic IDs |

Debug printing is required for useful development. Verbose payload dumps, logs on every widget build and unbounded per-detection prints are not useful instrumentation.

An A/B/D model stage is a request to an existing pretrained Roboflow hosted API. Its timing covers our request/response path; model execution belongs to Roboflow. Logs and replay do not initiate training or load model weights in Cloud Run.

## D2. Correlation contract

| Identifier | Lifetime |
| --- | --- |
| `interactionId` | One frontend interaction, useful before a backend request exists |
| `requestId` | Stable ID for one mutating intent; survives ambiguous retry/reopen |
| `traceId` | Trusted correlation root, represented as 32 lowercase hex characters |
| `sessionId` | Scan journey |
| `depositId` | Immutable submitted batch |
| `jobId` | Durable processing work |
| `attemptId` | Fenced execution attempt |
| `decisionVersion` | Accepted outcome revision |
| `policyVersionId` / `pipelineVersionId` | Rules and inference configuration used |
| `redemptionId` / `voucherId` | Reward/usage flow |

The backend creates/validates trace context, returns it in safe responses/errors, and persists it with job/session/result metadata. Queue delivery and worker gateway calls propagate it. Each retry/attempt may have a new span but keeps the logical source linkage.

Use one stable application trace for the scan journey once reservation is committed. Subsequent owned-session commands recover that trusted stored trace, and Continue's job inherits it. Pre-response UI events can initially correlate by request/interaction ID. Authentication and reward-redemption operations may have separate roots with explicit domain links. Preserve a separate transport trace when necessary; do not claim that an SDK automatically created a single distributed span graph.

Do not use trace IDs or queue headers as authorization. Do not overwrite one request's context with another in a warm instance. Python uses request-local context; Node uses explicit scoped context or AsyncLocalStorage.

Cloud Logging records should include `logging.googleapis.com/trace` using the verified project and trace ID, plus an explicit searchable `traceId` field. Continuation must work across Functions, Tasks and Cloud Run even when their automatic HTTP traces differ.

## D3. Minimum event schema

```json
{
  "timestamp": "2026-10-18T09:00:00.000Z",
  "severity": "INFO",
  "event": "inspection.submission_committed",
  "service": "firebase-functions",
  "environment": "emulator",
  "unit": "BK-P04-B",
  "traceId": "0123456789abcdef0123456789abcdef",
  "requestId": "request-001",
  "sessionId": "session-001",
  "depositId": "deposit-001",
  "jobId": "job-001",
  "outcome": "committed",
  "durationMs": 35,
  "schemaVersion": 1
}
```

Include only applicable fields. Additional allowed fields include safe actor hash, attempt/decision identity, asset version/digest, model version, stage, reason/rule ID, bounded counts, points/spc delta, cold-start flag, elapsed/remaining budget, and provider usage totals.

Distinguish **intent**, **attempt**, **proposal**, and **committed effect**. A transaction callback that later retries must not emit a misleading successful credit. Emit commit events after the transaction resolves, with a durable ledger/posting ID.

### Levels

- DEBUG: draft/version changes, schema conversion, matching summaries and expected retries.
- INFO: committed transitions and stage summaries.
- WARNING: conflicts, unavailable fallbacks, pending review and deadline recovery.
- ERROR: unexpected failures with redacted stack, causal code and recovery route.

Expected conflicts are not automatically ERROR. A valid review outcome is not a server crash.

## D4. Event catalog and source locations

| Events | Implementation boundary / essential fields |
| --- | --- |
| `auth.sign_in_started`, `auth.sign_in_completed`, `auth.sign_in_cancelled` | Flutter auth controller; provider, interaction/request ID; no tokens |
| `account.bootstrap_committed`, `account.bootstrap_recovered` | Account application/transport; safe owner hash and role/provisioning state |
| `scan.qr_decoded`, `scan.reserve_requested` | Camera/controller and command client; QR identifier rather than camera frame |
| `scan.reservation_committed`, `scan.reservation_conflict`, `scan.reservation_expired` | Session transaction; session/bin/version and reason |
| `scan.draft_selected`, `scan.draft_saved`, `scan.draft_conflict` | Picker/controller/backend; selected asset ID/version and draft/session revision |
| `inspection.submission_committed`, `inspection.submission_replayed` | Submission application; immutable input/policy/job identities |
| `dispatch.task_enqueued`, `dispatch.task_recovered`, `dispatch.enqueue_failed` | Outbox/Tasks adapter; job/task identity and dispatch state |
| `job.attempt_claimed`, `job.delivery_replayed`, `job.attempt_fenced` | Worker gateway; attempt/version/deadline and lease state |
| `vision.stage_started`, `vision.stage_completed`, `vision.stage_failed` | Pipeline stage boundary; model/stage version, latency, count and safe failure category |
| `vision.matching_completed` | Matching; raw counts per detector, groups, unmatched/rejected counts and config version |
| `vision.resolution_completed` | Resolution; accepted/excluded/unresolved/conflicting counts and applied rule IDs |
| `vision.fallback_started`, `vision.fallback_completed` | Crop/full-image path, candidate IDs, request count/usage and schema validity |
| `finalization.committed`, `finalization.replayed`, `finalization.stale_ignored` | Trusted finalizer; decision version, outcome, source attempt and ledger/posting IDs |
| `wallet.credit_committed`, `capacity.post_committed`, `capacity.correction_committed` | After successful transaction; delta, cycle, stable source and resulting version |
| `scan.session_completed`, `job.review_finalized` | Automatic completion/recovery; reason, result/ticket, matching reservation release |
| `reward.redemption_committed`, `reward.redemption_replayed`, `reward.redemption_rejected` | Reward service; offer version, amount and safe reason |
| `voucher.use_committed`, `voucher.use_replayed`, `voucher.expired` | Use/maintenance; voucher/event identity, no raw code |
| `notification.intent_created`, `notification.sent`, `notification.skipped`, `notification.retry_scheduled` | Notification outbox; event/recipient hash/platform and reason |
| `maintenance.cleanup_completed`, `maintenance.collection_committed` | Exact namespace/cycle, object counts/deltas and operation identity |

Keep names stable. Add an event only for a useful boundary or diagnosis. Tests should prove the most important events carry their required IDs, not assert every formatting detail.

## D5. Redaction and cost controls

Never log:

- Google/Firebase ID or refresh tokens, Authorization headers, provider API keys, signed URL query strings or FCM registration tokens.
- Email/full name, raw voucher code, private image bytes/base64 or full arbitrary request bodies.
- Evaluation expected answers in runtime engine logs/prompts.

Use stable owner hashing where owner-level correlation is necessary. Log an internal asset/path identifier or sanitized prefix, not an authorized download URL. Raw model outputs go to scoped artifacts; ordinary logs contain bounded summaries. Scrub third-party exception text before emitting it because URLs/errors may embed credentials.

Add tests with sentinel secrets in nested errors/URLs and assert they never appear. Live default logging is INFO; targeted DEBUG can be enabled for a bounded diagnostic run without changing business outcomes.

## D6. Per-run artifact bundle

For real probes/evaluation and diagnostically retained inspections, produce references such as:

```text
run-manifest.json             source digest, versions, timing, cost metadata
raw-model-a.json
raw-model-b.json
normalized-detections.json
matching-groups.json
matching-overlay.jpg
resolution-decisions.json
specialist-results.json       when used
gemini-results.json           when used; structured final output only
final-findings.json
```

Each object decision must identify source detections, matching rule/configuration and accepted/excluded/unresolved reasoning code. Preserve original boxes; derived/crop coordinates must identify their reference image. A model disagreement should be inspectable from one bundle.

These artifacts follow the specification's retention policy. Keep compact version/digest/decision metadata after raw cleanup and mark purged references honestly.

## D7. Required debugging tools

### Read-only state inspection

Implement `functions/tools/inspect.ts` with documented npm entry commands. Given a session/deposit/job ID, print a redacted timeline of session, job/attempts, batch decision, ledger/capacity entries, receipt/ticket, dispatch and notification intent states.

- Default to emulator mode; live reads require explicit verified environment/project arguments.
- Do not repair records, issue credits or replay mutations from this tool.
- Flag invariant mismatches such as a terminal verified batch without its credit, an already posted batch with another initial capacity entry, or an ended session retaining its reservation.

### Model-only replay

Implement `uv run python -m ecoloop_vision.tools.replay` with an image/manifest/config and output directory.

- Default has **no financial finalization** and no job-gateway completion callback.
- Reuse saved provider responses for deterministic matching/debugging where possible.
- Actual provider calls require explicit mode and are recorded as billable usage.
- Evaluation truth is read only after prediction, never passed into inference.

### Log queries

Example Cloud Logging filters, substituting actual IDs:

```text
jsonPayload.traceId="TRACE_ID"
jsonPayload.depositId="DEPOSIT_ID"
jsonPayload.jobId="JOB_ID" AND severity>=WARNING
jsonPayload.event="finalization.stale_ignored"
```

If the structured logger nests fields differently, record the actual filter once in the environment/runbook; do not leave examples that cannot find deployed logs.

## D8. Fast fault-localization table

| Symptom | First evidence to inspect | Likely boundary to verify |
| --- | --- | --- |
| QR accepted twice | reserve request IDs and active refs | Camera callback debounce, persistent intent and reservation transaction |
| No image choices | catalog query/error, environment, asset enabled/version | Owner rules/query/index and selected runtime; not inference |
| Wrong image after Continue | draft revisions, committed source digest | Out-of-order saves, submission expected version and immutable worker input |
| Identifying never finishes | job/dispatch/deadline/attempt timeline | Outbox delivery, IAM audience, worker startup, reconciler |
| Worker HTTP 403 | task identity/audience and actual service IAM | Confusing Firebase user tokens with Google service invocation |
| Raw detections correct, totals wrong | normalized boxes and groups overlay | Transform inversion, matching assignment, invalid-candidate filtering |
| Generic can incorrectly paid as aluminium | taxonomy/resolution rule IDs | Over-specific label mapping or unvalidated fallback acceptance |
| Wallet doubled | credit entries and finalization versions | Unique source key, transaction replay, stale attempt acceptance |
| Space doubled/old bin refilled | capacity entries and cycle IDs | Provisional posting versus correction, current-cycle guard |
| Cloud wallet correct, app shows mock 245/zero | app runtime/owner stream events | Composition override, hardcoded resident ID, stale provider/cache |
| Pending review leaves bin busy | finalization release fields | Matching reservation/active-reference transaction |
| Expired voucher still available | dynamic clock, tab query and server use result | Frozen May-2024 clock or reliance on delayed cron status |
| Web push missing/duplicated | token binding, permission, service-worker URL/scope | HTML returned for worker, wrong config/VAPID, duplicate registration/cache |
| Missing notification but correct points | outbox intent/send state | Post-commit dispatcher; never repeat the credit to resend push |

Use the cheapest faithful reproduction first: pure fixture -> emulator transaction -> app/emulator -> private cloud integration. Run the broader path only when needed to establish the cause.

## D9. Definition of traceability complete

For AC-04 and at least one review/failure case, QA can start with the app's request/receipt reference and locate:

1. UI intent and exact submitted image version.
2. Session, job and claimed attempt.
3. Raw/normalized model evidence and fusion rule.
4. Pinned policy and final decision version.
5. Exactly one capacity posting and any wallet credit.
6. Result/ticket and notification intent.

The relevant log query and readonly inspection command must be included in the evidence report. A collection of unrelated debug prints is not this milestone.
