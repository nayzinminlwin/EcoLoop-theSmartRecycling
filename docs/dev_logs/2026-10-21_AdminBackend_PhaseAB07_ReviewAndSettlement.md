# Dev Log: Admin Backend - Phase AB-07 Review and Shared Settlement

**Date and Time :** 2026-10-21 12:15  
**Agent:** Gemini 3.8 Flash High (Antigravity)  
**Moderator:** Alex  
**Status:** Completed  

## 1. Objective

Implement Phase AB-07 of the Admin Backend Activation Plan (`docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md`), integrating real `reviewTickets` inspection joined with canonical batches, results, and pinned policies, multi-object class disambiguation, cardboard exclusion, non-committing server settlement previews (`previewAdminReviewResolution`), atomic settlement resolution transactions (`adminResolveReview`) updating batch/result/ticket, capacity entries, cycle-sensitive bin occupancy, resident wallet/stats, retention and notification events, and purging `ADM-001` and "Physical camera capture" fallbacks in the admin web portal.

## 2. Reference Documents

- `docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` (Section 12, Phase AB-07)
- `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` (Sections 8, 9, 10, 14, 15, 16, 17)
- `contracts/backend/v1/` and `contracts/admin/v1/`
- `.agent/developer/agent.md`, `.agent/web_developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `functions/src/domain/admin_reviews.ts`: Domain validations (`validateTicketId`, `validateExplanation`, `validateReviewDecisions`) and calculation plan (`calculateReviewPlan`), handling `empty`, `unreadable`, and multi-object canonical class resolutions with cardboard exclusion.
  - `functions/src/infrastructure/firestore/admin_reviews_store.ts`: `FirestoreAdminReviewsStore` implementing `previewReviewResolution` and atomic `resolveReview` (batch/result/ticket update, capacity entry review correction, cycle-specific bin occupancy update, wallet/stats credit, notification/retention event creation, idempotency receipt).
  - `functions/src/transport/admin_reviews.ts`: Exported callables `listAdminReviews`, `getAdminReview`, `previewAdminReviewResolution`, `adminResolveReview`.
  - `functions/tests/unit/admin_reviews.test.ts`: 7 unit tests covering review validations, calculation planning, empty chamber, unreadable failure, multi-object bottle/bag calculation, cardboard exclusion, and invalid input errors.
  - `apps/admin-web/src/data/firebase/firebaseVerificationRepository.ts`: Live Firebase adapter implementing `VerificationRepository` with `getReviewDetail`, `watchReviewDetail`, `previewResolution`, and `resolveReview`.
  - `apps/admin-web/tests/admin_reviews_ab07.test.ts`: 7 unit tests for codec decoding, timestamp normalization, multi-object detail mapping, safe resident display aliases, mock resolution/preview, and command client invocation.
  - `docs/admin_backend/evidence/AB-07_review_and_settlement.md`: Full phase evidence document.
- **Files Modified:**
  - `functions/src/infrastructure/firestore/admin_projections_store.ts`: Added `AdminReviewViewRecord`, `AdminReviewDetailViewRecord`, `projectReview`, and `writeReviewView`.
  - `functions/src/infrastructure/firestore/admin_queries_store.ts`: Added `SUPPORTED_REVIEW_SORTS`, `SUPPORTED_REVIEW_FILTERS`, `listReviews` (cursor pagination, count aggregation, prefix token search), and `getReview`.
  - `functions/src/composition.ts`: Wired `adminReviews` into composition container.
  - `functions/src/index.ts`: Exported review callables in `us-central1`.
  - `firestore.rules`: Added protected rule for `retentionEvents/{eventId}` (`allow read, write: if false;`).
  - `apps/admin-web/src/contracts/adminViewCodecs.ts`: Added review view codecs, inputs, and `adminReviewDetailToVerificationDetail`.
  - `apps/admin-web/src/data/repositories.ts`: Extended `VerificationRepository` with `previewResolution`, `resolveReview`, `getReviewDetail`, `watchReviewDetail`.
  - `apps/admin-web/src/data/mockRepositories.ts`: Implemented `getReviewDetail`, `watchReviewDetail`, `previewResolution`, and `resolveReview` in mock verification repository; replaced `ADM-001` fallback with `state.adminSession?.adminId ?? "Admin"`.
  - `apps/admin-web/src/app/services.ts`: Wired `FirebaseVerificationRepository` into production repository bundle.
  - `apps/admin-web/src/features/operations/DepositVerificationPage.tsx`: Integrated multi-object resolution editor, inventory state selector (`resolved`, `empty`, `unreadable`), live preview card, confirmation modal, safe resident display alias, and "Simulated bin capture" tags.
  - `apps/admin-web/src/features/operations/operations.css`: Added styles for resolution editor, finding cards, class selects, decision toggle groups, preview cards, and inventory state pills.
  - `apps/admin-web/package.json`: Included `admin_reviews_ab07.test.ts` in test and typecheck scripts.
- **Impact to other modules:** No impact on Flutter resident mobile code.

## 4. Technical Decisions & Deviations

- **Unreadable / Technical Failure vs Affirmative Empty:** An unreadable batch (e.g. camera obscured) yields outcome `"rejected"`, `pointsAwarded: 0`, but retains `spaceContributionSpc: 50` (unreadable batch provisional reservation), resulting in `deltaSpaceSpc = 0`. An affirmative empty resolution yields outcome `"empty"`, `pointsAwarded: 0`, and `spaceContributionSpc: 0`, freeing reserved space (`deltaSpaceSpc = -provisionalSpaceSpc`).
- **Current vs Historical Cycle Occupancy:** If `String(batch.cycleId) === String(bin.currentCycleId)`, the active bin's `occupiedSpc` is adjusted by `spaceDeltaSpc`. If `String(batch.cycleId) !== String(bin.currentCycleId)`, the batch belongs to a closed historical cycle; the capacity entry is recorded for historical accounting, but the active bin's occupancy is left untouched.
- **Cardboard Policy Exclusion:** Cardboard (`cardboard_item`) is explicitly excluded by the active policy (`eligible: false`, `points: 0`). The resolution UI disables the "Accept" toggle for cardboard items and provides clear tooltip feedback.
- **Purging Legacy Claims:** All `ADM-001` hardcoded strings have been purged in favor of real authenticated reviewer attribution. All "Physical camera capture" claims have been updated to "Simulated bin capture". Safe masked aliases are used for resident presentation.

## 5. Verification Results

- **Backend tests:** 16/16 test files passed, 94/94 tests passed (`npm test` in `functions`).
- **Frontend tests:** 7/7 test suites passed, 180/180 tests passed (`npm test` in `apps/admin-web`).
- **Frontend typecheck:** `check:tests` and `lint` passed with 0 errors.
- **Frontend build:** `npm run build` completed successfully, producing production bundle in `dist/`.
