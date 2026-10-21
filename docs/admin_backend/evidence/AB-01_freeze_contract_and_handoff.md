# Phase AB-01 Evidence: Freeze the Integration Contract and Handoff

- **Phase:** AB-01
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Committed Commit SHA:** `7dda851`
- **Tracker Record SHA:** `5f635cf`

---

## 1. Executive Summary

Phase AB-01 establishes the formal integration contract and architectural handoff between the React 19 administrative portal (`apps/admin-web/`) and the Firebase backend (`functions/`). All commands, data transfer objects (DTOs), query views, and error responses have been frozen in machine-verifiable JSON Schema Draft 2020-12 specifications under `contracts/admin/v1/`.

The contracts eliminate previous mock-contract discrepancies (§2.3) and establish:
1. Strict server-side authority (client identity and timestamps derived solely from server context).
2. Clean separation between mutable configuration (`capacitySpc`) and derived physical state (`occupiedSpc`, `fillPercent`).
3. Three-way review resolution semantics (`verified`, `rejected`, `empty`).
4. Rebuildable, indexed read projections with bounded cursor pagination.
5. End-to-end command idempotency and recovery semantics (`requestId`, `recoverAdminOperation`).

---

## 2. UI Function to Planned Backend Operation Mapping

Every user interaction across the seven admin screens is mapped to an authoritative backend callable and contract specification.

