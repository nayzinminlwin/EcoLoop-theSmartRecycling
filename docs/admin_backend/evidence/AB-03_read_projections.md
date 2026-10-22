# Phase AB-03 Evidence: Real Read Layer, Query Projections and Indexes

- **Phase:** AB-03
- **Plan Reference:** [ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md](../../ECOLOOP_ADMIN_BACKEND_IMPLEMENTATION_PLAN.md)
- **Author/Role:** Antigravity (Gemini 3.8 Flash High) / Backend & Integration Specialist
- **Date:** 2026-10-21
- **Status:** COMPLETE
- **Target Commit Message:** `feat: add admin query adapters and rebuildable read models`

---

## 1. Executive Summary

Phase AB-03 establishes the production-grade read layer, materialized query projections, and deterministic cursor pagination foundation for the EcoLoop Admin Portal (`apps/admin-web/`) and Backend (`functions/`).

Key outcomes achieved:
1. **Materialized Read Models:** Implemented `adminBinViews` and `adminRewardViews` projections derived from canonical entities (`bins/{binId}`, `binOperations/{binId}`, `rewards/{rewardId}`, `rewardCategories/{categoryId}`).
2. **Native Token-Prefix Search:** Pure prefix token generator indexing search tokens (`searchTokens`) for Firestore `array-contains` prefix queries without external search engines.
3. **Deterministic Bounded Pagination:** Symmetric base64 cursor serialization over composite sort keys `[sortFieldValue, documentId]` guaranteeing no missing or duplicate rows across pages with identical sort keys.
4. **Frozen Query Matrix & Indexes:** Strict query parameter validation on backend callables; composite indexes configured in `firestore.indexes.json` for all supported filter, sort, and search combinations.
5. **Narrow Invalidation & Topic Revision Watcher:** Materialized `adminReadVersions/{topic}` with atomic revision incrementing (`bumpVersion`) and reactive frontend listeners (`watchList`) avoiding redundant polling loops.
6. **Rebuild & Backfill CLI Tool:** Provided `functions/tools/admin_rebuild_projections.ts` supporting `--topic=bins|rewards|all` and `--mode=preview|apply` against named database `ecoloop-db`.
7. **Production Codecs & Repository Adapters:** Implemented `adminViewCodecs.ts` and Firebase repository implementations (`FirebaseBinRepository`, `FirebaseRewardRepository`) integrated into `AdminServiceBundle`.

---

## 2. Changes Made by Layer

### 2.1 Domain & Search (`functions/src/domain/`)
- **Prefix Token Generator (`src/domain/admin_search.ts`):**
  - Normalizes search text (lowercased, diacritics stripped, non-alphanumeric punctuation stripped).
  - Generates token prefixes from length 2 to 20.
  - Deduplicates tokens and enforces document-level cap (max 50 tokens per document) to bound index storage.

### 2.2 Infrastructure & Projections (`functions/src/infrastructure/firestore/`)
- **Timestamp Helpers (`src/infrastructure/firestore/codecs.ts`):**
  - Added `tryTimestampToInstant(value: unknown): Instant | null` helper to safely parse Firestore `Timestamp`, ISO string, or `Date`, falling back cleanly on `FieldValue.serverTimestamp()` sentinels or null inputs.
- **Read Versions Store (`src/infrastructure/firestore/admin_read_versions_store.ts`):**
  - Manages `adminReadVersions/{topic}` (`bins`, `rewards`, `alerts`, `reviews`, `settings`, `dashboard`).
  - Provides `getVersion(topic)` and `bumpVersion(topic, actorUid)` with transactionally incremented integer revisions.
- **Projections Store (`src/infrastructure/firestore/admin_projections_store.ts`):**
  - `projectBin`: Derives `fillPercent = Math.round((occupiedSpc / capacitySpc) * 100)`, computes 75% warning and 85% critical collection states, and generates `searchTokens`.
  - `writeBinView`: Persists `AdminBinViewRecord` to `adminBinViews/{binId}`.
  - `projectReward`: Maps canonical reward data and joins category name, generates `searchTokens`, and bounds integer costs.
  - `writeRewardView`: Persists `AdminRewardViewRecord` to `adminRewardViews/{rewardId}`.
  - `writeRewardCategoryView`: Persists category mapping to `adminRewardCategoryViews/{categoryId}`.
- **Queries Store (`src/infrastructure/firestore/admin_queries_store.ts`):**
  - `queryBins`: Validates against frozen sort keys (`locationName`, `fillPercent`, `binId`, `updatedAt`), supports `collectionState` and `logicalOnline` filters, executes `searchTokens` array-contains filter, queries full filtered count via `query.count().get()`, and constructs stable cursors.
  - `getBin`: Fetches detail record and joins QR payload `ecoloop://bin/{binId}`.
  - `queryRewards`: Validates sort keys (`title`, `pointsCost`, `expiresAt`), supports `categoryId` and `isActive` filters, full filtered count, and stable cursors.
  - `getReward`: Fetches single reward detail view.
  - `getRewardCategories`: Lists all reward categories sorted by `sortOrder`.

### 2.3 Backend Transport (`functions/src/transport/`)
- **Admin Query Callables (`src/transport/admin_queries.ts`):**
  - `listAdminBins`: HTTPS callable in `us-central1` protected by `requireAdminCaller`.
  - `getAdminBin`: HTTPS callable returning detail view or `not-found`.
  - `listAdminRewards`: HTTPS callable for paginated catalog search and sorting.
  - `getAdminReward`: HTTPS callable returning reward detail.
  - `getAdminRewardCategories`: HTTPS callable returning category list.
