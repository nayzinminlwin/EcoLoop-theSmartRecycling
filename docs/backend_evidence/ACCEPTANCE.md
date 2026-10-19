# BK-P08-B Fresh-user rehearsal and acceptance

**Unit:** BK-P08-B
**Role:** Integration executor
**Specification:** ECOLOOP-SPEC-001 full-scope delivery and verification; PHASES_07_08_VERIFICATION.md BK-P08-B
**Base revision:** `22bf7d5b10c5a1bf4985840638cb153261d22a5c`
**Captured:** 2026-10-19 (Asia/Singapore)
**Status:** BLOCKED — no fresh-user production rehearsal was claimed

## Rehearsal result

The required fresh resident flow was **not run**. The currently deployed Cloud Run service is revision `ecoloop-vision-00004-wgj`, serving the older `21fbb5fa3e28` image tag recorded in the BK-P00-C evidence. It is not evidence for the current release commit, and no authenticated fresh resident account, live Firebase-mode Hosting session, committed production batch, or end-to-end trace bundle was available for this unit.

The existing Flutter integration test is a mock UI journey (`resident_journey_test.dart`) and is not substituted for this gate. The prior Cloud Run `trash8.jpg` operator probe is a provider smoke test, not a resident QR/wallet/history/redemption rehearsal.

## Required rehearsal matrix

| Case | Result | Evidence / blocker |
|---|---|---|
| Fresh account: zero wallet -> QR -> genuine inference -> committed result -> wallet/history -> demo redemption/use | **BLOCKED** | No fresh live resident account and no current-release live deployment trace |
| Review classification | **NOT_RUN** | Requires a live committed inspection with review classification |
| Excluded item | **NOT_RUN** | Requires a live image/input case and persisted reason code |
| Empty scene | **NOT_RUN** | Requires a live provider response and persisted empty result |
| Full bin / authorized reset | **NOT_RUN** | Requires a live bin cycle and authorized reset evidence |
| Interruption recovery | **NOT_RUN** | Requires a live pending operation and recovery request/response trace |
| Notification permission/token/delivery | **BLOCKED** | Real Android/web delivery and provider receipt remain unverified |
| Reminder at controlled test time | **PARTIAL** | P06-E automated controlled-time tests pass; deployed schedule and delivered reminder were not run |
| Cleanup at controlled test time | **PARTIAL** | P06-E maintenance tests pass; live Storage/diagnostic cleanup was not run |

No case uses a filename as a backend classification, injects an expected label, or treats a mock resident as a production resident.

## Local checks run for this release

| Command | Result |
|---|---|
| `flutter build web --release --dart-define=ECOLOOP_FIREBASE_MODE=firebase` | **PASS** — `build/web` produced |
| `flutter build apk --release --dart-define=ECOLOOP_FIREBASE_MODE=firebase` | **BLOCKED** — Dart snapshot mapping failed because the Windows paging file was too small |
| `flutter devices` | **PASS** — Android 15 device, Chrome, Edge and Windows detected |
| `flutter test integration_test/resident_journey_test.dart -d qgfy7xz9eaci4tvs` | **NOT_RUN** — test is mock-only and cannot satisfy this production rehearsal |

## Controlled-time and retention contract

The implementation under test retains normal 30-day issuance/retention behavior. The maintenance contract is:

- available-voucher reminder schedule: `03:00` `Asia/Kuala_Lumpur`, at most one logical reminder;
- expired vouchers: status projection only, no wallet refund;
- resolved diagnostic generations: cleanup is guarded and readonly inspection is D7-scoped.

P06-E automated evidence covers these rules. It does not prove deployed Scheduler, FCM, or Storage behavior.

## Unresolved blockers

1. Deploy the current release through [deploy_poc.ps1](../../tools/backend/deploy_poc.ps1) with verified production App Check and provider configuration.
2. Create/use a fresh resident account in Firebase Auth and capture the full journey IDs (`requestId`, `traceId`, `sessionId`, `batchId`, `jobId`, `depositId`).
3. Re-run the matrix against the current immutable Cloud Run digest and Firebase Hosting release.
4. Re-run Android release build on a machine with sufficient paging memory and record the artifact identity.

## BK-P08-C final conformance matrix

**Specification:** ECOLOOP-SPEC-001 v1.1, §18; acceptance/runbook matrix AC-01..AC-24
**Review role:** Read-only QA review and integration documentation
**Review base:** commit `31984b8`; worktree had only pre-existing unrelated untracked paths (`.vscode/`, `Demo_Screenshots/`, `android/build/`, `assets/trash_images/`)

