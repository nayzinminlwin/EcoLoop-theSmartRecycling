# Phase 5 Implementation Audit

**Audit date:** 2026-10-19  
**Scope:** BK-P05-A through BK-P05-F  
**Authority:** [PHASES_05_06_SERVICES.md](../backend_plan/PHASES_05_06_SERVICES.md), [EXECUTION_PROTOCOL.md](../backend_plan/EXECUTION_PROTOCOL.md), ECOLOOP-SPEC-001 v1.1  
**Audit basis:** source inspection, tracker/dev-log reconciliation, existing focused test evidence, and worktree inspection  
**Commit state:** uncommitted; the Phase 5 changes are mixed with earlier uncommitted work

## Remediation update

The follow-up remediation has corrected the callable/recovery contract, authoritative reward receipt fields, lifetime-limit query truncation, voucher availability guard, and the missing local reward policy/emulator gates. Reward fixtures now use the specified 10/25/50/75 point prices. Voucher pagination now has a stable issuedAt/document-ID cursor, and Firebase voucher status projection uses an injected dynamic clock.

The remaining open items are foreground-resume rebinding and next-expiry scheduling, the complete widget/provider coverage matrix, broader edge-case emulator coverage, and all live/Auth/connected-app evidence. The audit conclusion therefore remains **not VERIFIED or COMPLETE**.

## Executive conclusion

Phase 5 is **implemented in substantial part but not ready to mark VERIFIED or COMPLETE**.

The Flutter read adapters, account/settings changes, reward UI scaffolding, and deterministic mock/contract tests are present. However, the required emulator/live acceptance evidence is absent, and source inspection found correctness gaps that prevent an unconditional “meets the plan” conclusion:

1. The Firebase Flutter redemption client calls `redeemReward`, while the Functions export is `redeemResidentReward`; the live redemption path therefore does not target the exported callable.
2. The durable command recovery path does not include reward redemption or voucher-use records. Ambiguous reward requests can fall back to the generic recovery callable, which only recovers sessions and inspections.
3. The BK-P05-D resident-limit query uses `.limit(1)`, so configured limits greater than one cannot be enforced correctly.
4. Voucher use does not require `status === "available"`; a non-used, non-expired status can pass the backend guard.
5. BK-P05-F does not implement the specified pagination or foreground-resume rebind. It uses periodic refresh timers instead.
6. Required emulator tests and the named voucher policy unit test were not created.

Accordingly, the tracker’s `IMPLEMENTED` states are reasonable for deterministic implementation progress, but the phase must remain **IMPLEMENTED / BLOCKED FOR VERIFICATION**, not VERIFIED or COMPLETE.

## Unit status matrix

| Unit | Implementation coverage | Deterministic evidence | Plan gate | Audit status |
|---|---|---|---|---|
| BK-P05-A | Wallet/activity Firebase adapters, cursor types, owner/status/date filtering, UID invalidation, version merge | Focused Flutter tests and analysis recorded | Emulator indexes, missing/index error, auth rebinding and full owner-isolation flow | **Implemented; verification incomplete** |
| BK-P05-B | `residentStats` summary reads, estimated weights, current-policy guide adapter | Focused Home/guide tests and analysis recorded | 37/61 mixed batch, policy changes and historical receipt separation in emulator/live flow | **Implemented; verification incomplete** |
| BK-P05-C | Provider-aware Auth/profile/security/preferences changes | Account-focused tests and analysis recorded | Provider-aware settings with real Auth metadata and A → sign-out → B lifecycle | **Implemented; verification incomplete** |
| BK-P05-D | Callable/application/store skeleton and atomic transaction intent | Build and 14 unit tests recorded | Emulator reward transaction suite plus voucher policy unit suite and all listed contention cases | **Implemented; failed/incomplete required evidence** |
| BK-P05-E | Firebase repository, durable command usage, offer version/cost, receipt UI | Reward-focused tests and analysis recorded | Retry/price-conflict widget tests and backend balance/receipt agreement | **Implemented; correctness blocker** |
| BK-P05-F | Demo metadata, use action, watched detail, local expiry projection | Reward/lifecycle tests and analysis recorded | Backend/app issue/use/expiry agreement, repeat-use protection and time-correct lists | **Implemented; correctness and evidence blockers** |

## Findings

### P5-001 — Firebase redemption callable name does not match the exported Function

**Severity:** Critical  
**Affected units:** BK-P05-D, BK-P05-E  
**Files:**

- [firebase_rewards_repository.dart](../../lib/features/rewards/data/firebase_rewards_repository.dart)
- [command_client.dart](../../lib/core/firebase/command_client.dart)
- [resident_rewards.ts](../../functions/src/transport/resident_rewards.ts)
- [index.ts](../../functions/src/index.ts)

The Flutter repository calls:

