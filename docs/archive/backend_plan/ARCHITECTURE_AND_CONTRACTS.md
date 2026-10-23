# Implementation Architecture and Contract Decisions

**Authority:** [Specification](../backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md). Product values and outcomes come from it; this document chooses implementation seams.

## A1. Dependency direction

```text
Flutter widgets/controllers -> feature repository interfaces -> data adapters
                                                        -> Firebase clients

Functions transport -> application services -> pure domain rules
                             |                     (no Firebase SDK)
                             -> typed store/clock/ID ports
                                  <- Firestore / Auth / Tasks / FCM adapters

Vision HTTP/CLI -> inspect/run-job application -> normalized object/matching rules
                         |                      (no FastAPI/provider SDK)
                         -> detector/classifier/fallback/artifact/gateway ports
                              <- Roboflow hosted APIs / Gemini / GCS / HTTP
```

- Construct dependencies once at each runtime's composition root.
- Do not give widgets Firestore transactions or model-provider clients.
- Do not let the Python service mutate wallets or bin occupancy through a general Admin SDK.
- Share contracts and golden examples, not a dependency on another runtime's implementation.
- Use small modules with cohesive functions. Interfaces belong where dependency substitution is useful: clocks, stores, providers, artifact access and command clients. Avoid abstract wrappers around every getter.

## A2. Planned module map

Create these paths incrementally as assigned by phase manifests:

```text
contracts/backend/v1/
  commands.schema.json
  findings.schema.json
  snapshots.schema.json
  golden_cases.json
  invalid_cases.json

functions/
  package.json, package-lock.json, tsconfig.json, vitest.config.ts
  tools/copy-contracts.mjs
  tools/seed.ts, inspect.ts, operator.ts
  src/index.ts, composition.ts       # exports and actual dependency factories
  src/domain/types.ts, errors.ts, identity.ts, policy.ts
  src/application/ports.ts
  src/application/accounts.ts, sessions.ts, submit_inspection.ts
  src/application/jobs.ts, finalize_inspection.ts, rewards.ts
  src/application/notifications.ts, maintenance.ts
  src/infrastructure/logger.ts, cloud_tasks.ts, messaging.ts
  src/infrastructure/firestore/codecs.ts
  src/infrastructure/firestore/accounts_store.ts, sessions_store.ts
  src/infrastructure/firestore/inspection_store.ts, jobs_store.ts
  src/infrastructure/firestore/settlement_store.ts, rewards_store.ts
  src/infrastructure/firestore/notifications_store.ts, maintenance_store.ts
  src/transport/validation.ts, resident_accounts.ts, resident_sessions.ts
  src/transport/resident_inspections.ts, internal_jobs.ts, dispatch.ts
  src/transport/resident_rewards.ts, notification_dispatch.ts, schedules.ts
  tests/unit/, tests/emulator/

services/vision/
  pyproject.toml, uv.lock, Dockerfile, model_registry.json
  src/ecoloop_vision/config.py, logging.py, main.py
  src/ecoloop_vision/domain/models.py, matching.py, taxonomy.py, resolution.py
  src/ecoloop_vision/application/ports.py, inspect_image.py, run_job.py
  src/ecoloop_vision/adapters/detectors.py, specialist.py, gemini.py
  src/ecoloop_vision/infrastructure/contract_validation.py, images.py
  src/ecoloop_vision/infrastructure/job_gateway.py, artifacts.py
  src/ecoloop_vision/tools/probe_models.py, replay.py, evaluate.py
  tests/

lib/
  core/config/runtime_config.dart
  core/diagnostics/app_logger.dart
  core/firebase/firebase_clients.dart, command_client.dart, firebase_converters.dart
  core/data/pending_operation_store.dart
  core/domain/deposit_line_item.dart
  features/<feature>/domain/...       # evolve existing models/interfaces
  features/<feature>/data/firebase_<feature>_repository.dart
  features/scan/data/backend_scan_mapper.dart
  app/bootstrap.dart, app/providers/app_providers.dart

infra/cloudbuild.vision.yaml, cloudrun.vision.yaml
tools/backend/deploy_vision.ps1
```

Tests, UI widgets and additional small helpers appear in their unit manifests. This map is not permission to create all files up front or to import future modules. No new Flutter state-management framework, generic ORM, database server, message broker or admin frontend is required.

## A3. Runtime modes and composition

### Flutter

