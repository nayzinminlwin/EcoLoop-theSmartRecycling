# A2 Scan Flow Handoff

**Date:** 2026-10-20  
**Phase:** A2 — Transactions, complete scan state, and financial recovery  
**Current branch:** `dev`  
**Current HEAD:** `8279e7b`

## Purpose

This document records the A2 implementation history and the unresolved live
Android scan behavior so another engineer or higher-capability model can
continue from the exact state of the repository without repeating the same
one-symptom-at-a-time debugging cycle.

## A2 implementation baseline

A2 was implemented in `bf1185f`, with tracker/evidence updates in `5d06887`.
The backend and client changes covered:

- Per-UID durable command serialization and pending-operation recovery.
- Owner/reservation/version-fenced scan sessions, cancellation, expiry, and
  reopen behavior.
- QR mapping validation and bin reservation.
- Explicit settlement validation and pinned-policy enforcement.
- Atomic cycle/bin occupancy accounting and accepted-item statistics.
- Canonical terminal `rejected` outcomes.
- Review correction accounting and notifications.
- Immutable reward receipts and one-time demo voucher use.

Automated evidence passed at that point:

- Functions build and unit tests: 22 tests.
- Session emulator: 5 tests.
- Settlement emulator: 3 tests.
- Rewards emulator: 3 tests.
- Focused Flutter command/reward tests: 9 tests.

The A2 tracker correctly remained `IMPLEMENTED`, not `COMPLETE`, because the
real-device developer rehearsal was still required.

## First live QR problem

The developer reported that the camera detected the QR, but the app showed:

> We could not start a scan.

The bin/session could sometimes still appear, and later the successful flow
was confirmed manually:

1. Sign in.
2. Scan `qr-demo-main`.
3. Bin screen appears.
4. Press back.
5. Choose **Cancel session**.
6. Return to scanner.
7. Scan again and create a new session.

The first diagnosis was that the QR callable succeeded, but the subsequent
`bins/{binId}` live read failed. The UI used the live stream error branch and
replaced a valid scan result with the generic error card.

## First successful fix

The following commits addressed that specific state conflict:

- `4c4e306` — normalized QR payloads and improved backend QR/bin error mapping.
- `e4dbe52` — cached the bin returned by a successful `scanBinQr` callable.
- `cb886fc` — made the session screen prefer a valid cached bin over a later
  stale live-stream error.

The intended invariant was:

> Once `scanBinQr` returns a committed session and bin, a later live-read
> failure must not downgrade the UI to “We could not start a scan.”

At this stage, the developer confirmed the functional cancel/reopen flow, but
the warning still appeared in some builds. The app needed to be rebuilt with
the explicit Firebase/App Check defines before final live verification.

## Request to audit the whole A2 flow

The developer explicitly asked not to fix symptoms one by one and requested a
whole-flow review. The audit covered:

- QR capture and duplicate detection.
- Callable request envelope and durable request identity.
- Session creation and bin observation.
- Session version transitions.
- Image selection and Continue behavior.
- Back/cancel/reopen behavior.
- Live bin stream errors and recovery.
- Processing/resume behavior.

The resulting refactor was committed as `2dbf912`:

- A valid bin value takes precedence over a later stream error.
- A live bin update remains usable if a later stream event fails.
- `getBin` updates the same observed-bin cache.
- Continue is disabled until an image is explicitly selected.
- The previous mock fallback that silently selected the first image was
  removed.

Focused scan/repository tests passed: 24 tests. Flutter analysis passed.

## Camera lifecycle regression

After the whole-flow refactor, the live device began showing camera flashing
and could no longer scan reliably. Android logs showed camera graph churn:

- `CameraGraph` instances repeatedly closed and reopened.
- `CameraUnavailable`.
- `BufferQueue has been abandoned`.
- Repeated orientation events.

The following attempted fixes were made:

- `2ae905e` — serialized camera start/stop transitions.
- `7c64f60` — disabled `MobileScanner` app-lifecycle handling with
  `useAppLifecycleState: false`.
- `aedca65` — stopped retrying when `MobileScannerController.start()` reports
  an error through controller state.

Important package behavior discovered from `mobile_scanner` 7.4.2:

