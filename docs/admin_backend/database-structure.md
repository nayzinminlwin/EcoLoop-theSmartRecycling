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
└── notificationEvents/{eventId}
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
| `simulationAssets` | Assets used by the recycling simulation flow. |
| `policies` / `policyPointers` | Active recycling and reward policy content/version pointers. |
| `rewards` / `rewardCategories` | Reward catalog and reward grouping data. |
| `guideContent` / `guideMaterials` / `guideSteps` | Recycling guide content, material information, and ordered steps. |
| `scanContent` | Scan/instruction content shown during recycling. |
| `depositSessions` | A resident's active or completed scanning/deposit session. |
| `deposits` | Deposit batches and material submissions. |
| `depositResults` | Inspection or processing receipts for deposits. |
| `walletEntries` | Points ledger entries associated with a resident. |
| `vouchers` | Reward vouchers issued to a resident. |
| `inferenceJobs` | Admin-only inspection/AI inference jobs and their subcollections. |
| `reviewTickets` | Admin review queue for inspection results. |
| `notificationEvents` | Push-notification intents and delivery state. |

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
- Administrators can read inference jobs, review tickets, and evaluation data.
- Client-side writes are disabled by the current Firestore and Storage rules.
  Backend functions are responsible for trusted writes.
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

