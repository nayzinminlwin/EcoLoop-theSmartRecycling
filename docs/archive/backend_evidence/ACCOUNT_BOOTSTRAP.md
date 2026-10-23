# BK-P02-B Account Bootstrap Evidence

**Captured:** 2026-10-18  
**Unit:** BK-P02-B — Account bootstrap and trusted provisioning  
**Specification:** ECOLOOP-SPEC-001 sections 9, 10, 11, 12 and 15  
**Status:** VERIFIED

## Implementation

- [accounts_store.ts](../../../functions/src/infrastructure/firestore/accounts_store.ts) initializes the profile, zero wallet, notification preferences and statistics records in one Firestore transaction.
- Firestore `Timestamp`/instant conversion is isolated in [codecs.ts](../../../functions/src/infrastructure/firestore/codecs.ts).
- [composition.ts](../../../functions/src/composition.ts) initializes the Admin SDK once and shares the verified Auth/Firestore clients.
- [resident_accounts.ts](../../../functions/src/transport/resident_accounts.ts) derives UID and token claims from callable Auth context and emits safe backend envelopes.
- Profile, preferences and device handlers are owner-scoped; device tokens are redacted in responses.
- Existing balances, wallet versions, edited names and preferences are preserved on retries. Missing records from interrupted provisioning are repaired.
- Role resolution reads current trusted Auth custom claims. Existing admin/tenant claims are preserved; client-supplied UID, resident ID or role fields are rejected.
- Server writes use Admin SDK composition; no client claim is treated as a trusted service identity.

## Verification

```text
cd functions
npm run test:accounts
npm test
npm run test:rules
```

Results:

- Account/Auth/Firestore emulator gate: **5 tests passed**.
- Functions build and unit suite: **10 tests passed**.
- P02-A Firestore/Storage rules regression: **5 tests passed**.

The account tests cover zero-wallet creation, duplicate bootstrap, partial provisioning retry, preservation of edited metadata and wallet values, trusted admin claim preservation, client UID/role injection rejection, and resident isolation.

The emulator gate uses the explicit `demo-ecoloop` namespace and cannot fall through to the live Firebase project. Live callable deployment and Flutter Auth integration remain later gates.