`MobileScannerController.start()` can return normally after a platform camera
failure. It sets `controller.value.error`, leaves `isRunning == false`, and
does not necessarily throw. Treating normal completion as success creates an
immediate start retry loop.

The current camera widget now checks `controller.value.error` and settles
instead of retrying indefinitely.

## Current live failure

The latest developer report clarifies that the camera itself is now working:

- The preview is visible.
- The QR detector recognizes the code.
- The scanner component flashes each time the code is seen.
- No session is created.
- A red label appears below the scanner:

> We could not start a scan.

This means the current failure is after QR detection, in the callable path,
not in camera startup. The flashing is a secondary effect: after the callable
fails, the capture handler releases the camera and it detects the same QR
again when scanning resumes.

The relevant path is:

```text
MobileScanner.onDetect
  -> QrCaptureView._handleCode
  -> ScanScreen._scan
  -> FirebaseScanRepository.scanBinQr
  -> CommandClient.execute('scanBinQr')
  -> resident scanBinQr callable
```

Before the latest UI adjustment, `ScanScreen._scan` mapped all unknown failures
to the generic `AppCopy.scanUnavailable` text and immediately allowed the
camera to resume. This obscured the actual callable failure.

The latest uncommitted diagnosis was implemented and committed as `8279e7b`:

- Pause scanning while a scan error is visible.
- Add an explicit Retry button.
- Add resident-facing mappings for active session, busy/full bin,
  authentication, permission, and transport failures.

## Important current limitation

The current error text still does not prove which backend error occurred. The
next debugging run must capture the exact `AppFailure.messageKey`, `code`,
request ID, and trace ID for the failed `scanBinQr` call. The likely classes
are:

- Existing active session from an earlier successful reservation.
- `bin_busy` or `bin_full`.
- `unauthenticated` or App Check/callable rejection.
- Wrong callable deployment/region.
- Invalid response/envelope mapping.

Do not infer the cause from the generic label or camera flashing.

## Runtime configuration used by the developer

The live Android app must be launched with:

```powershell
flutter run -d qgfy7xz9eaci4tvs `
  --dart-define=ECOLOOP_FIREBASE_MODE=firebase `
  --dart-define=ECOLOOP_FIREBASE_REGION=us-central1 `
  --dart-define=ECOLOOP_FIRESTORE_DATABASE=ecoloop-db `
  --dart-define=ECOLOOP_APP_CHECK_MODE=demo-debug
```

The defines select the live Firebase project/database/region and debug App
Check setup. They are not the source of the Android camera graph churn. They
must nevertheless be preserved for callable and Firestore diagnosis.

## Exact commit sequence

| Commit | Change |
| --- | --- |
| `bf1185f` | A2 transaction, settlement, reward, and recovery implementation |
| `5d06887` | A2 tracker/evidence update |
| `4c4e306` | QR payload normalization and scan error mapping |
| `e4dbe52` | Cache successful scan bin response |
| `cb886fc` | Prefer cached bin over stale live-read error |
| `2dbf912` | Whole-flow scan state precedence and explicit image selection |
| `2ae905e` | Serialize camera lifecycle transitions |
| `7c64f60` | Disable duplicate MobileScanner lifecycle ownership |
| `aedca65` | Stop camera retry loop after controller-reported startup error |
| `8279e7b` | Pause scanner after callable failure and add retry/actionable copy |

## Validation status at handoff

Passed after the latest code changes:

- Focused scan-flow tests.
- QR capture tests.
- Firebase scan repository tests.
- Flutter analysis for the scan feature.
- Functions build and unit tests from the A2 baseline.

Not yet proven:

- A rebuilt live Android APK successfully creates a new session from
  `ecoloop://bin/qr-demo-main` after the latest `8279e7b` change.
- The exact backend error currently causing the callable failure.
- The final A2 developer exit gate.

## Next debugging action

Instrument or surface the failed callable boundary first. Capture the exact
failure from `CommandClient._call` for one QR attempt, including:

```text
AppFailure.code
AppFailure.messageKey
AppFailure.requestId
AppFailure.traceId
FirebaseFunctionsException.code/details, if present
```

Then resolve that single confirmed cause. Do not change camera lifecycle code
again unless the captured error is a camera/controller error.

