# A3 Vision and transport evidence

**Captured:** 2026-10-20  
**Phase:** A3 — Real Tasks to vision to settlement pipeline  
**Source branch:** `dev`  
**Runtime baseline:** `ECOLOOP_FIREBASE_MODE=firebase`, project `ecoloop-thesmartrecycling`, database `ecoloop-db`, resident/gateway `us-central1`, Tasks/vision `asia-southeast1`, `JAVA_TOOL_OPTIONS=-Xms64m -Xmx256m`, `NODE_OPTIONS=--max-old-space-size=256`

## Agent checklist result

Implemented and locally verified:

- Job source claims now carry the immutable Storage path, generation and MIME type from `simulationAssets`; legacy emulator fixtures remain readable but production source loading rejects claims without the private identity.
- The vision worker reads the named private Storage bucket with attached runtime credentials, pins the requested generation, checks the MIME type, SHA-256, 10 MiB byte limit, decodability and 40M-pixel limit. It does not construct an unauthenticated URL from an asset ID.
- Task dispatch defaults to a 300-second deadline and has separate `ECOLOOP_VISION_TASK_URL` (route) and `ECOLOOP_VISION_SERVICE_AUDIENCE` (root audience) inputs. The worker gateway is explicitly `us-central1` with a 300-second timeout.
- The gateway verifies a signed Google OIDC token against the configured audience, issuer and exact service subject. It does not call Firebase resident `verifyIdToken` on a service token.
- Production task processing requires `ECOLOOP_ARTIFACT_BUCKET`; local artifact output is not a production success fallback.
- The provider composition loads model IDs from `services/vision/model_registry.json`, computes its registry digest, uses the exact `gemini-3.8-flash` identity, preserves provider-native scores, applies specialist evidence only to an existing candidate, and routes low-confidence detector findings to Gemini.
- Both detector transport failures are explicit provider outcomes; they are not converted into an empty inventory. An affirmative no-proposal response is the only path to full-image fallback.
- Gemini prompts use the canonical taxonomy, exclude filenames/fixture answers, require bounded per-object output and confidence, and distinguish crop candidate identity from full-image inventory.
- Evaluator precision now uses predicted-object denominators, including unmatched false positives; review/unresolved predictions cannot be counted as automatic completion.

## Verification

| Check | Result |
| --- | --- |
| `functions` TypeScript build and contract packaging | PASS |
| Vision suite (`uv run --frozen pytest -q`) | PASS — 35 tests |
| Functions job lease/identity emulator suite | PASS — 4 tests |
| Hosted provider smoke on real pixels (`assets/trash_images/trash8.jpg`) | PASS — A, B, D and Gemini each returned HTTP/provider success |
| Smoke image identity | `d60c8101b0795e01826dad830e3df4ea831161db6feacdc2e5668dc7d9f480e6`, 574×348 JPEG, 22,699 bytes |
| Smoke model IDs | `waste-detection-0momv/6`, `yolo-waste-detection/1`, `waste-classification-rjo28/2`, `gemini-3.8-flash` |
| Smoke provider calls | 4 total: A/B/D once each and Gemini once |

The smoke was a provider-access check, not a settlement or release gate. Its raw report was written to a local temporary directory and is not committed because it contains verbose provider payloads.

## Live infrastructure handoff

The live infrastructure configuration was applied and verified on 2026-10-20:

- Cloud Run vision revision `ecoloop-vision-00007-zwl` is ready and serves immutable image digest `sha256:eb0ae8757e106213a56c7add6f51a301d866127537b32c92d93df12ea38d2c66`.
- Vision runs as `ecoloop-vision-runtime@ecoloop-thesmartrecycling.iam.gserviceaccount.com` with source bucket `ecoloop-thesmartrecycling.firebasestorage.app` and artifact bucket `ecoloop-thesmartrecycling-vision-artifacts`.
- The `vision-processing` queue exists in `asia-southeast1` with one concurrent dispatch, three attempts and a 300-second retry duration.
- The `workerGateway` revision `workergateway-00004-bep` is ready in `us-central1` with `demo-vision-v1`, the Google OIDC issuer, the numeric Tasks service-account subject, and the explicit `/tasks/vision` route/audience settings.
- The Tasks service account has Cloud Run invoker access to the private vision service.

## Remaining H2 transport handoff

A3 code and infrastructure configuration are implemented, but the complete phase exit gate is **BLOCKED pending durable transport evidence**, not silently passed:

Configuration values are now deployed and verified without recording secret contents. A private source-read, durable artifact-write, signed gateway invocation, real Tasks delivery, and end-to-end settlement trace have not yet been captured, so they cannot honestly be claimed.

## Known limitations carried forward

- The hosted smoke is not a benchmark and makes no accuracy claim.
- Final Gemini full-image consistency verification still belongs in the deployed composition before A4; low-confidence/invalid/ambiguous Gemini output is bounded to review rather than credit.
- Developer device rehearsal and deployment remain H2/A4 responsibilities.
