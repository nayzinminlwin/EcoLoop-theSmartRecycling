# BK-P00-C Cloud Run Deployment Evidence

> This document records the historical BK-P00-C probe. The BK-P08-B release manifest and rehearsal status are in [ADMIN_HANDOFF.md](ADMIN_HANDOFF.md) and [ACCEPTANCE.md](ACCEPTANCE.md). The deployment recorded below is not current-release evidence.

**Captured:** 2026-10-18
**Unit:** BK-P00-C — Private Cloud Run packaging and cold/warm probe
**Role:** Integration executor
**Project:** `ecoloop-thesmartrecycling` (`353725053297`)
**Region:** `asia-southeast1`
**Service:** `ecoloop-vision`
**Service URL:** `https://ecoloop-vision-tl2e2dp5xq-as.a.run.app`
**Final revision:** `ecoloop-vision-00004-wgj`
**Final image digest:** `sha256:b609f35ae57be187a0375950649150ebb46ab43f6ed13aaa836ebe7be90b41aa`

## Package and deployment

The image contains orchestration code and provider SDKs only. It contains no model weights. The root-context build uses [vision.gcloudignore](../../infra/vision.gcloudignore), [cloudbuild.vision.yaml](../../infra/cloudbuild.vision.yaml), and [Dockerfile](../../services/vision/Dockerfile).

| Setting | Final value |
|---|---|
| Runtime | Python 3.12 slim |
| CPU | 2 vCPU |
| Memory | 4 GiB |
| Minimum instances | 0 |
| Maximum instances | 1 |
| Container concurrency | 1 |
| Timeout | 300 seconds |
| Runtime identity | `ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com` |
| Roboflow secret reference | `roboflow-api-key:latest` |
| Gemini secret reference | `gemini-api-key:latest` |
| Gemini model environment | `gemini-3.8-flash` |
| Public access | Disabled (`--no-allow-unauthenticated`) |
| Operator invoker | `user:nayzinminlwin22@gmail.com` |

The runtime identity has Secret Manager accessor access only on the two provider secrets. Operator invocation is granted separately with `roles/run.invoker`; the runtime identity is not granted operator access. No `allUsers` invoker binding exists.

The Artifact Registry repository created for this unit is:

```text
asia-southeast1-docker.pkg.dev/ecoloop-thesmartrecycling/ecoloop
```

## Build and deployment commands

Builds were submitted from the repository root:

```text
gcloud builds submit --project=ecoloop-thesmartrecycling --config=infra/cloudbuild.vision.yaml --substitutions="_IMAGE=asia-southeast1-docker.pkg.dev/ecoloop-thesmartrecycling/ecoloop/vision:21fbb5fa3e28" --ignore-file=infra/vision.gcloudignore .
```

Successful Cloud Build IDs:

- `b9ad1170-9aa1-4358-8654-6a5661b62bdc` — initial package build
- `84171577-c097-46ad-b4ba-9491743441aa` — runtime-library fix
- `1938aa36-e87d-4fe7-bd16-8da9311e6d39` — final health/error-diagnostics build

The first deployment failed because OpenCV required `libGL.so.1` in the slim image. The Dockerfile now installs `libgl1` and `libglib2.0-0`. A second deployment failed because the PowerShell secret flag interpolation omitted `:latest`; the deployment script now uses braced variables. The final revision became Ready after both fixes.

The initial Secret Manager versions had three extra newline bytes from a shell pipeline. Byte-level comparison found the mismatch without revealing values; exact binary versions were created as versions 2 and the service was refreshed to revision `00004-wgj`.

## Routes

- `GET /health` — private service health response
- `GET /healthz` — application health route retained for local/container checks
- `POST /operator/probe` — IAM-private multipart image probe with bounded 10 MiB input and provider flags

The operator route deletes its temporary image after processing. No financial callback, wallet mutation, task handler, or resident endpoint is present in this P00 probe.

## Verification

Authenticated operator checks used the active Google identity token and the service's `roles/run.invoker` binding:

- `GET /health`: HTTP 200, `{"status":"ok","service":"ecoloop-vision"}`
- First deployed full probe: trace `46f078958206d5dc9685f5a6298c8d62`
- Warm repeat full probe: trace `0de6e639a7d84d9ab1d55d168764c916`

Both full probes processed `trash8.jpg` independently of the local Python server. A, B, D and Gemini all returned success on the final revision.

The deployed route also returned Cloud Trace context on the health response. The structured application response includes its own 32-character lowercase `traceId`.

## Explicit limitations

- This is one representative smoke input, not evaluation evidence.
- Provider model execution remains hosted by Roboflow/Google; Cloud Run memory is the orchestration process only.
- No model accuracy, object reconciliation, eligibility, settlement or cost claim is made.
- Cloud Logging currently contains Uvicorn/provider client output and request traces; P01 will align all Python events with the full shared diagnostic schema.
