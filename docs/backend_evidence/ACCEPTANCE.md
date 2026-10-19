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
