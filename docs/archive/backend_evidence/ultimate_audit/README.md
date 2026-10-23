# Ultimate audit — reproducible evidence

**Parent:** [ECOLOOP-AUDIT-001](../../audits/ECOLOOP_ULTIMATE_BACKEND_AUDIT.md)

**Date/source:** 2026-10-20, revision `efa364a`, branch `dev`.

These are audit diagnostics, intentionally outside the ordinary regression suites. A diagnostic passing means it reproduced the documented behavior; it does **not** mean the application requirement passed. Update their expectations into proper regression assertions during the later refactor.

The backend diagnostic is emulator-only and refuses to run without `FIRESTORE_EMULATOR_HOST`; it uses only project `demo-ecoloop`. Use a fresh ephemeral emulator. It writes synthetic `audit-*` records and never connects to the live project. The transport diagnostic invokes exported handlers with synthetic callable requests and exits before business database reads. The vision diagnostic generates an image in memory and injects responses; it performs no paid inference. The Flutter diagnostic reuses test-only fake gateways and makes no live calls.

## Toolchain observed

- Node `22.23.3`
- Flutter `3.47.0`, Dart `3.13.0`
- uv `0.13.1`
- Java Microsoft OpenJDK `25.0.4.1`
- Windows PowerShell 5.1; `.cmd` shims were needed because the host blocks `.ps1` CLI launchers.

## Commands

Run separately from the stated directories. Build Functions first so diagnostics inspect freshly generated output.

### `../../../../functions`

```powershell
npm.cmd run build
npm.cmd run test:unit
node --max-old-space-size=128 ../docs/archive/backend_evidence/ultimate_audit/probe_transport.mjs
```

### Repository root

```powershell
$env:JAVA_TOOL_OPTIONS='-Xms64m -Xmx256m'
$env:NODE_OPTIONS='--max-old-space-size=256'
firebase.cmd emulators:exec --only firestore --project demo-ecoloop "node docs/archive/backend_evidence/ultimate_audit/probe_backend.mjs"
flutter analyze
flutter test docs/archive/backend_evidence/ultimate_audit/probe_flutter_test.dart --concurrency=1 --reporter=expanded
```

### `services/vision/`

```powershell
uv run --frozen pytest -q
$env:OPENBLAS_NUM_THREADS='1'
$env:OMP_NUM_THREADS='1'
uv run --frozen python ../../docs/archive/backend_evidence/ultimate_audit/probe_vision.py
```

The audit first executed these probes from the harness temporary directory, then retained the same probe logic here with repository-relative paths. **All four repository-path commands were rerun successfully:** transport failures matched the captured output, the emulator reproduced every listed accounting/provisioning state, vision output matched the JSON below, and Flutter reported 5/5 diagnostic tests passed. No production-source edits were made.

## Captured results

### Existing automated checks

| Check | Result |
| --- | --- |
| Functions build | Pass on isolated rerun |
| Functions unit tests | 20 passed / 10 files |
| Vision suite | 35 passed |
| Flutter analysis | No issues found |
| Five Flutter diagnostics | 5 passed, reproducing the five failures below |

Initial concurrent build/vision attempts, one `test:settlement` emulator attempt, one Flutter diagnostic load, and one vision diagnostic import failed due to memory/pagefile exhaustion. An OS snapshot showed about 0.74 GB free virtual memory. Successful isolated reruns establish the listed passes; the failed existing settlement invocation is not represented as passed.

### Exported transport handlers with the actual client envelope

```text
scanBinQr invalid-argument qrPayload is required
submitInspection invalid-argument sessionId is required
recoverOperation invalid-argument operationId is required
saveResidentPreferences invalid-argument preferences must contain boolean values
registerResidentDevice invalid-argument deviceId, platform and token are required
```

### Firestore emulator diagnostic

