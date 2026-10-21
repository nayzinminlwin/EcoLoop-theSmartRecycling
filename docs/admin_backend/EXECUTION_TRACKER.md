# EcoLoop Admin Backend Execution Tracker

- **Plan:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md) (ECOLOOP-ADMIN-BACKEND-001)
- **Authorities:** [ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md](../ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md), [ECOLOOP_DEMO_REFACTOR_PLAN.md](../ECOLOOP_DEMO_REFACTOR_PLAN.md)
- **Created:** 2026-10-21
- **Base source:** `e23d6bb`, branch `dev1`
- **Current phase:** AB-05 — COMPLETE
- **Next phase:** AB-06 — Capacity alerts and audited collection cycles

---

## 1. Phase Ledger

| Phase | Title | Lead | Status | Evidence Document | Target Commit Message | Commit SHA |
| --- | --- | --- | --- | --- | --- | --- |
| **AB-01** | Freeze the integration contract and handoff | Agent | COMPLETE | [AB-01_freeze_contract_and_handoff.md](evidence/AB-01_freeze_contract_and_handoff.md) | `docs: define admin backend integration contracts and handoff` | `7dda851` |
| **AB-02** | Real admin identity, service composition and command recovery | Agent | COMPLETE | [AB-02_auth_and_recovery.md](evidence/AB-02_auth_and_recovery.md) | `feat: connect admin authentication and trusted command transport` | `cfda97c` / `a4dfcde` |
| **AB-03** | Real read layer, query projections and indexes | Agent | COMPLETE | [AB-03_read_projections.md](evidence/AB-03_read_projections.md) | `feat: add admin query adapters and rebuildable read models` | `34b813c` / `62726b1` |
| **AB-04** | Bin management and usable registered QR codes | Agent | COMPLETE | [AB-04_bin_fleet_management.md](evidence/AB-04_bin_fleet_management.md) | `feat: activate admin bin management and QR registration` | `600a20f` |
| **AB-05** | Immutable program settings and policy publication | Agent | COMPLETE | [AB-05_program_settings_policy.md](evidence/AB-05_program_settings_policy.md) | `feat: publish versioned admin program settings` | `1e7590b` |
| **AB-06** | Capacity alerts and audited collection cycles | Agent | NOT_STARTED | `evidence/AB-06_capacity_alerts_collection.md` | `feat: integrate capacity alert lifecycle and collection cycles` | — |
| **AB-07** | Evidence-backed mixed-batch review and shared settlement | Agent | NOT_STARTED | `evidence/AB-07_review_and_settlement.md` | `feat: implement evidence-backed review resolution and settlement` | — |
| **AB-08** | Versioned reward-offer catalog management | Agent | NOT_STARTED | `evidence/AB-08_rewards_catalog.md` | `feat: activate admin reward offer catalog management` | — |
| **AB-09** | Dashboard accounting and cross-client realtime convergence | Agent | NOT_STARTED | `evidence/AB-09_dashboard_convergence.md` | `feat: activate admin dashboard accounting and realtime updates` | — |
| **AB-10** | Acceptance, separate HTTPS deployment and operational handoff | Agent | NOT_STARTED | `evidence/AB-10_acceptance_and_deployment.md` | `chore: verify end-to-end admin backend and configure hosting` | — |

*Allowed states: NOT_STARTED, IN_PROGRESS, IMPLEMENTED, VERIFIED, COMPLETE, BLOCKED, FAILED.*

---

## 2. Resume Checkpoint

```text
Updated: 2026-10-21 11:15 UTC+8
Executor/model: Antigravity (Gemini 3.8 Flash High)
Role: Backend & Integration Specialist
Phase and substep: AB-05 complete; ready for commit and Phase AB-06 startup
Source SHA: dev1 branch
Explicit Firebase mode / project / database / regions:
  - Project ID: ecoloop-thesmartrecycling
  - Named Firestore DB: ecoloop-db
  - Storage Bucket: ecoloop-thesmartrecycling.firebasestorage.app
  - Functions Region: us-central1 (admin callables & resident gateway)
  - Vision Worker Region: asia-southeast1
Exact target files created/staged for AB-05:
  - functions/src/domain/admin_settings.ts
  - functions/src/infrastructure/firestore/admin_settings_store.ts
  - functions/src/transport/admin_settings.ts
  - functions/src/composition.ts
  - functions/src/index.ts
  - functions/package.json
  - functions/tests/unit/admin_settings.test.ts
  - firestore.rules
  - apps/admin-web/src/contracts/admin.ts
  - apps/admin-web/src/data/mockRepositories.ts
  - apps/admin-web/src/data/firebase/firebaseSettingsRepository.ts
  - apps/admin-web/src/features/program/SettingsPage.tsx
  - apps/admin-web/src/features/program/program.css
  - apps/admin-web/src/app/services.ts
  - apps/admin-web/package.json
  - apps/admin-web/tests/admin_settings_ab05.test.ts
  - docs/admin_backend/EXECUTION_TRACKER.md
  - docs/admin_backend/evidence/AB-05_program_settings_policy.md
  - docs/dev_logs/2026-10-21_AdminBackend_PhaseAB05_ProgramSettingsPolicy.md
Contract identities:
  - Schema version: admin.v1
  - Backend schema version: backend.v1
Next exact substep:
  - Commit Phase AB-05: `feat: publish versioned admin program settings`
  - Begin Phase AB-06: Capacity alerts and audited collection cycles
```