| Spec ID | Status | Implementation/evidence | Release limitation |
|---|---|---|---|
| AC-01 | CONDITIONALLY PASSED | Account bootstrap/profile transaction and focused account tests; [ACCOUNT_BOOTSTRAP.md](ACCOUNT_BOOTSTRAP.md) | Live Google Auth smoke not run |
| AC-02 | CONDITIONALLY PASSED | QR/session handlers, reservation tests and capture flow; [BK-P04-A sessions log](../dev_logs/2026-10-19_Backend_BK-P04-A_Sessions.md) | Real camera/QR run not proven |
| AC-03 | CONDITIONALLY PASSED | Asset selection/version models and scan gateway tests; [BK-P04-I2 log](../dev_logs/2026-10-19_Backend_BK-P04-I2_ScanGateway.md) | Live Storage asset journey not run |
| AC-04 | CONDITIONALLY PASSED | Policy/finalization and mixed-line golden cases; [CONTRACT_DECISIONS.md](CONTRACT_DECISIONS.md) | Required real AC-04 trace bundle absent |
| AC-05 | CONDITIONALLY PASSED | Eligibility/exclusion and zero-receipt domain tests; [BK-P04-E log](../dev_logs/2026-10-19_Backend_BK-P04-E_Settlement.md) | No live excluded/empty case |
| AC-06 | CONDITIONALLY PASSED | Gemini/fallback tests and explicit empty/no-proposal handling; [CV_EVALUATION.md](CV_EVALUATION.md) | Frozen provider comparison absent |
| AC-07 | CONDITIONALLY PASSED | Review hold/settlement tests and pending UI integration; [BK-P04-E log](../dev_logs/2026-10-19_Backend_BK-P04-E_Settlement.md) | Live review ticket not exercised |
| AC-08 | CONDITIONALLY PASSED | Decision-version correction and settlement tests; [BK-P07-A QA](../test_logs/2026-10-19_BK-P07-A_QA.md) | Admin approval transport is harness/domain only |
| AC-09 | CONDITIONALLY PASSED | Cycle fencing and stale review/collection tests; [BK-P06-D log](../dev_logs/2026-10-19_Backend_BK-P06-D_Recovery.md) | No deployed race trace |
| AC-10 | CONDITIONALLY PASSED | Idempotency, outbox and concurrent settlement tests; [BK-P04-D log](../dev_logs/2026-10-19_Backend_BK-P04-D_Dispatch.md) | Live Cloud Tasks delivery absent |
| AC-11 | CONDITIONALLY PASSED | Lease, navigation and reopen recovery tests; [BK-P04-L log](../dev_logs/2026-10-19_Backend_BK-P04-L_Recovery.md) | Real background/reopen run absent |
| AC-12 | CONDITIONALLY PASSED | Durable pending-operation and server-session-version tests; [COMMAND_CLIENT.md](COMMAND_CLIENT.md) | Live refresh/background evidence absent |
| AC-13 | CONDITIONALLY PASSED | Deadline, attempt fence and technical-review recovery tests; [BK-P06-D log](../dev_logs/2026-10-19_Backend_BK-P06-D_Recovery.md) | No deployed deadline trace |
| AC-14 | CONDITIONALLY PASSED | Capacity/overflow and authorized reset domain tests | Full-bin live rehearsal absent |
| AC-15 | CONDITIONALLY PASSED | Redemption transaction/widget tests and golden cases; [BK-P05-D log](../dev_logs/2026-10-19_Backend_BK-P05-D_Rewards.md) | Live wallet/voucher journey absent |
| AC-16 | CONDITIONALLY PASSED | Concurrent redemption and owner-counter tests; [BK-P07-A QA](../test_logs/2026-10-19_BK-P07-A_QA.md) | No live concurrency trace |
| AC-17 | CONDITIONALLY PASSED | Voucher use/expiry/no-refund tests; [BK-P05-F log](../dev_logs/2026-10-19_Backend_BK-P05-F_VoucherLifecycle.md) | Live status query not run |
| AC-18 | BLOCKED | Notification intent/device lifecycle tests; [BK-P06-B log](../dev_logs/2026-10-19_Backend_BK-P06-B_Notifications.md) | Real Android/web permission, token and delivery evidence absent |
| AC-19 | CONDITIONALLY PASSED | Controlled-time reminder tests; [BK-P06-E log](../dev_logs/2026-10-19_Backend_BK-P06-E_Maintenance.md) | Deployed Scheduler/FCM delivery absent |
| AC-20 | CONDITIONALLY PASSED | Guarded Storage/diagnostic cleanup tests; [BK-P06-E log](../dev_logs/2026-10-19_Backend_BK-P06-E_Maintenance.md) | Live cleanup evidence absent |
| AC-21 | CONDITIONALLY PASSED | Availability/fallback budget tests and runtime error taxonomy | Provider budget/production outage trace absent |
| AC-22 | BLOCKED | Emulator rules tests and worker identity code; [FIREBASE_FOUNDATION.md](FIREBASE_FOUNDATION.md) | Actual live IAM/private invocation/App Check verification incomplete |
| AC-23 | BLOCKED | Firebase web build passed and Hosting identity recorded; [ADMIN_HANDOFF.md](ADMIN_HANDOFF.md) | Android artifact, HTTPS runtime, camera/auth/push release evidence incomplete |
| AC-24 | CONDITIONALLY PASSED | Immutable policy/guide and historical receipt model/tests | Live policy-change receipt trace absent |

### Cross-cutting gates

| Gate | Status | Evidence |
|---|---|---|
| CV-AC-01..03 | BLOCKED | [CV_EVALUATION.md](CV_EVALUATION.md): 0 labeled/frozen cases |
| Cost/latency target | BLOCKED | [COST_AND_LATENCY.md](COST_AND_LATENCY.md): provider pricing, isolated billing and memory evidence unavailable |
| Full-scope resident rehearsal | BLOCKED | This document's BK-P08-B matrix |
| M8 | BLOCKED / NOT COMPLETE | Required live rehearsal and release gates are not proven |

**Final verdict:** CONDITIONALLY PASSED for the implemented domain contract and deterministic operator harness; **FAILED to establish full release conformance** because required live evidence is missing. No deadline or prior automated test converts a blocked security, CV, finance, device, push, or fresh-user gate into a pass.