| Scenario | Observed state | Required state |
| --- | --- | --- |
| Mixed reference settlement | `verified`, 37 points, 61 spc returned; bin `occupiedSpc=10` | Bin opening 10 + contribution 61 = **71** |
| Accepted stats | `verifiedBatchCount=1`, `acceptedItemCount=6`; no per-material/class map | Accepted class/material counts sufficient for six items and 0.145 estimated kg |
| Accepted attempt | Still `state=claimed` | Terminal accepted/succeeded attempt linked to durable findings/artifacts |
| Review 30→28 | Returns 13 points/28 spc; bin stays 10; stats stay zero; version-2 notification absent | Coherent original-cycle correction, accepted stats and outcome/credit event |
| Deadline | Result review/0 spc; no capacity entry; session/reservation remain processing; active session reference remains | Pinned provisional contribution/marker, completed automatic session and guarded releases |
| Third execution failure, then reconcile | Job `failed`, deposit still `processing` | Terminal review with normal technical-settlement effects |
| Bootstrap identity | Stores requested `forged@example.invalid`; `claimWrites=0`; no top-level wallet | Auth-derived email, trusted missing-role assignment, one consistent wallet path |
| Scan while availability paused | Returns `binFound` | Explicit `processing_unavailable` before reservation |
| Task URL | Exactly the supplied service root | Authenticated task-handler route, separate service audience |
| Empty inventory with visible bottle | Accepted as empty/0 points/0 spc | Semantic contract rejection/review |
| Repeated same object ID | 2 items/10 points/20 spc | Duplicate candidate identity rejected |

### Synthetic vision/evaluation diagnostic

```json
{
  "no_proposals_without_fallback": "empty",
  "both_detectors_failed": "empty",
  "required_full_image_fallback_failed": "empty",
  "one_detector_failed_low_confidence": {
    "inventoryState": "resolved",
    "eligibility": "eligible",
    "confidence": 0.01,
    "outcomes": ["provider_error"]
  },
  "specialist_not_applied": {
    "specialistResults": 1,
    "resolution": "unknown",
    "eligibility": "unresolved"
  },
  "prompt_label_metal_can": "unresolved",
  "unbounded_fallback_count": {"status": "resolved", "count": 1000000},
  "multiple_objects_for_one_crop": {"status": "resolved", "findings": 2},
  "precision_with_one_correct_and_one_false_rewarded_object": 1.0
}
```

The required rewarded precision in that last case is 0.5; the diagnostic does not request materialization of the million-object response.

### Flutter diagnostics

1. Actual account writer shape is rejected by `ResidentProfile.fromJson`.
2. Actual initial processing result shape is rejected by `BackendScanMapper`.
3. A `paper_bag` line serializes back as `paper_item`.
4. Auth subscription created after sign-in receives no current ready state within 100 ms.
5. A callable `permission-denied` becomes retryable `unavailable`.

## Read-only live inventory

Commands executed against the existing project:

```powershell
firebase.cmd functions:list --project ecoloop-thesmartrecycling --json
gcloud.cmd firestore databases list --project=ecoloop-thesmartrecycling --format="table(name,locationId,type)"
gcloud.cmd run services describe ecoloop-vision --project=ecoloop-thesmartrecycling --region=asia-southeast1 --format="yaml(status.url,status.latestReadyRevisionName,spec.template.spec.serviceAccountName,spec.template.spec.containers,spec.template.metadata.annotations,metadata.annotations)"
gcloud.cmd tasks queues describe vision-processing --location=asia-southeast1 --project=ecoloop-thesmartrecycling --format="yaml(name,state,rateLimits,retryConfig)"
gcloud.cmd run services get-iam-policy ecoloop-vision --project=ecoloop-thesmartrecycling --region=asia-southeast1 --format="yaml(bindings)"
gcloud.cmd firestore indexes composite list --database=ecoloop-db --project=ecoloop-thesmartrecycling --format="table(name.basename(),collectionGroup,fields,state)"
```

Compact observations:

- Only Firestore `ecoloop-db`, region `asia-southeast1`, was listed.
- All listed resident callables and `workerGateway` were active in `us-central1`; four scheduled handlers were in `asia-southeast1`.
- Function runtime configuration used `ecoloop-db`, worker root URL/audience, and placeholder worker subject/issuer `worker-service`/`trusted-issuer`.
- Cloud Run latest ready revision was `ecoloop-vision-00004-wgj`, image `asia-southeast1-docker.pkg.dev/ecoloop-thesmartrecycling/ecoloop/vision:21fbb5fa3e28`.
- Cloud Run env exposed only model ID and secret references; no provider secret value was requested or recorded. Gateway/source/artifact-bucket settings were absent.
- Cloud Run ingress was `all`; IAM invokers were the task service account and authorized operator, with no `allUsers` grant. Service max-scale was 1 while template max-scale was 10.
- Tasks queue was running with concurrency 1, max attempts 3, max retry duration 300 seconds and backoff 5–30 seconds. This is configuration evidence, not a successful resident task trace.
- Seven deployed composite indexes were listed; the checked-in index contract remains out of alignment with the implemented resident queries.

No actual user documents, balances, provider secret values, Auth sessions, or model prediction requests were inspected by these inventory commands.
