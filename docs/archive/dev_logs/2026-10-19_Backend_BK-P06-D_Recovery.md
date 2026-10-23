# BK-P06-D Reconciliation, deadlines and controlled operator tools

## Objective

Recover interrupted dispatch and processing without introducing a second accounting path, while making collection an explicit, auditable operator action.

## Changes

- Added `FirestoreMaintenanceStore` for bounded stale-job recovery, deadline/attempt review projection, abandoned reservation expiry, and expected-cycle collection.
- Reused the existing Cloud Tasks pending-dispatch reconciliation from the scheduled maintenance entrypoint.
- Fenced recovery transactions against the current job attempt and matching reservation session ID.
- Recorded review tickets and notification intents once per batch/decision version; monetary and capacity settlement remains in the settlement store.
- Added a one-minute scheduled maintenance function.
- Added `../../../functions/tools/operator.ts`, defaulting to the Firestore emulator and requiring explicit live-project and live-operation flags.

## Verification

- `cd functions; npm run build` — passed.
- Existing jobs, outbox, and settlement emulator suites remain the accounting/fencing regression gates.
- `git diff --check` — passed.

## Remaining evidence

The live operator path is intentionally not exercised. A deployed scheduler, live IAM identity, and controlled collection run require production authorization and are acceptance evidence for the deployment gate.