`BACKEND_MODE = mock | emulator | firebase`, with explicit `APP_ENV` and verified public Firebase options.

- Mock mode retains isolated fixtures and is clearly a development/test runtime.
- Emulator mode binds Auth/Firestore/Functions/Storage before any feature starts subscribing.
- Firebase mode binds actual current-UID repositories. Invalid/missing real configuration fails visibly; it never silently displays the mock resident or balance.
- Keep existing Riverpod interfaces and providers where useful. Factory/override decisions belong in bootstrap/composition, not checks scattered through widgets.
- Bind account-dependent repositories/streams to the resolved UID. Dispose/reset them on sign-out or UID changes; ignore late events from the former owner.
- Preserve the mock clock constructor for legacy tests. Add a dynamic system clock factory/provider whose getter calls the current clock every time. `AppClock(now: DateTime.now())` alone freezes time at startup and is insufficient.
- Do not import `dart:io` into web runtime code. Pass emulator hosts via configuration: browser localhost and Android-emulator host addressing differ.

Recommended local ports: Auth 9099, Firestore 8080, Functions 5001, Storage 9199, emulator UI 4000, vision HTTP 8085. Cloud Run listens on its provided `PORT` (normally 8080). Record actual values to avoid a local Firestore/vision port collision.

### Functions

Use TypeScript strict mode, Node 22 and an explicitly consistent module convention. Prefer NodeNext with `.js` relative imports in TypeScript source; test compiled entrypoints. Pin actual compatible Firebase/Admin/Tasks/Auth-library/validator/test versions in the lockfile.

`index.ts` exports implemented handlers only. Per-feature factories accept typed ports; the composition root supplies production or emulator adapters. Domain/application services must not inspect `process.env` during business calculations.

Keep TypeScript operator/seed tools inside `functions/tools/` so they use that package's dependencies and explicit script runner. The repository-level PowerShell deployment wrapper uses CLI tools. Do not create an accidental second Node workspace just to execute a script that cannot resolve `firebase-admin` outside `functions/`.

### Vision

Use the declared Python baseline, `uv` and committed `uv.lock`, FastAPI/Pydantic, image/crop utilities and lightweight HTTP/API clients such as `inference-sdk`. A/B/D are existing pretrained Roboflow hosted model endpoints. No PyTorch/TensorFlow/Ultralytics model runtime, self-hosted Roboflow `inference` server, weights or training tools belong in this container.

Hosted model/version IDs, provider-reported revision metadata, input-image identity, preprocessing, thresholds, taxonomy, matching rules and prompt versions form a reproducible processing configuration. Request-local context uses `contextvars`, not mutable global trace/owner variables. Reusable HTTP connections and safe response caches may be shared; resident/job state may not. Confidence/matching configuration is application logic, not model training.

## A4. Canonical wire contract

### Resident callable request / response

The Firebase callable SDK wraps transport data. `request.data` is this logical envelope; do not add a second accidental `{data: {data: ...}}` layer.

```json
{
  "schemaVersion": 1,
  "requestId": "stable-id-for-one-confirmed-intent",
  "payload": {"sessionId": "session-001", "assetId": "asset-003", "assetVersion": "v1", "expectedSessionVersion": 5}
}
```

```json
{
  "schemaVersion": 1,
  "requestId": "stable-id-for-one-confirmed-intent",
  "traceId": "32-lowercase-hex-characters",
  "data": {"sessionId": "session-001", "depositId": "deposit-001", "jobId": "job-001", "stage": "processing"}
}
```

Derive UID from verified authentication. Ignore/reject user-supplied owner, role, points, counts, source Storage paths, policy version overrides and final outcomes.

Use stable application error codes from specification §11.4. Callable errors carry a safe `messageKey`, application code, `retryable`, request/trace identifiers and safe recovery references. Map them into the existing `AppFailure` abstraction in the data layer. Never pass provider exception objects directly to widgets.

### Worker gateway

Use a private IAM-authenticated HTTP function/gateway, with operations `claim`, `checkpoint`, `complete`, `fail` and attempt renewal if required. It supplies the exact committed source/configuration and a fenced attempt identity. The queue invokes Cloud Run with a job identity, not arbitrary client image/award instructions.

The gateway validates current attempt/lease, source digest, paths, schema, deadline and allowed result semantics. A queue header is not authentication. Use OIDC/service identity with the actual deployed audience URL.

