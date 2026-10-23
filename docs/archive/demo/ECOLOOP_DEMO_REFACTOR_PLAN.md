# EcoLoop Demo Recovery and Refactor Plan

- **Plan ID:** ECOLOOP-DEMO-REFACTOR-001
- **Version/date:** 1.0 / 2026-10-20
- **Status:** Ready for sequential execution; implementation has not started
- **Deadline:** Demonstration on 2026-10-20 at 8:00 PM MYT; confirmed in H1 evidence
- **Defect baseline:** [Ultimate audit, UA-001–UA-055](../audits/ECOLOOP_ULTIMATE_BACKEND_AUDIT.md)
- **Original authority:** [Backend/CV specification](../backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md)
- **Execution tracker:** [Demo refactor tracker](../demo_refactor/EXECUTION_TRACKER.md)
- **Phase count:** **5 agent-led phases + 3 human-led phases**, interleaved below

## 1. The delivery objective

Deliver a demonstrably working **real Firebase** resident application on the developer's Android device and deployed HTTPS web:

```text
Google login -> usable Home -> real QR -> Bin Found -> Ready
-> choose a prepared image -> Continue -> genuine hosted inference
-> verified / zero-credit / pending-admin result
-> coherent wallet + history + occupancy
-> demo reward redemption -> issued voucher -> simulated voucher use
```

The software must finish honestly even when inference fails: a bounded technical/admin-review result, released bin, preserved evidence, and no accidental credit. It must not spin forever, invent empty images, hide transport failures as success, or require a local vision server during the presentation.

**A green release gate means the exact deployed candidate passed the required demonstration tests. It is not a guarantee of correct recognition on every unseen image.** The plan therefore combines real model execution, conservative confidence gates, semantic checks, and admin referral. Judging/demo success is established by rehearsal, not by an agent promising 100% accuracy.

### 1.1 User-authorized demo direction

The user's latest instructions govern these changes:

- **No model training, fine-tuning, or dataset uploads.**
- **No manual image-labeling/classification/evaluation-dataset work for the developer.** This plan does not assign annotation work to another person or agent either.
- Use the existing hosted A/B YOLO endpoints. Low-confidence, conflicting, missing, or incomplete useful findings escalate to **`gemini-3.8-flash`**.
- Gemini uncertainty or failure refers the **whole transaction** to admin review; no partial points.
- Continue must still process the selected pixels. Filenames, fixture answers, and intended demo narratives must not determine classification.
- A fresh-user demo must actually run; earlier mock/probe passes cannot close release gates.

The original approximate 100-image/frozen-CV statistical acceptance exercise is **not a prerequisite for this demo release** under this updated direction. No 95% precision/90% counting/70% coverage claim may be made without such measurement. Deterministic software tests still use independently constructed fixtures; that is not training or manual image annotation.

### 1.2 Scope change to record before implementation

A1 must add a dated **demo delivery addendum** to the specification, linking this user direction and this plan. Preserve the original historical acceptance requirements and identify the limited changes:

1. Demonstration acceptance replaces frozen-dataset measurement as this release's delivery gate; accuracy statistics remain unclaimed.
2. Low-confidence YOLO findings must reach Gemini instead of being prematurely accepted or discarded as empty.
3. The H1 Android debug sideload demo does **not** use App Check, per explicit developer confirmation. Required Firebase services must remain configured without App Check enforcement for this checkpoint. This is not a production attestation claim. HTTPS web uses its configured production-suitable web provider if web scope is later enabled.
4. The verified existing region/database/physical-layout mapping below is explicit.

If the developer requires a release-signed Play Integrity APK rather than the debug sideload, H1 must establish that distribution before A4. Do not change distribution/signing for the first time immediately before the presentation.

## 2. Phase sequence and ownership

| Order | Phase | Lead | Outcome required before advancing |
| --- | --- | --- | --- |
| 1 | **H1 — Freeze real identities and demo access** | Developer | Actual device/platform/cloud inputs, distribution choice and native/OAuth/App Check prerequisites recorded |
| 2 | **A1 — One data contract and a working real Home** | Agent | Real login/provisioning/Home/guide reads agree across database, paths, DTOs, rules and auth lifecycle |
| 3 | **A2 — Transactions, complete scan state, and financial recovery** | Agent | Correct session/draft/settlement/cycle/stats/reward/voucher contracts with independent invariants |
| 4 | **A3 — Real Tasks→vision→settlement pipeline** | Agent | Compatible service identity, private source retrieval, full providers/fallback, bounded outcomes and evidence |
| 5 | **H2 — Console/provider/infrastructure handoff** | Developer | Provider secrets, service identities, messaging/web registrations and deployment permissions are usable |
| 6 | **A4 — Integrate app, operations, and deploy a candidate** | Agent | Full screens/lifecycle/notifications/retention/diagnostics wired; current reproducible candidate deployed |
| 7 | **H3 — Independent device/browser rehearsal** | Developer | Actual device/browser checklist observed; precise defects and release IDs returned |
| 8 | **A5 — Close rehearsal defects and freeze the demonstrated release** | Agent | Defects fixed/retested, current immutable release, demo/operator handoff, final evidence and commit |

Human console tasks that can be prepared during an agent phase may be prepared early, but their recorded gate still belongs to H1/H2/H3. Do not invent extra formal phases or silently exceed the requested limits. Each agent phase contains bounded substeps so it can survive context resets.

### Practical deadline management

- At H1 record hours remaining and actual presentation time; reserve the final **60–90 minutes for H3/A5**.
- Finish Home first, then the exact end-to-end recycle/earn/redeem path. Do not spend the first hours polishing charts, admin CRUD, or dataset tooling.
- Use one executor sequentially unless the developer explicitly requests delegation. Avoid simultaneous emulator/build processes on this memory-constrained Windows host.
- Every 60–90 minutes checkpoint the tracker with the next exact substep and blocker. A checkpoint is not a new phase and does not require a new approval for ordinary authorized work.
- If a dependency fails, isolate the smallest boundary and reproduce it. Do not start a broad unrelated refactor while the first failing call remains unexplained.
- Never trade duplicate finance, fabricated classification, permissive private-data rules, or unresolved infinite processing for a nicer demo. A pending-review result is a valid final automatic outcome; a successful clear-image automatic receipt must also be rehearsed.

## 3. Shared decisions — do not let separate agents choose these differently

### 3.1 Cloud and runtime contract

| Setting | Agreed execution baseline |
| --- | --- |
| Existing project | `ecoloop-thesmartrecycling`; verify before each live command |
| Firestore | Explicit named database **`ecoloop-db`** everywhere, including seed/operator/tests |
| Storage | `ecoloop-thesmartrecycling.firebasestorage.app`; source/evidence access remains authorized |
| Resident callable region | **`us-central1` for this demo**, matching existing deployed exports; set explicitly in source/client/builds |
| Worker gateway region | `us-central1`, explicitly configured |
| Vision/Tasks/scheduled region | `asia-southeast1`, explicitly configured |
| Real app mode | `ECOLOOP_FIREBASE_MODE=firebase`; remove old `BACKEND_MODE` examples from active run instructions |
| Real clock | Dynamic system clock + explicit Malaysia calendar/display handling |
| Role | `role: user | admin`; service identities use IAM/OIDC, not a resident/admin role |
| Canonical zero-credit outcome | `rejected`; legacy `excluded` is a documented **read-only migration alias**, never unknown/verified |
| Null semantics | Unknown counts/held points remain null; final zero is 0 |
| Time storage | Firestore `Timestamp`; UTC ISO strings only on JSON wire contracts |
| Request contract | `{schemaVersion: 'backend.v1', operation, requestId, payload}`; exactly one unpack/validation boundary |
| Response contract | Versioned committed/error envelopes with stable request ID and propagated trace; callable errors mapped to safe domain errors |
| Production decision boundary | Functions recalculates policy/accounting from validated object findings; neither Flutter nor Gemini chooses rewards |
| Native protected files | Agent must preserve existing restrictions; developer handles necessary Gradle/Google Services changes after targeted inspection |

Choosing existing US callable endpoints avoids a risky region migration on demo eve. This does not require moving the Firestore database or vision service. Record cross-region latency; do not silently switch one caller to Singapore. If a region change is later approved, it requires a complete endpoint/client deployment change and fresh acceptance.

### 3.2 Physical data layout for the refactor

Retain the backend's existing business identities rather than duplicate wallets into a second layout. Record this explicit mapping in the spec addendum and contracts.

| Concern | Canonical physical path | Contract rule |
| --- | --- | --- |
| Profile | `residents/{uid}` | Keep one stored name source. Map legacy `residentId`/`displayName` to app DTO `id`/`fullName` at the boundary; Auth controls email |
| Wallet | `residents/{uid}/wallet/current` | Only trusted transactions write balance/version |
| Stats | `residents/{uid}/stats/current` | Verified batch and per-class/per-material accepted counts, rebuildable |
| Preferences/devices | `residents/{uid}/preferences/current`, `residents/{uid}/devices/{installationId}` | Only supported fields; token ownership backed by a global trusted association |
| Token association | `deviceAssociations/{tokenHash}` or equivalent documented global index | One active owner/installation per actual FCM token; never expose raw token globally |
| Scan | `depositSessions`, `binOperations`, `bins`, `binQrMappings`, `binCycles` | Private reservation internals separate from resident bin display |
| Deposits/results | `deposits`, `depositResults`, `reviewTickets` | Stable identity, correct processing/final projections, canonical lines and decision version |
| Wallet/capacity ledger | `walletEntries`, `capacityEntries` | Immutable coherent entries with operation/source/version/time |
| Policy | `policies/{version}`, `policyPointers/active` | Full immutable payload and content identity; no silent default fallback |
| Assets | `simulationAssets/{assetId}` | Exact authorized `storagePath`, generation/digest, MIME/geometry; no expected answer fields |
| Rewards | `rewards`, `rewardCategories`, `redemptions`, `vouchers`, trusted per-resident reward counters | Owner-scoped reads; immutable original offer/receipt snapshots |
| Operations/jobs | Existing actor-scoped receipts, `inferenceJobs/{id}/attempts/{id}` | Consistent operation scope, source/config/attempt fencing; service-only writes |
| Evidence | `inspection-evidence/{uid}/{depositId}/{attemptId}/...` | Normal workers, review tickets, authorized evidence reads and retention use the same exact layout |
| Artifact manifests | `diagnosticArtifacts/{id}` plus attempt manifest | Exact path/generation/digest, resolved/pending state and cleanup eligibility |

