# EcoLoop Admin Website Backend Activation Plan

- **Plan ID:** ECOLOOP-ADMIN-BACKEND-001
- **Version/date:** 1.0 / 2026-10-20
- **Status:** Proposed implementation baseline; source analysis complete; implementation not started
- **Frontend:** `../../../apps/admin-web` — React 19, React Router 7, TypeScript, Vite
- **Backend:** Extend the existing Firebase/TypeScript backend in `../../../functions`
- **Delivery:** 10 sequential implementation phases, each with checklists, an exit gate, and a mandatory Git commit
- **Related work:** [Resident demo refactor](../demo/ECOLOOP_DEMO_REFACTOR_PLAN.md), especially A1/A2/A3/A4

## 1. Objective and authority

Activate the existing six-page admin portal against the **same real Firebase system as the resident application**:

```text
Real admin sign-in
  -> real fleet and dashboard
  -> register a usable bin and its QR
  -> resident submits a batch through the existing inference pipeline
  -> uncertain/failed batch appears with usable evidence
  -> admin resolves it using the submitted policy
  -> resident receipt, wallet, statistics and bin accounting agree
  -> capacity alert -> scheduled collection -> new empty cycle -> resolved alert
  -> manage real reward offers and publish future program-policy versions
```

The primary correctness authority is the [Backend and CV Specification](../backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md), particularly §§8–10 and §§14–17. The [Demo Recovery and Refactor Plan](../demo/ECOLOOP_DEMO_REFACTOR_PLAN.md) supplies the newer **physical path mapping, existing-project configuration, canonical `rejected` outcome, and demo delivery changes**. Preserve specification invariants while using that explicit mapping. Record any subsequent agreed changes before implementation.

The [10 admin development logs](../dev_logs/2026-10-19_AdminWeb_Phase1_StandaloneProjectAndTheme.md) and [admin mock acceptance report](ADMIN_WEB_ACCEPTANCE.md) explain the existing UI. Their older Firebase handoff assumptions do not override the newer backend/refactor contracts.

This plan adds the administrative transports and workflows deliberately left to a separate plan in specification §17. Implementation includes the necessary React adapters, contracts, form changes, and tests: changing only server code cannot make the current mock contracts correct.

### 1.1 Scope of the first release

- Existing login, overview, fleet, capacity alerts, deposit verification, rewards catalog, and settings screens.
- Real persistent reads, trusted mutations, refresh/reopen recovery, live cross-client updates, authorization, audit records, indexes, and separate admin hosting.
- Existing software-only simulation boundary: logical bin availability, prepared source images, estimated occupancy, and simulated collection.
- Existing hosted inference pipeline remains the producer of review evidence; administration consumes that evidence and calls shared business finalization.
- The `/vouchers` page manages **reward offers**, not issued resident vouchers. Issuance/use stays in the resident backend. There is currently no admin voucher-instance table, merchant redemption portal, resident-management page, or role-management page to activate.

### 1.2 Inputs to confirm during Phase AB-01

Planning can proceed with the following baseline; record actual inputs before live setup:

| Input | Planning baseline | Confirmation needed |
| --- | --- | --- |
| Admin login provider | Firebase email/password, preserving the current form | Intended admin UID/email and whether this provider is enabled; Google login would require an explicit UI/provider change |
| Admin provisioning | Controlled operator grants `role: admin`; no public admin registration | Who provisions the first account and can manage Firebase Auth |
| Hosting | Separate Firebase Hosting site/target named `admin` in the existing project | Actual available site ID/domain; `admin` is the target alias, not an invented deployed site ID |
| App Check | Web reCAPTCHA Enterprise for the actual admin web registration/domain | Public site key/provider registration and applicable enforcement configuration |
| Release order | Coordinate with resident refactor gates below | Actual completed refactor commits/evidence when implementation begins |
| Demo controls | Normal Firebase portal uses real deposits and collection; capacity-injection controls stay in explicit mock/emulator tooling | Any later request for a live capacity-adjustment workflow needs a separately specified audited operation |

No provider keys, account passwords, App Check debug tokens, or service credentials belong in these records.

### 1.3 Phase roadmap

| Phase | Deliverable |
| --- | --- |
| AB-01 | Shared integration contract and resident-refactor handoff |
| AB-02 | Real admin authentication, authorization and command recovery |
| AB-03 | Firebase read adapters, search, pagination, projections and indexes |
| AB-04 | Bin management and usable registered QR codes |
| AB-05 | Immutable program settings and policy publication |
| AB-06 | Capacity alerts and audited collection cycles |
| AB-07 | Evidence-backed mixed-batch review and shared settlement |
| AB-08 | Versioned reward-offer catalog management |
| AB-09 | Dashboard accounting and cross-client realtime convergence |
| AB-10 | Acceptance, separate HTTPS deployment and operational handoff |

## 2. What the source actually contains

### 2.1 Frontend inventory and activation gaps

| Screen / source | Existing functionality | Backend/integration required |
| --- | --- | --- |
| `src/app/LoginPage.tsx`, `router.tsx`, `AdminShell.tsx` | Email/password form, demo autofill, admin route guard, identity, alert badge, bin search, safe redirect, logout | Real Auth, current token claims, admin context, auth-scoped subscriptions, removal of live demo credentials |
| `src/features/fleet/OverviewPage.tsx` | Registered bins, active alerts, verified deposits, points issued, seven-day activity, material mix, attention bins | Rebuildable metrics, current Malaysia dates, mixed-batch accepted-item totals, real alert/fleet changes |
| `src/features/fleet/SmartBinsPage.tsx` | Search, capacity/collection/online filters, sorting, pagination, add/edit/delete | Trusted bin configuration, positive `capacitySpc`, QR registration, lifecycle/reference checks, derived fill instead of free percentage editing |
| `src/features/operations/CapacityAlertsPage.tsx` | Active/resolved lists, detail, threshold snapshot, schedule/collect/resolve | Durable alert creation, per-cycle lifecycle, serialized collection, empty-cycle reset, actor/time/version records |
| `src/features/operations/DepositVerificationPage.tsx` | Review tabs/search/detail, image, prediction/confidence, approve/reject, request key, receipt banner | Mixed-object evidence and correction inputs, technical failure reasons, pinned-policy preview/finalization, decision fencing and durable replay |
| `src/features/program/RewardsVouchersPage.tsx` | Catalog CRUD, categories, title/cost/expiry sort, active/draft toggle, artwork metadata, resident limit | Versioned real offers, terms/demo fields, redemption-safe update/delete, resident catalog visibility |
| `src/features/program/SettingsPage.tsx` | Threshold 75/80/85, accepted category toggles, category rates, dirty-draft/navigation protection | Immutable policy publication, class-specific acceptance, optimistic concurrency, threshold reconciliation |
| `src/data/repositories.ts`, `src/app/services.ts` | Promise/Observable interfaces, common hooks, errors, a singleton mock bundle | Mode-neutral service composition, Firebase repositories, shared command/error/recovery handling |
| `src/data/mockRepositories.ts`, `mockSeeds.ts` | In-memory state, fixed dates, simulated delays/failures, local accounting | Keep as explicit mock fixtures; replace as the source of real-mode state |

**Confirmed mock-only:** `services.ts` constructs `createMockRepositories()` unconditionally, and `apps/admin-web/package.json` has no Firebase SDK dependency. A page refresh resets business state because there is no persistence. Mock tests demonstrate UI behavior, not deployed backend readiness.

### 2.2 Existing backend capabilities to reuse, with limitations