| Screen / Feature | UI Trigger / Component | Operation Name | Transport | Schema Reference | Acceptance Case |
| --- | --- | --- | --- | --- | --- |
| **Authentication** | Sign-In button (`LoginPage.tsx`) | `getAdminContext` | HTTPS Callable | `dtos.schema.json#/$defs/adminContext` | Valid admin session restored; non-admin rejected |
| **Authentication** | Sign-Out / Account Switch | Client Auth SDK | Client SDK | Client Auth event | State cleared, no stale caches |
| **System Recovery** | Page refresh with inflight mutation | `recoverAdminOperation` | HTTPS Callable | `commands.schema.json#/$defs/recoverOperationCommand` | Replays original receipt without re-executing |
| **Overview** | Page Mount / Refresh (`OverviewPage.tsx`) | `getAdminDashboard` | HTTPS Callable | `dtos.schema.json#/$defs/adminDashboardView` | Aggregate KPI tiles, 7-day volume, attention bins |
| **Fleet** | Search / Filter / Page (`SmartBinsPage.tsx`) | `listAdminBins` | HTTPS Callable | `dtos.schema.json#/$defs/adminBinView` | Token-prefix search, 10/20 limit, cursor pagination |
| **Fleet** | Bin Detail Modal | `getAdminBin` | HTTPS Callable | `dtos.schema.json#/$defs/adminBinDetailView` | Full bin config, collection stats, active alert link |
| **Fleet** | Add Bin Form (`AddBinModal.tsx`) | `adminCreateBin` | HTTPS Callable | `commands.schema.json#/$defs/createBinCommand` | `ab01-bin-registration-and-qr` |
| **Fleet** | Edit Bin Form (`EditBinModal.tsx`) | `adminUpdateBin` | HTTPS Callable | `commands.schema.json#/$defs/updateBinCommand` | Optimistic lock `expectedVersion`, location edit |
| **Fleet** | Delete Bin Action | `adminDeleteUnusedBin` | HTTPS Callable | `commands.schema.json#/$defs/deleteUnusedBinCommand` | Fails if cycles or deposits reference bin |
| **Capacity Alerts** | Alert Table Mount / Filter (`CapacityAlertsPage.tsx`) | `listAdminAlerts` | HTTPS Callable | `dtos.schema.json#/$defs/adminAlertView` | Active vs. Resolved tabs, threshold snapshot |
| **Capacity Alerts** | Schedule Collection Button | `adminScheduleCollection` | HTTPS Callable | `commands.schema.json#/$defs/scheduleCollectionCommand` | State transitions to `scheduled`, records actor |
| **Capacity Alerts** | Record Collection Button | `adminRecordCollection` | HTTPS Callable | `commands.schema.json#/$defs/recordCollectionCommand` | `ab01-alert-collection-cycle`: resets to 0 spc |
| **Capacity Alerts** | Resolve Alert Button | `adminResolveCapacityAlert` | HTTPS Callable | `commands.schema.json#/$defs/resolveCapacityAlertCommand` | State transitions to `resolved` |
| **Verification** | Review Queue Tabs / Search (`DepositVerificationPage.tsx`) | `listAdminReviews` | HTTPS Callable | `dtos.schema.json#/$defs/adminReviewView` | Awaiting vs. Resolved, safe resident display |
| **Verification** | Review Detail Card / Bounding Boxes | `getAdminReview` | HTTPS Callable | `dtos.schema.json#/$defs/adminReviewDetailView` | Pinned policy, provisional space, findings |
| **Verification** | Evidence Image View | `getAdminEvidencePreview` | HTTPS Callable | Private Storage URL | Bounded signed preview URL |
| **Verification** | Decision Input Changes | `previewAdminReviewResolution` | HTTPS Callable | `commands.schema.json#/$defs/previewReviewResolutionCommand` | Client previews points & space recalculation |
| **Verification** | Submit Decision Button | `adminResolveReview` | HTTPS Callable | `commands.schema.json#/$defs/resolveReviewCommand` | `ab01-empty-resolution`, `ab01-mixed-batch-resolution` |
| **Rewards** | Catalog Table Mount / Sort (`RewardsVouchersPage.tsx`) | `listAdminRewards` | HTTPS Callable | `dtos.schema.json#/$defs/adminRewardView` | Active/Draft offers, resident limit, artKey |
| **Rewards** | Category Selector | `getAdminRewardCategories` | HTTPS Callable | `dtos.schema.json#/$defs/adminRewardCategoryView` | Standard category definitions |
| **Rewards** | Add Reward Form (`NewRewardModal.tsx`) | `adminCreateReward` | HTTPS Callable | `commands.schema.json#/$defs/createRewardCommand` | Defaults to Draft (`isActive: false`), artKey |
| **Rewards** | Edit Reward Form (`EditRewardModal.tsx`) | `adminUpdateReward` | HTTPS Callable | `commands.schema.json#/$defs/updateRewardCommand` | Versioned update, preserves redemptions |
| **Rewards** | Delete Reward Action | `adminDeleteUnusedReward` | HTTPS Callable | `commands.schema.json#/$defs/deleteUnusedRewardCommand` | Fails if active redemptions exist |
| **Settings** | Page Mount (`SettingsPage.tsx`) | `getAdminSettings` | HTTPS Callable | `dtos.schema.json#/$defs/adminSettingsView` | Active operational threshold & policy digest |
| **Settings** | Save Settings Form | `adminPublishSettings` | HTTPS Callable | `commands.schema.json#/$defs/publishSettingsCommand` | `ab01-publish-program-settings`: new policy version |

---

## 3. Field Alias and Single Boundary Normalization

Mock assumptions and legacy schema names are normalized at the repository boundary:

| UI / Mock Representation | Canonical Backend Field | Transformation / Invariant |
| --- | --- | --- |
| `transactionId` | `depositId` / `batchId` | Mapped at repository adapter; no dual names exposed to UI components. |
| `ownerId` / Resident UID | `residentAlias` | Raw private UIDs (`RES-xxx` or Firebase Auth UIDs) are masked to safe public display strings (e.g. `Resident #B842`) to protect resident privacy. |
| `merchant` | `merchantName` | Unified across all reward schemas. |
| `capacityPercent` (editable) | `capacitySpc` (configured), `fillPercent` (derived) | Admin sets positive integer capacity in Space Units (`capacitySpc` >= 50). `occupiedSpc` and `fillPercent` are derived by cycle accounting and read-only. |
| Single material assumption | `materialMix` array, `objects` array | Batches support mixed materials (`plastic_bottle`, `aluminium_can`, `paper_bag`, etc.). |
| Binary `status: "approved"` / `"rejected"` | `outcome`: `"verified"`, `"rejected"`, `"empty"` | Three-way outcome explicitly distinguishes empty chambers from rejections. |
| Current category rates | Pinned policy rates (`pinnedPolicyId`, `pinnedPolicyVersion`) | Review settlement recomputes points and space strictly against the policy active when the deposit was submitted. |
| Client-side numeric pagination | Opaque cursor tokens | Cursors are generated server-side from indexed sort fields (`adminPaginatedResponse.nextCursor`). |