The path table is a decision record, not permission to overwrite existing records. Migration must handle legacy ISO dates, missing fields, `excluded`, old evidence prefixes and earlier seed state explicitly.

### 3.3 Minimum record contract

Before splitting into features, establish these independently consumed DTOs and use them in actual writer→reader tests:

- **Resident DTO:** `id`, `fullName`, Auth-derived `email`, nullable `avatarUrl`, `createdAt`.
- **Wallet DTO:** resident, nonnegative integer balance, monotonic version, updated time; optional next reward is derived from real eligible catalog offers, not a mock balance.
- **Stats DTO:** verified positive-accepted batch count, accepted counts by class and material, version/time; estimated kg derived at display time.
- **Session DTO:** owner, bin, stage/version, draft ID/version, committed batch/job/result references, lease/deadline, safe progress and termination reason.
- **Deposit DTO:** owner/session/bin/cycle, snapshotted location, submission `occurredAt`, pinned asset/policy/config, status, null/final totals, lines, settlement/capacity states, accepted attempt, decision version and trace.
- **Processing result DTO:** explicitly supports pending fields; readers must not require final lines/timestamps before finalization.
- **Final result DTO:** stable ID and same batch, canonical outcome, nullable count/points semantics, pinned policy, lines, explanation/reasons, decision time/version/trace.
- **Voucher DTO:** owner/redemption/reward, title, `merchantName` wire mapping, explicit demo terms, unique code, issue/expiry/use time, status, `remainingUses`, offer version.
- **Operation receipt:** actor + operation + request ID + typed fingerprint, committed response/snapshot, domain record IDs and time. Replay returns the original complete receipt.
- **Worker finding:** one candidate ID per physical object, canonical class, resolution/eligibility, normalized nullable geometry, evidence/model/config/source identity. No reward/space amounts from inference.

### 3.4 Exact configuration-key contract

A1/A3 must implement and test this shared manifest. These names are **planned interfaces**; several do not exist yet. Their absence must be fixed, not “solved” by setting undocumented environment variables.

| Key | Consumer and value/source | Secrecy |
| --- | --- | --- |
| `ECOLOOP_FIREBASE_MODE` | Flutter: `firebase` for demo; emulator/mock only explicitly | Public |
| `ECOLOOP_APP_ENV` | Flutter/backend safe diagnostics: `demo` | Public |
| `ECOLOOP_FIREBASE_REGION` | Flutter and resident Functions export options: `us-central1` | Public |
| `ECOLOOP_FIRESTORE_DATABASE` | Flutter, Functions, seed/operator/reconciliation/migration: `ecoloop-db` | Public |
| `ECOLOOP_APP_CHECK_MODE` | Flutter: explicit platform/distribution choice; `demo-debug` requires debug Android + H1 confirmation, `web-enterprise` for actual HTTPS web | Mode public; debug token private |
| `ECOLOOP_WEB_APP_CHECK_SITE_KEY` | Flutter web: H1/H2 verified public Enterprise site key | Public site key |
| `ECOLOOP_WEB_VAPID_KEY` | Flutter web: H2 web push public key | Public key |
| `ECOLOOP_ENFORCE_APP_CHECK` | Resident Functions: `true` for actual demo; internal IAM worker/schedulers use their own auth, not resident App Check | Public setting |
| `ECOLOOP_STORAGE_BUCKET` | Functions/seed: verified existing bucket | Public resource name |
| `ECOLOOP_SOURCE_BUCKET` | Vision: verified bucket for private committed sources | Public resource name |
| `ECOLOOP_ARTIFACT_BUCKET` | Vision/maintenance: verified bucket for durable evidence | Public resource name |
| `ECOLOOP_TASKS_REGION` | Dispatcher/schedules/queue: `asia-southeast1` | Public |
| `ECOLOOP_TASKS_QUEUE` | Dispatcher: `vision-processing` | Public |
| `ECOLOOP_VISION_SERVICE_URL` | Dispatcher/deploy manifest: actual Cloud Run **root URL** | Public endpoint; requires auth |
| `ECOLOOP_VISION_TASK_URL` | Dispatcher: root URL + `/tasks/vision` | Public endpoint; requires auth |
| `ECOLOOP_VISION_AUDIENCE` | Task OIDC: exact accepted Cloud Run service audience/root, independently verified | Public audience |
| `ECOLOOP_TASK_INVOKER_SERVICE_ACCOUNT` | Tasks OIDC signing identity: H2 existing task invoker email | Public identity |
| `ECOLOOP_WORKER_SERVICE_ACCOUNT` | Gateway allowlist: H2 actual attached vision runtime service email/verified subject | Public identity |
| `ECOLOOP_WORKER_GATEWAY_URL` | Vision: actual current `workerGateway` HTTP endpoint | Public endpoint; requires auth |
| `ECOLOOP_WORKER_GATEWAY_AUDIENCE` | Vision→gateway OIDC: exact expected gateway audience, distinct from vision audience | Public audience |
| `ECOLOOP_INSPECTION_CONFIGURATION` | Submission/worker: immutable `demo-vision-v1` identity plus digest | Public identity |
| `ECOLOOP_GEMINI_MODEL` | Vision: exactly `gemini-3.8-flash`, access verified | Public model ID |
| `ROBOFLOW_API_KEY`, `GEMINI_API_KEY` | Vision only, managed Secret Manager version bindings | **Secret — never Dart define/public env file/committed evidence** |

Deprecate the old overloaded `ECOLOOP_WORKER_AUDIENCE` and root-only `ECOLOOP_WORKER_SERVICE_URL` deliberately. During transition, reject inconsistent old/new settings at startup rather than accepting ambiguous aliases. Do not store raw FCM/debug/service/provider tokens in this manifest. No one should have to guess whether “worker audience” means the Tasks target or the callback gateway.

### 3.5 Migration/rollback contract

- A1 creates a preview listing target project/database, collection counts, legacy date/enum/path issues, conflicting wallet sources and proposed changes. No live write occurs in preview mode.
- Apply requires an explicit `--environment=live --project=ecoloop-thesmartrecycling --database=ecoloop-db` contract, scoped migration ID and reviewed developer confirmation. Do not trust ambient gcloud project or a generic `--force` flag.
- Conflicting top-level/nested wallet facts stop for reconciliation; do not add balances together or select the bigger one. Preserve operation IDs, immutable ledger IDs and original issuance/submission times.
- Use conditional/version-checked updates and a per-record migration marker; a second identical run is harmless. Missing evidence/count is recorded unknown, not fabricated.
- Timestamp migration must finish for a queried dataset before enabling Timestamp range/cursor queries on it. Mixed string/Timestamp order is not a valid transitional feed.
- Keep a scoped pre-migration backup and exact changed-record manifest. Restore is a deliberate operator action only after confirming no subsequent business transactions would be overwritten.
- Deployment rollback selects the last accepted compatible image/Hosting/Functions source **and schema/config contract**. Never roll back new ledger entries/balances with an old seed. Do not point the client back at an incompatible collection layout merely to make Home render.
- Live mutation/seed/collection tools show the exact target and intended record scope; no recursive bucket/collection reset is part of demonstration preparation.

## 4. Rules for every executing agent

### 4.1 Before a phase

- [ ] Read this plan, the current tracker row, relevant ultimate-audit findings, and actual source of the named boundary.
- [ ] Read applicable repository/harness instructions. Historical mock-only instructions remain applicable to mock mode; this is explicitly authorized real-backend refactor work.
- [ ] Run `git status --short`, `git diff`, and `git log --oneline -10`. Preserve unfamiliar/untracked developer work.
- [ ] Confirm actual tools and environment. Use PowerShell 5.1-compatible commands and `.cmd` shims where needed.
- [ ] Record source revision, dirty paths, mode/project/database, current phase and next bounded substep.
- [ ] Reproduce the phase's first failing boundary before editing. Read tests critically; a passing old fixture can be irrelevant.
- [ ] Identify exact app/test/config files before changing them. Implement compatible migrations atomically within a bounded substep.

### 4.2 Implementation discipline

- [ ] Keep existing Riverpod/GoRouter/feature repository structure; centralize Firebase/provider composition.
- [ ] SDK types stay in adapters. Application validation and domain rules are shared, small and testable.
- [ ] Use explicit full request/response DTOs; do not fabricate supported versions/traces or default missing pinned business configuration.
- [ ] Keep external Storage/Tasks/provider/FCM calls outside retried Firestore transaction callbacks.
- [ ] Perform all Firestore transaction reads before writes. Generate stable IDs before retries; never print “credited” inside a retried callback.
- [ ] Use one shared pending-intent coordinator per ready UID; no independent clients racing on one preferences slot.
- [ ] On account changes cancel old subscriptions, clear owner caches, and ignore late events. Backend rules remain mandatory even if the app checks owner too.
- [ ] Never expose provider keys, service tokens, FCM tokens, full voucher codes, or raw private responses in logs/commits.
- [ ] No broad dependency upgrades, destructive git operations, forced pushes or admin frontend changes as a shortcut.
- [ ] Run memory-heavy commands sequentially. On OOM record the command/failure and retry a narrower isolated gate; do not rewrite application behavior to hide a host-resource problem.

### 4.3 End-of-phase proof and mandatory commit

