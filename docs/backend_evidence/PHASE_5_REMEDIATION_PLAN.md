# Phase 5 Audit Ownership and Remediation Plan

**Date:** 2026-10-19  
**Source audit:** [PHASE_5_AUDIT.md](./PHASE_5_AUDIT.md)  
**Scope:** BK-P05-A through BK-P05-F  
**Status:** In execution; Waves 1, 2, and the independently executable parts of Wave 4 are implemented. Wave 3 pagination and dynamic-clock work is implemented locally; foreground rebinding/expiry-boundary scheduling and live evidence remain open.

Implementation record: [2026-10-19 Backend Phase 5 Remediation](../dev_logs/2026-10-19_Backend_Phase5_Remediation.md)

## 1. Ownership summary

| Ownership | Count | Findings | Meaning |
|---|---:|---|---|
| Can be tackled independently by the implementation agent | **9** | P5-001, P5-002, P5-003, P5-004, P5-005, P5-006, P5-007, P5-008, P5-010 | Code corrections, contract alignment, tests, fixtures, lifecycle logic, and local emulator execution can be implemented and validated in the repository |
| Requires moderator/user help for final evidence or access | **1** | P5-009 | The implementation agent can prepare and run local tests, but final live Auth/project/app lifecycle evidence requires the user's approved Firebase environment, credentials, and/or a connected Flutter app |
| Confirmed inherited from previous phases | **0** | None | The audit did not identify a Phase 4 defect that directly caused a Phase 5 finding |

### Important qualification

“Requires user help” does not mean the entire finding is outside implementation scope. P5-009 can be partially addressed independently by adding emulator coverage and preparing the test procedure. The user is needed for the remaining live-project/Auth/app evidence and any approval to use production-like resources.

Similarly, the Phase 5 reward work depends on prior contracts and composition infrastructure, but that is a prerequisite relationship, not an inherited defect. No Phase 4 implementation defect was established by the audit.

## 2. Finding-by-finding ownership

| ID | Short description | Primary owner | Independent work |
|---|---|---|---|
| P5-001 | Redemption callable name mismatch | Agent | Align callable export/client operation and add an invocation-level test |
| P5-002 | Reward operations missing durable recovery | Agent, then user for live ambiguity evidence | Add reward recovery contract, preserve request keys, add retry/ambiguous tests |
| P5-003 | Redemption query incorrectly limited to one document | Agent | Correct limit enforcement and test configured limits greater than one |
| P5-004 | Voucher use does not require available status | Agent | Enforce exact status guard and add non-available rejection coverage |
| P5-005 | Required emulator/policy tests missing | Agent | Create named tests and run local emulator gates |
| P5-006 | Voucher pagination/foreground rebinding missing | Agent | Add cursor/page contract, lifecycle observer, expiry-boundary refresh |
| P5-007 | Receipt timestamps/version reconstructed locally | Agent | Map authoritative committed fields and add contract assertions |
| P5-008 | Reward seed prices do not match 10/25/50/75 | Agent, with product confirmation if fixtures are intentional | Update authoritative fixtures and test no wallet grant for new residents |
| P5-009 | A/B/C integration gates unverified | Shared | Agent prepares emulator tests and evidence; user supplies approved live environment/app access for final lifecycle evidence |
| P5-010 | Required retry/conflict/widget coverage incomplete | Agent | Add controlled transport/clock widget and provider tests |

## 3. Remediation sequence

### Wave 0 — Confirm baseline and isolate current-unit changes

1. Preserve the existing dirty worktree and untracked user assets.
2. Re-run the current targeted Flutter and Functions gates.
3. Create a narrow change inventory for each remediation wave.
4. Do not mark any tracker item VERIFIED from deterministic tests alone.

**Exit:** reproducible baseline and no unrelated files included in the remediation scope.

### Wave 1 — Fix the callable and recovery contract

Targets: P5-001, P5-002, P5-007.

1. Choose one canonical operation name and use it consistently in:
   - Flutter `CommandClient`
   - Functions export
   - envelope operation
   - emulator/callable tests
2. Add reward operation recovery to the backend recovery contract, or add an explicit reward recovery callable that returns the stored committed result.
3. Persist the request key in the voucher-use controller/detail flow across retryable or ambiguous failures.
4. Return authoritative redemption/voucher timestamps and wallet version from the backend result/document.
5. Add tests for:
   - callable name alignment
   - same request key after retry
   - same-key/different-payload conflict
   - committed receipt field preservation

**Exit:** implemented locally; Functions build, focused unit/emulator tests, Flutter reward tests, and receipt contract checks pass. Live ambiguous-response evidence remains pending.

