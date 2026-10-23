# Phase 6 Refactor Record

**Date:** 2026-10-19  
**Scope:** Remediation of [PHASE_06_AUDIT.md](PHASE_06_AUDIT.md)

## Refactor principles

1. **One accounting owner:** maintenance detects stale work; settlement owns result, review, capacity, wallet, and notification state transitions.
2. **Re-read before destructive work:** retention queries are candidates only. The current artifact is claimed transactionally and eligibility is checked again before Storage deletion.
3. **Business time is server time:** reminder, voucher expiry, and retention decisions use the injected/server `now`; scheduled cleanup is not authorization.
4. **Readonly means structurally readonly:** inspection performs reads only, applies bounded limits, and redacts provider/token/voucher secrets.
5. **Availability is explicit:** processing state carries an operator-facing reason and provider mode, allowing submissions to pause while preserving already-submitted recovery.

## Implemented changes

### Deadline settlement boundary

- Added `SettlementStore.finalizeExpiredJob`.
- Scheduled maintenance delegates terminal deadline/attempt recovery to the settlement store.
- Existing idempotent result checks remain the first branch in the settlement transaction.
- Review, decision version, notification intent, and job terminal state are written by one settlement-owned transaction.

### Retention fencing

- Diagnostic candidates require eligible state, a valid per-run `inspection-evidence/...` path, numeric Storage generation, `resolvedAt`, and `purgeAfterAt == resolvedAt + 30 days`.
- Shared-source-marked artifacts are refused.
- Candidates are transactionally claimed as `purging`, re-read after Storage deletion, and marked `purged` or `purge_pending`.
- Successful deletion records `diagnosticPurgeEvents/{artifactId}` with exact path and generation.

### D7 inspection

- Inspection accepts `--session-id`, `--batch-id`, `--job-id`, or `--resident-id`.
- Batch reports include redacted result/review, capacity, wallet, and notification records.
- Job reports include redacted job and attempt records.
- Session records and resident voucher views are bounded and redacted.
- The command rejects invalid limits and has no mutation/repair/settlement path.

### Availability and deployment metadata

- Submission recognizes `enabled=false`, `status=paused`, and `status=disabled` with an explicit reason.
- `providerMode == "gemini_only"` is persisted as `providerMode` and `inspection-gemini-only` configuration metadata.
- Voucher and diagnostic maintenance query indexes were added.

## Invariants preserved

- No scheduled cleanup grants, debits, refunds, or changes wallet ledger history.
- Used vouchers remain used; only currently available vouchers can expire.
- Pending review and shared source artifacts are not eligible for deletion.
- Storage deletion is generation-scoped, never recursive.
- Notification provider acceptance remains separate from user receipt/read state.

## Remaining work before Phase 6 COMPLETE

- [ ] Add the dedicated recovery emulator suite for timeout/completion races, stale callbacks, crash-after-artifacts, collection-before-review, and paused-service behavior.
- [ ] Add true retention fixtures for pending review, resolution+29 days, resolution+30 days, newer generation, and shared-source references.
- [ ] Complete D7 timeline fields for all production receipt/dispatch projections and document the command output schema.
- [ ] Define and test the actual Gemini provider limiter/routing behavior; current code records provider mode but does not implement a Gemini quota manager.
- [ ] Deploy and verify Cloud Tasks queue settings, worker runtime settings, scheduler configuration, IAM, billing controls, push delivery, and Storage generation deletion.
- [ ] Capture real browser/device push and production readonly diagnosis evidence.

## Validation

- `cd functions; npm run build` — passed after the refactor.
- `cd functions; npm run test:unit` — 19 tests passed.
- `cd functions; npm run test:maintenance` — 2 emulator tests passed, including reminder idempotency, no-refund expiry, and resolution+30-day retention eligibility.
- `git diff --check` — required before commit.
