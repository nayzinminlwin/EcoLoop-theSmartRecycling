# BK-P05-D Atomic Rewards and Demo Consumption

- **Unit:** BK-P05-D
- **Role:** Integration executor
- **Specification:** wallet/ledger atomicity, redemption idempotency, offer version checks, demo voucher issuance and use
- **Base source revision + dirty/source-bundle identity:** Existing uncommitted BK-P05-A/B/C work; no commit created
- **Files created/modified/generated:**
  - `functions/src/application/rewards.ts`
  - `functions/src/infrastructure/firestore/rewards_store.ts`
  - `functions/src/transport/resident_rewards.ts`
  - `functions/src/composition.ts`
  - `functions/src/index.ts`
  - `functions/tests/unit/rewards.test.ts`
- **Contract/config/model versions:** `backend.v1`; reward catalog `offerVersion`
- **Commands actually run + working directory + result:**
  - `npm run build` from `functions/` — passed
  - `npm run test:unit` from `functions/` — passed, 14 tests
- **Environment/project mode:** Local deterministic TypeScript/Vitest validation; no emulator or live Firebase project evidence
- **Example traceId / requestId:** No runtime callable invocation
- **Evidence paths:** `functions/tests/unit/rewards.test.ts`
- **Defect IDs and unresolved blockers:** Emulator verification remains required for Firestore transaction contention, composite indexes, callable auth, and rules
- **Commit SHA or explicit uncommitted status:** Uncommitted
- **Next unit and required read set:** BK-P05-E; read reward confirmation/receipt UI and callable client integration

## Implementation notes

Redemption uses a Firestore transaction to read the request recovery record, catalog offer, owner wallet, resident stats, and lifetime reward query before writing the wallet debit, immutable wallet entry, redemption snapshot, demo voucher, reward count, and request recovery record. Voucher use is similarly transactional and creates one immutable usage event without another wallet mutation. Voucher codes are generated in memory and are not logged.
