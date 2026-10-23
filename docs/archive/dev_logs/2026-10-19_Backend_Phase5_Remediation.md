# Backend Phase 5 Remediation

**Date:** 2026-10-19  
**Scope:** Follow-up remediation for BK-P05-A through BK-P05-F  
**Status:** Partially implemented; local deterministic gates pass; live verification remains blocked

## Objective

Correct the Phase 5 audit findings that could be addressed in the repository and record deterministic validation without claiming live or authenticated verification.

## Implemented refactors

### Reward callable and recovery contract

- Added the `redeemReward` callable export compatibility required by the Flutter client.
- Added reward redemption lookup to durable `recoverOperation` handling.
- Preserved request identity for voucher-use retries.
- Returned authoritative redemption timestamps and wallet version from backend responses.
- Updated Flutter receipt mapping to consume committed backend values.

### Reward transaction rules

- Removed the resident redemption query truncation that prevented configured limits above one from being counted.
- Required voucher status to be exactly `available` before demo use.
- Preserved owner, demo, expiry, and one-time-use guards.
- Added pure reward policy helpers and focused unit coverage.

### Voucher query and clock behavior

- Added `VoucherCursor` and `VoucherPage` domain types.
- Added owner-scoped Firebase pagination ordered by `issuedAt` and document ID.
- Added mock repository pagination behavior for deterministic tests.
- Injected the dynamic clock into Firebase voucher status projection.

### Fixture alignment

- Aligned reward fixture prices to the specification: `10 / 25 / 50 / 75` points.
- Updated affected mock reward expectations.

## Validation

The following local gates passed:

- Functions TypeScript build.
- Functions unit suite: 16 tests passed.
- Firestore reward emulator suite: 3 tests passed.
- Flutter rewards suite: 11 tests passed.
- `flutter analyze`.
- `git diff --check`.

## Remaining gaps

The following are not claimed as complete:

- Foreground-resume stream rebinding.
- Next-expiry-boundary scheduling.
- Full retry/conflict/stale-detail widget and provider coverage.
- Additional reward emulator edge cases.
- BK-P05-A/B/C live integration evidence.
- Authenticated A -> sign-out -> B isolation evidence.
- Flutter hot restart evidence; DTD was available but no active Flutter app was connected.

Therefore Phase 5 remains **IMPLEMENTED / BLOCKED FOR VERIFICATION**, not VERIFIED or COMPLETE.

## Related evidence

- [Phase 5 audit](../backend_evidence/PHASE_5_AUDIT.md)
- [Phase 5 remediation plan](../backend_evidence/PHASE_5_REMEDIATION_PLAN.md)