- [ ] Run the named unit/contract/emulator/widget gates and directly affected regressions. Distinguish mock, injected-provider, emulator and deployed evidence.
- [ ] Review staged/unstaged diffs and ensure no intentional behavior is supported only by a fake DTO the backend does not produce.
- [ ] Update tracker with changed files, exact commands/results, failing/passing evidence, closed audit IDs, remaining blockers and next read set.
- [ ] Inspect `git status --short`, `git diff`, and `git log --oneline -10` **before committing**.
- [ ] Stage only explicitly reviewed phase paths using `git add -- <file1> <file2> ...`; never `git add .` or stage unrelated native/assets/user files.
- [ ] **Create a separate commit after each completed agent phase.** Suggested messages appear in the phase sections. Commit human phase evidence as instructed in H1/H2/H3 as well.
- [ ] If hooks fail, fix and create a new commit; do not skip hooks or amend without authorization. Do not push unless the developer requests it.
- [ ] Record actual commit SHA. If the phase is blocked, record `BLOCKED` and a truthful checkpoint; never label an incomplete phase complete solely to produce a commit.

This document instructs future phase execution/commits; creating the plan itself does not start the refactor or authorize a cloud deployment with invented inputs.

### 4.4 Repeatable gate command interface

**Each phase must establish its own named scripts/test entrypoints below and document the exact implemented file lists. A1 establishes the shared serial-emulator convention and A1 gate only. These are implementation targets, not commands claimed to work before their owning phase.** Prefer small serial wrappers around existing configs; do not build a generic test framework or import nonexistent future tests.

| Working directory | Command to support | Required coverage |
| --- | --- | --- |
| `functions/` | `npm.cmd run build` | Source/tools typecheck and packaged schemas; existing command |
| `functions/` | `npm.cmd run test:unit` | Pure policy/identity/error/contract tests; existing command |
| `functions/` | `npm.cmd run test:demo:a1` | Account provisioning + actual callable envelope + real-path rules/DTO fixtures; explicit demo project/database |
| `functions/` | `npm.cmd run test:demo:a2` | Session/submission/settlement/reward/review/collection/recovery + independent invariant assertions |
| `functions/` | `npm.cmd run test:demo:a3` | Gateway OIDC verifier/claim/complete/dispatch route/fencing and semantic findings rejection |
| `functions/` | `npm.cmd run test:demo:a4` | Device ownership/send leases/reminder/retention/diagnostic integration |
| `functions/` | `npm.cmd run test:demo:release` | The above named emulator gates serially in an isolated namespace; exits nonzero on failure |
| Repository | `flutter analyze` | Current source/test static check |
| Repository | `flutter test test/demo_refactor/a1_contract_and_home_test.dart --concurrency=1` | New A1 entrypoint: real DTO/auth timing/UID/Home regressions |
| Repository | `flutter test test/demo_refactor/a2_scan_and_rewards_test.dart --concurrency=1` | New A2 entrypoint: production adapter scan/intent/receipt/pagination regressions |
| Repository | `flutter test test/demo_refactor/a4_lifecycle_and_notifications_test.dart --concurrency=1` | New A4 entrypoint: foreground/reopen/owner reset/target routing/permission errors |
| `services/vision/` | `uv run --frozen pytest -q` | Existing and new normalization/threshold/fallback/budget/run-job/schema/replay/evaluation software tests |
| Repository | `flutter test integration_test/backend_resident_journey_test.dart -d <actual-device-id> --dart-define-from-file=<private-local-public-config-file>` | Real candidate app test, using H1 device and all explicit nonsecret build inputs |
| Repository | `flutter test integration_test/backend_recovery_test.dart -d <actual-device-id> --dart-define-from-file=<private-local-public-config-file>` | Real platform reopen/interrupt/ownership recovery; explicit controlled setup |

The integration-test config file contains **only public app configuration**, not provider/service secrets or Firebase Auth tokens. A1 creates genuine assertions for its implemented boundary; A2/A3/A4 create their own entrypoints when their implementation exists. A4 assembles `test:demo:release` after all constituent gates exist. No skipped test/dummy green placeholder can count as coverage. Test scripts must use emulators for financial fixtures and refuse a live default. Actual provider/deployed platform calls are separate explicit H2/A4/H3/A5 runs.

Known current commands such as `npm.cmd run test:accounts`, `test:rules`, `test:sessions`, `test:submission`, `test:settlement`, `test:rewards`, and `test:maintenance` can be reused by serial wrappers after inspecting their current config. Ensure they target the same named database and do not rely on stale default-database fixtures. Emulator success does not validate composite-index deployment; A4 also checks actual READY indexes and real queries.

For the 8-GB Windows machine, begin with serial processes and configured Java heap, for example `JAVA_TOOL_OPTIONS=-Xms64m -Xmx256m`, increasing only if a genuine emulator-memory requirement is observed. Do not run Functions emulators, Flutter compilation, Python heavy imports and cloud builds simultaneously. Shell examples use `.cmd` on Windows; CI uses the corresponding native commands on Linux.

## 5. H1 — Freeze real identities and demo access

**Lead:** developer. **Depends on:** completed audit. **Feeds:** A1/A3/A4.

**Purpose:** remove the exact platform/configuration ambiguities that caused the login struggle, without editing application logic by console trial-and-error.

### Developer checklist

- [ ] Record the exact presentation date/time/time zone and available execution hours in the tracker.
- [ ] Choose the Android device and browser actually used for the presentation. Record Android version, browser version and whether the camera can focus on a QR from a second screen or printout.
- [ ] Record the exact command/Dart defines/native edits used for the already-successful login hotfix. If unsure, collect `git diff` for native/config files and the current launch configuration; do not rely on memory.
- [ ] Open Firebase Console and select **`ecoloop-thesmartrecycling`**. In Project settings → General verify actual Android/web registration IDs; the Android application ID must match the installed app, not just the Kotlin namespace. The historical package is `sd.idk.ecoLoop`; verify the actual file before changing it.
- [ ] In Authentication → Sign-in method confirm Google is enabled and the support email/consent configuration is usable by the intended Google account.
- [ ] In Authentication → Settings → Authorized domains confirm the actual HTTPS Hosting domain and any real browser development domain used for testing. Do not add arbitrary domains.
- [ ] For Android, obtain the fingerprints of the certificate actually signing the demo APK. Register its SHA-1/SHA-256 where required. If `google-services.json` needs refreshing, inspect the downloaded public app/package/client metadata, back up the existing file, replace only the correct protected file yourself, and record the intentional diff. Do not paste OAuth/provider secrets into documentation.
- [ ] Confirm Firestore database **`ecoloop-db`** and Storage bucket; do not create `(default)` as a workaround.
- [ ] Choose distribution now:
  - Selected fast demo path: real Firebase debug APK on the known device without App Check enforcement.
  - Release-signed Play Integrity path only if its signing/distribution and successful attestation can already be established.
- [ ] Keep App Check enforcement disabled for the selected H1 Android debug APK path. Do not generate or publish a debug token unless the distribution decision changes.
- [ ] For web, create/confirm the reCAPTCHA Enterprise site/provider registration for the actual Hosting domain and retain only public site-key/config identifiers for the agent.
- [ ] Confirm you can use Firebase/gcloud/Secret Manager for this existing project. Sign into the tooling yourself if credentials have expired; do not share your login token in chat.
- [ ] Confirm there is a usable Google account for a **fresh** zero-wallet resident and a second account for account-switch testing. Existing personal balances must not be reset.
- [ ] Capture only safe configuration IDs/statuses in `docs/archive/demo_refactor/evidence/H1_ENVIRONMENT.md`; list exact pending configuration items rather than ticking unverified boxes.
- [ ] Commit intentionally changed public native configuration and H1 evidence after inspecting status/diff/log; use explicit file staging. Suggested message: `docs: record demo H1 environment readiness` (or an accurate config message if native files changed). Never include private credentials.

### Agent checklist

- [ ] Assist with **read-only** CLI inventory and exact fingerprint/build commands using the actual files/tools; do not overwrite protected native files.
- [ ] Compare console-provided identities with `firebase_options.dart`, Android app ID, `.firebaserc`, and messaging worker configuration.
- [ ] Populate a public configuration manifest template for the developer; mark unknown inputs `UNVERIFIED`, not guessed.
- [ ] Record console blockers that prevent Auth/App Check deployment, and independent A1 code tasks that can still proceed.
- [ ] Verify H1 artifacts contain no raw tokens/provider keys. Record developer's commit SHA and carry any small pending debug-token registration into A1's developer checklist.

### Exit gate

- [ ] Exact demo platforms, distribution, project/database/app identities and login-hotfix inputs recorded.
- [ ] No accidental second database/project or overwritten wallet.
- [ ] Developer can authenticate tooling; required console tasks have named owner/status.
- [ ] H1 safe evidence committed.

## 6. A1 — One data contract and a working real Home

**Lead:** agent. **Primary findings:** UA-001–011, 016–019, 044–046, 054; groundwork for UA-017/048/055.

**Depends on:** H1 public identity contract. **Milestone:** a real newly authenticated resident reaches a stable usable Home.

### Source/file manifest

Inspect and scope edits in:

```text
contracts/backend/v1/{commands,findings,snapshots}.schema.json and golden/invalid corpus
functions/src/{composition,index}.ts
functions/src/transport/{validation,resident_accounts,resident_sessions,resident_inspections,resident_rewards}.ts
functions/src/application/accounts.ts
functions/src/infrastructure/firestore/{accounts_store,codecs}.ts
functions/tools/{seed,seed-manifest.example}.json/.ts (actual existing file names)
firestore.rules, firestore.indexes.json, storage.rules
lib/core/config/runtime_config.dart
lib/core/firebase/{firebase_clients,command_client,backend_envelope,firebase_converters}.dart
lib/core/data/pending_operation_store.dart
lib/app/bootstrap.dart, lib/app/providers/app_providers.dart
lib/features/account/{data,domain,presentation/controllers}/...
lib/features/{wallet,activity,recycling_guide}/data/firebase_*_repository.dart
lib/features/home/presentation/controllers/home_controller.dart
lib/core/domain/deposit_line_item.dart and affected strict DTO decoders
relevant tests + new cross-boundary contract fixtures
```

Do not trust brace shorthand as an actual filename: expand targets from the repository before edits. New helper/migration/contract files must be listed in the checkpoint.

### A1.1 — Freeze contract and migration strategy