---

## 4. Three-Way Review Resolution Semantics

The review resolution domain enforces three distinct outcomes, each with explicit accounting and presentation semantics:

```text
                                  [Admin Review Decision]
                                             |
            +--------------------------------+-------------------------------+
            |                                |                               |
            v                                v                               v
       [VERIFIED]                       [REJECTED]                        [EMPTY]
- >= 1 accepted items            - 0 accepted items               - 0 deposited items
- Points awarded via policy      - 0 points awarded               - 0 points awarded
- Final space calculated         - Space retained in bin          - Provisional space refunded
- Space delta applied to bin       (provisional space kept)         (delta = -provisionalSpace)
- Badge: Green "Verified"        - Badge: Red "Rejected"          - Badge: Gray "Empty"
```

### 4.1 Outcome Detailed Rules:
1. **Verified (`outcome: "verified"`):**
   - Condition: At least one deposited item has `decision: "accept"` and matches an eligible material class in the pinned policy.
   - Resident Impact: Resident wallet credited with computed points; resident stats incremented.
   - Bin Impact: Bin occupancy adjusted by `finalSpace - provisionalSpace`.
   - UI Representation: Green badge labeled **Verified** / **Approved**.
2. **Rejected (`outcome: "rejected"`):**
   - Condition: All detected items are excluded (contaminated, prohibited, or unreadable technical failure).
   - Resident Impact: 0 points awarded; reason documented.
   - Bin Impact: Provisional space is **retained** in the bin (the physical object remains inside the bin chamber). Delta = 0.
   - UI Representation: Red badge labeled **Rejected**.
3. **Empty (`outcome: "empty"`):**
   - Condition: Operator confirms the chamber contains no deposited items (e.g. false door trigger or immediate retrieval). `objects: []` is mandatory.
   - Resident Impact: 0 points awarded.
   - Bin Impact: Provisional space was reserved erroneously; full provisional space is **deducted** from the bin (`delta = -provisionalSpace`).
   - UI Representation: Gray badge labeled **Empty**. **Must NEVER be mislabeled as Rejected or Approved.**

---

## 5. Backend Infrastructure & Functions Inventory

Inspection of current `functions/src/index.ts` and backend components confirms:

### 5.1 Existing Functions Exports
- **Accounts:** `bootstrapResident`, `getResidentProfile`, `saveResidentPreferences`, `registerResidentDevice`, `unregisterResidentDevice`
- **Sessions:** `scanBinQr`, `confirmSession`, `reportFinishPressed`, `saveImageSelection`, `renewSession`, `cancelSession`, `recoverOperation`
- **Inspections:** `submitInspection`
- **Jobs & Gateway:** `workerGateway`, `dispatchPendingJobs`
- **Rewards:** `redeemResidentReward`, `redeemReward`, `useResidentDemoVoucher`
- **Notifications:** `dispatchPendingNotifications`
- **Schedules:** `reconcileBackendState`, `runDailyMaintenance`
- **Admin Exports:** Currently **ZERO** admin endpoints exist in `functions/src/index.ts`. All admin callables in §2 will be introduced in Phases AB-02 through AB-09 under `functions/src/transport/admin_*.ts`.

### 5.2 Database & Environment Baseline
- **Firebase Project ID:** `ecoloop-thesmartrecycling`
- **Named Firestore Database:** `ecoloop-db` (used across Functions, tools, and web adapters; default `(default)` database is strictly prohibited).
- **Storage Bucket:** `ecoloop-thesmartrecycling.firebasestorage.app`
- **Functions Execution Region:** `us-central1` (for callable transports, matching resident endpoints).
- **Vision Worker Region:** `asia-southeast1` (Cloud Tasks pipeline).