- **Composition (`src/composition.ts`):**
  - Instantiated `FirestoreAdminReadVersionsStore`, `FirestoreAdminProjectionsStore`, and `FirestoreAdminQueriesStore` inside composition root.
- **Entrypoint (`src/index.ts`):**
  - Exported the 5 admin query callables.

### 2.4 Backfill & Projection Tool (`functions/tools/`)
- **`tools/admin_rebuild_projections.ts`:**
  - CLI script targeting named database `ecoloop-db`.
  - Supports `--topic=bins|rewards|all` and `--mode=preview|apply`.
  - Scans canonical records, computes projected read views, applies batched writes, and bumps topic revisions in `adminReadVersions`.

### 2.5 Web Application Adapters (`apps/admin-web/`)
- **Codecs & Mappers (`src/contracts/adminViewCodecs.ts`):**
  - `decodeAdminBinView`, `decodeAdminBinDetailView`, `decodeAdminRewardView`, `decodeAdminRewardCategoryView`, and `decodeAdminPaginatedResponse`.
  - Mappers `adminBinViewToRow` (mapping to UI `SmartBinRow`) and `adminRewardViewToReward` (mapping to UI `Reward`).
  - Cursor helpers `encodeCursor` and `decodeCursor`.
- **Firebase Repositories (`src/data/firebase/`):**
  - `FirebaseBinRepository`: Implements `BinsRepository` with `list` (calling `listAdminBins`), `get` (calling `getAdminBin`), and `watchList` (listening to `adminReadVersions/bins`).
  - `FirebaseRewardRepository`: Implements `AdminRewardsRepository` with `list`, `get`, `getCategories`, and `watchList` (listening to `adminReadVersions/rewards`).
- **Services Composition (`src/app/services.ts`):**
  - Wired `FirebaseBinRepository` and `FirebaseRewardRepository` into `AdminServiceBundle` in `firebase` and `emulator` modes.

### 2.6 Security & Indexes
- **`firestore.rules`:**
  - Added read permissions for `adminRewardCategoryViews/{categoryId}` and `adminReadVersions/{topic}` guarded by `isAdmin()`.
  - Write permissions explicitly denied (`allow write: if false;`).
- **`firestore.indexes.json`:**
  - Added composite indexes for `adminBinViews` (filtering by `collectionState` and `logicalOnline` with `locationName`, `fillPercent`, `binId`, and `updatedAt`).
  - Added composite indexes for `adminRewardViews` (filtering by `categoryId` and `isActive` with `title`, `pointsCost`, and `expiresAt`).

---

## 3. Verification & Test Evidence

### 3.1 Backend Functions Tests
- Executed `npm test` in `functions/`:
  - **12 test suites passed, 45 unit tests passed (0 failures).**
  - Added `tests/unit/admin_projections.test.ts` testing:
    - Search token generation, normalization, bounds, deduplication, and capping.
    - Derived fill percentage and 75%/85% warning/critical threshold transitions.
    - Cursor encoding/decoding and unsupported sort key rejection.
    - `adminReadVersions` revision incrementing and fallback versioning.

### 3.2 Frontend Admin Web Tests
- Executed `npm test` in `apps/admin-web/`:
  - **182 unit tests passed across 48 suites (0 failures).**
  - Added `tests/admin_queries_ab03.test.ts` testing:
    - Runtime validation of `AdminBinView`, `AdminBinDetailView`, `AdminRewardView`, and `AdminRewardCategoryView`.
    - Clamping of capacities, fill percentages, and numeric costs.
    - Timestamp conversion from Firestore seconds objects to ISO strings.
    - Future schema rejection on paginated response envelopes.
    - Cursor serialization and multi-field stability across duplicate sort values.
- Executed `npm run check:tests`:
  - **Clean TypeScript compilation of all 3 test suites with 0 type errors.**
- Executed `npm run lint`:
  - **Clean TypeScript check of `src/main.tsx` entry graph with 0 type errors.**

---

## 4. Acceptance Criteria & Gate Verification

| Plan Criteria | Status | Evidence |
| --- | --- | --- |
| Versioned query decoding & bounded cursors | Verified | `adminViewCodecs.ts`, `tests/admin_queries_ab03.test.ts` |
| Bounded prefix token search | Verified | `functions/src/domain/admin_search.ts`, `admin_projections.test.ts` |
| Filtered count aggregation (`query.count()`) | Verified | `FirestoreAdminQueriesStore` using `count().get()` |
| Materialized `adminBinViews` & `adminRewardViews` | Verified | `FirestoreAdminProjectionsStore`, `admin_projections_store.ts` |
| Narrow `adminReadVersions/{topic}` invalidation | Verified | `FirestoreAdminReadVersionsStore`, `admin_read_versions_store.ts` |
| Projection rebuild & backfill tool | Verified | `functions/tools/admin_rebuild_projections.ts` |
| Security rules guard read projections | Verified | `firestore.rules` restricts `admin*` collections to `isAdmin()` |
| Composite index configuration | Verified | `firestore.indexes.json` updated with supported query matrix |
| Frontend repository wiring | Verified | `apps/admin-web/src/app/services.ts` wires real repositories |

---

## 5. Conclusion & Next Steps

Phase AB-03 is fully verified and ready to be merged. The next phase is **AB-04: Bin management and usable registered QR codes**.
