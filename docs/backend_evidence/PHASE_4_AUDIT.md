# Phase 4 Audit — Durable State, Accounting, and Recycling Vertical Slice

**Captured:** 2026-10-19 14:00 +08:00
**Source of truth:** `docs/backend_plan/PHASES_03_04_RECYCLING.md`
**Protocol:** `docs/backend_plan/EXECUTION_PROTOCOL.md`
**Phase:** P04 — Durable state, accounting, and full existing Flutter flow
**Milestone:** M4
**Repository revision:** `9f93a01`
**Firebase project:** `ecoloop-thesmartrecycling` (`353725053297`)
**Firestore database:** `ecoloop-db`
**Region:** `asia-southeast1`

## Executive conclusion

Phase 4 is implemented across BK-P04-A through BK-P04-L, with focused
automated evidence recorded for every unit. The local backend, emulator,
Python, Flutter, adapter, navigation, and recovery gates pass according to the
unit logs and tracker.

Phase 4 is **not fully accepted as a production milestone yet**. The remaining
gap is end-to-end production delivery evidence: a genuine resident submission
must travel through Firebase Functions, Cloud Tasks, private Cloud Run, the
authenticated worker gateway, and durable settlement, with correlated job and
trace logs. That evidence was deliberately not fabricated.

### Phase status

| Area | Status | Assessment |
|---|---|---|
| BK-P04-A through BK-P04-C backend state and worker contracts | ✅ Implemented and locally verified | Emulator and unit evidence exists for session, submission, fencing, and recovery behavior. |
| BK-P04-D deployment configuration and outbox repair | ⚠️ Implemented; production delivery gate open | Cloud resources/configuration are present; no genuine pending production job was available for delivery verification. |
| BK-P04-E through BK-P04-F settlement and Python worker integration | ⚠️ Implemented; live boundary evidence open | Local/emulator/Python evidence exists; private Tasks → Cloud Run → gateway → settlement has not been observed end to end. |
| BK-P04-G through BK-P04-I2 compatibility, read models, and gateway | ✅ Verified locally | Flutter analysis, adapter tests, model tests, and affected regressions pass. |
| BK-P04-J through BK-P04-L camera, atomic UI, lifecycle, and recovery | ✅ Verified locally | Widget, full scan-flow, routing, recovery, and pending-operation tests pass; real platform/runtime evidence remains unavailable. |
| M4 production acceptance | ⛔ Pending | Requires the real delivery and durable-processing trace bundle described below. |

## Unit audit