---

## 6. Resident Refactor A2 Invariant & Shared Interfaces Handoff

The admin backend coordinates with the resident refactor (`docs/ECOLOOP_DEMO_REFACTOR_PLAN.md` Phase A2) to prevent duplicate or conflicting domain models:

1. **Per-Resident Reward Counter Path:**
   - A2 establishes transactional per-resident limits under `residents/{uid}/rewardCounters/{rewardId}` (with fields `redemptionCount`, `lastRedeemedAt`).
   - Admin catalog management (Phase AB-08) configures `maxRedemptionsPerResident` on `rewards/{rewardId}`. Admin queries read aggregated catalog redemption totals from `rewards/{rewardId}.totalRedemptions`, never scanning across private resident subcollections.
2. **Review Resolution Authority (`settlement_store.ts`):**
   - Both automatic settlement and operator review use the shared `settlement_store.ts` transaction pipeline.
   - Admin command `adminResolveReview` acts as a trusted client gateway to `resolveReview`, ensuring identical accounting for wallet entries, statistics, and bin capacity deltas.
3. **Collection Cycle Authority (`maintenance_store.ts`):**
   - Admin commands `adminRecordCollection` and `adminResolveCapacityAlert` invoke the authoritative cycle transition in `maintenance_store.ts`.
   - Cycle transition closes `binCycles/{cycleId}`, creates `collectionEvents/{eventId}`, resets `binOperations/{binId}.occupiedSpc` to `0`, and establishes a new empty cycle.

---

## 7. Preview-Only Inventory and Backfill Plan for Legacy Data

When migrating live or existing emulator collections to the versioned admin schema:

1. **Date Representations:**
   - Historical documents containing ISO strings or client numbers are normalized to Firestore `Timestamp` records via preview scripts.
   - Missing review resolution timestamps are preserved as `null`, never backfilled with artificial current dates.
2. **Legacy Review Tickets:**
   - Existing tickets lacking per-object finding bounding boxes are marked with `confidence: null` and `boundingBox: null`.
   - Unreadable/failed inference jobs retain `totalCount: null`, preserving unknown status without inventing zero counts or fake model confidence scores.
3. **Query Projections Backfill:**
   - Projections (`adminBinViews`, `adminAlertViews`, `adminReviewViews`, `adminRewardViews`) are rebuildable read-only artifacts.
   - An idempotent offline rebuild tool (`tools/rebuild-admin-projections.ts`, introduced in AB-03) will generate projections directly from canonical records (`bins`, `capacityAlerts`, `reviewTickets`, `rewards`).

---

## 8. Database Migration Strategy & Change Manifest

To guarantee safety in `ecoloop-db`:
1. **Target Verification:** All migration scripts require explicit parameters: `--project=ecoloop-thesmartrecycling --database=ecoloop-db`. Defaulting to any unverified database aborts execution.
2. **Change Manifest & Dry-Run:** Every migration step runs in `--mode=preview` first, generating a scoped JSON change manifest specifying document paths, before-state hashes, and proposed after-states.
3. **Rollback Safeguards:** Direct manual edits in the Firebase Console are forbidden. Applied changes are recorded in `adminAuditEvents` with trace identifiers.

---

## 9. Operational Inputs & Pending Console Work with Owners

Per §1.2, the following operational tasks are recorded with assigned owners:

| Task / Input | Detail | Assigned Owner | Target Gate |
| --- | --- | --- | --- |
| Admin User Provisioning | Create admin user in Firebase Auth; assign Custom Claim `role: "admin"`; create `adminAccounts/{uid}` | Backend Specialist / Moderator (Alex) | Phase AB-02 |
| App Check reCAPTCHA Enterprise | Register admin web app domain; generate public site key; configure enforcement | Project Admin / Moderator (Alex) | Phase AB-02 |
| Hosting Target Configuration | Define separate `admin` hosting target in Firebase project console (`firebase target:apply hosting admin <site-name>`) | DevOps / Moderator (Alex) | Phase AB-10 |
| Seeded Reference Verification | Verify `bin-demo-main` and QR `ecoloop://bin/qr-demo-main` accessibility | Completed & Confirmed | Pre-requisite |