| Existing source | Useful foundation | Current limitation / integration owner |
| --- | --- | --- |
| `functions/src/index.ts`, `composition.ts` | Existing Functions exports, shared Auth/Firestore/Storage composition | No exported admin portal endpoints; add a distinct admin transport/application layer |
| `infrastructure/firestore/inspection_store.ts` | Durable batch/job creation, policy/cycle/source pinning | Consume the corrected A1/A2 contract rather than preserving today's incomplete DTOs |
| `infrastructure/firestore/settlement_store.ts` | Automatic finalization and internal `resolveReview` | Current review method lacks the complete request/replay contract and coherent stats/cycle/events; A2 owns repair before admin transport reuses it |
| `infrastructure/firestore/maintenance_store.ts`, `functions/tools/operator.ts` | Internal `recordCollection`, cycles, collection events, maintenance | A2 owns replay ordering, old-cycle closure, and safe collection semantics; portal lifecycle must join the same transaction |
| `infrastructure/firestore/rewards_store.ts` | Redemption, wallet debit, issuance, usage | A2 owns replay/counter/snapshot fixes; add catalog administration around the repaired domain |
| `domain/policy.ts`, `contracts/backend/v1/` | Policy arithmetic, shared versioned backend contracts | Extend with admin-specific contracts without making another settlement calculator |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Existing access/index deployment points | Current rules still use `admin: true` and obsolete paths; current ticket index uses `status` while actual tickets use `state` |
| `firebase.json`, `.firebaserc` | Named database and resident Hosting target | Only resident Hosting is configured; append a separate admin target |

The [ultimate audit](../audits/ECOLOOP_ULTIMATE_BACKEND_AUDIT.md) reports these resident integration defects. Source inspection confirms relevant examples: automatic settlement currently writes capacity entries without updating bin occupancy, and review finalization can resolve a still-uncertain plan. **The presence of those methods is not evidence they are safe to expose.**

At planning time, `docs/archive/demo_refactor/EXECUTION_TRACKER.md` reports H1 and A1–A5 as **NOT_STARTED**. Re-read it at execution time; use actual verified commits, not the future-tense tasks in either plan, as dependencies.

### 2.3 Required corrections to mock assumptions

| Existing assumption | Required live behavior |
| --- | --- |
| `ADMIN_WEB_ACCEPTANCE.md` names `ecoloop-smart-recycling`, top-level wallets, `smartBins`, `depositTransactions`, `verificationTickets`, and `admin: true` | Existing project `ecoloop-thesmartrecycling`, named database `ecoloop-db`, physical mapping in §3, `role: user \| admin` |
| Acceptance report says React 18 / Router 6 | Actual pinned package is React 19 / Router 7; preserve actual working package structure |
| One material, mandatory item count and confidence percentage per review | Mixed batches, nullable unreadable count/confidence, per-object/source evidence, technical reviews |
| Approve with the current category rate | Resolve with the policy pinned when Continue submitted the batch |
| `decide(ticket, approve/reject, key)` alone can resolve any case | Final validated object decisions, inventory state, reason, request ID and expected decision version are required |
| Collected bins reset to 10% | Collection starts a new cycle at **0 spc / 0%**; seeded opening occupancy is a separate fixture concept |
| Edit `capacityPercent` directly | Fill is derived from cycle accounting; configure `capacitySpc`, show `occupiedSpc` and estimated fill read-only |
| Per-bin accepted materials can differ | One shared active class-level policy for all PoC bins; bin acceptance is a read projection |
| Paper/cardboard and metal/aluminium are interchangeable eligibility labels | Explicit accepted classes; cardboard remains excluded and a generic metal can is not automatically aluminium |
| Every image URL means “Physical camera capture” | Prepared image represents a **simulated bin capture**, even when a real HTTPS preview is available |
| Missing reviewer defaults to `ADM-001`; UID masking assumes `RES-...` | Actual authenticated reviewer or unavailable metadata; use a safe presentation alias for arbitrary Firebase UIDs |
| Old mock test: change paper rate, then pending review uses new rate | New policy affects **future submissions**; pending/historical batches retain their old policy |
| Fleet filter bands and cards agree | Source differs: mock filtering uses 60/80 while cards use 75/85; centralize 75/85 display bands and keep the configured alert threshold separate |
| In-memory `includes()` search and numbered slicing map directly to Firestore | Define indexed search/cursor semantics explicitly; do not download all private deposits to filter them in the browser |

## 3. Shared architecture and data contract

### 3.1 Runtime baseline

| Setting | Baseline inherited from the resident refactor |
| --- | --- |
| Firebase project | `ecoloop-thesmartrecycling` — verify before live commands |
| Firestore | Explicit named database **`ecoloop-db`** in web, server, tools and tests |
| Storage | `ecoloop-thesmartrecycling.firebasestorage.app` |
| Resident callables / worker gateway | `us-central1` for the current demo |
| New admin callables | Explicit `us-central1`, sharing the existing Functions deployment baseline |
| Existing vision / Tasks / schedules | `asia-southeast1`; no worker-region migration is required for admin activation |
| Identity | Firebase UID; trusted `role: user \| admin` |
| Time | Firestore `Timestamp`, UTC ISO on JSON wire, `Asia/Kuala_Lumpur` for calendar/display |
| Business outcomes | `processing`, `review`, `verified`, `rejected`, `empty`; legacy `excluded` is a documented read-only migration alias |

Admin Vite configuration must be explicit. Plan these public inputs: `VITE_ECOLOOP_BACKEND_MODE=mock|emulator|firebase`, `VITE_ECOLOOP_FIREBASE_PROJECT_ID`, `VITE_ECOLOOP_FIRESTORE_DATABASE`, `VITE_ECOLOOP_FIREBASE_REGION`, the standard public Firebase web app options, and `VITE_ECOLOOP_APP_CHECK_SITE_KEY`. AB-01/02 must document their exact final names and validate all consumers. Emulator host/port inputs are used only in emulator mode. Production builds fail on missing live configuration and never fall back to mocks.

### 3.2 Component boundary

```text
React pages -> repository interfaces -> Firebase adapters
                                      |-- Firebase Auth / token changes
                                      |-- admin callable reads and commands
                                      |-- admin-only revision/summary listeners
                                      `-- authorized evidence preview

Admin callables -> Auth + enabled-admin check + App Check + schema validation
                -> existing shared application/domain operations
                -> Firestore transactions: facts + ledgers + receipt + audit + outbox

Resident Functions / vision finalization -> same canonical records
                                       -> rebuildable admin read projections