- [ ] Read the physical-layout/minimum-DTO tables above and produce `docs/archive/demo_refactor/evidence/A1_CONTRACT_MAP.md` with writer/read/rule/index/time-type entries.
- [ ] Add the dated demo specification addendum from §1.2. Record every intentional logical/physical alias and the existing US/Singapore region split.
- [ ] Define shared region/database/config constants; remove implicit `(default)` clients/tools. Runtime banner/log identifies real Firebase mode safely.
- [ ] Define strict request unpacking once; validate schema, operation, request ID and payload. Route all exported resident commands through it, including recovery/preferences/devices.
- [ ] Define stable callable error details with domain code/retryability/trace/request/recovery references; map `FirebaseFunctionsException` correctly. Preserve a concise actionable UI message for invalid QR, busy/full, expired, offer changed, insufficient points and permission denial.
- [ ] Use supported enum/version/null semantics. `excluded` maps explicitly to `rejected` for legacy reads; future unsupported values produce recovery, never success.
- [ ] Preserve canonical class in line objects through `toJson`/round trip. Separate it from material category. Do not overwrite incoming schema/version/trace with invented constants.
- [ ] Build a **dry-run-first** migration tool for legacy dates/missing fields/aliases; record counts and conflicts. Real writers use Firestore Timestamp while JSON serializers emit UTC ISO.
- [ ] Migration must distinguish empty/absent/unknown. It must not invent a verified count, award, evidence, or classification time.
- [ ] Export/back up existing affected data using scoped trusted tooling before a live migration. The agent prepares exact preview/apply commands; developer authorizes the actual existing-project scope.

### A1.2 — Repair identity and account services

- [ ] Initialize Admin composition before any handler uses Auth/Firestore; set explicit callable region `us-central1`.
- [ ] Derive email/provider/avatar identity fields from verified Auth. Preserve resident-edited display name and existing wallet/state on repeated bootstrap.
- [ ] Assign missing `role: user` using current trusted claims, preserve `role: admin` and unrelated claims without stale-claim reintroduction. Bootstrap retries repair partial provisioning.
- [ ] Implement/export real profile read/update and preferences read/save with exact supported fields. Profile mutation cannot change UID, role, Auth email or wallet.
- [ ] Serialize bootstrap per UID. Refresh claims after successful provisioning and fence account changes; failed bootstrap has a retry path rather than a cached rejected Future forever.
- [ ] Expose current auth state immediately plus future transitions. Test a subscriber created after login and after cold restored auth.
- [ ] Start/reset all UID providers from **ready** auth, not ad hoc `currentUser` reads. Recreate scan/wallet/activity/rewards/preferences/security subscriptions and clear active scan/result/history state on account changes.
- [ ] Make push initialization/registration failure nonblocking for Home/auth; implement best-effort sign-out cleanup without trapping the user in a signed-in state.

### A1.3 — Make Home and current guide real

- [ ] Point wallet/stats readers at canonical resident subcollections. Home subscriptions watch their repository/UID dependencies rather than using stale `ref.read` bindings.
- [ ] Ensure profile, wallet, stats and empty recent-history decode from actual bootstrap records. Load visible sections with explicit dependency errors; no permanently unresolved event wait.
- [ ] Define complete deposit processing/final DTOs now; temporary missing final fields are represented, not coerced. A2 fills transactional values.
- [ ] Bind `appClockProvider` to advancing real time in Firebase mode. Apply Malaysia calendar boundaries explicitly for all history filters/relative display.
- [ ] Compose guide from actual `acceptedObjectClasses`, rates and class/category maps. Seed real educational content; watch the active pointer and switch subscriptions on version change.
- [ ] Seed actual four demo rewards `reward-snack` 10, `reward-cafe` 25, `reward-meal` 50, `reward-shopping` 75, one resident redemption each, correct food/shopping categories and clear demo terms. Fresh wallets remain zero.
- [ ] Make seed reruns preserve actual occupancy, collection cycles, offer/policy versions and user records. Same-version different policy/offer fails before mutating other data.
- [ ] Sources come from current prepared images uploaded to Storage. Record asset bytes/dimensions/digests and generic display IDs, not the developer's local path as a runtime requirement.
- [ ] Declare all actual resident owner/status/time query indexes and rules. Deny unrelated private records; use exact roles and deny direct wallet/status/capacity/job writes.
- [ ] Add App Check mode configuration: debug-only registered demo Android provider, web Enterprise/public site key and appropriate live provider; do not activate emulator-only behavior in live accidentally.

### A1.4 — Proof checklist

- [ ] Writer→JSON→Flutter contract tests for profile, zero wallet, empty stats, processing/final deposit and voucher shapes. Fixtures must be generated/exported from real production serializers.
- [ ] Actual exported callable request/response tests using the exact Flutter envelope; ensure original UA-006 diagnostic failures are replaced with working handler tests.
- [ ] Late-auth/Home, bootstrap retry, restored session, sign-out→B and old-event tests use production-style immediate auth events.
- [ ] Rules tests read the actual `depositSessions/deposits/depositResults/vouchers` paths, canonical resident subcollections and allowed query shapes; cross-owner and privileged writes fail.
- [ ] Timestamp/date boundary and unsupported-schema/null/canonical-class round-trip tests pass.
- [ ] Run Functions build/unit + affected rules/account emulator gate; run affected Flutter tests and `flutter analyze`. Run sequentially and record actual commands.
- [ ] Deploy only the A1 working account/read/rules changes if needed for the checkpoint; do not claim the old worker pipeline is repaired. Verify live Home on the H1 device/browser with exact source/build identity.

### Developer checklist

- [ ] Complete the small pending App Check debug-token registration privately once A1's known debug app prints it.
- [ ] Confirm the live data migration preview targets only the intended project/database/collections and preserves existing balances; approve the exact apply scope when needed.
- [ ] Launch with the agent-provided explicit Firebase/region/App Check defines; sign in with a fresh intended Google account.
- [ ] Confirm Home leaves loading, displays your name, zero wallet and empty activity; open/retry profile/preferences/guide, then sign out and use the second account.
- [ ] Return exact visible error text, platform/build, time and safe trace/request ID if any step fails. Do not change rules to `allow read, write: if true`.
- [ ] No model labels/classifications are required from you.

### Exit gate and commit

- [ ] Fresh Android/web real auth→Home and safe account-switch evidence exists. A remaining console prerequisite is `BLOCKED`, not a passed Home gate.
- [ ] Contract map and migration summary current; narrowed tests/builds green.
- [ ] Close only demonstrated audit findings; leave downstream transaction/worker findings open.
- [ ] **Commit A1 after reviewing status/diff/log and staging exact files.** Suggested message: `refactor: unify demo Firebase contracts and resident bootstrap`.

## 7. A2 — Transactions, complete scan state, and financial recovery

**Lead:** agent. **Primary findings:** UA-009, 012–017, 020–028, 047, 051, 054.

**Depends on:** A1 contracts, real UID, rules and DTO agreement. **Milestone:** deterministic business journey is correct under duplicate, interrupted and concurrent operations.

### Source/file manifest

```text
functions/src/domain/{types,policy,identity,reward_policy,errors}.ts
functions/src/application/{sessions,submit_inspection,finalize_inspection,rewards,maintenance}.ts
functions/src/infrastructure/firestore/{sessions,inspection,jobs,settlement,rewards,maintenance}_store.ts
functions/src/transport/{resident_sessions,resident_inspections,resident_rewards,schedules}.ts
functions/tools/{operator,inspect,verify_accounting}.ts
lib/features/scan/{data,domain,presentation/controllers,presentation/screens}/...
lib/features/{wallet,activity,rewards}/data/firebase_*_repository.dart
lib/features/{activity,rewards}/presentation/controllers/... and paginated UI
lib/core/firebase/command_client.dart and UID intent coordination
functions/tests/{unit,emulator}/... + affected Flutter scan/history/reward tests
```

### A2.1 — Request intent, reservation and draft correctness

- [ ] Implement shared UID/operation-scoped durable intent coordination with serialized writes and compare-and-clear. A heartbeat cannot overwrite a pending Continue/redemption request.
- [ ] Persist stable intent before calls. On ambiguous failure, query the owned committed operation/session; never erase ambiguity because a different early recovery returned not-found.
- [ ] Start/recover one active session per resident and one reservation per bin. Validate exact enabled QR mapping and processing availability **before** reservation.
- [ ] Collect all expiry/session/reservation reads before writes. Cancel expired matching sessions and their resident references coherently; never release a newer reservation.
- [ ] Save single image choice with expected session version before submission. Replacing A with B persists B; no inference runs until Continue.
- [ ] Coordinate draft writes and renewals so stale versions are refreshed explicitly and submitted identity cannot change.
- [ ] Disable Continue without a loaded valid selection/online validation; preserve retry identity. Remove null-assertion dependencies on unavailable instructions.
- [ ] Discover server `activeSessionId` at foreground/cold reopen and route to actual committed stage/draft/result; offer a real resume link when scanning another bin.
- [ ] After Continue store/publish batch/job/result/policy/cycle/source/deadline and safe job progress. Submitted processing no longer depends on heartbeats.

### A2.2 — One coherent settlement implementation

- [ ] Validate worker findings semantically and by schema **before** financial calculation. Reject duplicate IDs, invalid geometry/class/eligibility, too many objects, and inconsistent empty/unreadable inventories.
- [ ] Load the exact complete immutable policy; missing/corrupt pinned policy produces a recoverable technical hold, never default policy rates.
- [ ] Build a pure finalization plan that separately calculates recognition, eligibility, count, rewards and occupancy. Resolved/unresolved contributions are disjoint per object, including mixed state within one class.
- [ ] In one transaction read batch/job/attempt/result, original cycle/current bin, matching reservation/session/resident, wallet/stats/ledger markers, ticket/event and necessary policy data before writes.
- [ ] Create one initial capacity marker for every terminal outcome, including zero-space empty.
- [ ] Update original cycle contribution total and current bin occupancy/display only if that cycle is current. Preserve raw overflow; clamp display only.
- [ ] For verified eligible objects atomically post one credit, wallet version, ledger and accepted class/material stats. Verified impact does not depend on a positive reward rate.
- [ ] Publish complete stable result/deposit lines/total/policy/trace/state/time/reason fields, accepted attempt and evidence identity.
- [ ] Complete the automatic session and clear **only** matching bin/resident active references for verified/rejected/empty/review.
- [ ] Create one logical notification event for that exact decision version. Provider delivery is outside the transaction.
- [ ] Mark accepted attempt terminal and fence old attempts/deadlines. A late result becomes evidence only after review referral; it cannot credit.

