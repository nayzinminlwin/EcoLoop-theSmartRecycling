# EcoLoop Database Structure

This document describes the Firebase data structure currently configured in
the repository. The source of truth for access control is
[`firestore.rules`](../firestore.rules), and the source of truth for indexes is
[`firestore.indexes.json`](../firestore.indexes.json).

## Database address

| Resource | Address |
| --- | --- |
| Firebase project ID | `ecoloop-thesmartrecycling` |
| Firestore database ID | `ecoloop-db` |
| Firestore REST endpoint | `https://firestore.googleapis.com/v1/projects/ecoloop-thesmartrecycling/databases/ecoloop-db/documents` |
| Firebase Console | `https://console.firebase.google.com/project/ecoloop-thesmartrecycling/overview` |
| Firestore Console | `https://console.firebase.google.com/project/ecoloop-thesmartrecycling/firestore` |
| Authentication domain | `ecoloop-thesmartrecycling.firebaseapp.com` |
| Storage bucket | `gs://ecoloop-thesmartrecycling.firebasestorage.app` |

The Firebase project configuration is shared by the Flutter app and web
messaging worker. API keys and app IDs remain in the platform configuration
files; private service-account credentials must not be committed.

### Local emulator addresses

These addresses come from [`firebase.json`](../firebase.json):

| Service | Address |
| --- | --- |
| Firebase Emulator UI | `http://127.0.0.1:4000` |
| Firestore | `http://127.0.0.1:8080` |
| Hosting | `http://127.0.0.1:5000` |
| Functions | `http://127.0.0.1:5001` |
| Authentication | `http://127.0.0.1:9099` |
| Storage | `http://127.0.0.1:9199` |

## Firestore structure

Firestore uses a document/collection model. `{uid}` identifies a Firebase
Authentication user. `{id}` values are generated or domain-specific document
IDs.

```text
ecoloop-db
├── residents/{uid}
│   ├── wallet/current
│   ├── preferences/current
│   ├── stats/current
│   └── devices/{deviceId}
│
├── bins/{binId}
├── binQrMappings/{mappingId}
├── binCycles/{cycleId}
├── binCollectionState/{binId}
├── capacityAlerts/{alertId}
├── simulationAssets/{assetId}
├── policies/{policyId}
├── policyPointers/{pointerId}
├── rewards/{rewardId}
├── rewardCategories/{categoryId}
├── guideContent/{contentId}
├── guideMaterials/{materialId}
├── guideSteps/{stepId}
├── scanContent/{contentId}
├── depositSessions/{sessionId}
├── deposits/{batchId}
├── depositResults/{receiptId}
├── walletEntries/{entryId}
├── vouchers/{voucherId}
├── inferenceJobs/{jobId}
│   └── {subcollection}/{documentId}
├── reviewTickets/{ticketId}
├── notificationEvents/{eventId}
│
├── adminAccounts/{uid}
├── adminSettings/{settingId}
├── adminAuditEvents/{eventId}
│
├── adminDashboardViews/{dashboardId}
├── adminBinViews/{binId}
├── adminAlertViews/{alertId}
├── adminReviewViews/{reviewId}
├── adminRewardViews/{rewardId}
├── adminRewardCategoryViews/{categoryId}
└── adminReadVersions/{topic}
```

### Collection responsibilities