```

- Add the **Firebase browser SDK** to the admin package; keep Admin SDK/server credentials in `functions/` only.
- Retain the current repository/hooks/page organization. Replace `MockBundle` as the common composition type with an `AdminServiceBundle`; mock-only controls stay in the mock implementation.
- Server callables provide joins, search, pagination and private review details. Browser listeners observe small admin-only revision documents and the dashboard projection, then refresh the affected callable read.
- All privileged writes go through trusted commands. An admin claim does not grant direct wallet, capacity, policy, job, review, or catalog writes.
- Service IAM/OIDC remains separate from browser Auth. The admin client cannot claim a worker attempt or impersonate vision.

### 3.3 Canonical physical records

Use the refactor's actual identities; the table distinguishes shared business facts from proposed additive records.

| Concern | Physical path / ownership |
| --- | --- |
| Resident profile | `residents/{uid}`; boundary maps legacy name fields once |
| Wallet / accepted stats | `residents/{uid}/wallet/current`, `residents/{uid}/stats/current` |
| Financial and occupancy audit | `walletEntries/{id}`, `capacityEntries/{id}`; immutable |
| Bin display/config / reservation | `bins/{binId}`, `binOperations/{binId}`; do not expose reservation internals as collection rows |
| QR / collection | `binQrMappings/{qrId}`, `binCycles/{cycleId}`, `collectionEvents/{eventId}` |
| Session / batch / stable result | `depositSessions/{id}`, `deposits/{id}`, `depositResults/{id}` |
| Review / processing evidence | `reviewTickets/{id}`, `inferenceJobs/{id}/attempts/{id}`, canonical evidence manifests |
| Policy | Immutable `policies/{version}`, `policyPointers/active` |
| Catalog / issued records | `rewards/{id}`, `rewardCategories/{id}`, `redemptions/{id}`, `vouchers/{id}`, trusted per-resident reward counters |
| Images | `simulationAssets/{assetId}` and `simulation-assets/...`; private `inspection-evidence/{uid}/{depositId}/{attemptId}/...` |
| Notifications / retention | Existing `notificationEvents`, `diagnosticArtifacts` and maintenance contracts |
| **New:** enabled admin context | `adminAccounts/{uid}`: identity display, enabled status, context version, server timestamps; role still comes from trusted Auth claims |
| **New:** operational settings | `adminSettings/global`: threshold, operational settings version and publication metadata; rates/accepted classes are composed from the active policy |
| **New:** capacity lifecycle | `capacityAlerts/{id}`, `binCollectionState/{binId}`; alert stores its own cycle/workflow history |
| **New:** admin receipts/audit | `adminOperations/{scopedHash}`, `adminAuditEvents/{id}`; backend-owned |
| **New:** query projections | `adminBinViews`, `adminAlertViews`, `adminReviewViews`, `adminRewardViews`; minimal indexed rows, backend-owned and rebuildable |
| **New:** metrics/invalidation | `adminDashboard/global`, `adminDailyMetrics/{YYYY-MM-DD}`, `adminReadVersions/{topic}`, versioned projection-contribution checkpoints |

New names are **implementation targets**, not assertions that those collections exist. AB-01 freezes exact schemas and mappings before writers are added. Never create a second wallet, deposit collection or independently editable rate store to satisfy an old UI codec.

### 3.4 Admin DTO and command changes

Add explicit versioned admin contracts under `contracts/admin/v1/`, packaged with Functions using the existing schema-copy/build mechanism. React codecs consume the same contract corpus. Keep SDK types inside adapters.

Minimum DTOs:

- **Bin:** ID, location, positive integer `capacitySpc`, raw `occupiedSpc`, derived fill, cycle ID, enabled/logical-online state, configuration version, shared-policy summary, collection summary.
- **Alert:** ID/bin/original cycle, threshold and triggering-fill snapshots, operational-settings version, lifecycle/version, scheduled/collected/resolved actor/times, collection-event reference. Current fill is separate from historical triggering/collection fill.
- **Review summary:** ticket/batch/bin IDs, original occurrence time, open/resolved state, explicit final outcome, reasons, safe resident display, decision version, nullable recognition summary. No wallet balance or image credentials in every list row.
- **Review detail:** stable session/result references, pinned policy/version, provisional space, held points, nullable total count, canonical lines and per-object findings, source/run/model/config identities, evidence availability, reviewer/decision history. Missing inference is not zero confidence or zero objects.
- **Review resolution input:** ticket/batch, expected decision version, inventory state, final distinct object decisions, correction reasons and operator explanation. Server recomputes eligibility/rates/space from the pinned policy. It accepts no authoritative client points/balance/spc totals.
- **Reward offer:** existing presentation fields plus offer version, demo flag, terms, update version/time. Admin catalog DTO excludes the resident-specific `residentRedemptionCount`; any administrative redemption total is a separate named field.
- **Settings:** operational version, active policy ID/content digest, exact accepted classes and category rates, threshold, publication time. Category labels remain explanatory groupings.
- **Command receipt:** actor/operation/request identity, original committed response, resource/decision versions and IDs, trace ID, committed time, replay indicator. Signed evidence URLs are obtained separately and are never a durable receipt field.

Every mutation uses:

```json
{
  "schemaVersion": "admin.v1",
  "operation": "adminResolveReview",
  "requestId": "stable-id-for-one-intent",
  "payload": {
    "ticketId": "example-ticket",
    "expectedDecisionVersion": 1,
    "inventoryState": "empty",
    "objects": [],
    "explanation": "Image-wide review confirms no visible deposited objects."
  }
}
```

This illustrates an empty-resolution envelope; acceptance additionally requires affirmative supporting evidence under the review domain contract. Domain validation rejects inconsistent inventory/object combinations. Server identity and timestamps come from authentication/server time, never payload fields.

Required common behavior:

1. Authenticate and authorize **every** callable, including reads, recovery and evidence access. Require `role == admin` and an enabled `adminAccounts/{uid}` record. Provision/disable reconciles Auth and Firestore deliberately, since they are not one transaction. Sensitive mutation transactions recheck enabled status so a concurrent disable cannot silently authorize a new write.
2. Use App Check on applicable admin browser endpoints. Emulator mode is explicit; live enforcement never silently disables itself for localhost testing.
3. Deduplicate by authenticated actor + operation + request ID and a typed meaningful-payload fingerprint. Read the committed receipt **before** revalidating a now-changed resource/version. Different payload with the same identity returns an idempotency conflict.
4. Enforce domain uniqueness as well: one resolution per accepted decision version; one collection transition for an expected cycle. A new request ID cannot bypass those fences.
5. Generate stable intent IDs before transaction retries; persist pending admin intents across refresh without storing passwords/tokens. Account switches fence/cancel stale completions and clear visible account-scoped data.
6. Commit business facts, bounded projections, immutable audit, receipt and notification/outbox intent coherently. External Auth/Storage/FCM/queue calls stay outside retried transaction callbacks; perform all transaction reads before writes.
7. Return safe typed errors with field errors, retryability, trace/request ID and recovery references. Distinguish not-found from permission denied, stale version, active session, unavailable evidence, and network ambiguity.

### 3.5 Proposed endpoint inventory

These are planned public export names; AB-01 records their exact request/response schemas. All use the guard above. Existing shared domain methods remain the business authority.

| Area | Planned operations | Owner phase |
| --- | --- | --- |
| Context/recovery | `getAdminContext`, `recoverAdminOperation` | AB-02 |
| Lists/details | `listAdminBins`, `getAdminBin`, `listAdminAlerts`, `getAdminAlert`, `listAdminReviews`, `getAdminReview`, `listAdminRewards`, `getAdminReward`, `getAdminRewardCategories` | AB-03 foundations; feature phases finish relevant endpoints |
| Fleet/QR | `adminCreateBin`, `adminUpdateBin`, `adminDeleteUnusedBin`, `getAdminBinQr` | AB-04 |
| Program | `getAdminSettings`, `adminPublishSettings` | AB-05 |
| Collection | `adminScheduleCollection`, `adminRecordCollection`, `adminResolveCapacityAlert` | AB-06 |
| Review/evidence | `previewAdminReviewResolution`, `adminResolveReview`, `getAdminEvidencePreview` | AB-07 |
| Catalog | `adminCreateReward`, `adminUpdateReward`, `adminDeleteUnusedReward` | AB-08 |
| Dashboard | `getAdminDashboard` plus admin-only summary listener | AB-09 |

### 3.6 Query, search and refresh design

- Keep 5/10/20 rows and Previous/Next controls. Replace numeric database offsets with stable cursors ordered by the selected sort field plus document ID. Page number is presentation/navigation state; a cold URL without a valid cursor resets to page one while retaining filters/selection.
- Return matching `total` through a count query using the **same filters**, plus `hasMore`, cursor and projection/version metadata. Counts and pages may shift under concurrent writes; expose freshness and reset invalidated page chains instead of claiming a frozen snapshot.
- Materialize normalized sort/search fields in admin query views, not another editable business table. Use server validation and a finite supported sort/filter matrix to generate actual composite indexes.
- For this first Firestore-native release, search is a **single normalized token prefix** over bounded indexed identity/name/title/location fields. Store bounded, deduplicated prefix tokens. Change UI hint text and tests explicitly from arbitrary substring behavior. This supports the existing search controls without a paid external search service; do not advertise general full-text/substring search.
- Cap search length, indexed token count, page size and evidence page size. Define a minimum prefix length with a separate exact-ID lookup. Test punctuation in IDs, Unicode normalization, and a useful no-match state.
- `adminReviewViews` carries safe resident/bin search display fields. Profile/location edits enqueue/reconcile dependent views; record source versions and projection freshness. History retains its original occurrence/location snapshot.
- Replace the undefined aggregate-confidence sort with occurrence/review-time sorting; show source-specific scores only in detail. Unknown confidence remains unavailable.
- Observe topic revisions for list refresh, coalesced/debounced (initial 300 ms), plus mutation-triggered refresh and foreground/reconnect reload. No per-row inference listeners or collection-wide polling. Bound concurrent loads and ignore old query responses.
- A projection update compares source versions and reads current canonical facts before replacement. Duplicate/out-of-order triggers cannot restore stale rows. A rebuild tool supports preview, paging, checkpoints and safe resume.
- Define refresh targets: a committed portal mutation refreshes its own view immediately; resident-originated updates should reach visible admin views within 10 seconds under normal deployed conditions. Display last-updated/stale status and make reconciliation observable.

## 4. Coordination with the resident refactor

This plan does not take over the resident recovery schedule or change its phase count. Use one owner for shared business changes and record the handoff commit.

| Resident gate | Required before | Why |
| --- | --- | --- |
| H1 + A1 contracts/config/Auth/rules | AB-01 baseline freeze; AB-02/03 live integration | Named database, claims, timestamps, field aliases and envelope must agree |
| A2 settlement/review/collection/rewards invariants | AB-04/05/06/07/08 shared mutations accepted | Admin transports must reuse repaired accounting, policy pinning, replay and reservation behavior |
| A3 evidence/worker contract | AB-07 real pipeline evidence acceptance | Review must display actual source/run/object evidence and technical failures |
| A4 events/retention/deployed resident candidate | AB-09/10 cross-client acceptance | Review notifications, evidence lifetime and current deployed source must be real |
| A5 resident freeze, if already released | Any shared production deployment | Retest the affected resident gates and issue a compatible new release identity |

AB-01 can inventory/design while refactor gates are pending; AB-02/03 can develop against frozen emulator contracts. Mark live or accounting-dependent gates **BLOCKED** until verified. If shared methods remain defective, resolve them in the owning resident phase or an explicitly recorded shared fix, then consume that implementation. Never add an independent admin wallet-credit or percentage-reset shortcut.

The historical `.agent/web_developer/agent.md` describes Goal 2 mock-only, 3–5-file UI phases. This is a separate cross-stack integration plan: its planned edit scope is `apps/admin-web/`, `functions/`, `contracts/`, relevant rules/indexes/hosting/CI, and documentation. Preserve design artifacts and developer-owned native files; no broad native refactor is needed.

## 5. Execution and Git protocol — applies to every phase

Before starting a phase:

- [ ] Read this plan, the current admin tracker, relevant resident handoff evidence, and actual source for the boundary.
- [ ] Inspect `git status --short`, `git diff`, and `git log --oneline -10`; identify and preserve unrelated work.
- [ ] Record source SHA, current phase/substep, exact target files, project/database/mode, prerequisite commits and the first failing boundary.
- [ ] Expand proposed file manifests against the repository. New paths below are targets, not existing-file claims.

At the end of **each completed phase**:

- [ ] Run that phase's actual acceptance gates and directly affected resident/admin regressions. Distinguish mock, emulator, injected-provider and deployed evidence.
- [ ] Update `docs/archive/admin_backend/EXECUTION_TRACKER.md` and `docs/archive/admin_backend/evidence/AB-XX_<name>.md` with changed files, exact commands/results, blockers, next read set and actual commit SHA after committing.
- [ ] Review `git status --short`, `git diff`, and `git log --oneline -10`, then stage **only explicitly reviewed phase files** with `git add -- <path1> <path2> ...`.
- [ ] Inspect `git diff --cached` and **create the phase's separate Git commit** using the suggested message or an accurate equivalent matching repository style.
- [ ] Fix rejected hooks and create a new commit; do not bypass hooks, amend, force-push, or push without explicit instruction.

An incomplete phase stays `IN_PROGRESS` or `BLOCKED`, with an honest checkpoint. Creating this plan does not execute any phase, create accounts, deploy resources, or commit the current worktree.

## 6. Phase AB-01 — Freeze the integration contract and handoff

**Outcome:** one agreed mapping of current UI, corrected shared domain, real environment, and ownership.

**Source/target areas:** this document; `apps/admin-web/src/contracts/`, `src/data/repositories.ts`; `contracts/backend/v1/`; proposed `contracts/admin/v1/`; resident tracker and contract evidence; proposed `docs/archive/admin_backend/`.

### Checklist

- [ ] Confirm §1.2 operational inputs, actual resident refactor state and exact prerequisite SHAs. Record pending console work with an owner.
- [ ] Inventory actual Functions exports, role guards, database selection, record writers/readers and existing deployed resource identifiers without assuming old admin handoff values.
- [ ] Freeze schemas for the DTOs/commands in §3.4–3.5, operation scopes, error codes, cursor/search semantics and supported sort/filter combinations.
- [ ] Document field aliases at a single boundary: `ownerId`/resident UID, `batchId`/`depositId`/legacy `transactionId`, `merchant`/`merchantName`, offer/demo flags and legacy enum/time representations.
- [ ] Record A2's agreed per-resident reward-counter path and shared review/collection application interfaces. Verify their implemented handoff before the dependent feature gates; do not introduce a competing counter path if A2 is still in progress.
- [ ] Design the contract migration for admin codecs: mixed lines, nullable counts/scores, `processing`/`empty`, immutable policy IDs, versioned mutation inputs and final review outcomes.
- [ ] Specify the three-way final review presentation: resolved with accepted items, resolved with excluded items, resolved empty. An empty resolution must not be mislabeled rejection or positive approval. Preserve awaiting/resolved queue access with explicit outcome filters.
- [ ] Produce preview-only inventory/backfill plans for legacy dates, reviews, alerts/projections and settings. Preserve missing evidence/count as unknown; do not synthesize confidence or financial history.
- [ ] Create the admin execution tracker with AB-01–10 initially not started, prerequisite/evidence/commit columns, next-substep checkpoint and an input register.
- [ ] Define migration preview/apply targeting the explicit project/database and scoped backup/change manifest. Reuse resident migration machinery; a live apply requires its existing explicit target contract.

### Exit gate

- [ ] Each existing UI function maps to a planned backend operation/source and acceptance case.
- [ ] The UI corrections in §2.3 and shared ownership/dependencies are documented; no unresolved business-rule contradiction is hidden in an adapter.
- [ ] Schemas and representative valid/invalid examples are reviewed, including unreadable technical review and mixed-batch resolution.
- [ ] **Git commit after AB-01:** `docs: define admin backend integration contracts and handoff`.

## 7. Phase AB-02 — Real admin identity, service composition and command recovery

**Outcome:** a provisioned real admin can sign in/out; ordinary residents cannot access administrative data or commands.

**Source/target areas:** `apps/admin-web/package.json`, lockfile, `src/app/{services,LoginPage,router,AdminShell}.tsx/.ts`; proposed web Firebase config/auth/command adapters; `functions/src/composition.ts`, `index.ts`, proposed `transport/admin_context.ts`, shared admin guard/validation; rules and provisioning tooling.

### Checklist

- [ ] Add/pin the compatible Firebase browser SDK and explicit mock/emulator/firebase composition. Validate project/database/region configuration at startup and build.
- [ ] Implement Auth email/password sign-in using Firebase directly. Use token-change events with current-state replay, distinguish resolving-auth from signed-out, and derive identity/role from verified context.
- [ ] Provision the initial account through controlled tooling/console, set `role: admin` while preserving unrelated claims, and create enabled `adminAccounts/{uid}`. Account passwords remain private.
- [ ] Implement role/context refresh, disabled/deleted admin behavior and repair of partial provisioning. Do not grant admin through a writable profile field or self-service endpoint.
- [ ] Implement `getAdminContext`, guarded `recoverAdminOperation`, reusable schema/envelope/error handling, actor-scoped receipts and safe trace propagation.
- [ ] Require enabled-admin context in callables and rules for admin listeners. Disabled admin context must stop new access even with an unexpired stale admin token.
- [ ] Initialize App Check for the actual web app/provider/domain; define explicit emulator behavior. Verify missing/invalid attestation rejection on an enforced deployed admin callable.
- [ ] Remove demo autofill/credentials and mock-reset copy from Firebase mode. Keep safe redirects and dirty-form logout behavior.
- [ ] Implement durable pending-intent coordination for every privileged mutation, retaining stable keys across retries/reopen. Resolve ambiguous outcomes via the original receipt before allowing a new intent.
- [ ] Key query/mutation state by UID and auth generation. Unsubscribe and clear sensitive data/drafts/receipts on sign-out, disable or account switch; discard late callbacks. Avoid persistent private browser caches by default.
- [ ] Deny direct client writes to business records, jobs/attempts, operation receipts and audit records, including for admins. Remove the existing broad admin attempt-write permission while coordinating shared rules changes with A1.
- [ ] Keep administrative raw-evidence reads behind the enabled-admin server guard. Do not leave a claim-only Storage rule as a bypass of disabled-admin enforcement; preserve the separate resident-owner access contract.

### Exit gate

- [ ] Valid admin login/restored session/refresh/logout work; a resident, forged profile role, legacy-only `admin: true` token and disabled admin fail administrative access.
- [ ] Wrong password, expired auth, permission denial and transport failure produce distinct recoverable states.
- [ ] Lost-response recovery returns the original test command receipt; payload-key conflict fails; account switching shows no previous user's data.
- [ ] **Git commit after AB-02:** `feat: connect admin authentication and trusted command transport`.

## 8. Phase AB-03 — Real read layer, query projections and indexes

**Outcome:** the portal has a production-shaped read/realtime foundation; implemented lists use real records with correct filters and permissions.

**Depends on:** AB-01/02 and A1's verified physical contract.

**Source/target areas:** `src/data/repositories.ts`, web codecs and proposed Firebase repository bundle; `src/ui/ListControls.tsx`; proposed Functions admin query/projection stores and rebuild tool; `firestore.rules`, `firestore.indexes.json`; schema copy/build tooling.

### Checklist

- [ ] Implement versioned query decoding, bounded cursor pages, token-prefix search and count queries as specified in §3.6.
- [ ] Establish `adminBinViews` and `adminRewardViews` from canonical writer-produced fixtures; add the shared builder/version framework for alert/review views as their feature phases land.
- [ ] Separate list summaries from detail DTOs; use bounded server joins for details. Do not return every resident profile/wallet or evidence artifact in a list response.
- [ ] Freeze the supported query/index matrix for every filter/sort/search combination, including tie-breakers and missing optional fields. Reject unsupported combinations explicitly.
- [ ] Implement narrow `adminReadVersions/{topic}` listeners and refresh scheduling. Invalidate the appropriate topic from committed writes/projection changes; perform reconnect/foreground refresh without an endless background poll.
- [ ] Make `useQuery`/`useObservableQuery` distinguish new query/auth context from transient refresh. Prevent old rows/detail from flashing after selection/account changes and stale errors from replacing a newer success.
- [ ] Create a paged preview/rebuild/backfill tool with source versions and resume checkpoints. Duplicate/out-of-order updates re-read current facts; deleted/disabled records remove or update their views.
- [ ] Bind every Firestore-triggered projector to the explicit named database and recorded region. Test resident-originated events against that binding; a default-database trigger cannot maintain these views.
- [ ] Declare explicit role-protected listener permissions. Keep canonical private records behind authorized detail reads; do not expand resident read scope for admin convenience.
- [ ] Use the named database in SDK, emulator clients and test tools. Backfill queried timestamps before enabling Timestamp-range/cursor feeds over that dataset.
- [ ] Add schema packaging/check commands that include all new server/web adapters/tests; existing `lint`/`check:tests` scripts only typecheck their imported entry graphs.

### Exit gate

- [ ] Real serialized records pass backend-to-React codec tests, including empty feeds, Timestamp conversion, future schema rejection and null semantics.
- [ ] At least two pages with duplicate sort values, filter changes, inserts/removals and refreshes have no skipped/duplicated merged rows; counts use the full filtered dataset.
- [ ] Rules tests prove ordinary residents cannot read admin projections/revisions; actual index deployment/query execution is reserved for AB-10.
- [ ] **Git commit after AB-03:** `feat: add admin query adapters and rebuildable read models`.

## 9. Phase AB-04 — Trusted bin management and registered QR codes

**Outcome:** an admin-created enabled bin is actually usable by the resident QR journey.

**Depends on:** AB-03 and A2 reservation/submission/cycle invariants.

**Source/target areas:** `SmartBinsPage.tsx`, fleet contracts/repositories; proposed `application/admin_bins.ts`, `transport/admin_bins.ts`, Firestore bin-management store; shared submission/reference fencing; existing QR generator tooling.

### Checklist

- [ ] Implement idempotent create/update/delete-unused commands with expected configuration versions, strict IDs/field lengths, immutable identity and server timestamps.
- [ ] Replace editable fill percentage with positive integer capacity on registration, read-only raw occupancy/estimated fill, and active cycle information. First release keeps established capacity immutable after registration; resizing requires a separately specified cycle-capacity change.
- [ ] Remove per-bin acceptance checkboxes as independent rules; show the active shared accepted classes/categories. Display logical enabled/online status with software-only wording, not transmitting telemetry.
- [ ] Create bin, initial zero-opening cycle, private operation state and enabled QR mapping coherently. Generate/export a QR encoding the **registered payload**, not an unchecked bin ID.
- [ ] Provide `getAdminBinQr` and UI download/preview so the admin does not need access to the seed tool's local output directory.
- [ ] Serialize disable/configuration changes and deletion against active sessions. Define disable as preventing new reservations; an already committed batch continues to its normal outcome. Never abandon its reservation/accounting.
- [ ] Permit delete only for a never-used, empty bin with no active reservation, batch/ledger, alert or collection history. Maintain a shared transactional reference fence so concurrent submit/alert creation cannot race a reference scan.
- [ ] Retire its QR mapping and clean up only its unused configuration/initial-cycle records. Retain an ID tombstone so deleted bin IDs and retired QR payloads cannot be reassigned accidentally. Used bins return a typed conflict and remain disable-able; historical deposits keep their original identity/location snapshot.
- [ ] Remove hardcoded `BIN-004` capacity-simulation buttons from Firebase mode in overview/alerts. Mock/emulator controls remain explicit and cannot call an unrestricted live percentage setter.
- [ ] Finish bin list/detail adapters, search/filter/cursor behavior and the centralized 75/85 display-band helper across UI and projection builders.

### Exit gate

- [ ] Register bin -> export QR -> real reservation contract finds that bin; full/disabled/busy states follow shared backend rules.
- [ ] Duplicate create/retry creates one identity/cycle/QR mapping; stale edits and referenced deletes fail without losing data.
- [ ] Fill is derived from actual capacity entries; ordinary edits cannot change occupancy or active-session ownership.
- [ ] **Git commit after AB-04:** `feat: activate admin bin management and QR registration`.

## 10. Phase AB-05 — Immutable program settings and future-policy publication

**Outcome:** settings affect future resident submissions while pending/historical batches retain their pinned policy.

**Depends on:** AB-03 and repaired A2 policy loading/pinning.

**Source/target areas:** `SettingsPage.tsx`, settings codecs/repositories; `policies`, `policyPointers`, proposed `adminSettings/global`; shared policy validation and proposed admin publication application/store.

### Checklist

- [ ] Compose settings from the active immutable policy and operational settings; expose both versions/content identity to the form.
- [ ] Replace blanket material eligibility with explicit class acceptance controls grouped by category. Initially show bottles, aluminium cans, paper items and paper bags; cardboard remains visibly excluded.
- [ ] Keep category rate controls with nonnegative integers, including valid zero rates. Correct “Paper & Cardboard”/generic metal eligibility copy. Weight conversion constants remain derived display rules, not editable weighing/reward fields.
- [ ] Publish a complete immutable policy version for changed acceptance/rates. Copy and validate the unchanged class-space/default/unresolved/unreadable rules; never silently fill a missing pinned policy with defaults.
- [ ] Atomically compare expected active policy and operational version, create the new policy when needed, advance the pointer, update threshold/settings version, and write audit/receipt/invalidation intent.
- [ ] Threshold-only changes do not create a redundant financial policy. Identical settings return an explicit no-change/replay result without changing history.
- [ ] Preserve dirty drafts on background updates but show a version-conflict/reload path before saving over another administrator's change. The submitted expected version belongs to the draft's original base snapshot.
- [ ] Enqueue a durable paged threshold-reconciliation intent when the threshold changes. AB-06 supplies processing that evaluates existing bins without rewriting old alert thresholds or financial policies.
- [ ] Verify resident guide/bin acceptance reads switch to the new active policy; historical receipts and review previews use the old pinned payload.

### Exit gate

- [ ] Submit batch under policy P1, publish P2, then resolve P1: P1 accounting is unchanged. A new submission and current guide use P2.
- [ ] Two concurrent publishers cannot both replace the same expected pointer; zero-rate accepted items still count toward verified impact.
- [ ] Saving category rates cannot accidentally accept cardboard or mutate stored policy P1.
- [ ] **Git commit after AB-05:** `feat: publish versioned admin program settings`.

## 11. Phase AB-06 — Capacity alerts and collection-cycle workflow

**Outcome:** genuine occupancy changes create alerts and admins can schedule, collect and resolve them safely.

**Depends on:** AB-04/05 and A2's repaired `recordCollection` contract.

**Source/target areas:** `CapacityAlertsPage.tsx`, alert DTOs/repositories; shared settlement/collection transaction hooks; proposed alert/collection application/store, `capacityAlerts`, `binCollectionState`, threshold reconciler and admin alert views.

### Checklist

- [ ] Evaluate raw `occupiedSpc / capacitySpc` against the configured threshold after initial settlement, current-cycle review corrections and valid bin registration/backfill. Consume the AB-05 threshold-reconciliation intent fairly with checkpoints/retries.
- [ ] Create at most one alert per **bin + cycle** with a deterministic uniqueness marker; snapshot threshold, settings version, triggering occupancy/time and cycle.
- [ ] Keep an alert latched until its collection workflow resolves even if a later accounting correction drops fill below threshold. Show current fill separately so operators see why it changed; do not create another alert for the same cycle.
- [ ] Store lifecycle on each alert: pending -> scheduled -> collected -> resolved, with versions, actors and server times. `binCollectionState` summarizes the current cycle only; do not repurpose private reservation phase fields.
- [ ] Schedule means an administrator recorded collection as scheduled. Preserve that existing simple action; do not claim an external truck dispatch or invent ETA/route features.
- [ ] Implement collect through the **same shared transactional collection operation**: replay receipt first, validate expected cycle and no valid active session/processing, close old cycle, create new zero-opening cycle, reset occupancy to 0 and write one event.
- [ ] Join the alert's collected transition, collection event, receipt, audit and bounded invalidation writes to that transaction. A server crash must not reset occupancy while leaving a retry able to collect twice.
- [ ] Resolve only that collected alert; it neither resets occupancy again nor touches a new reservation. Subsequent deposits in the new cycle can produce a new alert even if the old collected alert is awaiting resolution.
- [ ] Historical alert detail uses its own workflow snapshots, not the latest bin collection status. Preserve history when threshold/settings/current cycle change.
- [ ] Replace every 10% reset/sensor/physical-dispatch claim in live UI copy and tests. Distinguish active alerts awaiting resolution from bins actually awaiting pickup in counters/banners.
- [ ] Finish alert list/detail views, active/resolved counts, version conflicts and selection behavior after resolution.

### Exit gate

- [ ] Occupancy crosses threshold -> one alert -> schedule -> collect -> **new empty cycle** -> resolve; reload preserves all stages and authorship.
- [ ] Duplicate triggers/commands and two collectors produce one alert/event per domain identity; collection-versus-scan/submission is correctly serialized.
- [ ] Review after collection changes the original historical cycle only. A second cycle's alert is not blocked or resolved by the first cycle's workflow.
- [ ] Threshold reconciliation resumes after interruption and does not duplicate alerts.
- [ ] **Git commit after AB-06:** `feat: connect capacity alerts to audited bin collection cycles`.

## 12. Phase AB-07 — Evidence-backed mixed-batch review and settlement

**Outcome:** real uncertain/technical batches can be inspected and resolved once, with coherent resident-facing effects.

**Depends on:** AB-03/05/06, verified A2 review settlement, A3 real evidence contract; A4 events/retention for deployed end-to-end acceptance.

**Source/target areas:** `DepositVerificationPage.tsx`, review DTOs/codecs/repositories; proposed admin review/evidence transport and application services; shared `settlement_store.ts`/application finalization; evidence manifests, notification/retention integrations.

### Checklist

- [ ] Read actual `reviewTickets` (`state: open/resolved`) and join canonical batch/result/pinned policy. Preserve original ticket/result identity and show reason codes, held/null points, provisional space, occurrence and resolution times.
- [ ] Build minimal review list views and bounded detailed object/evidence pages. Do not discard tickets because optional profile/image/model evidence is missing; show unavailable metadata explicitly.
- [ ] Render multiple classes/counts, per-object eligibility/resolution, source-specific predictions/model scores and uncertainty/technical reasons. Never average model scores into a fabricated batch confidence percentage.
- [ ] Supply authorized previews for the exact committed source/version and available crops. Resolve artifact IDs through manifests bound to that ticket/attempt; reject arbitrary client Storage paths, other-ticket artifacts and purged generations.
- [ ] Prefer authenticated byte retrieval with short-lived object URLs; revoke them on detail/account changes. If temporary signed URLs are used, bound expiry, avoid durable storage/logging and renew through authorization. Always label prepared images simulated capture.
- [ ] Add a resolution editor for final object classes/count corrections, excluded objects, false proposals and affirmative emptiness, with reasons. Unknown/unreadable cases may remain open; they cannot be closed as fully resolved without enough final evidence.
- [ ] Make any submitted eligibility assertion consistent with server recomputation from canonical classes/pinned policy. Treat false detections separately from real excluded waste, which still occupies space.
- [ ] Implement a **server-computed preview** using the same policy calculator, showing pinned version, proposed outcome/points, old/new space and delta. It is noncommitting; final submit revalidates expected decision version and findings.
- [ ] Replace the binary-only `decide()` backend contract with `adminResolveReview`. Approve/reject convenience actions are enabled only when they encode complete valid findings. “Reject” cannot silently zero space or claim an unreadable inventory was empty.
- [ ] Use the repaired shared resolution transaction: one initial reward settlement at most, coherent wallet/version/ledger, accepted counts/stats, original-cycle space correction, stable result/lines/explanation, ticket resolution and decision history.
- [ ] Do not acquire/release unrelated current bin or resident reservations during review. Fence stale workers and competing reviewers; late AI results stay additional evidence after referral.
- [ ] Create the shared versioned outcome/credit notification intent and resolved-evidence retention intent coherently. Unresolved evidence remains retained; eligible diagnostics become due at resolution +30 days.
- [ ] Persist the complete committed receipt for retry/reopen. Use actual reviewer UID/display metadata; remove `ADM-001` fallback and expose an arbitrary-UID-safe resident display alias.
- [ ] Present explicit resolved outcomes (`verified`, `rejected`, `empty`), including a successful accepted zero-rate outcome without a misleading positive-credit banner. Selected resolved detail remains reachable after leaving the open queue.

### Exit gate

- [ ] Two bottles + one unknown: hold null points and 30 spc; resolve unknown to paper bag -> **13 points, 28 spc, -2 correction**, once.
- [ ] Same resolution after collection updates the old cycle without refilling the new bin; a currently active different session is untouched.
- [ ] Concurrent approve/reject, duplicate key, different key for an already-resolved version, lost response and stale AI completion cannot double-credit or overwrite the winner.
- [ ] Unreadable/technical review shows unknown count and real failure evidence; unknown findings cannot close a ticket. Excluded/empty resolutions retain correct distinct accounting.
- [ ] Real resident receipt/history/wallet/stats update through the shared contract; notification intent and retention state reference the same decision version.
- [ ] **Git commit after AB-07:** `feat: resolve admin reviews through shared pinned-policy settlement`.

## 13. Phase AB-08 — Real reward-offer catalog management

**Outcome:** admins manage offers that residents can actually redeem, while issued vouchers remain stable.

**Depends on:** AB-03 and repaired A2 redemption/counter/snapshot behavior.

**Source/target areas:** `RewardsVouchersPage.tsx`, reward admin contracts/repositories; proposed admin catalog application/transport/store; shared redemption reference fencing; `rewards`, `rewardCategories`, query views and audit.

### Checklist

- [ ] Implement create/edit/publication/delete-unused with stable request IDs, expected versions, strict server validation, bounded strings and known category/art keys.
- [ ] Map title/description/merchant/art/cost/category/limit/expiry consistently to A2's canonical catalog fields; include explicit demo terms and server-enforced demo-only offers for this PoC.
- [ ] Generate a new offer version for meaningful offer/publication changes and preserve audit history. Never overwrite a resident redemption/voucher snapshot.
- [ ] Make active/draft toggles version-checked so a stale reconstructed full input cannot clobber another edit. Preserve fields not editable by that action.
- [ ] Treat catalog date selection as Malaysia end-of-day with an explicit UTC Timestamp boundary; format dates in Malaysia rather than slicing UTC dates. Server time enforces expiry.
- [ ] Validate HTTPS artwork URLs without fetching arbitrary URLs server-side; use existing art keys when no artwork exists. An uploader is not required by the present URL-based form.
- [ ] Reject publication of expired/invalid offers; permit deactivating an already expired offer without requiring a fabricated new future expiry.
- [ ] Allow delete only if never redeemed/issued, using a reference marker/fence updated in the same resident redemption transaction. Otherwise return a conflict and keep deactivation available.
- [ ] Keep catalog expiry/active state independent of issued voucher validity; initial voucher expiry remains issuance +30 days and no expiry refund is introduced.
- [ ] Finish categories, publication/category/search filters, cost/title/expiry cursors and resident catalog refresh. Label this page's create action as reward offer/catalog voucher offer rather than issuing a resident voucher.

### Exit gate

- [ ] Create draft -> publish -> resident sees it -> redeem with displayed version/cost -> one debit and voucher -> admin edit/deactivate leaves original receipt/code/terms/expiry unchanged.
- [ ] Concurrent offer edit vs redemption yields either the committed original offer or a typed offer-changed retry; limits and balances remain correct.
- [ ] Delete-versus-redemption cannot orphan an issued voucher or erase referenced offer history; replay cannot create a second offer.
- [ ] **Git commit after AB-08:** `feat: activate versioned admin rewards catalog management`.

## 14. Phase AB-09 — Dashboard accounting, realtime convergence and operational proof

**Outcome:** all six pages reflect coherent real facts, including changes originating outside the admin browser.

**Depends on:** AB-04–08; A4 notification/retention and deployed resident integration for live evidence.

**Source/target areas:** `OverviewPage.tsx`, `AdminShell.tsx`, dashboard DTO/repository; proposed metrics/projector/reconciliation stores and tooling; shared notification/maintenance hooks; admin integration tests.

### Checklist

- [ ] Define registered bins as nondeleted fleet records, active alerts as unresolved workflows, and verified deposits as finalized batches with accepted items (including accepted zero-rate batches). Label enabled/disabled distinctions accurately.
- [ ] Compute EcoPoints issued from original positive deposit-credit ledger effects, including review credits; redemptions do not reduce “issued” totals. Never derive it from current wallet balances.
- [ ] Compute material mix/estimated kg from accepted verified counts by material, including mixed batches. Use 0.025 plastic, 0.015 aluminium, 0.050 paper and 0.200 glass kg/item as **display estimates**; excluded cardboard contributes no verified impact.
- [ ] Define the seven-day activity window dynamically as today plus the previous six Malaysia calendar dates, grouped by original submission occurrence date once the batch is verified. A late review updates that day's verified count; credit timing remains the actual ledger time.
- [ ] Build versioned per-source contribution checkpoints. In a projection transaction, read the latest canonical source, subtract its last applied contribution and add the new one. Duplicate/out-of-order events cannot inflate counters or revert newer state.
- [ ] Define bounded attention bins from active collection needs, warning-band/full or disabled status; sort deterministically and show the actual reason. Keep display bands separate from the configurable alert threshold.
- [ ] Finish dashboard/current-day rollover, metrics freshness, alert counts across shell/pages and coalesced topic refresh. Background tabs pause refresh and revalidate on foreground/reconnect.
- [ ] Provide preview/rebuild/reconciliation of dashboard, admin rows and relevant resident/cycle totals from canonical records. Missing/corrupt sources are reported rather than filled with mock values.
- [ ] Trace admin request -> decision/collection/offer/policy -> ledger/event/projection; log committed results after transaction success, with privacy-safe metadata.
- [ ] Verify review event dispatch uses A4's durable notification path and current preferences/devices. Delivery failure neither repeats nor rolls back a settlement.
- [ ] Verify resolved/unresolved/purged evidence presentation and retention manifests agree with A4 maintenance; shared prepared source images remain protected.
- [ ] Exercise every current UI control against the real adapter; required-feature placeholder/no-op buttons cannot masquerade as success. Preserve error/retry/loading/empty and dirty-navigation behavior.

### Exit gate

- [ ] A mixed 37-point batch adds one verified batch, six accepted items and 0.145 estimated kg; a later redemption changes wallet balance but not issued/impact totals.
- [ ] Review, policy, reward and collection changes from another browser/resident session converge without reloading the whole app; a reload retains the same facts.
- [ ] Projection replay/rebuild matches canonical ledger and accepted-line totals, including a zero-rate accepted batch and a late review across Malaysia midnight.
- [ ] All six routes operate in Firebase mode with no mock identity, fixed 2024 reporting dates, fake confidence or percentage-reset write path.
- [ ] **Git commit after AB-09:** `feat: connect admin analytics and cross-client realtime projections`.

## 15. Phase AB-10 — Cross-client acceptance, separate deployment and handoff

**Outcome:** a reproducible HTTPS admin website operates with the same accepted resident/backend release.

**Depends on:** all previous admin gates and the compatible resident refactor gates in §4.

**Source/target areas:** `firebase.json`, `.firebaserc`, admin build/config tooling, `.github/workflows/`, Functions exports/contracts, indexes/rules; Playwright/emulator suites; proposed admin runbooks and release evidence.

### Checklist — verification

- [ ] Run the command gates in §16 sequentially on the Windows host; record exact commands/results and distinguish tooling/OOM failures from application failures.
- [ ] Adapt the existing seven mock Playwright journeys to explicit mock mode and add a distinct Firebase-emulator suite covering the corrected live semantics. Do not change emulator tests to use mock repositories for convenience.
- [ ] Exercise real Auth/Functions/Firestore/Storage SDK boundaries and rules on the named emulator database; invoke exported admin handlers, not only pure policy helpers.
- [ ] Complete the cross-client scenario matrix in §17, including denied roles/direct writes, concurrent review/collection/redemption, ambiguous responses, reload/account switching, settings pinning and projection rebuild.
- [ ] Re-run directly affected resident A1/A2/A4 regressions. Any shared domain/rules/config change requires compatible resident acceptance evidence.
- [ ] Review exact staged source/config changes for credentials, personal data and generated artifacts. Keep provider/service secrets server-side.

### Checklist — deployment and independent rehearsal

- [ ] Verify actual project/database/bucket/regions, admin web app ID/provider/domain and role provisioning. Record public configuration only.
- [ ] Convert Hosting configuration to explicit resident + admin targets; admin serves `apps/admin-web/dist` with SPA rewrite and appropriate cache/security headers. Preserve resident `build/web`, messaging-worker headers and existing target binding.
- [ ] Set the actual admin Hosting site binding and Auth authorized domain/App Check registration. Do not publish to the resident target or replace the resident web app registration by accident.
- [ ] Build/package Functions schemas before deployment. Deploy compatible rules/indexes and wait until actual indexes are READY; then deploy the scoped new/changed Functions and relevant projection/reconciliation handlers, validate backfills, and publish admin Hosting.
- [ ] Verify every supported deployed query shape; emulator success cannot prove composite index readiness. Observe live App Check, token refresh and authorization failure handling.
- [ ] Rehearse on the deployed HTTPS admin site and compatible resident Android/web candidate: genuine submission/review evidence, admin resolution, wallet/history/cycle effects, reward publication/redemption and collection.
- [ ] Use controlled fixtures only for deterministic emulator fault cases. A live technical/uncertain review must come from actual pipeline evidence; do not break global provider credentials or edit a wallet to manufacture a pass.
- [ ] Have a second operator independently exercise login, bin QR creation, alert/collection, review, catalog and settings with supplied exact URLs/test identities. Record failures with safe trace/resource IDs.
- [ ] Fix/retest first failing boundaries. A pending reviewer decision is a supported state; a broken resolution/evidence transport is not a passed review feature.
- [ ] Record source/build SHA, package/lock/schema/config digests, Functions regions/exports, database, Hosting URL/version and prerequisite resident release identity.
- [ ] Document compatible deployment rollback and paged projection rebuild. Preserve real ledger entries/balances and subsequent transactions; never reset data using a seed to roll back code.
- [ ] Supply `docs/archive/admin_backend/ADMIN_RUNBOOK.md`, `OPERATOR_RUNBOOK.md` and final acceptance/release evidence: provisioning/disable, normal workflows, stale versions, ambiguous-request recovery, evidence unavailable, reconciliation, deploy/rollback.

### Exit gate and commit/build ordering

- [ ] All required feature/security/accounting gates pass, unresolved configuration inputs are closed, and actual deployed browser/cross-client observations are recorded.
- [ ] **Git commit after AB-10 implementation:** `feat: verify and deploy the integrated admin website`.
- [ ] Build/deploy the exact committed implementation and perform a short post-deploy smoke. Record the actual Hosting/Functions artifact identities rather than labeling an earlier dirty build as that commit.
- [ ] Commit final deployment evidence in a small follow-up documentation commit if necessary: `docs: record admin backend release acceptance`. Distinguish build SHA from documentation-only SHA.

## 16. Verification command contract

### Existing commands to retain

Run from the indicated working directory. These commands exist in the inspected manifests; this planning task has not rerun or asserted their results.

| Directory | Commands |
| --- | --- |
| `apps/admin-web/` | `npm.cmd run lint`; `npm.cmd run check:tests`; `npm.cmd test`; `npm.cmd run build`; `npm.cmd run test:e2e` |
| `functions/` | `npm.cmd run build`; `npm.cmd run test:unit`; affected `test:rules`, `test:sessions`, `test:submission`, `test:settlement`, `test:rewards`, `test:maintenance` scripts |
| Repository | Resident refactor phase commands already established by the owning phases; `flutter analyze` when shared client contracts are affected |

Inspect existing emulator scripts before reuse: many currently rely on default-database fixtures. A passing obsolete path/claim fixture cannot validate the corrected admin contract.

### New named gates to establish during their owning phases

These are **planned scripts**, not commands claimed to exist today. Implement real assertions before adding them to CI; no empty/dummy pass placeholders.

| Directory / planned command | Owner | Required boundary |
| --- | --- | --- |
| Admin: `npm.cmd run check:all` | AB-02/03 | All actual source/adapters/tests/config typecheck, not just old entrypoints |
| Admin: `npm.cmd run test:firebase` | AB-03 onward | Runtime codecs, adapter envelopes/errors, auth lifecycle, pending intents and versioned DTOs |
| Functions: `npm.cmd run test:admin:auth` | AB-02 | Exported handler guards, context disable, App Check verifier behavior, scoped recovery |
| Functions: `npm.cmd run test:admin:queries` | AB-03 | Real-path views/rules/cursors/search/counts and rebuild ordering |
| Functions: `npm.cmd run test:admin:bins` | AB-04 | Bin/QR registration, config concurrency, delete/reference races |
| Functions: `npm.cmd run test:admin:settings` | AB-05 | Immutable policy/pointer publication and submitted-policy preservation |
| Functions: `npm.cmd run test:admin:collections` | AB-06 | Alert uniqueness, threshold reconciliation, collection/scan serialization and replay |
| Functions: `npm.cmd run test:admin:reviews` | AB-07 | Shared settlement, original-cycle deltas, competing decisions, evidence authorization |
| Functions: `npm.cmd run test:admin:catalog` | AB-08 | Offer-version publication, redemption/delete races, immutable voucher snapshots |
| Functions: `npm.cmd run test:admin:projections` | AB-09 | Duplicate/out-of-order updates, rebuild equality and Malaysia day rollover |
| Functions: `npm.cmd run test:admin:release` | AB-10 | Established admin gates and affected shared invariants serially, failing on any failure |
| Admin: `npm.cmd run test:e2e:firebase` | AB-10 | Real Firebase emulator adapter Playwright journeys, isolated namespace/identities |

Emulator gates refuse a live default, use explicit project/database, and run serially to fit the current host. CI explicitly includes new schema/infra/rules/web/Functions paths. Deployed provider/evidence/browser checks are separate from injected or emulator evidence.

## 17. Final acceptance scenario matrix

| ID | Scenario | Required proof |
| --- | --- | --- |
| ADM-01 | Admin vs resident/disabled admin | Real login works; residents and disabled accounts cannot read admin data or invoke commands; direct business writes denied even for admin |
| ADM-02 | Refresh/logout/account switch | Persistent facts survive reload, pending intent recovers, old subscriptions and sensitive detail clear |
| ADM-03 | Create a bin | One positive-capacity zero-opening cycle and registered QR; resident scans the exported payload successfully |
| ADM-04 | Edit/delete races | Stale config rejected; active/referenced bin cannot disappear; unused delete and concurrent reservation cannot both succeed |
| ADM-05 | Occupancy -> alert | Actual capacity posting crosses threshold, producing one bin/cycle alert with immutable threshold snapshot |
| ADM-06 | Collect and resolve | One new empty cycle/event; duplicate/lost-response retry does not reset again; old workflow can resolve after new deposits |
| ADM-07 | Mixed review | Two bottles + unknown held at null/30 spc; resolve to bag -> 13 points, 28 spc, -2 delta, same receipt and one credit |
| ADM-08 | Review after collection | Old-cycle correction only; current empty bin and unrelated new reservation unchanged |
| ADM-09 | Concurrent/stale decisions | One accepted decision version; loser conflicts; replay returns original committed receipt even after wallet/catalog/policy changes |
| ADM-10 | Technical/excluded/empty | Technical unknown stays unknown until valid resolution; excluded items retain space; affirmative empty is zero count/points/space |
| ADM-11 | Evidence access/lifetime | Correct exact source/crops readable to enabled admin; arbitrary references denied; pending retained and purged artifacts honestly unavailable |
| ADM-12 | Policy changes | P1 pending batch keeps P1 rates/space/classes; P2 affects new batch/guide; zero-rate accepted batch still contributes impact |
| ADM-13 | Reward management | Draft/publish/edit/deactivate visible in resident catalog; version/cost race is explicit; issued voucher snapshot unchanged |
| ADM-14 | Reward deletion/retry | Referenced delete fails; redeem/delete race serialized; retries do not create another offer/debit/voucher |
| ADM-15 | Lists/search | All documented filters/sorts work with deployed indexes, stable ties and prefix search; no filtering of one arbitrary private page |
| ADM-16 | Dashboard | Canonical 37-point/61-spc batch yields one verified batch, six accepted items, 0.145 estimated kg; redemption does not reduce issued/impact totals |
| ADM-17 | Realtime/rebuild | Resident/second-admin changes arrive; missed/out-of-order/duplicate projection updates reconcile to canonical totals |
| ADM-18 | Notifications | One logical versioned review outcome/credit intent; current preferences respected; delivery failure cannot mutate accounting |
| ADM-19 | Shared regression | Resident QR/session/reward/recovery/ownership gates still pass against the compatible backend/schema |
| ADM-20 | Deployment independence | HTTPS admin SPA deep links work, correct named database/regions/roles are used, resident Hosting is preserved, no local server dependency |

Financial/concurrency/fault scenarios require independently calculated assertions on production stores in the emulator. Real browser/platform/IAM/App Check/index/provider-evidence behavior also requires deployed observations. Keep these evidence categories distinct.

## 18. Completion definition

The admin website is activated when all six existing feature pages use the real configured repository bundle, privileged commands are authorized and auditable, shared accounting invariants survive retries/concurrency, and an actual resident-to-admin-to-resident journey passes on the identified deployed release.

At implementation handoff, provide:

- Admin URL, supported login method and privately provisioned operator access.
- Phase tracker with actual verification evidence and a separate Git commit for every completed phase.
- Final physical/DTO/endpoint/index map and compatible resident/backend release identities.
- Admin/operator runbooks, source/build/deployment identity, reconciliation/rebuild instructions and any truthful remaining blockers.

**Suggested first execution instruction:** Start AB-01 by reading this plan and the current resident refactor tracker. Freeze the A1/A2 shared contract and actual completed handoff commits, confirm admin Auth/Hosting inputs, create the admin execution tracker, complete the AB-01 checklist and commit that phase before proceeding to AB-02.