---

## 10. Artifacts Created & Verification Proof

The following files were authored, verified, and committed:

1. [`contracts/admin/v1/commands.schema.json`](file:///c:/Users/muabi/EcoLoop-theSmartRecycling/contracts/admin/v1/commands.schema.json)
   - 13 admin command schemas: `recoverAdminOperation`, `adminCreateBin`, `adminUpdateBin`, `adminDeleteUnusedBin`, `adminScheduleCollection`, `adminRecordCollection`, `adminResolveCapacityAlert`, `previewAdminReviewResolution`, `adminResolveReview`, `adminCreateReward`, `adminUpdateReward`, `adminDeleteUnusedReward`, `adminPublishSettings`.
   - Typed responses: `adminResponse`, `adminErrorResponse` with 11 typed error codes.
2. [`contracts/admin/v1/dtos.schema.json`](file:///c:/Users/muabi/EcoLoop-theSmartRecycling/contracts/admin/v1/dtos.schema.json)
   - Read models: `adminContext`, `adminBinView`, `adminBinDetailView`, `adminAlertView`, `adminReviewView`, `adminReviewDetailView`, `adminRewardView`, `adminRewardCategoryView`, `adminSettingsView`, `adminDashboardView`, `adminPaginatedResponse`.
3. [`contracts/admin/v1/golden_cases.json`](file:///c:/Users/muabi/EcoLoop-theSmartRecycling/contracts/admin/v1/golden_cases.json)
   - Covers empty resolution (`ab01-empty-resolution`), technical failure review (`ab01-technical-failure-review`), mixed-batch review (`ab01-mixed-batch-resolution`), alert collection cycle (`ab01-alert-collection-cycle`), bin registration (`ab01-bin-registration-and-qr`), and settings publication (`ab01-publish-program-settings`).
4. [`contracts/admin/v1/invalid_cases.json`](file:///c:/Users/muabi/EcoLoop-theSmartRecycling/contracts/admin/v1/invalid_cases.json)
   - Covers negative capacity, zero capacity, invalid threshold, missing review explanation, inconsistent empty inventory with objects, client points injection attempt, client space injection attempt, free fill percentage editing, negative reward cost, and unsupported schema version.
5. [`docs/admin_backend/EXECUTION_TRACKER.md`](file:///c:/Users/muabi/EcoLoop-theSmartRecycling/docs/admin_backend/EXECUTION_TRACKER.md)
   - Master tracking table for AB-01 through AB-10.
6. [`docs/dev_logs/2026-10-21_AdminBackend_PhaseAB01_IntegrationContractsAndHandoff.md`](file:///c:/Users/muabi/EcoLoop-theSmartRecycling/docs/dev_logs/2026-10-21_AdminBackend_PhaseAB01_IntegrationContractsAndHandoff.md)
   - Formal dev log tracking Phase AB-01 execution.

---

## 11. Exit Gate Verification Checklist

- [x] **UI Mapping:** Each existing UI function maps to a planned backend operation/source and acceptance case (§2).
- [x] **Assumptions Corrected:** The UI corrections in §2.3 and shared ownership/dependencies are documented; no unresolved business-rule contradiction is hidden in an adapter (§3, §4, §6).
- [x] **Schema & Case Validation:** Schemas and representative valid/invalid examples are reviewed, including unreadable technical review and mixed-batch resolution (`golden_cases.json`, `invalid_cases.json`). Validated with Node.js parser.
- [x] **Execution Tracker:** Established with AB-01–10 ledger, input registers, and verified commit SHAs (`EXECUTION_TRACKER.md`).
- [x] **Git Commit:** Completed with exact message `docs: define admin backend integration contracts and handoff` (SHA: `7dda851`).
