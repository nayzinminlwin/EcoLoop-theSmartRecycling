# A1 Contract Map

- **Captured:** 2026-10-20
- **Phase:** A1
- **Source identity:** `8abdc1a` plus the uncommitted A1 changes recorded with this evidence
- **Project/database:** `ecoloop-thesmartrecycling` / `ecoloop-db`
- **Resident callable region:** `us-central1`
- **Vision/Tasks/scheduled region:** `asia-southeast1`

## Canonical records

| Contract | Writer | Resident read | Rule/authorization | Time and version |
| --- | --- | --- | --- | --- |
| Profile | `residents/{uid}` from `bootstrapResident` and `updateResidentProfile` | `getResidentProfile` DTO (`id`, `fullName`, `email`, `avatarUrl`, `createdAt`) | Owner or admin read; direct client writes denied | ISO strings at callable boundary; `updatedAt` retained |
| Wallet | `residents/{uid}/wallet/current` from account/settlement stores | Flutter wallet repository | Owner subcollection read; direct client writes denied | Firestore timestamps/ISO boundary; integer `version` |
| Preferences | `residents/{uid}/preferences/current` | `getResidentPreferences`/`saveResidentPreferences` | Owner subcollection read; direct client writes denied | `updatedAt` retained |
| Stats | `residents/{uid}/stats/current` | Flutter activity summary repository | Owner subcollection read; direct client writes denied | `updatedAt`; counters are server-owned |
| Activity | `deposits/{batchId}` | Owner query by `ownerId`, ordered by `updatedAt` and document ID | Owner read; direct client writes denied | `updatedAt`, `decisionVersion`, nullable points/counts |
| Result/session | `depositResults/{id}`, `depositSessions/{id}` | Owner reads where exposed by the production screen | Owner read; direct client writes denied | Backend schema version and operation/request IDs |
| Voucher/ledger | `vouchers/{id}`, `walletEntries/{id}` | Owner reads | Owner read; direct client writes denied | Server timestamps and immutable receipt fields |
| Guide | `policyPointers/active`, `policies/{policyId}`, `guideContent/{policyId}`, `guideMaterials/{policyId}`, `guideSteps/{policyId}` | Authenticated guide repository | Authenticated catalog reads; writes denied | Active pointer selects immutable policy version |

## Boundary rules

- Flutter sends one `backend.v1` envelope with `operation`, `requestId`, and
  object `payload`; resident callables validate and unpack it once.
- Callable responses retain `schemaVersion`, operation, request/trace IDs,
  status, and data. Firebase callable failures preserve domain code,
  retryability, request ID, and trace ID when supplied.
- Profile aliases are mapped only at the DTO boundary. `residentId` is not
  renamed in Firestore, and `displayName` is not used as an auth claim.
- `excluded` is a legacy read alias for `rejected`; unknown future enum values
  remain non-success and require recovery/review.
- Writers use server-owned Firestore timestamps or ISO instants at the
  application boundary. JSON fixtures serialize UTC ISO strings.

## Migration and seed posture

The reference seed is create-only and targets `ecoloop-db`; it preserves
existing residents, wallets, cycles, offers, policies, and occupancy. A live
legacy migration is not authorized by this phase. The required next command is
the scoped preview tool against the named project/database, followed by
developer authorization before any apply. Missing/empty/unknown values remain
distinct; no verified count, award, evidence, or classification time is
invented.

## Verification status

- Functions TypeScript build: passed after A1 changes.
- Flutter targeted analyze: passed after A1 changes.
- Live Android/web Home and account-switch observations: **not run in this
  agent session; developer-owned A1 gate remains pending**.