### A2.3 — Terminal recovery, review and collection

- [ ] Deadline/third-attempt/permanent-failure paths invoke the same settlement effects, preserving usable known findings or pinned unreadable 50-spc allowance when no inventory exists.
- [ ] Include failed/exhausted-but-unsettled jobs in recovery; do not exclude a failed third attempt from reconciliation.
- [ ] Distinguish a present processing projection from a durably completed result on lost completion responses.
- [ ] Reconcile pages/due work fairly; one bad job/dispatch error must not prevent all other session expiry/recovery.
- [ ] Define idempotent `resolveReview` domain/harness input: trusted actor, stable request/fingerprint, expected decision version and final validated object decisions.
- [ ] Refuse to close a review ticket if supplied decisions are still uncertain. Apply one pinned-policy credit, original-cycle delta, stats/result/explanation/reason/version/time and new notification coherently.
- [ ] Keep review resolution separate from unrelated current reservations. Retain original automatic outcome and subsequent decision history.
- [ ] Collection checks/replays existing operation first, validates expected current cycle and absence of active processing/session, closes old cycle, creates audited new cycle and resets current occupancy atomically.
- [ ] Provide a controlled admin/operator **review queue report** and authorized harness contracts. A full rewrite of `apps/admin-web` is not part of this plan; the live review ticket/report must be real. Developer need not manually classify images for the demonstration.

### A2.4 — Rewards/vouchers/feeds

- [ ] Use transactional per-resident reward counters plus wallet serialization; validate displayed offer/cost/active/expiry before a genuinely new redemption.
- [ ] Store the complete immutable committed receipt, including issue/redemption times, wallet version/balance, title/merchant/terms, demo and voucher state. Replay reads it **before** current catalog/limit validation.
- [ ] Issue one unique single-use demo voucher with `remainingUses=1`; consumption requires owner/demo/available/server-time and updates status/use event/remaining uses once with no extra debit.
- [ ] Expiry changes only available vouchers and never refunds. Used remains used after expiry. Copy code is clipboard-only.
- [ ] Map voucher fields consistently; immediate receipt is explicitly demo and matches later document reads.
- [ ] Implement owner-scoped wallet ledger/history/voucher queries and actual presentation load-more/reset. No collection-wide private reads with local UID filtering.
- [ ] Use occurrence-time history order/cursors. Live first-page updates remove rows that cease matching; paginated merging remains bounded and does not accumulate infinite “recent two” records.
- [ ] Derive status filters correctly across pending cron updates; do not filter a single arbitrary page and claim complete expired/available pagination.
- [ ] Implement independent reconciliation/rebuild against canonical ledgers, accepted deposit lines, cycles and voucher debits; treat missing/corrupt data explicitly.

### A2.5 — Required invariant table

| Fixture/action | Independent assertions |
| --- | --- |
| 2 bottles + 3 cans + bag + cardboard | 37 points, 61 spc, six accepted items, one batch, 0.145 estimated kg |
| Same batch in opening-10 bin | Bin and original cycle show 71 occupied spc after one posting |
| Cardboard only | Rejected completed receipt, 0 points, 15 spc, no positive stats/credit |
| Two bottles + one unknown | Whole-batch review, null points, 30 spc, released automatic session |
| Resolve unknown to bag | One 13-point credit, space corrected 30→28 by -2, stats/event/version updated |
| Collection before that resolution | Correct old cycle only; newly emptied current bin stays empty |
| Validated empty | Zero/zero final receipt and posting marker; empty cannot coexist with visible findings |
| No inventory after technical failure | Review, null count/points, 50 spc, no fabricated lines, released lease |
| Repeated submit/finalize/review/use | Same business IDs; no second credit/capacity/voucher/use event |
| Deadline vs completion / third failure | Exactly one coherent terminal state and no stuck active session |
| Wallet 37, cafe 25 | Balance 12, one debit/voucher, complete original replay after offer edit |
| Concurrent distinct spending | Nonnegative wallet, correct version sequence and resident limit |
| Account switch / cross-owner reads | No A data shown as B; private reads and forged writes denied |

### Developer checklist

- [ ] Provide a second screen/printed QR and use the seed-generated code for the intended normal bin.
- [ ] On the A2 checkpoint app, confirm the complete pre-submit screen sequence, explicit selection, disabled Continue with none, replacement and cancel/reopen behavior.
- [ ] Confirm prompts/text are understandable; send a screenshot and safe ID for errors.
- [ ] Review the migration/seed preview if new fields/counters require live backfill; do not manually edit a wallet or set a final status in Console to make the test pass.
- [ ] No annotation or manual inference decision is required from you. The numerical table uses controlled software fixtures; the real-provider acceptance is A3/H3.

### Exit gate and commit

- [ ] Required invariant table passes on Firestore emulators using production stores, not just in-memory calculators.
- [ ] Real client callable/rules/DTO boundaries tested; scan/reward/history UI regressions and analyze/build pass.
- [ ] Converted audit diagnostics now have proper requirement-oriented regression counterparts; keep historical audit output clearly historical.
- [ ] **Commit A2** with reviewed exact paths. Suggested message: `refactor: repair demo settlement and transaction recovery`.

## 8. A3 — Real Tasks→vision→settlement pipeline

**Lead:** agent. **Primary findings:** UA-028–038, 047–050, 052.

**Depends on:** A2 validated settlement/attempt/source contracts. **Milestone:** real pixels produce a genuine bounded final receipt or review through the same production path.

### Source/file manifest

```text
functions/src/infrastructure/{cloud_tasks,logger}.ts
functions/src/infrastructure/firestore/{inspection,jobs,settlement}_store.ts
functions/src/transport/{internal_jobs,dispatch}.ts
services/vision/src/ecoloop_vision/{config,main,logging}.py
services/vision/src/ecoloop_vision/application/{inspect_image,run_job,ports}.py
services/vision/src/ecoloop_vision/adapters/{detectors,specialist,gemini}.py
services/vision/src/ecoloop_vision/domain/{models,taxonomy,resolution,matching}.py
services/vision/src/ecoloop_vision/infrastructure/{job_gateway,artifacts,images,contract_validation}.py
services/vision/src/ecoloop_vision/tools/{replay,evaluate,benchmark}.py
services/vision/model_registry.json, Dockerfile, locked dependencies as needed
contracts/backend/v1/..., focused Python/Functions boundary tests
```

### A3.1 — Make the private transport real

- [ ] Initialize SDK composition before verification; verify Google service OIDC using the real issuer, exact gateway audience, verified service email/subject and required invoker authorization. Do not call Firebase resident `verifyIdToken` on a Google service token.
- [ ] Replace placeholder worker subject/issuer with the allowed attached runtime identity. Test invalid issuer/audience/subject and resident tokens against the actual HTTP handler.
- [ ] Separate `VISION_SERVICE_AUDIENCE` (root) from `VISION_TASK_URL` (`/tasks/vision`); gateway audience/URL is a different explicit setting.
- [ ] Claim supplies the exact immutable Storage path/generation/hash and allowed evidence prefix/config identity. Source loader uses attached identity/private bucket reads, not an unauthenticated guessed URL template.
- [ ] Validate bytes/MIME/geometry/digest before providers. Bound source file size to 10 MiB, decode pixel limits and internal resizing; preserve original transforms for normalized boxes/crops.
- [ ] Fail production startup if gateway, source bucket or durable artifact writer is absent. Temporary local artifacts are test/operator-local mode only.
- [ ] Task handler awaits durable completion or a durably recoverable terminal/failed attempt before acknowledgment; no untracked background completion after HTTP 200.

### A3.2 — Confidence and fallback decision contract

Create an immutable `demo-vision-v1` configuration and record its digest. Initial values below are **conservative software settings, not measured/calibrated probabilities**. Do not quietly relax them to force green receipts.

| Decision | Initial demo rule |
| --- | --- |
| Detector output | Call A and B on the same image; retain raw labels/scores/source model separately |
| Proposal preservation | Request a provider-supported proposal floor (initial 0.20 where configurable). Retain any returned lower-score plausible proposal as uncertainty too; never delete a returned 0.01-score object and call it absent. No useful proposals triggers image-wide fallback |
| Normal auto-resolution | Reconciled supported specific class with score ≥0.85 in its own model, no conflicting usable evidence, valid count/geometry and all required provider stages successful |
| Low-confidence/conflicting/generic subtype | Route the existing candidate or whole unresolved batch to Gemini; D may supply applicable supporting evidence but cannot suppress required Gemini escalation |
| Missing useful proposals / detector technical failure | Full-image Gemini inventory required; never assume empty or enable an unreviewed reduced YOLO path |
| Gemini usable decision | Schema-valid distinct bounded visible-object inventory, allowed canonical class, no unresolved eligibility/count/visibility flags, coherent geometry/evidence; minimum returned object confidence 0.90 is an additional conservative gate, **never sufficient alone** |
| Full-image-only reward decision | Obtain bounded consistency/grounding verification against the same pixels with a separate structured verification request; disagreement/uncertain inventory → admin |
| Gemini low confidence/unavailable/invalid/ambiguous | Whole transaction review, null points, preserved findings/evidence and provisional occupancy |
| Empty | Affirmative image-wide `emptyConfirmed` + consistency verification + no usable visible-object proposals; disagreement → review |
| Confident excluded objects | Zero-credit receipt with ordinary occupancy; do not send to review merely for ineligibility |

Every final result should include a safe decision-path label such as `yolo_resolved`, `gemini_crop_resolved`, `gemini_inventory_resolved`, `review_uncertain`, or `review_technical`. These describe execution, not guaranteed accuracy percentages.

