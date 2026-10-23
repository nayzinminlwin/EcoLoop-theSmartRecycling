# Dev Log: Backend — live sample references and registered QR images

**Date and Time:** 2026-10-20 02:45 +08:00

**Agent:** GPT-6.1-Sol / OpenCode integration executor

**Moderator:** Alex

**Status:** Completed — scoped seeding prerequisite, not a completed A1–A5 refactor

## 1. Objective

Use the developer-approved demo defaults to seed actual application reference records and existing source pixels into the named Firebase database/bucket, preserve existing state, and provide usable registered bin QR PNGs.

## 2. Reference Documents

- `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md`, especially policy, source/QR, seed and accounting boundaries.
- `docs/archive/audits/ECOLOOP_ULTIMATE_BACKEND_AUDIT.md`, UA-002/018/019 and current runtime limitations.
- `docs/archive/demo/ECOLOOP_DEMO_REFACTOR_PLAN.md`, canonical physical layout and create-only seeding direction.
- User authorized proceeding with reasonable default bin identity and sample catalog.

## 3. Changes Made

Created:

- `../../../functions/tools/seed-manifest.demo.json`
- `../../../functions/tools/seed_reference_data.ts`
- `../../../functions/tools/seed_transport.ts`
- `../../../tools/backend/verify_seed_qr.py`
- `docs/archive/demo_refactor/evidence/SEEDING_AND_QR.md`

Modified:

- `../../../functions/tools/seed.ts` — explicit named database, byte-based MIME, create-only atomic document publication, source-generation verification, safe preview/apply/readback and QR/print-sheet output.
- `../../../functions/package.json` — explicit preview/apply/verify commands for the verified live target.
- `../../../functions/tests/emulator/seed.test.ts`, `../../../functions/vitest.seed.config.ts` — meaningful named-database/storage/preservation/conflict tests with serial resource limits.
- `docs/archive/demo_refactor/EXECUTION_TRACKER.md` — record this pre-phase prerequisite without claiming the full refactor passed.

Generated ignored artifacts: six 1024px QR PNGs, a printable HTML sheet and dry-run/preview/live/verification reports under `../../../functions/.seed-output/demo-v1`.

## 4. Technical Decisions & Deviations

- Existing seed selected `(default)` and overwrote occupancy. New reference seed targets `ecoloop-db` and never updates an existing document.
- Actual primary bin is `bin-demo-main`; registered QR `qr-demo-main` encodes `ecoloop://bin/qr-demo-main`.
- All 16 supplied sources are raster images, including the PNG named `trash10.svg`; original files were not renamed or edited.
- Reused authenticated gcloud with in-memory tokens because local ADC was absent; no credential file/provider key is required for this local operator operation.
- Timestamp data and canonical policy/source records follow the upcoming refactor; defective old client decoding was not patched with duplicate competing data.
- Processing is explicitly paused until real worker/settlement verification. Model/config reference existence is not inference deployment evidence.
- No fabricated resident activity, balances, findings, vouchers or notifications were seeded.

## 5. Deliverables and verification

| Deliverable | Completion | Evidence |
| --- | --- | --- |
| 56 real reference documents | Complete | Live create/readback; correct named database |
| 16 actual private source objects | Complete | Exact generations and independent SHA-256 readback |
| 6 registered QR PNGs/print sheet | Complete | OpenCV pixel decoding matched all registered payloads |
| Rerun safety | Complete for tested seed scope | Four Firestore/Storage emulator tests passed |
| Build | Passed | `npm.cmd run build` |
| Independent live verify | Passed | 56 preserved, zero creates/conflicts; `verified=true` |
| Full Firebase app journey | Pending planned refactor | Audit still applies beyond this scoped seed fix |

Exact commands, IDs and output locations are in `docs/archive/demo_refactor/evidence/SEEDING_AND_QR.md`.

## 6. Next Steps / Known Issues

- Start H1/A1 using the actual seeded named-database records and registered primary QR.
- Repair client paths/DTOs/rules/auth lifecycle and backend processing before lifting availability pause.
- Preserve raw sample inputs and existing native/untracked user work.
- Source base `efa364a`; scoped changes remain uncommitted. This request did not independently authorize a git commit or complete a formal refactor phase.