| Collection/path | Purpose |
| --- | --- |
| `residents/{uid}` | Resident profile, including `residentId`, `displayName`, `email`, `avatarUrl`, `role`, and timestamps. |
| `residents/{uid}/wallet/current` | Current points balance and wallet version. |
| `residents/{uid}/preferences/current` | Notification preferences: `recyclingUpdates`, `pointsCredits`, and `rewardReminders`. |
| `residents/{uid}/stats/current` | Recycling totals such as verified batches, accepted items, material counts, and estimated weight. |
| `residents/{uid}/devices/{deviceId}` | Push-notification device registration, platform, token, and enabled state. |
| `bins` / `binQrMappings` | Smart-bin catalog and QR-code mappings. |
| `binCycles/{cycleId}` | Smart-bin collection lifecycle cycles (opened, ended, space contributions). |
| `binCollectionState/{binId}` | Real-time dispatch state for collection crews (`normal`, `warning`, `critical`, `collection_pending`). |
| `capacityAlerts/{alertId}` | Automated capacity alerts triggered when bin occupancy reaches threshold ($\ge 85\%$). |
| `simulationAssets` | Assets used by the recycling simulation flow. |
| `policies` / `policyPointers` | Active recycling and reward policy content/version pointers. |
| `rewards` / `rewardCategories` | Reward catalog and reward grouping data. |
| `guideContent` / `guideMaterials` / `guideSteps` | Recycling guide content, material information, and ordered steps. |
| `scanContent` | Scan/instruction content shown during recycling. |
| `depositSessions` | A resident's active or completed scanning/deposit session. |
| `deposits` | Deposit batches and material submissions (verified, rejected, or settled). |
| `depositResults` | Inspection or processing receipts for deposits. |
| `walletEntries` | Points ledger entries associated with a resident. |
| `vouchers` | Reward vouchers issued to a resident. |
| `inferenceJobs` | Admin-only inspection/AI inference jobs and their subcollections. |
| `reviewTickets` | Admin review queue for inspection results. |
| `notificationEvents` | Push-notification intents and delivery state. |
| `adminAccounts/{uid}` | Authorized admin identities with verified roles and active flags. |
| `adminSettings/{settingId}` | Global operational parameters (rates, thresholds, active policy pointers). |
| `adminAuditEvents/{eventId}` | Immutable compliance ledger of all administrative mutations. |
| `adminDashboardViews/summary` | Materialized aggregate view of fleet metrics, weekly activity, and material distributions. |
| `adminBinViews/{binId}` | Projected smart bin rows indexed for fast pagination, filtering, and search. |
| `adminAlertViews/{alertId}` | Projected capacity alerts for dispatch operations. |
| `adminReviewViews/{reviewId}` | Projected pending deposit inspection verification cards. |
| `adminRewardViews/{rewardId}` | Projected reward offer entries. |
| `adminRewardCategoryViews/{categoryId}` | Projected reward categories with display ordering. |
| `adminReadVersions/{topic}` | Incremental cache invalidation counters for real-time client convergence. |

---

## Admin Overview Dashboard Data Connection

The Admin Portal's **Overview Dashboard** (`/overview` in `apps/admin-web`) connects directly to Firestore database `ecoloop-db` using a high-performance, real-time reactive model. The dashboard reads canonical business entities (`bins`, `capacityAlerts`, `deposits`, `reviewTickets`) alongside projected materialized snapshots (`adminDashboardViews/summary`, `adminBinViews`, `adminAlertViews`).

### 1. KPI Metric Cards Data Mapping

| KPI Metric Card | Database Collection & Query Filter | Field Mapping / Calculation |
| --- | --- | --- |
| **Registered Bins** | `bins` merged with `adminBinViews` (where `deleted != true`) | Count of unique active smart bin records across the township fleet. |
| **Active Alerts** | `capacityAlerts` and `adminAlertViews` (where `state != 'resolved' && state != 'closed'`) | Total count of uncollected bins currently exceeding critical capacity ($\ge 85\%$) requiring crew pickup. |
| **Verified Deposits** | `deposits` (or `batches`) (where `status in ['verified', 'settled']`) | Total lifetime count of successfully verified recycling submissions; displays combined recyclable weight. |
| **EcoPoints Issued** | `deposits` (or `batches`) (where `status in ['verified', 'settled']`) | Sum of `pointsAwarded` (gross ledger invariant). Resident voucher redemptions debit individual wallets but **never** decrement this gross community issuance metric. |

### 2. 7-Day Weekly Activity Trend (Bar Chart)

- **Source Collection:** `deposits` / `batches` where `status in ['verified', 'settled']`.
- **Date Window:** Dynamic 7-day calendar window pegged to `Asia/Kuala_Lumpur` timezone (`[today - 6 days, ..., today]`).
- **Grouping Key:** Batch occurrence timestamp (`occurredAt` or `createdAt`). A late verification across midnight correctly attributes the deposit to its original occurrence date.
- **Display Order:** Ordered sequentially from **Monday to Sunday** (`Mon -> Sun`).

### 3. Material Mix Distribution (Donut Chart)

