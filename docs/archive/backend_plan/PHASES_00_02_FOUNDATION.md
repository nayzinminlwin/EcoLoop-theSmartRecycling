# P00-P02 — Feasibility, Contracts, Diagnostics and Identity

Read the [execution protocol](EXECUTION_PROTOCOL.md) and the [master plan](../backend/ECOLOOP_BACKEND_IMPLEMENTATION_PLAN.md). `N` means a planned new file; `M` means inspect and patch an existing file. Evidence/log/tracker outputs are additional to the named code targets. Generated locks/build artifacts must be recorded separately.

## P00 — Verify the heart of the project first

**Role:** integration executor. **Spec:** §§2-3, 7, 16, 18, 20. **Milestone:** M0. No publication of an accuracy or affordability claim before measurement.

### BK-P00-A — Instructions, toolchain and existing-resource inventory

**Depends on:** none.

**Targets:** N `../../../infra/vision.gcloudignore`; execution evidence `docs/archive/backend_evidence/READINESS.md` and `ENVIRONMENT.md`.

1. Read the applicable role files/protected-file rules and inspect current git changes.
2. Record Flutter/Dart, Node/npm, Python/uv, Java, Firebase/gcloud and Git versions. Verify the installed emulator Java requirement from current documentation.
3. Inspect existing Android registration/configuration without editing protected files. The current application ID is `sd.idk.ecoLoop`; its namespace is `com.example.eco_loop`. Confirm Firebase app metadata matches the application ID.
4. Record verified project ID, actual Firestore/Storage region/bucket, Android/web app IDs, authorized domains, billing/API permissions, and Firebase/Cloud Run region choices. Record secret **reference names**, never contents.
5. Identify the physical Android test device/emulator and web browser/camera/push test path. Missing device evidence is a blocker for its eventual acceptance case, not an automatic pass.
6. Make the cloud build ignore manifest include only required orchestration/contract/build inputs. Exclude Flutter build caches, API-response caches, private local env files, design artifacts and user screenshot folders from build upload; do not alter/delete those source folders.
7. Record who will prepare/review the evaluation images and begin that work. These are test cases, not training data, and the full evaluation set is not a prerequisite for an API access probe.

**Gate:** actual versions/resource identities and a specific blocker list exist. No fabricated project selection. The three protected native files remain untouched. No backend implementation milestone is marked done by this inventory.

### BK-P00-B — Real A/B/D and Gemini access probe

**Depends on:** existing Roboflow/Gemini API access, a representative image/crop, and a usable HTTP client. Google Cloud CLI/region/billing verification is needed for P00-C, not for this local hosted-API access check. The Python adapter package/lock remains part of this unit's implementation gate.

**Targets (N):**

```text
services/vision/pyproject.toml
services/vision/src/ecoloop_vision/config.py
services/vision/src/ecoloop_vision/logging.py
services/vision/src/ecoloop_vision/adapters/detectors.py
services/vision/src/ecoloop_vision/adapters/specialist.py
services/vision/src/ecoloop_vision/tools/probe_models.py
```

Generated: `services/vision/uv.lock` and ignored API-response artifacts. Evidence: `MODEL_ACCESS.md` and referenced redacted raw API outputs.

1. Select compatible lightweight HTTP/API, image/crop and validation dependencies for the Python baseline; lock them. Use `inference-sdk` or supported HTTP requests, not a local model runtime.
2. Call existing hosted Model A `waste-detection-0momv/6` using the server-side Roboflow API key. The GitHub checkpoint is reference material only; no weight download is required.
3. Call existing hosted B `yolo-waste-detection/1` and D `waste-classification-rjo28/2` through Roboflow's supported hosted API. Record actual response/class maps, access and per-call cost requirements. No training workspace/dataset fork/upload/export is required.
4. Run one real, appropriate sample/crop through each adapter. Preserve actual raw response shape, coordinates and class vocabulary. D is multi-label; do not force a single-label interpretation.
5. Make a real `gemini-3.8-flash` image/structured-output smoke request from the operator probe. This can be a small temporary function in the probe script; production fallback logic is extracted into its adapter in P03.
6. Emit redacted stage/usage events from the first request. Files/labels containing the expected answer are not inference hints.
7. Measure API round-trip time, request size, usage and our client's memory where useful. Roboflow owns model execution/loading; do not claim to measure its GPU/RAM from our process. Record untested portions honestly.

**Command contract:** from `services/vision/`, generate/verify the lock, then `uv run python -m ecoloop_vision.tools.probe_models --help`; run its documented real-input mode with an explicit output directory and provider enablement.