| Unit | Requirement area | Status | Evidence and remaining concern |
|---|---|---|---|
| BK-P04-A | Session/reservation transitions | ✅ VERIFIED | [A dev log](../dev_logs/2026-10-19_Backend_BK-P04-A_Sessions.md); session emulator and unit gates passed. Covers atomic QR reservation, exclusivity, version/owner fencing, renewal, cancellation, and operation recovery. |
| BK-P04-B | Immutable submission and durable dispatch intent | ✅ VERIFIED | [B dev log](../dev_logs/2026-10-19_Backend_BK-P04-B_Submission.md); submission emulator and unit gates passed. Covers immutable asset/policy/cycle pinning, deadline, trace, deterministic identity, and actor-scoped recovery. |
| BK-P04-C | Fenced worker gateway | ✅ VERIFIED | [C dev log](../dev_logs/2026-10-19_Backend_BK-P04-C_WorkerGateway.md); worker emulator and unit gates passed. Covers identity, attempt limits, leases, checkpoints, stale/expired attempts, and finalized-result reuse. |
| BK-P04-D | Cloud Tasks dispatcher/outbox repair | ⚠️ IMPLEMENTED | [D dev log](../dev_logs/2026-10-19_Backend_BK-P04-D_Dispatch.md); deployment resources and outbox tests pass. Live task delivery remains open. |
| BK-P04-E | Atomic settlement/review/capacity | ⚠️ IMPLEMENTED | [E dev log](../dev_logs/2026-10-19_Backend_BK-P04-E_Settlement.md); settlement emulator and unit gates pass. Production settlement through the real worker path remains open. |
| BK-P04-F | Python job runner and narrow integration | ⚠️ IMPLEMENTED | [F dev log](../dev_logs/2026-10-19_Backend_BK-P04-F_JobRunner.md); 32 vision tests pass, including gateway, artifacts, deadlines, and ambiguous completion. Live private task delivery remains open. |
| BK-P04-G | Enum compatibility | ✅ VERIFIED | [G dev log](../dev_logs/2026-10-19_Backend_BK-P04-G_EnumCompatibility.md); analysis and affected activity/scan tests pass. |
| BK-P04-H | Batch lines, nullable quantities, accepted-only impact | ✅ VERIFIED | [H dev log](../dev_logs/2026-10-19_Backend_BK-P04-H_BatchLines.md); model/activity/scan tests and analysis pass. |
| BK-P04-I1 | Session/bin/asset read models | ✅ VERIFIED | [I1 dev log](../dev_logs/2026-10-19_Backend_BK-P04-I1_ReadModels.md); model and scan regressions pass. |
| BK-P04-I2 | Firebase scan gateway/mapper | ✅ VERIFIED | [I2 dev log](../dev_logs/2026-10-19_Backend_BK-P04-I2_ScanGateway.md); callable/read/watch adapter tests and regressions pass. |
| BK-P04-J | Controlled camera and asset picker | ✅ VERIFIED locally | [J dev log](../dev_logs/2026-10-19_Backend_BK-P04-J_CapturePicker.md); duplicate capture, permission, disposal, and selection tests pass. Real platform permission evidence remains a later platform gate. |
| BK-P04-K | Atomic production scan interface/UI cutover | ✅ VERIFIED locally | [K dev log](../dev_logs/2026-10-19_Backend_BK-P04-K_AtomicScanCutover.md); atomic QR, stable request identity, asset selection, server-owned processing, and affected regressions pass. The specified real Storage image through Cloud Run trace is not present. |
| BK-P04-L | Lease, navigation, and reopen recovery | ✅ VERIFIED locally | [L dev log](../dev_logs/2026-10-19_Backend_BK-P04-L_Recovery.md); full scan suite, recovery/controller, router, and pending-operation tests pass. No connected Flutter app was available for hot restart or live reopen testing. |

## Deployment and delivery gate

This is the corrected checklist for the deployment and delivery requirements
that were previously recorded only under BK-P04-D.

| # | Requirement | Status | Evidence / interpretation |
|---:|---|---|---|
| 1 | Cloud Run service is deployed in `asia-southeast1` | ✅ Verified | `ecoloop-vision` is deployed in the required region. |
| 2 | Cloud Run has no public `allUsers` invoker | ✅ Verified | The recorded IAM policy has no `allUsers` invoker binding. |
| 3 | `ecoloop-tasks@...` has `roles/run.invoker` | ✅ Verified | The task service account is bound on `ecoloop-vision`. |
| 4 | Cloud Tasks API is enabled | ✅ Verified | `cloudtasks.googleapis.com` is enabled. |
| 5 | Queue `vision-processing` exists in the same region | ✅ Verified | Queue exists in `asia-southeast1`. |
| 6 | Queue concurrency is `1` | ✅ Verified | Queue configuration records `maxConcurrentDispatches: 1`. |
| 7 | Queue attempts/backoff fit the five-minute budget | ✅ Verified | Maximum attempts `3`, retry duration `300s`, minimum backoff `5s`, maximum backoff `30s`. |
| 8 | Firebase Functions runtime has the five dispatcher variables | ✅ Verified | Queue, region, Cloud Run URL, audience, and task-invoker account are configured in the deployed dispatcher. |
| 9 | Firebase Functions runtime has `roles/cloudtasks.enqueuer` | ✅ Verified | The deployed Functions runtime service account has the enqueue role. |
| 10 | Cloud Tasks OIDC audience equals the actual private Cloud Run URL | ⚠️ Configured, not delivery-verified | The configured service URL and audience equal the recorded private URL. A real OIDC task request has not yet been observed. |
| 11 | A real pending job is dispatched | ⛔ Pending | No genuine production `inferenceJobs/{jobId}` was available during the audit; no production job was fabricated. |
| 12 | Cloud Run receives the task | ⛔ Pending | Requires item 11 and a real task delivery log. |
| 13 | Cloud Run accepts the OIDC identity | ⛔ Pending | IAM/OIDC configuration is present, but no real authenticated task request has been observed. |
| 14 | Worker claim succeeds through the private gateway | ⚠️ Emulator only | Fenced identity/claim tests pass; production claim evidence requires item 11. |
| 15 | Logs contain a shared job/trace identity | ⛔ Pending | Requires correlated Functions, Cloud Tasks, Cloud Run, worker, and settlement logs for one real job. |
| 16 | Duplicate task creation recovers metadata without a second business submission | ⚠️ Emulator verified | `ALREADY_EXISTS` outbox recovery is covered by emulator tests; production replay evidence remains pending. |

