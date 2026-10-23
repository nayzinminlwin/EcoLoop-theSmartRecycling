# EcoLoop mock contracts and backend handoff

Goals 1–2 use stateful in-memory repositories only. All reads and writes are
asynchronous and pass through `MockApi`; default delays are 350 ms for reads,
650 ms for writes, and 1,500 ms for classification. The demo clock is injected
and defaults to `2024-05-20T11:00:00+08:00`.

## Fixture sources

| Data | Fixture |
| --- | --- |
| Resident profile | `../../../assets/mock/account/profile.json` |
| Account security | `../../../assets/mock/account/security.json` |
| Notification preferences | `../../../assets/mock/account/notification_preferences.json` |
| Demo session | `../../../assets/mock/account/session.json` |
| Wallet | `../../../assets/mock/wallet/wallet.json` |
| Deposits | `../../../assets/mock/activity/deposits.json` |
| Guide | `../../../assets/mock/recycling_guide/guide.json` |
| Reward categories/catalog | `../../../assets/mock/rewards/categories.json`, `catalog.json` |
| Vouchers/redemptions | `../../../assets/mock/rewards/vouchers.json`, `redemptions.json` |

## Stored document shapes

All dates are ISO-8601 strings in mock JSON and become `DateTime` values in
models. Firebase adapters must use Firestore `Timestamp` conversion at the
repository boundary and persist only document fields, never computed
projections, credentials, `AuthState`, or file/blob objects.

- **Profile:** `id`, `fullName`, `email`, nullable `avatarUrl`, `createdAt`.
- **Wallet:** `residentId`, `balance`, `updatedAt`, `version`. `nextRewardCost`
  is computed from the active catalog.
- **Deposit:** `id`, `residentId`, nullable `sessionId`, `binId`,
  `binLocation`, `materialType`, `materialLabel`, integer `itemCount`,
  nullable `pointsAwarded`, `status`, `occurredAt`, nullable `verifiedAt`.
- **Reward document:** `id`, `title`, `description`, `merchantName`,
  `categoryId`, nullable `tag`, nullable `imageUrl`, integer `pointsCost`,
  `expiresAt`, `isActive`, `maxRedemptionsPerResident`, `artKey`, `sortOrder`.
- **Voucher:** `id`, `residentId`, nullable `rewardId`, `title`, `merchantName`,
  `code`, `terms`, `issuedAt`, `expiresAt`, `status`, integer
  `remainingUses`, nullable `usedAt`.
- **Redemption:** `id`, `residentId`, `rewardId`, `idempotencyKey`,
  `pointsSpent`, `redeemedAt`, `voucherId`, `walletBalanceAfter`,
  `walletVersion`.
- **Scan session:** `id`, `residentId`, `binId`, `stage`, `createdAt`,
  `updatedAt`, `creationRequestId`, nullable `resultId`.
- **Scan result:** `id`, `sessionId`, `transactionId`, `outcome`,
  `materialType`, `materialLabel`, integer `itemCount`, nullable
  `pointsAwarded`, `classifiedAt`, `explanation`.

Enum wire values are stable lower-case values such as `verified`, `review`,
`rejected`, `available`, `used`, `expired`, and scan stages such as
`binFound`, `ready`, `itemDetected`, `processing`, and `completed`. Unknown
values map to explicit unknown/cancelled states rather than crashing.

## Repository seams

- `AccountRepository`: profile/security/preferences/session reads and writes,
  `watchProfile`, `watchAuthState`, `watchSecurityInfo`,
  `watchNotificationPreferences`, `watchDemoSession`, `signOut`, and
  `resumeDemoSession`.
- `WalletRepository`: `getWallet`, `watchWallet`.
- `ActivityRepository`: `getDeposits(filter, limit)`, `watchDeposits(filter,
  limit)`, `getSummary`, `watchSummary`.
- `RecyclingGuideRepository`: guide read/watch and configured content.
- `ScanRepository`: instructions, demo QR, bin lookup, session creation,
  stage transitions, completion, result/bin reads, and cancellation.
- `RewardsRepository`: category/catalog/voucher reads and streams,
  `getReward`, `getVoucher`, and `redeemReward(rewardId, idempotencyKey)`.

Stream initial snapshots are delayed reads. Subscribers receive later committed
state changes and can cancel without retaining repository resources.

## Mutation and scenario rules

The shared `MockDataStore` is process-local and transactionally rolls back
profile, wallet, and deposits together on failure. Scan completion is
idempotent by session/request identity; it adds one verified deposit and its
configured points exactly once. Redemption is serialized, checks expiry,
resident limits and nonnegative balance, debits the wallet, and creates one
voucher; retrying the same idempotency key returns the original receipt.

Named mock scenarios include `normal`, `readFailureOnce`,
`classificationFailureOnce`, `profileSaveFailureOnce`, `emptyActivity`, and
`redemptionFailureOnce`. The one-shot write scenarios target their named
operations and fail before mutation. Scenario state is process-local and must
be injected into repository overrides in tests; there are no network or
Firebase side effects. Failure recovery must retain the last successful UI
state and expose Retry rather than silently succeeding.

## Goals 3–4 handoff

Backend adapters must target the user's existing, shared Firebase project
(project ID intentionally not invented here): Firestore for the flat document
records, Firebase Auth UID with custom claim `role` exactly `user` or `admin`,
Cloud Storage HTTPS download URL strings, App Check for applicable resources,
and Firebase Hosting for `../../../apps/admin-web/dist` with SPA fallback. Preserve
string IDs, Timestamp converters, URL-only persisted fields, observable
interfaces, unsubscribe behavior, trusted atomic wallet credit/redemption
operations, and rules/indexes. Admin remains a separate web client; the
resident app has no admin route or role switch.