Local worker tests can inject an in-memory gateway or an explicitly emulator-only composition. A test identity path must fail startup/validation in a live environment; do not add a public `skipAuth` request field.

### Contract packaging

- Canonical JSON schemas/golden cases live under `contracts/backend/v1/`.
- Functions deployment only includes its source/output tree. `functions/tools/copy-contracts.mjs` copies verified schemas into deploy output during `npm run build`; do not reference `../../contracts` from a deployed function assuming the repository exists there.
- Cloud Build's Docker context is the repository root; copy the canonical schema directory and vision sources explicitly. Set a real runtime schema path.
- Python aliases map internal snake_case to the exact camelCase wire names. Test serialization with aliases enabled.
- Dart decoders use shared examples and existing JSON-reader patterns; Firebase `Timestamp` conversion is data-layer-only.
- Expected images/labels for CV evaluation are separate from golden business/API examples. A schema fixture is not an inference answer source.

## A5. Business ports and transaction discipline

Define a small typed port per cohesive store: AccountsStore, SessionsStore, InspectionStore, JobsStore, SettlementStore, RewardsStore, NotificationsStore and MaintenanceStore. They may expose transaction callbacks with typed read/write contexts. Do not expose Firestore `DocumentReference`, `Transaction`, `Timestamp` or collection path strings to pure policy code.

Within an actual Firestore transaction, perform all required reads before writes. Automatic callback retries must not call model APIs, send notifications, enqueue tasks, generate changing operation identities or print a misleading “credited” success.

Stable document IDs are derived from actor/operation/request and domain uniqueness. Use hashes/structured encoding rather than ambiguous UID/string concatenation. Store request fingerprints. External effects use outbox records committed with their source operation.

### A5.1 Reservation recipe

1. Read the actor's prior operation receipt and active-session reference.
2. Recover a valid existing journey, or inspect the enabled QR mapping and bin/current operations.
3. Check actual capacity, availability and unsubmitted lease expiry using trusted current time.
4. An expired processing reservation cannot simply be stolen: its original batch must obtain its recovery outcome/occupancy posting first.
5. Create/recover one session and matching reservation; update owner-private active reference and sanitized bin availability coherently.
6. Emit `scan.reservation_committed` only after commit, or a specific conflict/availability event.

### A5.2 Continue/submission recipe

1. Recover an existing receipt by actor/operation/request identity first.
2. Read session, reservation, exact selected asset version, active policy/config, current cycle and processing availability.
3. Verify owner, `itemDetected`, valid reservation, expected version and exact UI-confirmed asset. Stale draft saves cannot overwrite this input.
4. Create one immutable batch and durable job/dispatch intent; pin source version/digest, policy and configuration; set five-minute deadline.
5. Transition session to processing and reservation phase to processing. Heartbeats are no longer required from the app.
6. Persist response references. The external enqueue happens after commit through dispatcher/reconciliation.

### A5.3 Finalization recipe

1. Verify service identity and validate persisted findings/artifact identities outside the retried transaction.
2. Read batch/job/attempt, operation receipt, pinned policy, session/owner active reference, bin/cycle/operations, existing posting/credit, wallet/stats/result/ticket/event records as needed.
3. Return an already committed result idempotently. Reject/fence stale attempts. If the deadline has passed, use the technical-review outcome rather than late auto-credit.
4. Calculate pure class eligibility, disjoint space contributions, count/null/empty semantics and points from the pinned policy. Never trust client/LLM reward amounts.
5. Create one initial capacity entry and update original cycle/current-bin projection where applicable. Zero-space empty outcomes still have a terminal posting marker.
6. For verified positive rewards, append the unique credit, update wallet/version and accepted-item stats once. Pending review credits nothing; final zero outcomes do not invent a zero credit.
7. Publish canonical batch lines, decision/result projection, review ticket if needed, and notification intent coherently.
8. Complete the automatic session and release only matching reservation/active-owner references.
9. Log committed effects after the transaction succeeds. FCM/task delivery failures do not repeat finance.

### A5.4 Future review and collection

Keep review resolution and collection as tested application/domain functions, accessible through a controlled harness/operator tool as allowed by the specification. Do not export a public admin decision API or edit the friend's frontend in this plan.