A supported REST client may verify an initial API response before Python packaging is ready. This does not waive the later Python implementation checks. A missing complete evaluation image set, weight export, Node runtime or `gcloud` installation must not be reported as preventing a simple Roboflow HTTPS request.

**Gate:** real hosted A/B/D API outputs, Gemini structured output, hosted model/version identities, and a preliminary all-provider cost path. If an endpoint is inaccessible or a required provider plan exceeds RM50, report the actual API/access/cost issue. Do not train/self-host a replacement, quietly omit a model, or substitute fixture results.

### BK-P00-C — Private Cloud Run packaging and cold/warm probe

**Depends on:** B's viable adapter choices; existing-project cloud access.

**Targets (N):**

```text
services/vision/model_registry.json
services/vision/Dockerfile
services/vision/src/ecoloop_vision/main.py
infra/cloudbuild.vision.yaml
infra/cloudrun.vision.yaml
tools/backend/deploy_vision.ps1
```

1. Record exact hosted A/B/D model/version IDs, response contracts and server-side API-client configuration. The container holds orchestration code and no model weights.
2. Build from the repository root using Cloud Build, copying only declared inputs. The local 8 GB PC need not build a large container.
   The initial probe image copies only existing vision inputs. Add canonical-schema packaging after P01 creates those files; do not make this first build depend on nonexistent future contracts.
3. Provide private health/operator probe routes with validated bounded input, proper `PORT`, and no financial callback. Production task handling is added in P04.
4. Configure CPU-first 2 vCPU/4 GiB, minimum zero, maximum one, concurrency one as the initial benchmark, not an unmeasured final guarantee.
5. Attach a service identity with only needed artifact/invocation access. The endpoint is not public; invoke using a verified operator identity/audience.
6. Measure our container startup, first/repeat API-orchestration requests, memory and usage. Distinguish local startup from any Roboflow-hosted endpoint warmup. Verify source/config/lock/image digests in logs and deployment evidence.

**Gate:** a real image is processed in Cloud Run while independent of a local Python server. Logs are searchable by trace ID. Store the actual image digest and command/results in `DEPLOYMENT.md` / `COST_AND_LATENCY.md`.

### BK-P00-D — Evaluation-image manifest and test-case preparation

**Depends on:** A; preparation may overlap external-access waits.

**Targets (N):** `datasets/evaluation/README.md`, `datasets/evaluation/annotations.schema.json`, `datasets/evaluation/manifest.json`.

1. Define source provenance, immutable image identity, scene/group ID, split, dimensions, visible-object annotations, eligibility truth and clear/difficult/empty category.
2. Prepare approximately 100 labeled evaluation examples; use separate examples for choosing our software's confidence/matching settings and for frozen checks. Neither subset is model-training data. Keep related scenes together and preserve useful class coverage.
3. Include all five eligible classes, cardboard/other exclusions, touching/overlapping objects, bags versus bottles, generic can/glass ambiguity, unknowns and empty images.
4. Keep annotations outside runtime selectable metadata. Source filenames are converted to generic input identifiers when necessary.
5. Record actual prepared/labeled counts. An empty manifest is valid scaffolding but not “100 images complete.”

**Gate:** manifest/schema and labeling protocol validate; preparation has real ownership/progress. Full evaluation completeness is a P07 gate.

## P01 — Contracts, pure rules and diagnostics

**Role:** integration executor, plus Flutter developer for named Dart targets. **Spec:** §§6, 8-11, 15, 18-20. **Milestone:** M1.

### BK-P01-A — Canonical schema and golden corpus

**Depends on:** P00 metadata sufficient to define actual adapter inputs/outputs.

**Targets (N):** `contracts/backend/v1/commands.schema.json`, `findings.schema.json`, `snapshots.schema.json`, `golden_cases.json`, `invalid_cases.json` in that directory.

1. Choose a consistent JSON Schema dialect, e.g. 2020-12, and explicit schema version handling.
2. Define exact camelCase fields for logical commands, responses/errors, session/asset/bin snapshots, batch lines/results, worker findings and reward receipts.
3. Include all specified enums, null unknown counts/held points, zero empty counts, positive line counts, finite normalized boxes, strict command input and safe error details.
4. Golden corpus includes verified 37/61, review 30, empty 0/0, excluded cardboard 0/15, unreadable null/50, redemption 37->12, and used/expired voucher cases.
5. Invalid corpus includes fractional/negative counts or costs, invalid geometry, mismatched source/attempt, unexpected owner/award input, unsupported version and malformed timestamps.

**Gate:** schemas/goldens parse, values match the specification, no live secrets/expected image hints are included. Record unresolved purely technical choices in `CONTRACT_DECISIONS.md` with stable decision IDs.

