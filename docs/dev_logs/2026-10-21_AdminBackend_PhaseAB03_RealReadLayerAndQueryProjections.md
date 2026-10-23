# Dev Log: Admin Backend - Phase AB-03 Real Read Layer, Query Projections and Indexes

**Date and Time :** 2026-10-21 10:15  
**Agent:** Gemini 3.8 Flash High (Antigravity)  
**Moderator:** Alex  
**Status:** Completed  

## 1. Objective

Implement Phase AB-03 of the Admin Backend Activation Plan (`docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md`), establishing the real read layer, materialized query projections (`adminBinViews`, `adminRewardViews`), token-prefix search, deterministic cursor pagination, count aggregation, composite indexes, reactive cache invalidation (`adminReadVersions`), projection backfill tooling, and frontend repository adapters.

## 2. Reference Documents

- `docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` (Section 8, Phase AB-03)
- `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` (Sections 14, 16, 17)
- `contracts/admin/v1/commands.schema.json` and `dtos.schema.json`
- `.agent/developer/agent.md`, `.agent/web_developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `functions/src/domain/admin_search.ts`: Pure prefix token generator for native Firestore search indexing.
  - `functions/src/infrastructure/firestore/admin_read_versions_store.ts`: Narrow invalidation listener store managing integer topic revisions.
  - `functions/src/infrastructure/firestore/admin_projections_store.ts`: Materialized view models for smart bins, rewards, and categories.
  - `functions/src/infrastructure/firestore/admin_queries_store.ts`: Firestore queries supporting frozen query matrix, token search, count aggregation, and cursor pagination.
  - `functions/src/transport/admin_queries.ts`: Admin HTTPS callables (`listAdminBins`, `getAdminBin`, `listAdminRewards`, `getAdminReward`, `getAdminRewardCategories`).
  - `functions/tools/admin_rebuild_projections.ts`: Backfill and projection rebuild tool for named database `ecoloop-db`.
  - `functions/tests/unit/admin_projections.test.ts`: Unit tests for token generation, projections, cursor stability, and query constraints.
  - `apps/admin-web/src/contracts/adminViewCodecs.ts`: Safe runtime codecs, DTO mappers, and cursor serializers.
  - `apps/admin-web/src/data/firebase/firebaseBinRepository.ts`: Live Firebase bin repository with topic revision invalidation.
  - `apps/admin-web/src/data/firebase/firebaseRewardRepository.ts`: Live Firebase reward repository with category mapping and topic invalidation.
  - `apps/admin-web/tests/admin_queries_ab03.test.ts`: Unit tests for view codecs, timestamp parsing, boundary clamping, and cursor stability.
  - `docs/admin_backend/evidence/AB-03_read_projections.md`: Complete phase evidence and acceptance verification document.
- **Files Modified:**
  - `functions/src/infrastructure/firestore/codecs.ts`: Added `tryTimestampToInstant` helper to handle Firestore Timestamps, Dates, ISO strings, and FieldValue sentinels resiliently.
  - `functions/src/composition.ts`: Wired `adminReadVersions`, `adminProjections`, and `adminQueries` stores into composition container.
  - `functions/src/index.ts`: Exported 5 admin query callables.
  - `apps/admin-web/src/app/services.ts`: Wired `FirebaseBinRepository` and `FirebaseRewardRepository` into `AdminServiceBundle`.
  - `apps/admin-web/package.json`: Updated `check:tests` and `test` scripts to include all test files.
  - `firestore.rules`: Permitted read access on `adminRewardCategoryViews` and `adminReadVersions` for authenticated admins.
  - `firestore.indexes.json`: Configured composite indexes for `adminBinViews` and `adminRewardViews`.
  - `docs/admin_backend/EXECUTION_TRACKER.md`: Updated Phase AB-03 status to COMPLETE and recorded checkpoint.
- **Impact to other modules:** No impact on Flutter mobile app or protected resident configurations.

## 4. Technical Decisions & Deviations

- **Native Token Prefix Search (`admin_search.ts`):** Implemented pure bounded token-prefix generation (min length 2, max length 20, capped at 50 tokens per document) and indexed in a `searchTokens` array field. This enables prefix filtering with standard Firestore `array-contains` without requiring external third-party search dependencies (like Algolia or Typesense).
- **Composite Cursor Stability:** Cursor serialization packages both the target sort value and `doc.id` as `[value, docId]` in a base64 envelope. This prevents missed or duplicate records across pagination boundaries when multiple records share identical sort values (such as identical fill percentages or creation dates).
- **Resilient Timestamp Decoding:** Created `tryTimestampToInstant` which safely handles Firestore `Timestamp` objects (with `.toDate()`), native JavaScript `Date` instances, ISO strings, and gracefully defaults when uncommitted server timestamp sentinels or null inputs are encountered.
- **Narrow Revision Listening (`adminReadVersions/{topic}`):** Rather than polling the entire database or listening to unbounded collections, the client listens to a single document per topic (`adminReadVersions/{topic}`) which only updates when a write actually invalidates that topic.

## 5. Phase AB-03 Deliverables

| Deliverable | Completion | Description |
|-------------|-------------|-------------|
| Domain Search Tokenizer (`admin_search.ts`) | ✅ | Generates prefix tokens for `array-contains` search |
| Read Versions Store (`admin_read_versions_store.ts`) | ✅ | Topic revision management for narrow invalidation |
| Materialized Projections Store (`admin_projections_store.ts`) | ✅ | Materializes `adminBinViews` and `adminRewardViews` |
| Query Execution Store (`admin_queries_store.ts`) | ✅ | Cursor pagination, count aggregation, query matrix |
| Query Callables (`admin_queries.ts`) | ✅ | Role-guarded HTTPS callables in `us-central1` |
| Projection Rebuild Tool (`admin_rebuild_projections.ts`) | ✅ | CLI tool with preview and apply modes |
| Web Runtime Codecs (`adminViewCodecs.ts`) | ✅ | Runtime DTO parsing, boundary clamping, and UI mapping |
| Firebase Bin Repository (`firebaseBinRepository.ts`) | ✅ | Implements `BinsRepository` with revision watching |
| Firebase Reward Repository (`firebaseRewardRepository.ts`) | ✅ | Implements `AdminRewardsRepository` with revision watching |
| Unit & Integration Tests | ✅ | 45 functions tests + 182 admin-web tests passing |

## 6. Next Steps

- Merge Phase AB-03 commit: `feat: add admin query adapters and rebuildable read models`.
- Begin Phase AB-04: Bin management and usable registered QR codes (`docs/ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md` Section 9).
