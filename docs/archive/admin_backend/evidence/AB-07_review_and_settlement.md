# Phase AB-07 Evidence: Evidence-Backed Mixed-Batch Review and Settlement

- **Phase:** AB-07
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../admin/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md) (§12)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Target Commit Message:** `feat: resolve admin reviews through shared pinned-policy settlement`

---

## 1. Executive Summary

Phase AB-07 delivers full administrative deposit verification, multi-object evidence inspection, server-computed settlement previews, and atomic review resolution across the EcoLoop Firebase backend and Admin Web portal.

Key achievements:
1. **Canonical Review Ticket Reading & Pinned-Policy Joining:**
   - Reads actual `reviewTickets` (`state: open` / `resolved`) joined with the canonical deposit batch, classification result, and pinned policy snapshot.
   - Preserves original ticket and result identity, displaying reason codes (`uncertain_class`, `technical_failure`, etc.), held points, provisional space, occurrence timestamp, and resolution timestamp.
2. **Multi-Object Evidence & Canonical Class Disambiguation:**
   - Handles multi-object findings with per-object class selection (`plastic_bottle`, `aluminium_can`, `glass_bottle`, `paper_item`, `paper_bag`, `cardboard_item`, `other`) and per-object accept/exclude decisions.
   - Enforces policy invariants: cardboard (`cardboard_item`) is explicitly excluded by active program policy and cannot receive EcoPoints.
   - Rejects averaging confidence scores into a fabricated single batch percentage; presents true individual object confidence scores.
3. **Non-Committing Server Preview Calculation:**
   - Implements `previewAdminReviewResolution` callable endpoint and client hook.
   - Computes proposed outcome (`verified`, `rejected`, `empty`), proposed EcoPoints, accepted item count, and bin space contribution delta against provisional reservations.
4. **Shared Atomic Resolution Transaction (`adminResolveReview`):**
   - Atomically updates:
     - `batches/{batchId}`: transitions state to `settled`, writes settled items, sets `pointsAwarded`, `settledAt`.
     - `results/{resultId}`: records final `resolvedClasses`, `findings`, and `inventoryState`.
     - `reviewTickets/{ticketId}`: transitions `state: "resolved"`, sets `resolvedAt`, `reviewedByAdminId`.
     - `capacityEntries`: records a `review_correction` entry with `deltaSpc`.
     - Bin Occupancy: updates `occupiedSpc` by `deltaSpc` ONLY IF the batch belongs to the current cycle (`batch.cycleId === bin.currentCycleId`). If the batch belongs to an already closed historical cycle, the active bin's occupancy is untouched.
     - Resident Wallet & Stats: credits EcoPoints to resident wallet (incrementing `balance`, `version`, `updatedAt`) and bumps resident stats (`totalEcoPoints`, `lifetimeItemsRecycled`).
     - Notification Events: writes `notificationEvents` intent for resident delivery.
     - Retention Events: records `retentionEvents` with a 30-day purge due date (`purgeDueAt = now + 30 days`).
     - Idempotency Receipt: records atomic receipt in `adminOperations` and audit log in `adminAuditEvents`.
     - Projections: updates review projection in `adminQueryViews/reviews` and bumps `adminReadVersions/reviews`.
5. **Purged Legacy Claims & Safe Display Aliases:**
   - Removed all `ADM-001` hardcoded reviewer fallbacks in favor of authenticated reviewer attribution (`ticket.reviewedByAdminId ?? reviewerAlias ?? "Admin"`).
   - Removed false "Physical camera capture" claims in favor of accurate "Simulated bin capture" labeling.
   - Protected resident privacy by presenting safe display aliases (e.g., `Resident •••123`), never exposing raw Firebase UIDs or assuming rigid UID patterns.

---

## 2. Changes Made by Layer

### 2.1 Backend Domain (`../../../../functions/src/domain/admin_reviews.ts`)
- `validateTicketId(ticketId)`: enforces `ticketId` format and constraints.
- `validateExplanation(explanation)`: ensures operator records meaningful explanation (min 5 chars).
- `validateReviewDecisions(objects)`: validates per-object decisions and canonical class names.
- `calculateReviewPlan(input, policy)`: executes shared policy settlement calculation:
  - Handles `inventoryState === "empty"`: affirmative empty chamber (0 points, 0 spc, outcome `empty`).
  - Handles `inventoryState === "unreadable"`: camera obscured/technical failure (0 points, retains unreadable space 50 spc, outcome `rejected`).
  - Handles `inventoryState === "resolved"`: iterates objects, looks up policy rates, excludes cardboard and contaminants, computes points and space contributions.

### 2.2 Backend Infrastructure (`../../../../functions/src/infrastructure/firestore`)
- **`admin_reviews_store.ts` (`FirestoreAdminReviewsStore`):**
  - `previewReviewResolution(input)`: non-committing calculation preview using pinned policy.
  - `resolveReview(actorUid, input)`: atomic transaction executing complete settlement, wallet credit, historical cycle check, capacity entry writing, retention event logging, notification creation, and idempotent receipt recording.
- **`admin_projections_store.ts`:**
  - Added `AdminReviewViewRecord`, `AdminReviewDetailViewRecord`, `projectReview`, and `writeReviewView`.
- **`admin_queries_store.ts`:**
  - Added `listReviews` (filtering by state, searching by prefix tokens, cursor-based pagination) and `getReview`.