### BK-P01-B — TypeScript workspace and domain entities

**Depends on:** A.

**Targets (N):** `functions/package.json`, `functions/tsconfig.json`, `functions/vitest.config.ts`, `functions/src/index.ts`, `functions/src/domain/types.ts`, `functions/src/domain/errors.ts`.

Generated: `functions/package-lock.json`.

1. Pin Node 22 and compatible Functions/Admin/Tasks/Auth-library/AJV/Vitest/rules-test dependencies.
2. Establish strict TypeScript and consistent NodeNext imports/build output. Empty `index.ts` exports no future functions.
   The initial build uses only existing compiler inputs; P01-E1 adds the schema-copy build step when its script exists.
3. Define typed immutable domain entities and discriminated states with ordinary timestamps/values, no SDK objects.
4. Define stable domain errors and script names from the execution protocol. Unit tests must run without provider credentials.

**Gate:** install/lock reproduction, `npm run build`, test runner smoke, and compiled module loading succeed. No invented public placeholder endpoints.

### BK-P01-C — Ports, identity and pure policy engine

**Depends on:** B and golden corpus.

**Targets (N):** `functions/src/application/ports.ts`, `functions/src/domain/identity.ts`, `functions/src/domain/policy.ts`, `functions/tests/unit/policy.test.ts`, `functions/tests/unit/identity.test.ts`.

1. Declare the typed clock/ID/store interfaces consumed by subsequent units; no Firebase path strings in pure policy.
2. Implement stable actor/operation/request keys and canonical payload fingerprinting. Array order remains meaningful; normalize object-key ordering consistently.
3. Implement class eligibility, integer rewards, disjoint known/unresolved space, unknown-batch allowance and accepted-count effects.
4. Produce a finalization plan/value object; do not mutate a database from the calculator.
5. Golden tests assert the independent expected numbers, broad-label uncertainty, invalid candidate exclusion, null-versus-zero and policy snapshot semantics.

**Gate:** meaningful pure tests pass; no SDK/network imports in domain/application contracts.

### BK-P01-D — Structured logging in all runtimes

**Depends on:** diagnostic schema and B/C.

**Targets:** N `functions/src/infrastructure/logger.ts`; M `services/vision/src/ecoloop_vision/logging.py`; N `lib/core/diagnostics/app_logger.dart`; N `functions/tests/unit/logger.test.ts`, `services/vision/tests/test_logging.py`, `test/core/diagnostics/app_logger_test.dart`.

Implement [D1-D5](OBSERVABILITY_AND_DEBUGGING.md): context, levels, redaction, safe exceptions, throttled Flutter `debugPrint`, JSON server output and in-memory test collector. Verify concurrent/request-local context and sentinel-secret suppression.

**Gate:** one traceable success and failure from each logger; tokens/URLs/voucher codes do not leak; no build-loop spam.

### BK-P01-E1 — Runtime schema validation and deployment packaging

**Depends on:** A-D.

**Targets (N):** `functions/src/transport/validation.ts`, `functions/tools/copy-contracts.mjs`, `functions/tests/unit/contracts.test.ts`, `services/vision/src/ecoloop_vision/infrastructure/contract_validation.py`, `services/vision/tests/test_contracts.py`; M `functions/package.json`.

1. Validate golden/invalid cases in Node and Python with timestamp formats enabled, not merely parsed JSON.
2. Build copies canonical schemas into Functions deployment output; test their compiled runtime path.
3. Python reads an explicit schema path that is present in the container. Maintain alias consistency.
4. Tests prevent snapshots from conflating unknown count with zero and commands from accepting owner/reward injection.

**Gate:** cross-runtime corpus succeeds/fails consistently and a packaged schema lookup works without repository-parent files.

### BK-P01-E2 — Dart command/error envelope

**Depends on:** E1.

**Targets (N/M):** N `lib/core/firebase/backend_envelope.dart`; M `lib/core/data/app_failure.dart`; N `test/core/data/backend_contracts_test.dart`, `test/core/data/app_failure_test.dart`.

Add pure-Dart envelope/error parsing with schema/request/trace identities and safe recovery fields. Preserve existing failure API compatibility where useful. Verify the applicable golden envelope/date/error cases. Batch-model decoding is completed in P04, not falsely claimed here.

**Gate:** focused Dart tests and affected static analysis pass; SDK exceptions do not enter presentation types.

## P02 — Firebase foundation and actual Google identity

**Roles:** integration executor for server/config; Flutter developer for app; assigned QA uses its role/skills. **Spec:** §§2, 10-12, 15-16. **Milestone:** M2.

