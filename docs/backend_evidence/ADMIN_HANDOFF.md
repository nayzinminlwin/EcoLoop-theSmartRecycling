# EcoLoop backend operator handoff

**Release candidate:** `22bf7d5b10c5a1bf4985840638cb153261d22a5c`
**Unit:** BK-P08-B
**Status:** Handoff prepared; production rehearsal remains blocked

## Verified resource manifest

| Resource | Value |
|---|---|
| Firebase project | `ecoloop-thesmartrecycling` (`353725053297`) |
| Firestore database / region | `ecoloop-db` / `asia-southeast1` |
| Storage bucket | `ecoloop-thesmartrecycling.firebasestorage.app` |
| Hosting site | `ecoloop-thesmartrecycling` |
| Hosting URL | `https://ecoloop-thesmartrecycling.web.app` |
| Cloud Run service / region | `ecoloop-vision` / `asia-southeast1` |
| Current deployed revision | `ecoloop-vision-00004-wgj` |
| Current deployed URL | `https://ecoloop-vision-tl2e2dp5xq-as.a.run.app` |
| Current deployed image | `asia-southeast1-docker.pkg.dev/ecoloop-thesmartrecycling/ecoloop/vision:21fbb5fa3e28` |
| Recorded deployed digest | `sha256:b609f35ae57be187a0375950649150ebb46ab43f6ed13aaa836ebe7be90b41aa` |
| Runtime identity | `ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com` |
| Queue | `vision-processing` in `asia-southeast1` |
| Task identity | `ecoloop-tasks@ecoloop-thesmartrecycling.iam.gserviceaccount.com` |

The deployed image is explicitly identified as **not current-release evidence** until BK-P08-A deployment is rerun from the release commit and its digest is captured.

## Release identity and digests

| Input | SHA-256 |
|---|---|
| `pubspec.lock` | `4f6961ab28aef4e479574e58619160400aff89e91ee3b14fcbf40e52f51d543c` |
| `functions/package-lock.json` | `48332886c2307f4e095a364866a4a62dd66e0c5e9a16403bd2a834dc82b306f8` |
| `services/vision/uv.lock` | `746fe5c7f58d3bf2205ad4b6da1d00d4e4eefd05697fb4e25e533ff74df5ecee |
| `services/vision/model_registry.json` | `4adacdbdeba1a5b08c981378133147a9358f403a02845907716fd2fe395dfbca` |
| `contracts/backend` bundle | `0688afec0aabb39781454eee38b9036c4188ef49b443b66c7471370b020b1a15` |
| `firestore.rules` | `2184051cb55480801957c7b5dd0ba8d7e6c2cfc397e3d0f4e593ce75e37d40bb` |
| `storage.rules` | `afed0112204cad566891a9d55ab13c7e5ee3ae25a4e8400c97564a0841c76f3f |
| `firestore.indexes.json` | `5edd760c5645becfec43e68bc4a4cfefc87ca865b6d5a62a74f9be3073f27bd3` |
| `firebase.json` | `568c77c40c173583097979e3962d12be262b6f3a2365125e0cf46fb8f10413f3` |

No secret values are part of this manifest. The Functions environment file contains only non-secret routing/configuration values and references the private worker URL/audience.

## Schedules and operational controls

- `dispatchPendingJobs`: every 1 minute, `asia-southeast1`, 60 seconds, 256 MiB.
- `dispatchPendingNotifications`: every 1 minute, `asia-southeast1`, 60 seconds, 256 MiB.
- `reconcileBackendState`: every 1 minute, `asia-southeast1`, 60 seconds, 256 MiB.
- `runDailyMaintenance`: `0 3 * * *`, `Asia/Kuala_Lumpur`, 120 seconds, 256 MiB.
- Cloud Run: 2 vCPU, 4 GiB, concurrency 1, max instances 1, 300-second timeout, private ingress.
- Cloud Tasks: max concurrent dispatches 1, max attempts 3, retry duration 300 seconds, backoff 5–30 seconds.

## Trace inspection and replay

Use only an approved operator identity and never paste tokens or image/provider secrets into logs.

1. Start with a known identifier from the resident response envelope: `traceId`, `requestId`, `sessionId`, `batchId`, `jobId`, or `depositId`.
2. Inspect the backend projection without broad collection scans:

```powershell
npm --prefix functions run inspect -- --project=ecoloop-thesmartrecycling --environment=live --job-id=<jobId> --limit=50
npm --prefix functions run inspect -- --project=ecoloop-thesmartrecycling --environment=live --session-id=<sessionId> --limit=50
npm --prefix functions run inspect -- --project=ecoloop-thesmartrecycling --environment=live --batch-id=<batchId> --limit=50
npm --prefix functions run inspect -- --project=ecoloop-thesmartrecycling --environment=live --resident-id=<uid> --limit=50
```

3. Search Cloud Logging by exact structured fields and a bounded time window:

```powershell
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="ecoloop-vision" AND jsonPayload.traceId="<traceId>"' --project=ecoloop-thesmartrecycling --freshness=1h --limit=50 --format=json
gcloud logging read 'resource.type="cloud_function" AND jsonPayload.requestId="<requestId>"' --project=ecoloop-thesmartrecycling --freshness=1h --limit=50 --format=json
```

4. Replay only a persisted operation using its original `requestId`; do not create a new request identity after an ambiguous transport result. Confirm the result projection and idempotency state before retrying.
5. For a failed Cloud Tasks delivery, inspect the queue and task name derived from `jobId`; do not invoke the private worker URL directly as a resident client.

## Known limitations and next operator action

- BK-P08-B full-scope rehearsal is blocked; see [ACCEPTANCE.md](ACCEPTANCE.md).
- Frozen CV accuracy and cost targets remain blocked; see [CV_EVALUATION.md](CV_EVALUATION.md) and [COST_AND_LATENCY.md](COST_AND_LATENCY.md).
- Android release artifact identity was not captured because the local build hit paging-file exhaustion.
- App Check production attestation and real push delivery still require live verification.
- Later admin approval/collection transport is not part of this resident release; the tested domain contract and operator inspection harness do not authorize direct admin mutation.