```text
CommandClient.execute('redeemReward', ...)
```

The Functions transport exports `redeemResidentReward`, not `redeemReward`. The durable command therefore resolves the wrong callable name in Firebase mode. The deterministic test injects a transport and does not detect this deployment-level name mismatch.

**Required action:** Standardize the operation/export name across the client, callable export, envelope operation, and tests. Add a Firebase/emulator callable test that invokes the actual exported name.

### P5-002 — Reward operations are not integrated into durable server-side recovery

**Severity:** High  
**Affected units:** BK-P05-D, BK-P05-E, BK-P05-F  
**Files:**

- [command_client.dart](../../lib/core/firebase/command_client.dart)
- [resident_sessions.ts](../../functions/src/transport/resident_sessions.ts)
- [rewards_store.ts](../../functions/src/infrastructure/firestore/rewards_store.ts)

The client marks redemption and voucher use as durable. On a retryable transport failure, `CommandClient` calls `recoverOperation`. The backend recovery handler only checks session and inspection stores; it does not recover `rewardRequests` or `voucherRequests`. Thus an ambiguous reward operation can remain unresolved, and the UI can eventually allow a new request key.

The voucher detail UI generates a new request key on every use attempt:

```text
use-${voucher.id}-${DateTime.now().microsecondsSinceEpoch}
```

This conflicts with the requirement to keep the same request key across ambiguous recovery and not create another redemption/use request after timeout.

**Required action:** Add reward recovery to the recovery contract or make the reward command client perform operation-specific recovery. Persist the request key in controller state until the operation is conclusively committed or rejected. Add an ambiguous-timeout test.

### P5-003 — Lifetime resident limit is not enforced for configured limits above one

**Severity:** High  
**Affected unit:** BK-P05-D  
**File:** [rewards_store.ts](../../functions/src/infrastructure/firestore/rewards_store.ts)

The redemption query ends with `.limit(1)`, but enforcement compares `redemptions.size >= max`. For `maxRedemptionsPerResident > 1`, the query can never report more than one existing redemption, so the configured lifetime limit is not enforced.

**Required action:** Query/count all owner/reward redemptions, use a transaction-safe counter or a bounded query consistent with the configured maximum, and add a test with a limit greater than one.

### P5-004 — Voucher consumption does not require the available state

**Severity:** High  
**Affected unit:** BK-P05-D  
**File:** [rewards_store.ts](../../functions/src/infrastructure/firestore/rewards_store.ts)

The backend rejects `status === "used"` and expired vouchers, but it does not require `status === "available"`. A voucher with another non-used status and a future expiry can be consumed, contrary to the “owner/demo/available/time guarded” requirement.

**Required action:** Change the guard to require `voucher.status === "available"` and add non-available-state emulator coverage.

### P5-005 — Required BK-P05-D emulator and voucher-policy tests are missing

**Severity:** High  
**Affected unit:** BK-P05-D  
**Expected paths:** `functions/tests/emulator/rewards.test.ts`, `functions/tests/unit/voucher_policy.test.ts`

The plan explicitly names these tests and requires coverage for:

- 37 → 25 → 12 wallet flow
- duplicate lost-response redemption
- changed price/version
- insufficient funds
- simultaneous different requests
- lifetime one-per-reward limit
- duplicate use
- used/expired/non-demo/other-owner rejection
- catalog edits preserving issued terms

Neither named test file is present. The recorded 14 unit tests cover application validation and existing backend unit tests, not the required Firestore transaction/rules/auth behavior.

**Required action:** Add the named tests and run them through the repository’s emulator command contract before changing BK-P05-D to VERIFIED.

### P5-006 — BK-P05-F does not implement pagination or foreground-resume rebinding

**Severity:** High  
**Affected unit:** BK-P05-F  
**Files:**

- [vouchers_controller.dart](../../lib/features/rewards/presentation/controllers/vouchers_controller.dart)
- [vouchers_screen.dart](../../lib/features/rewards/presentation/screens/vouchers_screen.dart)
- [firebase_rewards_repository.dart](../../lib/features/rewards/data/firebase_rewards_repository.dart)

The plan requires available/used/expired filters and pagination, plus query/timer rebinding on foreground resume and relevant expiry boundaries. The implementation uses full collection reads and a fixed 30-second periodic refresh. It does not expose a voucher cursor/page model, does not paginate Firebase reads, and does not observe app lifecycle foreground transitions.

The timer also invalidates the provider from the screen, but the repository’s status projection uses `DateTime.now()` rather than an injected dynamic clock, making the behavior difficult to control and verify consistently.

**Required action:** Add an owner-scoped paginated voucher query with stable ordering/cursor, inject the system/dynamic clock, use `WidgetsBindingObserver` or the project’s lifecycle abstraction for foreground resume, and schedule refresh at the next expiry boundary rather than only every 30 seconds.

