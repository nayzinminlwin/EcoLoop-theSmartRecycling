# Dev Log: Backend - BK-P04-H Batch Lines and Nullable Quantities

**Date and Time:** 2026-10-19 12:54
**Agent:** Copilot SDK in VS Code
**Moderator:** Alex
**Status:** Completed

## 1. Objective

Wire authoritative mixed-material receipt lines and nullable quantities into
the Flutter scan/activity models and presentation without allowing legacy
display fields to drive accounting or impact calculations.

## 2. Reference Documents

- `docs/archive/backend_plan/PHASES_03_04_RECYCLING.md` - BK-P04-H
- `docs/archive/backend_plan/EXECUTION_PROTOCOL.md`
- `docs/archive/backend/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md`

## 3. Changes Made

- **Files Created:**
  - `../../../lib/core/domain/deposit_line_item.dart`
  - `../../../test/core/domain/batch_models_test.dart`

- **Files Modified:**
  - `../../../lib/features/scan/domain/models/deposit_result.dart`
  - `../../../lib/features/activity/domain/models/deposit_transaction.dart`
  - `../../../lib/features/scan/presentation/widgets/deposit_result_card.dart`
  - `../../../lib/features/activity/presentation/widgets/deposit_activity_tile.dart`
  - `../../../lib/features/activity/data/mock_activity_repository.dart`
  - Existing fixture assertions updated for nullable legacy counts.

- Added strict backend factories requiring v1 lines and policy/decision/trace
  metadata while keeping legacy fixture decoding separate.
- Added accepted-only count and impact calculations.
- Added mixed-material and excluded-line presentation.
- Added explanatory `Count pending` copy for null line quantities.
- Added debug-only selectable trace reference for verified receipts.

## 4. Technical Decisions & Deviations

Legacy mock factories retain their existing single-material fields and derive
the legacy total for presentation compatibility. Backend factories treat
`lines` as authoritative and never infer mixed-batch business calculations
from the legacy material getter.

## 5. Phase Deliverables

| Deliverable | Completion | Description |
|-------------|------------|-------------|
| Authoritative receipt lines | ✅ | Typed `DepositLineItem` model and backend decoder |
| Nullable quantities | ✅ | Null counts remain null and render explanatory copy |
| Mixed/excluded presentation | ✅ | Receipt card and activity tile list line materials |
| Accepted-only impact | ✅ | Summary and tile weight use accepted line counts |
| Legacy compatibility | ✅ | Existing mock fixtures and scan flow remain green |

## 6. Verification

- `flutter analyze` passed with no issues.
- `flutter test test/core/domain/batch_models_test.dart test/features/activity test/features/scan` passed: 32 tests.
- `git diff --check` passed.

## 7. Next Steps / Known Issues

Session/bin/asset read models remain deferred to BK-P04-I1.
