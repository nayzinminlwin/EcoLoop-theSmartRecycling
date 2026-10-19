# Phase 4 Gap — BK-P04-D Cloud Tasks Production Delivery

**Captured:** 2026-10-19 12:30 +08:00  
**Unit:** BK-P04-D — Cloud Tasks dispatcher and outbox repair  
**Project:** `ecoloop-thesmartrecycling` (`353725053297`)  
**Region:** `asia-southeast1`  
**Dispatcher:** `dispatchPendingJobs`  
**Cloud Run service:** `ecoloop-vision`  
**Cloud Run URL:** `https://ecoloop-vision-tl2e2dp5xq-as.a.run.app`

## Executive summary

The deployment and configuration portion of BK-P04-D is complete. The local
build, unit/emulator tests, Firebase Functions deployment, Cloud Scheduler
deployment, Cloud Tasks queue, service-account permissions, private Cloud Run
IAM policy, and dispatcher runtime configuration are present and verified.

The production delivery gate is not fully complete because no real pending
inspection job was available during this verification. Therefore, no
production Cloud Tasks delivery, OIDC worker request, worker claim, or shared
job/trace log can be claimed yet.

**Checklist result:**

- **11 of 16 items fully verified**
- **1 item verified in emulator only**
- **4 items pending real production delivery evidence**

## Checklist

| # | Requirement | Status | Evidence |
|---:|---|:---:|---|
| 1 | Cloud Run service is deployed in `asia-southeast1` | ✅ Verified | `ecoloop-vision` is deployed in `asia-southeast1`; URL is recorded above. |
| 2 | Cloud Run has no public `allUsers` invoker | ✅ Verified | IAM contains the operator user and task service account only; no `allUsers` binding. |
| 3 | `ecoloop-tasks@...` has `roles/run.invoker` | ✅ Verified | `ecoloop-tasks@ecoloop-thesmartrecycling.iam.gserviceaccount.com` is bound on `ecoloop-vision`. |
| 4 | Cloud Tasks API is enabled | ✅ Verified | `cloudtasks.googleapis.com` is enabled in the project. |
| 5 | Queue `vision-processing` exists in the same region | ✅ Verified | Queue exists at `asia-southeast1/vision-processing`. |
| 6 | Queue concurrency is `1` | ✅ Verified | `maxConcurrentDispatches: 1`. |
| 7 | Queue attempts/backoff fit the five-minute budget | ✅ Verified | Maximum attempts `3`, retry duration `300s`, minimum backoff `5s`, maximum backoff `30s`. |
| 8 | Firebase Functions runtime has the five dispatcher variables | ✅ Verified | Deployed function contains queue, region, Cloud Run URL, audience, and task-invoker account configuration. |
| 9 | Firebase Functions runtime has `roles/cloudtasks.enqueuer` | ✅ Verified | `353725053297-compute@developer.gserviceaccount.com` has `roles/cloudtasks.enqueuer`. |
| 10 | Cloud Tasks OIDC audience equals the actual private Cloud Run URL | ✅ Configured | Both `ECOLOOP_WORKER_SERVICE_URL` and `ECOLOOP_WORKER_AUDIENCE` equal the deployed Cloud Run URL. |
| 11 | A real pending job is dispatched | ⛔ Pending | No real production `inferenceJobs/{jobId}` was available; no production task was fabricated. |
| 12 | Cloud Run receives the task | ⛔ Pending | Requires item 11 and a real Cloud Tasks delivery log. |
| 13 | Cloud Run accepts the OIDC identity | ⛔ Pending | IAM and OIDC configuration are present, but no real task request has been observed. |
| 14 | Worker claim succeeds through the private gateway | ⚠️ Emulator only | Fenced claim and identity validation pass in BK-P04-C emulator tests; production claim awaits item 11. |
| 15 | Logs contain a shared job/trace identity | ⛔ Pending | Requires a real dispatched job and task/worker logs containing its job and trace IDs. |
| 16 | Duplicate task creation repairs metadata without a second business submission | ⚠️ Emulator verified | BK-P04-D outbox emulator test covers `ALREADY_EXISTS` recovery; production replay evidence remains pending. |