- Review: expected decision version, one accepted resolution, pinned original policy, difference-only capacity correction, old-cycle protection, one positive settlement, same receipt ID and new logical notification event.
- Collection: reject/serialize against active interactive/processing reservations, verify current cycle, close cycle/start a new one and reset current occupancy. Pending reviews do not block it.
- Review cannot release a newer session's reservation.

## A6. Flutter integration without excessive ceremony

1. Keep feature repositories as Flutter's backend boundary; use methods returning domain objects/streams.
2. Add one `CommandClient` for auth, logical envelope, request persistence/recovery, errors and trace propagation. It does not calculate business totals.
3. One Firebase adapter per feature composes Firestore owner queries and callable commands. Simple reads do not need a use-case class per field.
4. Models can retain pure-Dart JSON helpers for mocks, but strict backend DTO conversion must enforce schema version and nullable count semantics.
5. Keep authoritative `lines`, nullable `totalDetectedObjectCount`, status, points, policy and decision version. Display-summary getters can produce “Mixed materials”; they are not stored business classifications.
6. Adapt the existing `ScanSessionScreen` observer/canonicalization rather than replacing the navigation system. A missing best-effort stage cache means unresolved loading, not permission to declare an expired session.
7. Persist request IDs before mutating commands using a UID-scoped `PendingOperationStore`. On an ambiguous response, retain the ID/payload and recover. Clear only after acknowledged success or a known terminal rejection.
8. A dynamic clock and a foreground-expiry refresh update derived voucher status; do not rely on a daily cron before showing expiration correctly.

### Required seam changes

| Existing seam | Target behavior |
| --- | --- |
| `getDemoQrPayload` + `lookupBin` + `createSession` | Production uses one atomic `scanBinQr(payload, requestId)`; mock capture is test/dev-only |
| `startVerification` / `completeVerification` | `submitInspection` commits selected input; streams observe server completion |
| `peekSessionStage` | Optional observed-state hint only, or a small navigation cache; never authoritative missing-data logic |
| Single `materialType` / non-null count | Batch lines, nullable unknown total, zero empty total, accepted-only impact |
| `resumeDemoSession` | Actual Google sign-in/provisioning for Firebase modes; retain explicit mock behavior only where needed |
| `changePassword` | Provider-aware unsupported/Google-managed operation; no false password save |
| `redeemReward(id,key)` | Include displayed offer identity/cost and preserve durable request identity |
| Voucher `FutureProvider` only | Refresh/watch usage and expiry so consumed vouchers do not remain available |

Stage enum migration is first, nullable/mixed-model migration second, real repository/UI cutover third. Preserve compilation at each named compatibility gate; never hide an unknown count as zero to make old widgets compile.

## A7. Query/index registry to implement

| Read/job | Query shape to verify in emulator/live environment |
| --- | --- |
| Deposit feed | Owner equality; optional status and occurrence-time bounds; order time + document ID; cursor pagination |
| Wallet feed | Owner equality; order creation time + document ID |
| Reward feed | Active/category constraints, sort order; server redemption independently revalidates expiry |
| Voucher tabs | Owner equality; available/used/expired semantics derived correctly from server timestamps, not only stale stored status |
| Reminder candidates | Available state and expiry window; deduplicated reminder identity |
| Jobs needing dispatch | Pending dispatch state and due time |
| Jobs needing recovery | Nonterminal state with expired deadline/lease; bounded page size |
| Retention | Due cleanup time and unresolved/purged guards; narrow job artifact references |
| Future admin review | Open ticket state; creation order and optional bin filter |

Specifically test the gap where a voucher's time has expired but its stored status is still `available`. Available/expired tabs and backend use checks must agree. Use owner-scoped OR/range queries or an equivalent correct projection/refresh strategy, with actual SDK/index support verified. Local filtering of one arbitrary page is not complete status pagination.

## A8. Configuration and release identities

Keep explicit values for project/region, emulator hosts, service audiences, schema/policy/pipeline versions, model registry digest, limits and logging level. Public Firebase client configuration is distinct from Gemini/Roboflow/server credentials.

Cloud Run uses an immutable image digest and a source manifest containing base Git SHA, dirty/source-bundle identity, dependency lock hashes, schema digest and model/config identities. This remains traceable even if commit authorization is not available.

Readiness must verify supported SDK versions and existing Android registration. Do not blindly run `flutterfire configure` if it writes protected files. Obtain the public Dart options from verified app metadata or a configuration invocation proven to preserve those paths; otherwise report the exact manual prerequisite.
