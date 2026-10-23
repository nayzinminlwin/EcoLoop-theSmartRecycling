# Dev Log: Backend - BK-P05-A Wallet and History

**Date and Time :** 2026-10-19 15:00  
**Agent:** Copilot SDK in VS Code  
**Moderator:** Alex  
**Status:** Work in Progress

## 1. Objective

Implement the Flutter wallet and activity Firebase read adapters for BK-P05-A,
including owner-scoped queries, stable timestamp/ID cursor pagination, live
decision updates, mock compatibility, and provider composition.

## 2. Reference Documents

- `docs/archive/backend_plan/EXECUTION_PROTOCOL.md`
- `docs/archive/backend_plan/PHASES_05_06_SERVICES.md`
- `docs/archive/backend_plan/ARCHITECTURE_AND_CONTRACTS.md`
- `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` sections 10.1, 10.2, 10.4
- `../../../.agent/developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `../../../lib/features/wallet/data/firebase_wallet_repository.dart`
  - `../../../lib/features/activity/data/firebase_activity_repository.dart`
  - `../../../test/features/activity/firebase_activity_repository_test.dart`
- **Files Modified:**
  - `../../../lib/features/activity/domain/repositories/activity_repository.dart`
  - `../../../lib/features/activity/domain/models/deposit_transaction.dart`
  - `../../../lib/features/activity/data/mock_activity_repository.dart`
  - `../../../lib/features/activity/presentation/controllers/history_controller.dart`
  - `../../../lib/features/activity/presentation/screens/history_screen.dart`
  - `../../../lib/features/activity/presentation/widgets/deposit_activity_tile.dart`
  - `../../../lib/features/activity/presentation/widgets/history_filter_sheet.dart`
  - `../../../lib/app/providers/app_providers.dart`
- **Impact to other modules:** Firebase mode now selects real wallet/activity
  adapters; mock mode remains unchanged. Activity status presentation now
  includes the backend `excluded` state. Firebase resident summary reads remain
  assigned to BK-P05-B and are not claimed by this unit.

## 4. Technical Decisions & Deviations

- Firestore activity queries use owner equality, optional status/date bounds,
  descending occurrence time plus descending document ID, and
  `startAfter([timestamp, id])`.
- SDK snapshots are converted to `ActivityCursor` values at the adapter
  boundary; domain pagination does not expose Firestore snapshots.
- Activity stream updates merge by deposit identity and retain the greatest
  `decisionVersion`, preventing a pending record and its later verified
  decision from appearing as duplicate rows.
- No Firebase SDK is introduced into the mock adapter.
- Firebase-mode repository providers listen to the authenticated resident UID
  and invalidate on sign-out/sign-in, preventing resident A data from surviving
  a transition to resident B.
- Firestore activity ordering and range filters use the canonical `updatedAt`
  timestamp; the domain still exposes this as the activity occurrence time.

## 5. Phase 5 Deliverables

| Deliverable | Completion | Description |
|-------------|------------|-------------|
| Wallet Firebase read adapter | ✅ | Owner document read/watch and canonical wallet mapping |
| Activity Firebase read adapter | ✅ | Filtered cursor page/read/watch transport and mapping |
| Mock compatibility | ✅ | Existing mock activity tests remain green |
| Focused automated gate | ✅ | Firebase adapter, mock adapter, history widget/filter tests pass |
| Emulator/index/live owner rebinding gate | ⚠️ | Requires the Firebase emulator/live app path and auth transition verification |

## 6. Next Steps / Known Issues

- Complete BK-P05-B residentStats/home summary integration before claiming the
  Firebase home flow complete.
- Verify the Firestore composite index and missing/index-error behavior in the
  emulator/live test environment.
- A DTD connection was found, but no Flutter app was connected, so the required
  hot-restart operation could not be executed.

## Execution Evidence

- Base revision: `f696686`
- Commands:
  - `dart format ...` passed after correction
  - `flutter analyze` passed with no issues
  - `flutter test test\features\activity\firebase_activity_repository_test.dart test\features\activity\mock_activity_repository_test.dart test\features\activity\history_screen_test.dart test\features\activity\history_filter_test.dart` passed (13 tests)
  - `flutter test ... test\features\wallet\firebase_wallet_repository_test.dart` passed (15 tests total in the expanded gate)
- Environment: Windows, repository root
- Trace/request/session/deposit IDs: none; deterministic adapter tests only
- Commit: explicit uncommitted state; pre-existing untracked `../../../Demo_Screenshots`
  and `../../../assets/trash_images` preserved