## Verified deployment state

### Cloud Run

- Service: `ecoloop-vision`
- Region: `asia-southeast1`
- URL: `https://ecoloop-vision-tl2e2dp5xq-as.a.run.app`
- Container concurrency: `1`
- No `allUsers` invoker binding
- Task invoker:
  `ecoloop-tasks@ecoloop-thesmartrecycling.iam.gserviceaccount.com`

### Cloud Tasks

- Queue: `vision-processing`
- Resource:
  `projects/ecoloop-thesmartrecycling/locations/asia-southeast1/queues/vision-processing`
- State: `RUNNING`
- Maximum concurrent dispatches: `1`
- Maximum attempts: `3`
- Retry duration: `300s`
- Minimum backoff: `5s`
- Maximum backoff: `30s`

### Firebase Functions

- Function: `dispatchPendingJobs`
- State: `ACTIVE`
- Region: `asia-southeast1`
- Schedule: every minute
- Scheduler state: `ENABLED`
- Firestore database: `ecoloop-db`
- Runtime service account:
  `353725053297-compute@developer.gserviceaccount.com`
- Enqueue role: `roles/cloudtasks.enqueuer`

The production function initially returned Firestore `NOT_FOUND` because the
composition root opened the default database while this project uses the named
database `ecoloop-db`. The composition root was corrected, the function was
redeployed, and no new dispatcher errors appeared after the corrected revision.

## Local implementation evidence

The following gates passed before deployment:

- `npm run build`
- `npm run test:unit` — 11 tests
- `npm run test:dispatch` — 1 test
- `npm run test:outbox` — 3 emulator tests
- `npm run test:sessions` — 5 emulator tests
- `npm run test:submission` — 4 emulator tests
- `npm run test:jobs` — 4 emulator tests

The outbox tests cover:

1. Deterministic task identity and one dispatch metadata update.
2. Enqueue-success/metadata-loss recovery through `ALREADY_EXISTS`.
3. Cloud Tasks outage preserving `dispatchState: "pending"`.

## Remaining production verification procedure

Use one genuine resident inspection submission; do not manually create a
business job or modify production job state to simulate one.

1. Submit an inspection through the real resident flow.
2. Confirm the resulting `inferenceJobs/{jobId}` document starts with:
   - `state: "queued"`
   - `dispatchState: "pending"`
   - a five-minute `deadlineAt`
   - a `traceId`
3. Run or wait for `dispatchPendingJobs`.
4. Confirm the job changes to `dispatchState: "dispatched"` and records:
   - deterministic `taskName`
   - `dispatchedAt`
   - `dispatchAttempts`
5. Confirm the deterministic task appears in `vision-processing`.
6. Confirm `ecoloop-vision` receives the request through the task OIDC identity.
7. Confirm the worker retrieves the committed job and reaches the private
   gateway claim operation.
8. Correlate the job ID and trace ID across Functions, Cloud Tasks, Cloud Run,
   and worker logs.
9. For duplicate recovery, reproduce an interrupted metadata update or use a
   controlled fault-injection harness. Confirm the same task name is recovered
   and no second business submission is created.

## Related implementation

- [Cloud Tasks dispatcher](../../functions/src/infrastructure/cloud_tasks.ts)
- [Scheduled dispatcher transport](../../functions/src/transport/dispatch.ts)
- [Outbox emulator tests](../../functions/tests/emulator/outbox.test.ts)
- [Dispatch unit tests](../../functions/tests/unit/dispatch.test.ts)
- [BK-P04-D development log](../dev_logs/2026-10-19_Backend_BK-P04-D_Dispatch.md)
- [BK-P04-D tracker entry](../backend_plan/EXECUTION_TRACKER.md)

