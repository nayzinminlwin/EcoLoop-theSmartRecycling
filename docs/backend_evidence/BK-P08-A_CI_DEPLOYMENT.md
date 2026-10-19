# BK-P08-A CI, deployment and runtime controls

**Unit:** BK-P08-A
**Role:** Integration executor
**Specification:** ECOLOOP-SPEC-001 deployment, access-control and verification requirements; PHASES_07_08_VERIFICATION.md BK-P08-A
**Base revision:** `d647ddd`
**Status:** IMPLEMENTED; live deployment and provider-attestation evidence remain operator-gated

## Implemented controls

- `.github/workflows/backend-ci.yml` runs locked Functions build/unit tests, locked Python/vision tests, Flutter analysis/tests, and a Firestore/Storage rules emulator gate.
- `tools/backend/deploy_poc.ps1` requires an explicit project, runtime/task identities, artifact bucket, non-debug web VAPID key, Functions environment contract, and explicit production App Check confirmation.
- `tools/backend/deploy_vision.ps1` validates secrets/artifact storage, grants only the runtime artifact bucket role, builds from the repository root, resolves the image digest, deploys by digest with private ingress and no unauthenticated access, verifies the deployed digest, and configures the bounded Cloud Tasks queue.
- Cloud Run remains bounded at 2 vCPU, 4 GiB, concurrency 1, max instances 1 and 300 seconds. The checked-in manifest records private ingress and an explicit runtime service-account slot.
- Firebase deployment is limited to the implemented Functions export set, Firestore rules/indexes, Storage rules, the resident Hosting target, and Firebase-mode web/Android artifact builds.
- No provider credentials or real provider calls are available to the GitHub workflow.

## Commands and results

| Command | Result |
|---|---|
| PowerShell parser for both deployment scripts | Passed |
| `npm ci --prefix functions --ignore-scripts` | Passed; existing dependency audit reports 2 critical, 9 high and 38 moderate advisories |
| `npm test --prefix functions` | Passed; build and 20 unit tests |
| `Set-Location services\vision; uv sync --locked --group test; uv run pytest` | Passed; 35 tests |
| `flutter analyze` | Passed |
| `flutter test` | Blocked on this machine by Dart VM out-of-memory during the full suite; no test assertion failure was reported |

## Operator-only gates

`deploy_poc.ps1` intentionally does not run here. It requires authenticated Google Cloud/Firebase access, existing Secret Manager versions, the runtime/task service accounts, the artifact bucket, a deployed production App Check configuration, and a non-debug VAPID key. The workflow has no credentials and never performs provider calls.

Before distributing the app, the operator must verify Android Play Integrity and web reCAPTCHA Enterprise for the registered Firebase apps, then pass `-AppCheckConfigured`. Debug providers are not accepted by the deployment script.

## Files

- [backend-ci.yml](../../.github/workflows/backend-ci.yml)
- [deploy_poc.ps1](../../tools/backend/deploy_poc.ps1)
- [deploy_vision.ps1](../../tools/backend/deploy_vision.ps1)
- [cloudrun.vision.yaml](../../infra/cloudrun.vision.yaml)
