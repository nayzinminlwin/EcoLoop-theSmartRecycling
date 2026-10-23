# BK-P06-E Daily maintenance, retention and cost controls

## Objective

Implement scheduled reminders, voucher expiry, diagnostic retention, bounded runtime behavior, and readonly diagnostics inspection without weakening exact server-time business rules.

## Changes

- Added daily maintenance to `FirestoreMaintenanceStore`.
- Configured `runDailyMaintenance` for `03:00 Asia/Kuala_Lumpur`, one concurrent instance, zero minimum instances, and a bounded batch of 50.
- Created at most one preference-enabled reminder for an available voucher in the two-to-four-day window.
- Expired only currently available vouchers and never created wallet refunds.
- Purged only `diagnosticArtifacts` explicitly marked `eligible`, resolved by their stored `purgeAfterAt`, and containing an exact per-run Storage path plus generation. Purged state is recorded in Firestore.
- Added emulator-default readonly `npm run inspect -- --batch-id=...` / `--resident-id=...` tooling. It has no repair, settlement, debit, credit, or deletion path.
- Preserved pending review/source records and compact business history.

## Verification

- `cd functions; npm run build` — passed.
- `cd functions; npm run test:unit` — 19 tests passed.
- `cd functions; npm run test:maintenance` — 2 emulator tests passed, including injected-time reminder idempotency and no-refund expiry.
- Firestore emulator readonly inspect smoke — passed with no resident data and no write capability.
- Existing jobs, outbox, and settlement emulator gates remain passing regression gates.
- `git diff --check` — passed.

## Remaining evidence

Actual deployed scheduler timing, push receipt, Storage generation deletion, and production availability/billing measurements remain deployment evidence. The schedule hour is recorded as 03:00 Malaysia time.
