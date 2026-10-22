# H2 Cloud Handoff

**Captured:** 2026-10-20  
**Phase:** H2 — Console/provider/infrastructure handoff  
**Status:** BLOCKED — CLI-verifiable checks completed; durable transport proof is still unavailable

## Scope

- Project: `ecoloop-thesmartrecycling`
- Project number: `353725053297`
- Firestore database: `ecoloop-db`
- Firestore location/type: `asia-southeast1` / `FIRESTORE_NATIVE`
- Resident/gateway region: `us-central1`
- Vision/Tasks region: `asia-southeast1`
- Presentation platform: Android debug sideload
- Web presentation: out of scope per H1
- Android App Check enforcement: not enabled per H1
- Billing: enabled

No provider secret values, access tokens, signed URLs, or voucher contents are recorded here.

## Public runtime configuration

Verified from the deployed `workergateway` and `ecoloop-vision` services:

| Key | Verified value |
| --- | --- |
| `ECOLOOP_TASKS_REGION` | `asia-southeast1` |
| `ECOLOOP_FIRESTORE_DATABASE` | `ecoloop-db` |
| `ECOLOOP_TASKS_QUEUE` | `vision-processing` |
| `ECOLOOP_WORKER_SERVICE_URL` | `https://workergateway-tl2e2dp5xq-uc.a.run.app` |
| `ECOLOOP_WORKER_AUDIENCE` | `https://workergateway-tl2e2dp5xq-uc.a.run.app` |
| `ECOLOOP_VISION_TASK_URL` | `https://ecoloop-vision-tl2e2dp5xq-as.a.run.app/tasks/vision` |
| `ECOLOOP_VISION_SERVICE_AUDIENCE` | `https://ecoloop-vision-tl2e2dp5xq-as.a.run.app` |
| `ECOLOOP_INSPECTION_CONFIGURATION` | `demo-vision-v1` |
| `ECOLOOP_WORKER_SUBJECT` | `108247433586763841561` |
| `ECOLOOP_WORKER_ISSUER` | `https://accounts.google.com` |
| Source bucket | `ecoloop-thesmartrecycling.firebasestorage.app` |
| Artifact bucket | `ecoloop-thesmartrecycling-vision-artifacts` |
| Gemini model | `gemini-3.8-flash` |
| Vision service | `ecoloop-vision` |
| Gateway service | `workergateway` |

The repository environment contract contains all required key names. Secret values are not in the evidence.

## Secret Manager

| Resource | Enabled versions |
| --- | --- |
| `roboflow-api-key` | `1`, `2` |
| `gemini-api-key` | `1`, `2` |

The Vision revision references both resources through managed Secret Manager bindings using `latest`. No downloaded service-account key was used.

## Deployed identities and revisions

- Vision runtime identity:
  `ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com`
- Task invoker identity:
  `ecoloop-tasks@ecoloop-thesmartrecycling.iam.gserviceaccount.com`
- Gateway runtime identity:
  `353725053297-compute@developer.gserviceaccount.com`
- Current ready Vision revision:
  `ecoloop-vision-00008-7cs`
- Current ready Vision image:
  `sha256:1c0b53f5a31cb60327bb3f311fd4ae93f878843ff260b97eeb6c4a22e32a83ab`
- Current ready gateway revision:
  `workergateway-00010-tom`
- Current ready gateway image:
  `sha256:9db9ab3e43e18ef6885b0fa7d6bfe4bf3ee7beb974644e9623d83a565c8df5f0`

Both current revisions report `Ready=True`.

## Queue and scheduled infrastructure

The `vision-processing` queue is `RUNNING` in `asia-southeast1` with:

- maximum concurrent dispatches: `1`;
- maximum attempts: `3`;
- retry duration: `300s`;
- minimum backoff: `5s`;
- maximum backoff: `30s`.

The deployed scheduled jobs are enabled. Daily maintenance uses `Asia/Kuala_Lumpur`; the one-minute reconciliation/dispatch jobs use the deployed `UTC` schedule and are not changed by this handoff.

## IAM and ingress observations

Verified:

- Cloud Tasks has `roles/run.invoker` on the Vision service.
- The Vision runtime has `roles/storage.objectAdmin` on the artifact bucket.
- The Vision service ingress is `internal-and-cloud-load-balancing`.
- The gateway ingress is `all`.
- The gateway Cloud Run IAM policy includes `allUsers` as `roles/run.invoker`.
- The application gateway still rejects requests without an Authorization header; a no-token POST returned HTTP `401`.

The public gateway invoker binding and artifact `objectAdmin` grant are recorded as findings, not silently treated as least-privilege proof. The H2 checklist requires intentional confirmation or a later scoped correction.

## Provider verification

A3 recorded a real-pixel provider smoke for detector A, detector B, specialist D, and `gemini-3.8-flash`. The deployed revision has the required provider secret bindings and model/bucket configuration. This remains provider-access evidence, not a settlement or accuracy claim.

No model training, labeling, dataset upload, or accuracy claim was performed.

## Preflight and durable transport status

| Check | Result |
| --- | --- |
| Project/API/billing access | PASS |
| Named Firestore database | PASS |
| Secret resources and enabled versions | PASS |
| Vision/Gateway ready revisions | PASS |
| Queue configuration | PASS |
| Runtime key contract | PASS |
| Unauthenticated gateway rejection | PASS — HTTP `401` |
| Exact Tasks service-account OIDC invocation | BLOCKED — current CLI cannot impersonate `ecoloop-tasks` |
| Direct private Vision probe | BLOCKED — private ingress is not reachable from this workstation |
| Private source read | NOT CAPTURED |
| Durable artifact write | NOT CAPTURED |
| Real Tasks delivery | NOT CAPTURED |
| Settlement/result trace | NOT CAPTURED |
| Fresh-user Android transaction | NOT CAPTURED |

No safe `traceId`, `jobId`, `attemptId`, `artifactReference`, or terminal settlement ID is claimed by this handoff.

## Commands used

The following read-only checks completed successfully, with outputs reviewed for secrets:

```text
gcloud projects describe ecoloop-thesmartrecycling
gcloud services list --enabled --project=ecoloop-thesmartrecycling
gcloud billing projects describe ecoloop-thesmartrecycling
gcloud secrets list --project=ecoloop-thesmartrecycling
gcloud secrets versions list roboflow-api-key --project=ecoloop-thesmartrecycling
gcloud secrets versions list gemini-api-key --project=ecoloop-thesmartrecycling
gcloud firestore databases list --project=ecoloop-thesmartrecycling
gcloud run services describe ...
gcloud run services get-iam-policy ...
gcloud tasks queues describe ...
gcloud scheduler jobs list ...
gcloud storage buckets describe ...
gcloud storage buckets get-iam-policy ...
```

The exact OIDC preflight attempt could not mint a token because the active CLI principal lacks impersonation permission for the task service account. The failed attempt did not expose a token or secret.

## Remaining blockers

1. The developer must provide or authorize a safe way to mint an OIDC token as the configured Tasks identity, or run the exact signed preflight from an approved same-project execution context.
2. A genuine seeded-image or device submission must be run so the private source read, durable artifact write, Cloud Tasks delivery, and settlement/review result can be captured.
3. The developer must explicitly confirm whether the public gateway invoker binding and artifact `objectAdmin` grant are accepted for this demo or should be narrowed before A4.
4. Android device observations remain unperformed in this CLI session: QR scan, Continue/submission, and visible terminal result.

## H2 decision

**BLOCKED. Do not mark H2 complete or advance to A4 until the durable transport trace and the IAM/ingress decisions above are resolved.**