### P5-007 — Firebase reward receipt reconstructs issue timestamps and wallet version locally

**Severity:** Medium  
**Affected unit:** BK-P05-E  
**File:** [firebase_rewards_repository.dart](../../lib/features/rewards/data/firebase_rewards_repository.dart)

The committed backend response contains receipt/voucher data, but the repository reconstructs `issuedAt` and `redeemedAt` using the client’s `DateTime.now()` and sets `walletVersion` to `0`. This does not faithfully expose the actual committed receipt and can disagree with backend records, especially across retries or clock skew.

**Required action:** Return/read committed `issuedAt`, `createdAt`/`redeemedAt`, and wallet version from the backend response or authoritative voucher/redemption document, then map those values without client-generated timestamps.

### P5-008 — Reward seed/configuration does not match the Phase 5 price requirement

**Severity:** Medium  
**Affected unit:** BK-P05-E  
**Files:** [seed-manifest.example.json](../../functions/tools/seed-manifest.example.json), [catalog.json](../../assets/mock/rewards/catalog.json)

The Phase 5 plan states that existing catalog prices become 10/25/50/75. The example backend seed remains `pointsCost: 100`, and the Flutter mock catalog uses 100/200/350/500. No evidence shows the required price migration or a new-resident wallet-grant check.

**Required action:** Update the authoritative seed/fixtures to the specified prices, add a migration/fixture test, and verify that account bootstrap creates no fixture wallet grant for new residents.

### P5-009 — BK-P05-A/B/C acceptance gates remain unverified

**Severity:** Medium  
**Affected units:** BK-P05-A, BK-P05-B, BK-P05-C  
**Evidence:** the three unit logs and [EXECUTION_TRACKER.md](../backend_plan/EXECUTION_TRACKER.md)

The logs correctly state that deterministic tests passed, but the required integration evidence remains absent:

- BK-P05-A: Firestore composite-index/missing-index behavior and A → sign-out → B live owner isolation
- BK-P05-B: authenticated residentStats/policy reads and 37/61 mixed-policy behavior
- BK-P05-C: actual Auth provider metadata and controlled sign-out lifecycle

These are not documentation-only gaps; they are explicitly named gates in the plan/protocol.

**Required action:** Run the applicable emulator/live tests, record project/emulator identifiers and exact commands, then update statuses only from observed evidence.

### P5-010 — BK-P05-E/F widget coverage does not cover the required retry/conflict/UI behavior

**Severity:** Medium  
**Affected units:** BK-P05-E, BK-P05-F  
**Evidence:** [backend_redemption_test.dart](../../test/features/rewards/backend_redemption_test.dart), [voucher_lifecycle_test.dart](../../test/features/rewards/voucher_lifecycle_test.dart), [voucher_queries_test.dart](../../test/features/rewards/voucher_queries_test.dart)

The tests cover payload mapping, mock use-once behavior, status projection, and existing screen rendering. They do not cover:

- `offer_changed` rendering and refresh behavior
- insufficient balance without optimistic debit
- retry after an ambiguous/retryable command while preserving request identity
- committed receipt/voucher display from a real backend envelope
- foreground resume and expiry-boundary rebinding
- cached detail state attempting a second successful use

**Required action:** Add widget/provider tests with fake command transports and controlled clocks for each listed behavior.

## Positive findings

- Phase 5 work is separated into feature repositories, domain models, controllers, and composition bindings rather than adding Firebase calls to mock repositories.
- Owner scoping is consistently attempted in wallet/activity/reward reads.
- Activity cursors use domain timestamp/ID values instead of exposing Firestore snapshots.
- Home uses compact resident statistics and labels the computed impact as estimated.
- Account settings avoid inventing password age and keep Auth-managed identity separate from editable profile fields.
- Reward redemption writes are structured as one Firestore transaction and snapshot offer terms into the issued voucher/receipt.
- Voucher expiry is modeled as a runtime status projection and does not refund wallet points.
- Existing deterministic Flutter and Functions gates were run and their results were recorded without claiming unavailable live/emulator evidence.

## Required disposition

Phase 5 should remain:

```text
BK-P05-A: IMPLEMENTED — integration verification pending
BK-P05-B: IMPLEMENTED — integration verification pending
BK-P05-C: IMPLEMENTED — integration verification pending
BK-P05-D: IMPLEMENTED — required emulator tests and correctness fixes pending
BK-P05-E: IMPLEMENTED — callable-name and committed-receipt fixes pending
BK-P05-F: IMPLEMENTED — recovery, pagination, lifecycle, and backend agreement fixes pending
```

Do not mark the phase `VERIFIED` or `COMPLETE` until the high-severity findings are fixed and the named emulator/widget gates have passed. No commit was created by this audit.