### BK-P02-A — Existing-project configuration, rules and indexes

**Depends on:** P00 resource inventory and P01 schemas.

**Targets (N):** `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `functions/tests/emulator/rules.test.ts`.

1. Reuse/merge existing files if discovered at execution; never overwrite unknown configuration.
2. Define Functions and resident Hosting targets, emulator ports and declared indexes. Bind actual existing live identities only.
3. Deny by default, permit owner reads/safe catalog/bin reads, and deny direct client financial/job/role writes. Subcollection rules must enforce parent ownership.
4. Keep private bin operations and detailed evidence separate from resident-readable projections.
5. Test owner, other resident, signed-out, admin-read scope and forged direct mutation cases.
6. Emulator-only project namespaces may use an explicit `demo-*` identifier; that is not a newly invented live Firebase project. Test SDK configuration must not fall through to a live endpoint.

**Gate:** emulator/rules checks pass. Actual project/bucket/index plan is recorded. Missing deployment permissions are explicit blockers, not overwritten native configuration.

### BK-P02-B — Account bootstrap and trusted provisioning

**Depends on:** P01 ports/validation/logs and P02-A.

**Targets (N/M):** N `functions/src/infrastructure/firestore/codecs.ts`, `functions/src/infrastructure/firestore/accounts_store.ts`, `functions/src/application/accounts.ts`, `functions/src/transport/resident_accounts.ts`, `functions/src/composition.ts`, `functions/tests/emulator/accounts.test.ts`; M `functions/src/index.ts`. This seven-file bootstrap bundle includes the shared composition factory deliberately.

1. Initialize Admin SDK once in composition; keep Timestamp conversion in codecs.
2. Bootstrap profile/wallet/preferences/stats idempotently for a verified current identity. New wallet is zero; repeat calls never reset existing money or edited name.
3. Resolve role claims safely, preserve existing trusted claims/admin role, and account for Auth-versus-Firestore non-atomic provisioning.
4. Expose bootstrap/profile/preferences/device operations only as implemented, with ownership and safe envelopes.
5. Test partial provisioning retry, changed Google profile metadata, duplicate calls and client-supplied role/UID rejection.

**Gate:** stored records are correct under repeats and isolation tests, with `account.bootstrap_*` evidence.

### BK-P02-C1 — Flutter dependencies and Firebase clients

**Depends on:** A and verified platform metadata.

**Targets (N/M):** M `pubspec.yaml`; N `lib/core/config/runtime_config.dart`, `lib/core/firebase/firebase_clients.dart`, `lib/core/firebase/firebase_converters.dart`, `lib/firebase_options.dart`.

Generated: `pubspec.lock` and tool-generated plugin metadata.

1. Add compatible Firebase Core/Auth/Firestore/Functions/Storage/App Check/Messaging, Google sign-in, QR capture and lightweight pending-operation persistence packages. Pin resolved compatible versions and document their purpose; reuse Riverpod/GoRouter.
2. Define explicit modes/region/hosts with no secret values in Dart defines.
3. Obtain public Firebase options without protected-file rewrites. Inspect tool flags before use; report a manual prerequisite if preservation cannot be guaranteed.
4. Configure emulator clients before subscriptions. Provide typed clients/converters, not a generic database abstraction.
5. Verify current Google sign-in package API; do not copy an obsolete constructor/signIn snippet from model memory.

**Gate:** dependencies resolve and Android/web compile checks for these clients are valid. Public Firebase options are not confused with server provider secrets.

### BK-P02-C2 — Explicit bootstrap and advancing real clock

**Depends on:** C1.

**Targets (M/N):** M `lib/app/bootstrap.dart`, `lib/app/providers/app_providers.dart`, `lib/core/mock/app_clock.dart`; N `test/core/config/runtime_config_test.dart`, `test/core/mock/app_clock_test.dart`.

1. Select mock/emulator/firebase composition explicitly and preserve the test fixture runtime.
2. Add a system clock factory that advances on every `now` access while preserving fixed-clock test construction.
3. In real modes, missing feature adapters/configuration fail visibly during integration; never inherit a default mock resident/balance.
4. Initialize Firebase/App Check for applicable real modes with approved debug providers only in explicitly debug/emulator contexts.
5. Keep the default deployment command explicit about Firebase mode; do not ship a mock build labeled integrated.

**Gate:** mode selection, fail-visible configuration, real clock advance and retained fixed-clock tests pass. Unimplemented feature screens are not claimed as completed services.

### BK-P02-C3 — Durable command client and pending intents

**Depends on:** C2 and P01-E2.

**Targets (N):** `lib/core/firebase/command_client.dart`, `lib/core/data/pending_operation_store.dart`, `test/core/firebase/command_client_test.dart`, `test/core/data/pending_operation_store_test.dart`.

1. Centralize callable envelopes, safe error mapping, region, request/trace IDs and response validation.
2. Persist UID-scoped intent identity/payload before reservation, submission, redemption and usage calls. Lightweight metadata calls can use ordinary per-call identities.
3. Preserve the intent on ambiguous transport failure and recover its committed state before making another one. Do not regenerate its request ID in a catch block.
4. Use lightweight preferences for non-secret pending-operation metadata/installation ID, not wallet values or authentication credentials.
5. Test ambiguous success, reopen recovery, changed-payload conflict, terminal rejection cleanup and account switch isolation with a fake callable transport.

**Gate:** command recovery is deterministic and preserves one intent identity. Live server recovery operations are verified in P04/P05 as their handlers become available.

### BK-P02-D — Google account adapter and sign-in UI

**Depends on:** B, C3 and envelope client.

**Targets (N/M):** M `lib/features/account/domain/repositories/account_repository.dart`, `lib/features/account/data/mock_account_repository.dart`; N `lib/features/account/data/firebase_account_repository.dart`, `lib/features/account/presentation/controllers/auth_controller.dart`, `lib/features/account/presentation/screens/sign_in_screen.dart`, `test/features/account/firebase_auth_flow_test.dart`.

1. Expose explicit Google sign-in/sign-out behavior; test/dev demo methods remain isolated from production sign-in.
2. Use native Google credentials on Android and supported Firebase web auth flow on a user gesture.
3. After credential success, bootstrap and refresh token claims before emitting a resident-ready state. Withhold/represent provisioning rather than flashing signed-out or assuming admin access.
4. Cancellation returns to sign-in safely. Bootstrap failure has a retry state with trace reference.
5. Subscribe once to token/auth changes; dispose old owner data. Do not overwrite user-edited display names at every login.

**Gate:** fake-adapter auth tests plus real Android/web sign-in smoke evidence. A missing console SHA/domain is logged as an exact configuration blocker.

### BK-P02-E — Routing and UID-scoped composition

**Depends on:** D.

**Targets (M):** `lib/app/providers/app_providers.dart`, `lib/app/router/app_router.dart`, `route_guards.dart`, `lib/features/account/presentation/controllers/account_providers.dart`, `test/app/route_guards_test.dart`, `test/app/app_router_test.dart`.

1. Inject actual account repository and sign-in builder in real mode; preserve mock route setup for its tests.
2. Keep pending deep-link restoration through provisioning and avoid redirect loops.
3. Recreate/dispose UID-scoped feature subscriptions on account changes. No hardcoded resident ID outside mock fixtures.
4. Validate new-user zero wallet in storage and ready auth state. Feature wiring still pending P04/P05 must be visible rather than silently mocked.

**Gate:** the account/routing portion of M2 is proven: real identities are recoverable, protected routes are correct, cross-account cache/state is cleared, and owner records contain the correct zero-wallet baseline. Complete the phase milestone after P02-F's seed gate as well.

### BK-P02-F — Repeatable policy/bin/asset/QR/catalog seeding

**Depends on:** P01 schemas, P02 rules and actual image inputs from P00 preparation.

**Targets (N/M):** N `functions/tools/seed.ts`, `functions/tools/seed-manifest.example.json`, `functions/tsconfig.tools.json`, `functions/tests/emulator/seed.test.ts`; M `functions/package.json`, repository `.gitignore` for exact generated artifact/cache prefixes.

1. Add a typed tools runner such as `tsx` to the Functions dev package and typecheck its own config. Reuse domain policy/codecs/composition without importing handler registration side effects.
2. Seed the specification's immutable policy, active pointers, real registry/config identities, named bins, explicit cycle opening occupancy and demo catalog.
3. Generate actual QR PNGs matching enabled DB mappings. Seed at least the logical situations needed for normal, full/near-full and competing-bin tests; record fixture IDs and synthetic opening occupancy.
4. Upload/register versioned prepared images with actual size/geometry/content identity and display metadata. Never manufacture an image file or carry expected labels into runtime asset records.
5. Default to dry-run/emulator. An intentional live seed uses the verified project/environment, scoped fixture IDs and immutable-value conflict checks. Do not reset real resident wallets or overwrite unknown data.
6. Use current/future catalog dates; newly authenticated real residents still start at zero.

**Gate M2:** a second identical seed is harmless; conflicting immutable values fail explicitly; QR text round-trips to its correct bin; a real source image is selectable under the declared rules; all prior account/routing gates are recorded.