### Wave 2 — Correct transaction rules and complete backend tests

Targets: P5-003, P5-004, P5-005.

1. Correct resident lifetime-limit enforcement without truncating the count to one.
2. Require voucher status `available` in addition to owner, demo, and time checks.
3. Create:
   - `functions/tests/unit/voucher_policy.test.ts`
   - `functions/tests/emulator/rewards.test.ts`
4. Cover every BK-P05-D gate:
   - 37 → 25 → 12
   - duplicate lost-response redemption
   - changed price/version
   - insufficient balance
   - simultaneous different requests
   - configured lifetime limit
   - duplicate/used/expired/non-demo/other-owner use
   - catalog edits preserving issued terms

**Exit:** implemented locally; Functions build, all unit tests, and the reward emulator suite pass. Additional edge-case expansion remains planned.

### Wave 3 — Complete voucher lifecycle and query behavior

Targets: P5-006, P5-010.

1. Add owner-scoped voucher pagination with stable timestamp/ID ordering and a domain cursor.
2. Preserve status projection using an injected dynamic clock.
3. Rebind voucher streams and expiry timers when the app returns to the foreground.
4. Refresh at the next relevant expiry boundary rather than only a fixed interval.
5. Add widget/provider tests for:
   - copy code while use is unavailable
   - demo available use action
   - used/expired/non-demo state
   - stale detail state after committed use
   - retry without changing request key
   - available/used/expired filters across an expiry boundary

**Exit:** partially implemented; stable cursors and injected dynamic clock are present and tested locally. Foreground rebinding, expiry-boundary scheduling, and the full widget matrix remain open.

### Wave 4 — Align seed/fixture contracts

Target: P5-008.

1. Confirm the required catalog values are 10/25/50/75 points in the authoritative seed.
2. Update backend example seed and Flutter mock fixtures consistently.
3. Add a bootstrap test proving new residents do not receive a fixture wallet grant.
4. Re-run reward screen and earning-to-spending tests.

**Exit:** implemented locally; catalog fixtures now use 10/25/50/75 and reward-focused Flutter tests pass. A dedicated zero-wallet bootstrap assertion remains to be added.

### Wave 5 — Local integration evidence for BK-P05-A/B/C

Target: P5-009, independently executable portion.

1. Add or complete emulator tests for:
   - activity composite index/query behavior and empty/missing data
   - residentStats summary and active-policy guide reads
   - Auth provider metadata and owner isolation
2. Run the repository’s prescribed emulator commands.
3. Record project mode, emulator IDs/ports, commands, and exact results.

**Exit:** all locally reproducible evidence is captured; live-only blockers are explicitly isolated.

### Wave 6 — User-assisted live/app verification

Target: remaining P5-009 evidence and final Phase 5 gate.

User help needed:

1. Provide or approve the Firebase project/environment for authenticated live verification.
2. Provide a signed-in test account or authorize use of an existing non-production test account.
3. Connect or launch a Flutter app so DTD hot restart and controlled Auth lifecycle checks can run.
4. Approve the live A → sign-out → B test and any reward balance/receipt verification.
5. Confirm whether the price change is an authorized fixture migration if it is not already approved by the specification owner.

The user must not provide credentials in this document or in source control. Use approved local authentication mechanisms only.

**Exit:** live/Auth/app evidence is recorded, and only then may the tracker move from IMPLEMENTED to VERIFIED where every gate passes.

## 4. Planned evidence and status transitions

| Deliverable | Evidence to produce | Allowed status after evidence |
|---|---|---|
| Callable/recovery fixes | Focused unit/contract tests and callable emulator test | IMPLEMENTED; VERIFIED after emulator gate |
| Atomic reward rules | `voucher_policy.test.ts` and `rewards.test.ts` results | VERIFIED if every listed gate passes |
| Voucher lifecycle | `voucher_lifecycle_test.dart`, `voucher_queries_test.dart`, widget tests, lifecycle evidence | VERIFIED if backend agreement also passes |
| A/B/C read/settings integration | Emulator and controlled Auth lifecycle records | VERIFIED only for the specific unit with complete evidence |
| Whole Phase 5 | Updated tracker, linked logs, clean acceptance matrix | COMPLETE only after all units are VERIFIED and handoff is coherent |

## 5. Recommended next action

Start with **Wave 1**, because the callable-name mismatch and reward recovery gap block meaningful live redemption and make later UI verification unreliable. After Wave 1, execute Wave 2 before spending time on live testing. Request the user’s environment/app help only when Wave 5 has isolated the exact live-only checks.

No implementation code was changed while creating this plan.
