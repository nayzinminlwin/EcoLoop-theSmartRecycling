# Dev Log: Backend - BK-P04-B Immutable Submission

**Date and Time :** 2026-10-19 11:35
**Agent:** Copilot SDK in VS Code
**Moderator:** Alex
**Status:** Completed

## 1. Objective

Implement the BK-P04-B trusted Continue/submission boundary: one immutable
business submission per session, a durable processing job and result projection,
pinned asset/policy/cycle identities, a five-minute deadline, dispatch intent,
and actor-scoped operation recovery.

## 2. Reference Documents

- `docs/archive/backend_plan/PHASES_03_04_RECYCLING.md` — BK-P04-B
- `docs/archive/backend_plan/EXECUTION_PROTOCOL.md`
- `docs/archive/backend_plan/ARCHITECTURE_AND_CONTRACTS.md` — A5.2
- `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` — §§4, 5, 9, 10, 11, 15, 18

## 3. Changes Made

- **Files Created:**
  - `../../../functions/src/application/submit_inspection.ts`
  - `../../../functions/src/infrastructure/firestore/inspection_store.ts`
  - `../../../functions/src/transport/resident_inspections.ts`
  - `../../../functions/tests/emulator/submission.test.ts`
  - `../../../functions/vitest.submission.config.ts`
- **Files Modified:**
  - `../../../functions/src/composition.ts`
  - `../../../functions/src/index.ts`
  - `../../../functions/src/transport/resident_sessions.ts`
  - `../../../functions/package.json`
- **Impact to other modules:** `recoverOperation` now recovers both session and
  inspection operations by actor-scoped operation ID. The composition root exposes
  the inspection store and the Functions index exports `submitInspection`.

## 4. Technical Decisions & Deviations

- Firestore reads all identity, session, reservation, asset, policy pointer,
  policy, bin cycle, processing availability, and prior batch state before any
  transaction writes.
- Batch, job, and result IDs are deterministic from the authenticated resident
  and session. Reusing a request ID with a different payload is rejected.
- The job is created with `dispatchState: pending`; no queue or external service
  is called inside the transaction.
- The selected asset version and content digest, active policy, collection cycle,
  trusted submission timestamp, five-minute deadline, trace ID, and source
  references are persisted together.
- A missing processing-availability document is treated as available for the
  emulator/foundation path; an explicitly disabled document rejects submission.

## 5. Phase 4 Deliverables

| Deliverable | Completion | Description |
|-------------|-------------|-------------|
| Immutable submission | ✅ | One batch per session with deterministic identity |
| Durable job and result | ✅ | Queued inference job, processing result projection, pending dispatch intent |
| Exact source pinning | ✅ | Asset version/digest, policy version, bin cycle |
| Deadline and trace context | ✅ | Trusted server time, five-minute deadline, trace ID |
| Recovery and idempotency | ✅ | Actor-scoped recovery, replay, payload conflict, duplicate-session guards |
| Emulator gate | ✅ | Four focused emulator scenarios passed |

## 6. Next Steps / Known Issues

- BK-P04-C must add the authenticated worker gateway, fenced attempts, and
  bounded claim/checkpoint operations.
- Cloud Tasks dispatch remains intentionally unimplemented for BK-P04-D.
- Commit SHA or explicit uncommitted state: implementation is uncommitted at
  this checkpoint; pre-existing untracked `../../../Demo_Screenshots` and
  `../../../assets/trash_images` were preserved.