### 2.3 Backend Transport & Rules (`../../../../functions/src/transport/admin_reviews.ts`, `../../../../firestore.rules`)
- Exported HTTPS callables: `listAdminReviews`, `getAdminReview`, `previewAdminReviewResolution`, `adminResolveReview`.
- Added security rule protecting `retentionEvents/{eventId}`: `allow read, write: if false;`.

### 2.4 Frontend Contracts & Codecs (`../../../../apps/admin-web/src/contracts/adminViewCodecs.ts`)
- Added `AdminReviewView` and `AdminReviewDetailView` interfaces and runtime codecs (`decodeAdminReviewView`, `decodeAdminReviewDetailView`).
- Added `adminReviewDetailToVerificationDetail` converting backend projection into the UI contract while preserving safe resident aliases and simulated capture tags.
- Added input interfaces: `ObjectResolutionDecisionInput`, `ReviewResolutionPreview`, `ResolveReviewInput`.

### 2.5 Frontend Repositories & UI (`../../../../apps/admin-web/src`)
- **`repositories.ts` & `mockRepositories.ts`:**
  - Extended `VerificationRepository` with `getReviewDetail`, `watchReviewDetail`, `previewResolution`, and `resolveReview`.
  - Implemented mock handling supporting multi-object findings and server previews.
- **`firebaseVerificationRepository.ts` (`FirebaseVerificationRepository`):**
  - Live Firebase implementation communicating with callable functions and real-time revision listeners.
- **`DepositVerificationPage.tsx`:**
  - Integrated `reviewDetailQuery` observing real review tickets.
  - Added multi-object resolution editor with canonical class dropdowns and accept/exclude buttons.
  - Added inventory state selector (`resolved`, `empty`, `unreadable`).
  - Added live preview card showing proposed outcome, EcoPoints, accepted count, and capacity delta.
  - Replaced `ADM-001` fallback and "Physical camera capture" with "Simulated bin capture" and authenticated reviewer.
- **`operations.css`:**
  - Added responsive styles for `.resolution-editor`, `.finding-card`, `.decision-toggle-group`, `.resolution-preview-card`, and inventory state pills.

---

## 3. Test Verification & Verification Matrix

### 3.1 Backend Test Results (`../../../../functions`)
Command: `npm.cmd test`
```
 ✓ tests/unit/policy.test.ts (3 tests)
 ✓ tests/unit/admin_reviews.test.ts (7 tests)
 ✓ tests/unit/notifications.test.ts (3 tests)
 ✓ tests/unit/rewards.test.ts (3 tests)
 ✓ tests/unit/contracts.test.ts (3 tests)
 ✓ tests/unit/logger.test.ts (1 test)
 ✓ tests/unit/reconciliation.test.ts (1 test)
 ✓ tests/unit/voucher_policy.test.ts (2 tests)
 ✓ tests/unit/identity.test.ts (2 tests)
 ✓ tests/unit/dispatch.test.ts (1 test)
 ✓ tests/unit/workspace.test.ts (1 test)
 ✓ tests/unit/admin_settings.test.ts (13 tests)
 ✓ tests/unit/admin_alerts.test.ts (16 tests)
 ✓ tests/unit/admin_projections.test.ts (16 tests)
 ✓ tests/unit/admin_auth.test.ts (11 tests)
 ✓ tests/unit/admin_bins.test.ts (11 tests)

 Test Files  16 passed (16)
      Tests  94 passed (94)
```

### 3.2 Frontend Test & Build Results (`apps/admin-web/`)
1. `npm.cmd run check:tests`: Passed with exit code 0.
2. `npm.cmd run lint`: Passed with exit code 0.
3. `npm.cmd test`: All 180 unit tests across 7 test suites passed:
   - `tests/contracts.test.ts`: 128 tests passed.
   - `tests/admin_auth_ab02.test.ts`: 14 tests passed.
   - `tests/admin_queries_ab03.test.ts`: 13 tests passed.
   - `tests/admin_bins_ab04.test.ts`: 4 tests passed.
   - `tests/admin_settings_ab05.test.ts`: 6 tests passed.
   - `tests/admin_alerts_ab06.test.ts`: 6 tests passed.
   - `tests/admin_reviews_ab07.test.ts`: 7 tests passed.
4. `npm.cmd run build`: Vite build produced clean client bundle in `dist/`.

---

## 4. Exit Gate Validation

| Requirement | Status | Evidence |
| --- | --- | --- |
| Read actual `reviewTickets` joined with canonical batch/result/policy | VERIFIED | `FirestoreAdminReviewsStore`, `getAdminReview`, `decodeAdminReviewDetailView` |
| Render multiple classes/counts and per-object eligibility | VERIFIED | Multi-object list with `CANONICAL_CLASSES` dropdown and accept/exclude toggles |
| Non-committing server preview calculation | VERIFIED | `previewAdminReviewResolution` and live preview card in `DepositVerificationPage` |
| Atomic resolution transaction with wallet, stats, cycle, and capacity correction | VERIFIED | `FirestoreAdminReviewsStore.resolveReview` transaction |
| Historical cycle occupancy preservation | VERIFIED | `batch.cycleId === bin.currentCycleId` conditional occupancy update |
| Retention intent (30-day purge due date) and notification creation | VERIFIED | `retentionEvents` and `notificationEvents` written in atomic transaction |
| Safe resident display alias and no `ADM-001` or physical camera capture claims | VERIFIED | Resident aliases sanitized, "Simulated bin capture" tags enforced throughout |