- **Source Collection:** `deposits.lines` across all verified deposit batches.
- **Conversion Factors:** Standard physical weight constants:
  - **Plastic** (`plastic_bottle`, `plastic`): `0.025 kg` per item
  - **Aluminium** (`aluminium_can`, `aluminium`): `0.015 kg` per item
  - **Paper** (`paper_item`, `paper_bag`, `paper`): `0.050 kg` per item
  - **Glass** (`glass_bottle`, `glass`): `0.200 kg` per item
  - **Cardboard** (`cardboard_item`): `0.000 kg` (excluded by active program policy)
- **Aggregation:** Percentage share by weight: $\frac{\text{Weight}_{\text{material}}}{\text{Total Weight}} \times 100\%$, rendered as a CSS conic gradient with color-coded legend chips.

### 4. Attention Bins Table

The Attention Bins panel monitors receptacles that require immediate operational intervention or technician awareness. Bins are sourced from `bins` merged with `adminBinViews` and evaluated against a deterministic 3-tier priority structure:

1. **Tier 1 — Critical / Pickup Required:**
   - Condition: Capacity fill $\ge 85\%$, `collectionState === 'critical'`, or `hasActiveAlert === true`.
   - Badge: Red `CRITICAL` + Green `ONLINE`.
   - Dispatch: `Pending Collection`.
2. **Tier 2 — Warning Threshold:**
   - Condition: Capacity fill between $75\% - 84\%$ or `collectionState === 'warning'`.
   - Badge: Amber `WARNING` + Green `ONLINE`.
   - Dispatch: `Collection Scheduled`.
3. **Tier 3 — Offline & Out of Service:**
   - Condition: `enabled === false`, `isOnline === false`, or `logicalOnline === false`.
   - Promoted to Attention Bins **even at 0% capacity** so technicians immediately know which bins are administratively disabled or disconnected from telemetry.
   - Badge: Red/Amber/Green capacity badge + Gray **`OFFLINE`** badge.
   - Deterministic sorting: Tier $\rightarrow$ Fill Percentage Descending $\rightarrow$ Bin ID Ascending.

### 5. Real-Time Convergence Architecture

The web client (`FirebaseDashboardRepository`) maintains real-time synchronization with Firestore:
1. **Cache-Busting Trigger:** Listens to `adminReadVersions/dashboard`. Any backend mutation (e.g., bin collection, deposit settlement) bumps the topic version and prompts an immediate background refresh.
2. **Live Fleet Collections:** Subscribes with `onSnapshot` listeners to `bins`, `adminBinViews`, `deposits`, and `capacityAlerts`.
3. **Visibility Management:** Pauses live polling when the browser tab is hidden (`document.visibilityState === 'hidden'`) and executes an immediate revalidation as soon as the administrator returns to the tab.

---

## Firebase Storage structure

```text
gs://ecoloop-thesmartrecycling.firebasestorage.app
├── simulation-assets/{assetId}/{assetVersion}/{fileName}
├── reward-art/{rewardId}/{assetVersion}/{fileName}
├── evaluation-data/{datasetVersion}/{fileName}
└── inspection-evidence/{residentId}/{depositId}/{runId}/{fileName}
```

## Access summary

- Signed-in users can read catalog content such as bins, guides, policies,
  rewards, and simulation assets.
- A resident can read only their own resident document, resident
  subcollections, deposits, results, wallet entries, vouchers, and
  notification events.
- Administrators can read inference jobs, review tickets, evaluation data,
  audit logs, settings, and read view projections.
- Client-side writes are strictly regulated by `firestore.rules`.
  Administrators can update catalog records and dispatch statuses;
  sensitive ledger mutations and balance calculations are processed through
  trusted Firebase Cloud Functions.
- Unmatched Firestore documents and Storage paths are denied by default.

## Configured composite indexes

The following collection-group indexes are configured in
[`firestore.indexes.json`](../firestore.indexes.json):

- `sessions`: `ownerId ASC`, `updatedAt DESC`
- `batches`: `ownerId ASC`, `occurredAt DESC`
- `receipts`: `ownerId ASC`, `occurredAt DESC`
- `deposits`: `ownerId ASC`, `updatedAt DESC`
- `notificationEvents`: `recipientUid ASC`, `createdAt DESC`
- `reviewTickets`: `status ASC`, `createdAt ASC`
- `vouchers`: `status ASC`, `expiresAt ASC`
- `diagnosticArtifacts`: `state ASC`, `purgeAfterAt ASC`


