# A2 transaction and recovery evidence

- **Phase:** A2 — Transactions, complete scan state, and financial recovery
- **Implementation commit:** recorded in `EXECUTION_TRACKER.md` after the phase commit
- **Environment:** Functions Firestore emulator, named demo project `demo-ecoloop`; production identifiers remain `ecoloop-thesmartrecycling` / `ecoloop-db`
- **Scope:** no model training, image labeling, dataset upload, or provider substitution

## Implemented contracts

- Durable resident operations are serialized per UID in the Flutter command client. A pending operation is not replaced by a concurrent action, and an inconclusive `not-found` recovery does not clear the durable intent.
- Session reservation, QR mapping, expiry, draft image selection, expected-version transitions, and cancellation remain owner- and reservation-fenced.
- Findings are validated before settlement for unique object IDs, bounded inventory, confidence, normalized geometry, supported eligibility, and empty-inventory consistency.
- Settlement requires the pinned policy and updates the original cycle contribution plus current-bin display occupancy atomically. Display occupancy is clamped while the raw cycle contribution is retained.
- Terminal rejected outcomes use canonical `rejected` status; `excluded` remains an input eligibility value only.
- A verified batch with zero reward rate still updates accepted-item statistics; positive points create exactly one wallet ledger entry and wallet version.
- Review correction applies only against the expected decision version and emits a new notification event and capacity correction.
- Redemptions persist the immutable offer/receipt metadata and issue one demo voucher with `remainingUses=1`; use changes it to zero exactly once.

## Independent checks

| Check | Result |
| --- | --- |
| Functions build and unit suite (`npm.cmd run build`, `npm.cmd run test:unit`) | PASS — 11 files / 22 tests |
| Session emulator (`npm.cmd run test:sessions`) | PASS — 5 tests |
| Settlement emulator (`npm.cmd run test:settlement`) | PASS — 3 tests, including 37 points / 61 SPC, rejected, empty, unreadable, review correction |
| Rewards emulator (`npm.cmd run test:rewards`) | PASS — 3 tests, including replay and one-time use |
| Flutter command/reward tests | PASS — 9 tests |
| Dart hot reload/restart | No Flutter app was connected to the VS Code DTD; no runtime reload was possible |

## Developer checkpoint still required

The A2 developer checklist remains an observation gate: rehearse the seeded QR on the actual presentation device, verify the pre-submit selection/cancel/reopen sequence, and review any live backfill preview. No developer observation is claimed by this evidence.