### A3.3 — Provider implementation checklist

- [ ] Create one composition used by Tasks and controlled operator smoke. Enable/disable flags actually control all providers.
- [ ] Load versioned model IDs/class maps/taxonomy/preprocessing/prompt/settings from the pinned registry/config, not scattered hardcoded defaults.
- [ ] Preserve model-native score meaning. Do not average or take a global max as “batch confidence.” Safe UI confidence is a defined band/path, not a fabricated calibrated percentage.
- [ ] Normalize original-image boxes, retain pixel transforms only for image operations, and reconcile one physical object once before counting.
- [ ] Preserve uncertain unmatched objects. Attached/loose caps and class-specific exclusions use explicit count rules; uncertain identity/duplicate overlap goes to review.
- [ ] Apply D scores only where vocabulary is useful, updating an existing candidate rather than adding counts. Enforce multi-label conflict semantics.
- [ ] Use mode-specific Gemini prompts with the **same exact allowed canonical labels** as the validator, candidate ID for crop mode and one-object-per-item inventory for full-image mode.
- [ ] Do not send source filename/display label/evaluation answers to the prompt. Include only actual pixels and legitimate recognition/counting instructions.
- [ ] Gemini response lists individual objects with unique IDs, one physical count each; reject aggregate huge counts, multiple crop decisions, inconsistent identity/boxes and unsupported labels.
- [ ] Crop fallback may explicitly reject a tested false detector proposal; it contributes no object/space/points and remains diagnostic evidence. This is distinct from a real excluded item, which still occupies space.
- [ ] Use nullable geometry where honestly unavailable. Missing geometry must not be fabricated as a whole-image box to pass a validator or count check.
- [ ] Persist prompt/model/config IDs, raw response reference, usage, latency and normalized findings before settlement. Provider self-confidence alone never establishes acceptance.
- [ ] Preserve useful CV-only completion when Gemini alone is unavailable **and no unresolved decision needs Gemini**. Missing A/B key/API error must not be hidden as a valid degraded YOLO pipeline.

### A3.4 — Actual budgets, leases and retries

- [ ] Use an absolute 300-second submission deadline, including queue/cold start/provider/artifact/finalization time. Worker reads remaining budget before every stage.
- [ ] Configure Cloud Run request timeout and Tasks dispatch deadline coherently at 300 seconds; application stops provider work with enough remaining time for artifacts/finalization. Target a normal rehearsed case comfortably below 90 seconds.
- [ ] Keep 90-second execution leases renewed every 30 seconds with attempt fencing while genuine work runs. Stop renewals and reject completion after deadline/ownership loss.
- [ ] At most three **claimed executions**. Queue delivery retries may be separately bounded, but may not create additional claimed work beyond three or beyond the absolute deadline.
- [ ] Use actual provider HTTP timeouts, no background thread timeout that leaves calls running. One bounded transient retry; permanent credentials/model/schema errors do not retry as network failures.
- [ ] Initial per-submission bounds: A/B once each per execution, at most four useful D crops, at most four crop fallbacks **or** one full-image fallback plus one verification request; maximum 12 physical objects. Record exact cumulative provider-call bounds across retries.
- [ ] When too many objects/crops/budget exhaustion prevent a complete decision, return review, not a truncated verified count.
- [ ] Store/reuse successful checkpoints only when image/model/config fingerprints agree. Checkpoint references must actually exist.
- [ ] Add generation-scoped retry deliveries for due recoverable jobs with one active lease, deterministic naming, and reconciler repair of dispatched-but-lost work. Duplicate delivery is not another deposit.

### A3.5 — Prove the original defects are gone

- [ ] Both detectors fail → review, never empty.
- [ ] No proposals and Gemini fails → review with no invented zero inventory.
- [ ] 0.01 YOLO score reaches Gemini; it cannot auto-credit solely from that score.
- [ ] D evidence changes the correct existing candidate where applicable; unsupported D output cannot establish a subtype.
- [ ] Gemini invalid JSON/unsupported label/low confidence/duplicate ID/ambiguous count/unbounded object response → review.
- [ ] Full-image-only accepted inventory has real per-object identity and successful consistency check; empty requires affirmative evidence.
- [ ] Service token verification uses actual signed HTTP contract; source loads privately; durable artifact references/generations and normalized schema all pass.
- [ ] Failed/late/duplicate completion preserves correct A2 accounting and released session.
- [ ] Fix evaluator software denominators so unmatched rewarded false positives count against precision, runtime review is not auto-completion, and extra duplicates cannot inflate success. No dataset preparation is added.
- [ ] Replay verifies image digest and matching/provider configuration and reproduces saved decisions without fresh provider calls.
- [ ] Run focused Python/Functions gateway and run-job tests, existing vision suite, cross-runtime golden checks and builds.
- [ ] Prepare the exact H2 config/IAM/secret manifest and bounded real-provider smoke command; never ask the developer to infer missing settings from stack traces.

### Developer checklist

- [ ] Ensure Secret Manager/provider access is available for the exact requested hosted models and `gemini-3.8-flash`; provide **secret resource names**, not key contents in chat.
- [ ] If provider access fails, resolve account/billing/endpoint access. Do not replace the model ID, train a model, or paste a provider key into Flutter.
- [ ] Allow the bounded real API smoke run after reviewing its maximum call count. Return actual provider access/billing error text safely if necessary.
- [ ] Review the app's normal result vs pending-review wording. You do not label images or create a benchmark dataset.

### Exit gate and commit

- [ ] The complete production composition is testable; all injected fault cases end correctly.
- [ ] Real provider smoke uses actual pixels and records bounded call/model/config/trace metadata; H2 may still own final live infrastructure deployment readiness, not unresolved code.
- [ ] No required runtime input remains a placeholder or a local file/PC server dependency.
- [ ] **Commit A3** with reviewed exact files. Suggested message: `refactor: connect bounded vision fallback and trusted job execution`.

## 9. H2 — Console/provider/infrastructure handoff

**Lead:** developer. **Depends on:** A3's generated exact environment/IAM manifest. **Feeds:** A4 candidate deployment.

### Developer checklist

- [ ] Use the project's existing billing/API settings to ensure Functions, Cloud Run, Tasks, Scheduler, Artifact Registry, Storage, FCM, Secret Manager and required token verification/services can run.
- [ ] In Secret Manager create/confirm the agent-listed Roboflow/Gemini secret resources and enabled versions. Enter key contents privately in Console or approved local tooling. Record version IDs, not contents.
- [ ] Verify the attached vision runtime and task-invoker service accounts named in the manifest. Do not use a downloaded service-account JSON key in the app/container.
- [ ] Apply the **exact scoped IAM bindings** prepared by the agent: task enqueue/token-creation as needed, task→vision invoke, vision→gateway invoke/verification, source-read, evidence create/read, and generation-delete for maintenance. Avoid Owner/Editor grants as a workaround.
- [ ] Confirm private invocation and intended ingress. An ingress restriction must actually admit same-project Tasks with the configured audience; a hostname alone is not proof.
- [ ] In Project settings → Cloud Messaging verify web push configuration and obtain the public VAPID key. Ensure FCM API/service authorization is active.
- [ ] Confirm App Check web domain/provider and the known Android debug token from H1/A1; keep attestation settings consistent with the actual candidate build.
- [ ] Confirm the resident Hosting target/domain, HTTPS certificate and Google authorized domain match the exact manifest. The admin target is separate.
- [ ] Review `functions/.env.<project>` or equivalent generated local runtime inputs by **key names and public values only**: named database, explicit regions, task route, separate audiences, gateway URL, allowed runtime identity, buckets/config IDs. Secrets stay in managed secret bindings.
- [ ] Confirm the current `gemini-3.8-flash` endpoint really works for image+structured requests. If access differs from historical smoke, report the exact blocker; do not quietly substitute another model.
- [ ] Review the one-time demo call/build budget and available billing alerts. No manual labeling or model training is required.
- [ ] Record safe console/CLI confirmation in `docs/archive/demo_refactor/evidence/H2_CLOUD_HANDOFF.md`; the agent must verify live configuration instead of trusting checked boxes.
- [ ] Commit only safe H2 evidence/public config changes after status/diff/log review. Suggested message: `docs: record demo H2 cloud handoff`.

### Agent checklist

- [ ] Generate a key-by-key manifest with **source of value, expected type, consumer, verifier and secrecy classification**. Eliminate placeholder `worker-service`/`trusted-issuer` and root/route ambiguity.
- [ ] Supply copy-ready commands with verified existing resource IDs and no secret interpolation into logged command lines.
- [ ] Run read-only configuration/IAM checks after developer changes; verify separate invoker/runtime identities and least-needed artifact scopes.
- [ ] Perform one authenticated private transport preflight and one real source-read/artifact-write check with safe disposable diagnostic identity, avoiding settlement side effects.
- [ ] Record exact remaining blockers. A console action belongs to the developer, but an absent adapter/HTTP verifier still belongs to the agent.
- [ ] Verify no secrets/native unrelated changes entered the staged handoff; record H2 commit SHA.

### Exit gate

- [ ] Full runtime inputs and private identity paths are verifiable; required provider calls are accessible.
- [ ] FCM/VAPID/Hosting/App Check match actual demo platforms.
- [ ] H2 handoff contains exact nonsecret values and successful verifier results, not screenshots of unrelated console pages.
- [ ] Safe H2 evidence committed.

## 10. A4 — Integrate app, operations, and deploy a candidate

**Lead:** agent. **Primary findings:** UA-010, 012–022, 038–050, 053–055.

**Depends on:** A1–A3 code gates + H2 configured access. **Milestone:** complete current deployed demo candidate on Android/HTTPS web.

### Source/file manifest