### Corrected count

- **9 of 16 fully verified from deployment/resource evidence**
- **1 of 16 configured but not delivery-verified**
- **2 of 16 verified in emulator only**
- **4 of 16 pending real production evidence**

The previous audit’s “11 of 16 fully verified” statement was not sufficiently
strict because it counted configuration/emulator evidence as full production
delivery verification.

## Phase 4 requirement coverage

The implementation aligns with the plan in the following ways:

- Backend state transitions use owner, reservation, version, operation, and
  deadline fencing.
- Submission creates one durable business operation and keeps external queue
  work outside the transaction.
- Worker attempts are authenticated, bounded, leased, and artifact-scoped.
- Outbox dispatch uses deterministic task identity and repairs known duplicate
  task creation rather than creating another business submission.
- Settlement is atomic and distinguishes accepted, excluded, unresolved,
  empty, review, and zero-credit outcomes.
- Flutter read models preserve backend versions, nullable quantities, result
  references, job metadata, and review/receipt states.
- The Firebase scan journey uses atomic QR submission, durable request identity,
  versioned asset selection, server-owned processing, and result watchers.
- Navigation preserves deep links and cancellation guards; stale snapshots do
  not move the active journey backward.
- Lease renewal is limited to the visible foreground pre-submission journey and
  stops on background, offstage navigation, sign-out, ownership change,
  cancellation, or completion.
- Mock-only client completion remains available for deterministic mock
  regression flows but Firebase implementations reject client-side completion.

## Outstanding Phase 4 acceptance work

1. Use the real resident flow to create a genuine pending inspection job with a
   real Storage image.
2. Capture the job’s `jobId`, `batchId`, `resultId`, `traceId`, deadline, and
   deterministic task name.
3. Confirm dispatch metadata, queue presence, private Cloud Run receipt, OIDC
   acceptance, gateway claim, artifact/checkpoint activity, and settlement.
4. Correlate one shared job/trace identity across Functions, Cloud Tasks,
   Cloud Run, worker, and Firestore settlement logs.
5. Repeat or fault-inject dispatch metadata loss to demonstrate duplicate task
   recovery without another business submission.
6. Exercise real app reopen/account-switch/background behavior when a Flutter
   application and authenticated Firebase runtime are available.
7. Capture the required AC-04 trace bundle and a review-case trace before
   upgrading the phase from locally verified to production-complete.

## Related evidence

- [Execution tracker](../backend_plan/EXECUTION_TRACKER.md)
- [BK-P04-D dev log](../dev_logs/2026-10-19_Backend_BK-P04-D_Dispatch.md)
- [BK-P04-D deployment configuration commit](../../c78eaad)
- [BK-P04-A through BK-P04-L dev logs](../dev_logs/)
- [Phase 3 gap/remediation context](../backend_plan/PHASE_3_GAP_REMEDIATION_PLAN.md)