---

## 3. Public Configuration & Input Register (§1.2)

| Input Name | Planning Baseline | Confirmed Status | Implementation Location | Notes |
| --- | --- | --- | --- | --- |
| Admin Login Provider | Firebase Email/Password | Planned Baseline | `apps/admin-web/src/app/LoginPage.tsx` | Preserves existing UI form; no third-party OAuth popup needed. |
| Admin Provisioning | Controlled Operator CLI / Admin SDK Script | Planned Baseline | `functions/tools/admin_provision.ts` | Sets Custom Claim `role: "admin"` and writes `adminAccounts/{uid}`. |
| Hosting Target | Separate Firebase Hosting target `admin` | Planned Baseline | `firebase.json` | Resident hosting target `resident` and admin hosting target `admin`. |
| App Check Site Key | Web reCAPTCHA Enterprise key | Configurable via `.env` | `apps/admin-web/src/app/firebase.ts` | Required in `firebase` mode; bypassed only in `emulator` mode. |
| Backend Mode Flag | `VITE_ECOLOOP_BACKEND_MODE` | `mock` \| `emulator` \| `firebase` | `apps/admin-web/.env.example` | Production build strictly enforces `firebase` mode. |
| Reference Bin Fixture | `bin-demo-main` | Confirmed live | `ecoloop-db/bins/bin-demo-main` | Seeded with 1000 spc, 0 occupied, QR `ecoloop://bin/qr-demo-main`. |

---

## 4. Required Corrections to Mock Assumptions Register (§2.3)

| Mock Assumption | Corrected Production Requirement | Disposition Status in Contracts |
| --- | --- | --- |
| Default project `ecoloop-smart-recycling` & default DB | Pinned project `ecoloop-thesmartrecycling` & named DB `ecoloop-db` | Enforced in `commands.schema.json` & `dtos.schema.json` |
| Direct `capacityPercent` manual editing | Capacity is configured via `capacitySpc`; fill is derived read-only | Rejection case in `invalid_cases.json`; enforced in schema |
| Collected bins reset to 10% | Collection resets cycle to **0 spc / 0%** | Specified in `golden_cases.json` case `ab01-alert-collection-cycle` |
| Single material, mandatory item count & confidence | Mixed batches, nullable unreadable counts, per-object review | Specified in `commands.schema.json` & `dtos.schema.json` |
| Binary Approve/Reject decision | Three-way outcome: `verified` (accepted items), `rejected` (excluded items), `empty` (0 items, -provisionalSpace) | Explicitly typed in `commands.schema.json`, `dtos.schema.json`, `golden_cases.json` |
| Change rate updates pending reviews | New rates apply strictly to **future submissions**; historical batches use pinned policy | Enforced via `pinnedPolicyId` and `pinnedPolicyVersion` |
| Broad substring search & full download | Single normalized token prefix search over indexed fields; cursor pagination | Structured in `dtos.schema.json` `adminPaginatedResponse` |

---

## 5. Coordination Gates with Resident Refactor (§4)

| Resident Gate | Dependency for Admin | Status | Action / Fallback |
| --- | --- | --- | --- |
| **H1 + A1** | AB-01 baseline freeze, AB-02 Auth, AB-03 read projections | H1 `NOT_STARTED`, Sample seeding complete | AB-01 contract frozen against canonical architecture; AB-02 development against local emulator. |
| **A2** | AB-04 bins, AB-05 settings, AB-06 collection, AB-07 review settlement | `NOT_STARTED` | Shared domain transactions will be consumed or co-located under clean architecture. |
| **A3** | AB-07 real camera/vision pipeline evidence | `NOT_STARTED` | Admin DTO accepts both `simulated_bin_capture` and pipeline evidence. |
| **A4** | AB-09 cross-client dashboard convergence | `NOT_STARTED` | Admin dashboard aggregation uses Firestore transactions/metrics. |
| **A5** | AB-10 final deployment and release freeze | `NOT_STARTED` | Final end-to-end verification. |