```text
lib/app/{bootstrap,eco_loop_app,providers,router}/...
lib/features/{scan,home,activity,account,rewards,notifications}/...
functions/src/application/{notifications,maintenance}.ts
functions/src/infrastructure/firestore/{accounts,notifications,maintenance}_store.ts
functions/src/transport/{notification_dispatch,schedules}.ts
functions/tools/{seed,operator,inspect,verify_accounting}.ts
web/{index.html,firebase-messaging-sw.js}
permitted AndroidManifest changes; protected native edits remain developer-owned
tools/backend/{deploy_poc,deploy_vision,build_web_config}.ps1
infra/{cloudrun.vision,cloudbuild.vision}.yaml, firebase.json, .github/workflows/backend-ci.yml
integration_test/backend_resident_journey_test.dart
integration_test/backend_recovery_test.dart
affected rules/indexes, tests and demo/operator docs
```

### A4.1 — Finish the visible app and lifecycle

- [ ] Use server-backed scan instructions/content; remove remaining required-feature placeholders, mock completions and null assertions in Firebase mode.
- [ ] Every stage has loading/error/retry/expired/cancelled handling and correct unknown/null/zero/mixed-material presentation.
- [ ] Real QR camera permission denial/duplicate capture/disposal is recoverable. A QR from the seed maps to the actual registered bin.
- [ ] Present safe progress from the accepted job/session projection; do not grant residents backend job/attempt mutation access to obtain progress.
- [ ] Cold reopen and stale URL resume the server stage, including terminal review/result. Heartbeats stop offstage/background/sign-out and cannot race a pending financial command.
- [ ] Wire real wallet/history/guide/reward/voucher paginated reads; filters and status counters reset on UID/filter changes.
- [ ] Home updates after settlement and redemption without restarting; verified/review/rejected/empty outcomes remain distinct.
- [ ] Simulate voucher use visibly calls the backend once; copy code remains independent. Foreground resume/next-expiry triggers update time-derived voucher state without offstage polling loops.
- [ ] All owner screens clear for account changes and preserve last good same-owner state only on legitimate transient errors.

### A4.2 — Notifications and admin referral

- [ ] Register installations/tokens through a transactional trusted global association; disable previous owner associations atomically.
- [ ] Handle permission denied/FCM unsupported/token refresh failures without blocking login/recycling/sign-out. Serially fence owner transitions.
- [ ] Dispatch source-versioned intents using expiring leases and bounded retry; reclaim `sending` after crash. Track delivery per legitimate device, not “first successful device wins.”
- [ ] Before reminder send, recheck voucher owner/status/expiry and current preference/device. Used/expired vouchers do not get new stale reminders.
- [ ] Use safe generic notifications where account association could change; details are loaded after authorized target access.
- [ ] Use the composed GoRouter directly or a valid descendant context. Handle notification-open separately from foreground arrival; verify target ownership/current ready UID before navigating.
- [ ] Support both deposit and voucher targets, initial/deferred auth opens and duplicate-event suppression.
- [ ] Web uses one notification display path and a tested click handler/scope. Do not combine SDK auto-display with manual duplicate `showNotification`.
- [ ] Review creates a genuine open `reviewTickets` record with reason, batch/source/policy/object evidence and null held points. Provide a safe authorized operator review-queue report and friend-facing contract; do not imply the existing mock admin website is live-integrated.

### A4.3 — Retention, diagnostics, maintenance, and costs

- [ ] Normal accepted/reviewed artifacts create generation/digest-backed manifests. Unresolved tickets have no purge eligibility; resolved artifacts become due exactly resolution+30 days.
- [ ] Maintenance uses the same exact evidence namespace; rechecks owning decision/ticket eligibility and protects shared source assets.
- [ ] Purge claims have recoverable leases/retries for `purging`/`purge_pending`; delete only exact object generation and record unavailable/purged status.
- [ ] Schedule recovery/expiry/reminders in the named database and Malaysia schedule; page fairly and isolate individual failures.
- [ ] Finish correct read-only inspect traversal using the same stable ID algorithm, including session→job/batch/result/evidence/ledger/events. Redact raw tokens, voucher codes, provider secrets and unneeded private fields.
- [ ] Propagate trace/request/session/batch/job/attempt/decision/config IDs through actual app/Functions/worker boundaries. Log committed effects after transaction success.
- [ ] Run independent accounting comparison against the real candidate demo records without changing them. No manual “repair balance” button in inspection.
- [ ] Enforce configured provider/concurrency/attempt/object/artifact bounds; record measured demo latency/call count. Do not claim an all-in RM50 measurement if billing inputs remain unavailable.

### A4.4 — Reproducible build/deployment

- [ ] Deployment always builds Functions and packages contracts before deploy; fail if generated output/config is stale or missing.
- [ ] Build manifests include source SHA, dirty bundle identity if any, schema/config/registry/lock digests and pinned container image digest. A SHA label alone does not prove a dirty build matches it.
- [ ] Validate existing-project app options/database/regions and every URL/audience/env consumer before live deploy.
- [ ] Configure managed secret **versions**, source/evidence buckets, worker gateway/identity, immutable processing config, queue route and actual HTTP timeouts. Do not clear required env with a partial `--set-env-vars` replacement.
- [ ] Apply/inspect intended Cloud Run service and revision concurrency/instance/health/timeouts. Choose request-based CPU/billing settings unless measured evidence justifies another configuration.
- [ ] Deploy narrow rules/indexes first as required, wait for actual indexes to be READY, then current Functions/vision/Hosting/app builds in the documented dependency order.
- [ ] Verify deployed image digest, gateway/Tasks route, attached identities, actual environment key set and private invocation. Inspect a real job trace; a provider-only `/operator/probe` is insufficient.
- [ ] Build Android for the H1 distribution and web for actual HTTPS host with explicit mode/region/App Check/VAPID inputs. Avoid launching a different old installed app by package/signature confusion.
- [ ] CI must include contract paths, indexes, infra/deployment tools and actual relevant branches; run the meaningful account/session/settlement/reward/recovery/rules emulator gates serially, Flutter tests/analyze and vision suite. Provider calls are explicit budgeted runs outside untrusted CI.

### A4.5 — Candidate acceptance before handing it to the developer

- [ ] Full fresh-user **real Firebase** flow reaches a genuine automatic verified receipt on at least one current prepared clear input; record IDs and source/config without encoding an expected label in runtime metadata.
- [ ] Wallet/history/stats/bin/cycle reflect that same result. Earn sufficient real points through legitimate repeated sessions, then redeem/use a demo reward.
- [ ] Force uncertainty/provider failure through an isolated emulator/injected-adapter test, and observe a real review-path record from available evidence where possible. Never break global live credentials just to create a demo review.
- [ ] Permission denial, invalid/full/busy QR, reopen before/after Continue, account switching and offline ambiguity gates are exercised with explicit IDs.
- [ ] Real FCM token and foreground/background/open paths tested where devices/browser allow; denial remains business-nonblocking.
- [ ] Record `docs/archive/demo_refactor/evidence/A4_CANDIDATE_RELEASE.md`: source, build/artifact digest, Hosting URL, Android package/signing/distribution, regions/database, service revision, queue/runtime config, test results and open H3 observations.
- [ ] Supply the developer with the **exact** install/build/open URLs and short H3 checklist; no guesswork about which APK/QR/Hosting version is current.

### Developer checklist

- [ ] Install/open only the identified Android candidate and exact HTTPS Hosting URL.
- [ ] Grant/deny camera and notification permission deliberately on the known test platforms; allow the agent to record safe delivery/camera evidence.
- [ ] Confirm the generated QR is available on a second screen or paper and Internet access is stable for demo venue conditions.
- [ ] Sign into the intended accounts; report real visible errors/IDs. Do not edit backend final states or wallet values to bypass a failing test.
- [ ] Complete only any console permission/token confirmation identified by a specific error. No manual image labeling/classification tasks.

### Exit gate and commit

- [ ] Current deployed candidate covers the core path; critical business/security/processing failures are not handed to H3 as “human testing needed.”
- [ ] Required builds/tests and current release manifest recorded; H3 receives exact artifact identities.
- [ ] **Commit A4** with explicit reviewed paths. Suggested message: `refactor: integrate and deploy the real demo journey`.
- [ ] If final artifact was built before the commit, record the exact dirty-source digest and rebuild/redeploy from that commit in A5 before freezing; do not claim commit identity without proof.

## 11. H3 — Independent device/browser demonstration rehearsal

**Lead:** developer. **Depends on:** A4 candidate identity. **Feeds:** A5 exact final defects/acceptance evidence.

This is ordinary use/rehearsal. **You do not annotate images, classify waste, create labels, or train anything.** Confirm that the real result comes back, its source/path is visible, the app is usable, and the resulting wallet/history/voucher operations agree with the displayed receipt. The agent verifies software/evidence invariants and handles test fixtures.

### Developer checklist — perform on Android and HTTPS web

- [ ] Record candidate release ID/URL/APK, device/browser, current time and network. Close any old localhost/mock app so there is no accidental mock demonstration.
- [ ] Sign in with a new intended Google account. Home loads with your identity, zero wallet and no fake historical grants.
- [ ] Navigate profile/preferences/guide/history/rewards and back; reload Home. No permanent spinner/generic fatal page.
- [ ] Scan the actual generated QR with the real camera. Confirm bin identity/location and all Bin Found → Ready → Item Detected stages appear.
- [ ] On Item Detected, no image selected means Continue disabled. Select one, choose another, then Continue; no inference begins on selection alone.
- [ ] Confirm processing shows real status and ends with a clear receipt or pending review. Record safe session/job/result ID and approximate elapsed time.
- [ ] For the agreed normal prepared demo input, confirm the candidate has a rehearsed automatic result path; if every run goes to review, report **FAIL — no useful automatic demo** rather than treating this as success.
- [ ] Confirm displayed earned points match the change in wallet, one history row and the same bin's updated displayed occupancy. The agent checks detailed ledger/cycle math.
- [ ] Navigate away/reopen before and after Continue; the existing session/result returns rather than a second deposit.
- [ ] Double-tap/retry once where the UI allows it; one result/credit only. Do not rapidly spam providers.
- [ ] Earn enough points using legitimate completed demo sessions, then redeem a specified demo reward. Wallet decreases exactly by displayed cost, one voucher appears with clear demo terms, and the actual issued data survives reload.
- [ ] Copy code; voucher remains unused. Use **Simulate voucher use**; it becomes used once and does not debit points again.
- [ ] Sign out, then sign into the second account. No old resident's name/wallet/history/scan/voucher remains visible.
- [ ] Test invalid QR and the supplied full-bin QR; receive a recoverable specific message, with no new stuck session.
- [ ] Deny camera once, then recover using platform permissions/retry. Deny push once; recycling/Home still work.
- [ ] With push granted, background the app/browser and observe the agreed result/reminder test; open it and reach an authorized appropriate target once.
- [ ] Observe a real pending-admin receipt/ticket/report supplied by the agent's safe review case. No manual classification/approval is required from you.
- [ ] Rehearse in the same venue/network conditions if available. Keep power/QR/known current URL accessible.
- [ ] Record each item as `PASS`, `FAIL`, or `BLOCKED` with platform, time, visible text and safe IDs. Screenshot failures only after removing private tokens/full voucher codes.
- [ ] Save observations to `docs/archive/demo_refactor/evidence/H3_REHEARSAL.md`. Commit safe evidence after status/diff/log review; suggested message: `docs: record independent demo H3 rehearsal`.

