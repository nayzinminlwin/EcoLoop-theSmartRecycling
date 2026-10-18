# BK-P00-A Readiness Gate

**Captured:** 2026-10-18
**Unit:** BK-P00-A — Instructions, toolchain and existing-resource inventory
**Base revision:** `21fbb5fa3e2876c1a32b6fb8971b629211178123`
**Status:** COMPLETE for inventory; BK-P00-B hosted access probe completed with cost evidence still pending.

## Gate results

| Requirement | Result | Evidence |
|---|---|---|
| Applicable instructions and protocol read | PASS | `docs/backend_plan/EXECUTION_PROTOCOL.md`, `.agent/developer/agent.md`, `.agent/tester/agent.md`; protocol identifies this backend work as integration-executor owned |
| Current git changes inspected | PASS | Existing untracked planning/specification/design paths preserved; no unrelated files reverted |
| Tool versions recorded | PASS | [ENVIRONMENT.md](ENVIRONMENT.md) |
| Existing Android registration inspected without edits | PASS | `applicationId` `sd.idk.ecoLoop`, namespace `com.example.eco_loop`, protected files unchanged |
| Firebase Android metadata matches application ID | PASS | Active app ID `1:353725053297:android:5f87dfd3ae7c99552f5ed0`, namespace `sd.idk.ecoLoop` |
| Verified project identity recorded | PASS | `ecoloop-thesmartrecycling`, number `353725053297` |
| Actual Firestore/Storage locations recorded | PASS | Firestore database `ecoloop-db` is in `asia-southeast1`; Storage bucket is in `US-EAST1` |
| Billing/API permissions and authorized domains recorded | PASS WITH FOLLOW-UP | Billing is enabled and the active account has Owner; authorized domains were not queried |
| Device/emulator and web test path recorded | PASS | Android device `qgfy7xz9eaci4tvs` / Android 15 API 35, Chrome and Edge are available |
| Scoped Cloud Build ignore manifest created | PASS | `infra/vision.gcloudignore` |
| Provider/model secret references recorded without contents | PASS | Roboflow and Gemini credentials were present in the local shell; values were not printed |
| Image provider/labeling owner recorded | BLOCKED | No operator/labeling owner was supplied; no images were labeled in this unit |
| Protected native files remain untouched | PASS | No diff in the three protected files |

## Specific blockers

1. Record provider pricing/quota references before claiming the M0 affordability gate.
2. Verify OAuth authorized domains in the Firebase console during P02.

The representative smoke image was supplied and the real hosted A/B/D/Gemini probe completed. The results are documented in [MODEL_ACCESS.md](MODEL_ACCESS.md). These results do not establish model accuracy or automatic settlement safety.

## Cloud Build context policy

`infra/vision.gcloudignore` includes only the future vision service, canonical contract, deployment configuration and backend tooling inputs. It excludes Flutter build/cache output, model caches, local environment/credential files, design artifacts and user screenshot folders. No source folder was deleted or altered.

## Next unit

`BK-P00-C` after provider pricing/quota references are recorded and the hosted adapter choices are accepted. Required read set: [MODEL_ACCESS.md](MODEL_ACCESS.md), [ENVIRONMENT.md](ENVIRONMENT.md), the BK-P00-C section of `docs/backend_plan/PHASES_00_02_FOUNDATION.md`, and specification sections 3 and 7.

## Subsequent scope clarification — 2026-10-18

The captured inventory above was completed against specification v1.0. Specification/plan v1.1 now records the user's explicit requirement to use existing pretrained Roboflow A/B/D APIs with server-side API keys.

- GitHub checkpoint access, weight export/download, self-hosting and model training are not prerequisites.
- Labels/images are for evaluation only; the complete test set is not needed for the first API smoke call.
- P00-B can first verify the hosted endpoints using API credentials, a representative image and an available HTTP client. Python packaging/tooling checks remain required for its implementation gate.
- `gcloud`, cloud region/billing/IAM checks and Android test access remain later deployment/platform prerequisites; they do not prevent a direct Roboflow HTTPS probe.
- No new provider probe or environment verification is claimed by this clarification. The inventory observations and completed P00-A result remain intact.