### Agent checklist

- [ ] Provide a one-page exact click sequence, current artifacts and safe trace display; no console maze for the developer.
- [ ] Independently trace the developer's IDs through actual job, provider decision, artifacts, settlement, cycle/wallet/stats, result, notification and voucher.
- [ ] Separate software defect from browser/device permission/configuration failure using concrete evidence.
- [ ] For every H3 failure create a specific A5 fix/retest item; do not ask the developer to restart repeatedly without diagnosing the first failed boundary.
- [ ] Confirm developer performed no labeling/manual prediction injection. Keep privacy-safe evidence and H3 commit SHA.

### Exit gate

- [ ] Both platforms have actual observations, including a usable real automatic result path and a truthful review path.
- [ ] Any failure has exact reproduction/IDs and owner, not “works for agent.”
- [ ] H3 observations committed and handed directly to A5.

## 12. A5 — Close rehearsal defects and freeze the demonstrated release

**Lead:** agent. **Primary findings:** all remaining UA IDs; final authority is independently observed behavior.

**Depends on:** H3 observations. **Milestone:** a reproducible, rehearsed demo release with no unresolved blocking core defect.

### Agent checklist — defect closure

- [ ] Reproduce every H3 failure against the exact candidate, fix the smallest correct boundary and add/repair the meaningful regression assertion.
- [ ] Keep the original audit and its captured diagnostics as historical evidence; add requirement-oriented fixed regressions under the ordinary test directories. Do not edit the captured baseline into a retroactive pass.
- [ ] Recheck the original path and directly affected neighboring flows; do not broaden testing endlessly after green gates unless new evidence justifies it.
- [ ] Review every UA-001–055 tracker disposition: `FIXED + evidence`, `DEMO-SCOPE CHANGE + authorized rationale/evidence`, or `OPEN BLOCKER`. Nothing disappears because a new plan exists.
- [ ] Statistical CV measurement may be `DEMO-SCOPE CHANGE` under §1.1; corrupted metric formulas, fabricated outcomes, broken recognition routing or infinite processing cannot.
- [ ] Verify source app contains no Firebase-mode placeholder/TODO handler required for the journey, mock completion/canned success, default fake resident/balance, public provider secret, or arbitrary Storage-path submission.
- [ ] Re-run contract/time/role/owner rules gates, session/settlement/reward/recovery emulator invariants, affected Flutter suite/analyze, vision/provider/fallback tests and intended platform builds.
- [ ] On this host run checks sequentially; record OOM as tooling failure, use lower-memory serial gates, and do not fabricate a whole-suite pass.
- [ ] Re-run one normal fresh-account deployed trace and one review/recovery trace after final fixes. Confirm released reservations, same receipt identity, no duplicate finance and correct original-cycle occupancy.
- [ ] Run the read-only accounting/reconciliation tool on the rehearsal records. Investigate discrepancies; do not silently edit records until the tool turns green.
- [ ] Confirm real notification click permissions/targets and exactly one display on the demonstrated browser/device; denied permission remains a supported nonblocking condition.

### Agent checklist — commit/build/deploy/freeze order

- [ ] Record H3 defect closures and final gate results in the tracker before commit.
- [ ] Inspect `git status --short`, `git diff`, and `git log --oneline -10`; stage only reviewed A5 paths.
- [ ] **Commit A5 implementation**. Suggested message: `fix: close demo rehearsal defects and freeze release`.
- [ ] Build/deploy the exact committed source; pin actual container digest and managed secret/config versions. Verify current live revisions/Hosting/Android artifact identity after deploy.
- [ ] Run a short post-deploy smoke against those exact artifacts; include Home, QR→real result→wallet/history and voucher access. A pre-commit smoke is not a substitute.
- [ ] Add final manifest/handoff/evidence and create a **small documentation commit** if needed. Identify separately the implementation build SHA and documentation-only SHA; do not rebuild solely for a docs-only commit or mislabel the artifact.
- [ ] No last-minute dependency upgrades, region moves, rule relaxations or model-ID swaps after acceptance. Any production-affecting change invalidates the affected gate and needs a new artifact identity/retest.

### Developer checklist

- [ ] Recheck any specifically fixed H3 item on the new artifact; the agent supplies exact changes and install/URL instructions.
- [ ] Confirm final APK/URL/QR are the ones you will show judges, not an older installed/browser-cached candidate.
- [ ] Keep a fresh normal demo account and prepared assets available, with sufficient legitimate earning opportunity for the reward demonstration.
- [ ] Keep review as a normal explanation: “The system could not verify this batch confidently, so no points are issued and evidence goes to admin.” Do not claim a review record is a completed credit.
- [ ] Know how to open the safe queue/diagnostic report and how an authorized collection resets a full demo bin. No private service/API keys are entered during the presentation.
- [ ] Confirm the final one-page demo checklist and release identity; no annotation/classification work is required.

### Required release handoff

- [ ] `docs/archive/demo_refactor/evidence/FINAL_RELEASE.md`: implementation/build SHA, clean/dirty identity, image digest/revision, Hosting URL/version, APK hash/package/signing/distribution, database/regions, config/registry/schema/lock digests, verification table.
- [ ] `docs/archive/demo_refactor/DEMO_RUNBOOK.md`: exact startup/login/QR/selection/result/redeem/use/review demonstration, expected state transitions, safe trace lookup and permission recovery.
- [ ] `docs/archive/demo_refactor/OPERATOR_RUNBOOK.md`: authorized seed-preview/collection/recovery/readonly inspection, precise project/database arguments, privacy-safe logs and bounded provider smoke.
- [ ] Tracker maps every finding and phase to concrete evidence/commit or explicit remaining blocker.
- [ ] State the demonstrated scope honestly: real inference and end-to-end accounting proven for rehearsed paths; unmeasured broad CV accuracy/all-in budget/production distribution are not claimed as measured facts.

### Final release gate

- [ ] Fresh Google resident reaches Home on both intended platforms.
- [ ] Real camera + all stages + exact prepared source + real inference reaches useful automatic receipt and truthful review path.
- [ ] Wallet/history/stats/bin/cycle agree; repeated/ambiguous work cannot duplicate effects and technical recovery cannot strand the bin.
- [ ] Reward issue/use/copy/expiry semantics and owner switching agree with server records.
- [ ] Current deployment works independently of the developer PC's vision process.
- [ ] Real platform permission/notification behavior and operational diagnosis are observed.
- [ ] All required evidence/phase commits exist; any remaining demo blocker means **NOT READY**, regardless of clock time.

## 13. Audit-to-phase coverage index

Every audit finding has a primary implementation phase and a final acceptance gate. Secondary phases integrate/verify; they must not assume the primary phase completed undocumented work.

| Findings | Primary phase | Required downstream gate |
| --- | --- | --- |
| UA-001–008 | A1 | A4 real endpoints/auth/Home; H3 platforms; A5 final artifact |
| UA-009 | A2 (A1 coordinator foundation) | A2 intent/concurrency/recovery + A4 actual client |
| UA-010–011 | A1 | A4 lifecycle/time + H3 account switching |
| UA-012–015 | A2 | A4 real QR/reopen + H3 |
| UA-016–019 | A1 contract/seed; A2 transactional feeds | A4 actual data/rules/indexes/UI + H3 |
| UA-020–028 | A2 | A3 trusted worker + A4 actual wallet/receipt/vouchers + A5 reconcile |
| UA-029–038 | A3 | H2 real access + A4 production task trace + A5 replay |
| UA-039–043 | A4 | H2 console inputs + H3 push/review + A5 controlled retention evidence |
| UA-044–046 | A1 (A3 service identity) | H1/H2 attestation/IAM + A4 real authorization |
| UA-047 | A2 admission + A3 provider budgets | H2 account inputs + A4 actual configured controls |
| UA-048–050 | A4 (A3 evidence/transport) | A5 exact build/config/deploy/diagnostic trace |
| UA-051 | A2 | A5 real readonly accounting report/rebuild checks |
| UA-052 | A3 metric software; real statistical measurement demo-deferred | A5 transparent demo scope, no false accuracy claims |
| UA-053–055 | A1 contract tests, A4 CI/active docs | A5 complete independent acceptance/coverage/tracker |

## 14. First executor instruction

```text
Start H1 from docs/archive/demo/ECOLOOP_DEMO_REFACTOR_PLAN.md with the developer.
Read docs/archive/audits/ECOLOOP_ULTIMATE_BACKEND_AUDIT.md and
docs/archive/demo_refactor/EXECUTION_TRACKER.md. Inspect status and actual public
configuration; preserve unrelated user work and protected native files.
Collect exact project/database/regions/distribution/login-hotfix inputs.
Then execute A1 sequentially; do not jump to vision before real Home works.
Use the user-authorized demo direction: no training or manual image labeling,
low-confidence YOLO -> Gemini 3.8 Flash -> admin if still uncertain.
Complete each phase's agent/developer checklists, independently verify its
exit gate, update evidence/tracker, and git commit that phase before advancing.
Do not claim whole-system readiness from fixtures or a provider-only probe.
```
