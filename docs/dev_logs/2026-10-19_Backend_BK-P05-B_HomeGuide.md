# Dev Log: Backend - BK-P05-B Home Summaries and Current Guide

**Date and Time :** 2026-10-19 15:20  
**Agent:** Copilot SDK in VS Code  
**Moderator:** Alex  
**Status:** Work in Progress

## 1. Objective

Implement compact residentStats-backed Home impact summaries and a Firebase
current-policy recycling guide without downloading activity history or changing
historical receipt terms.

## 2. Reference Documents

- `docs/backend_plan/EXECUTION_PROTOCOL.md`
- `docs/backend_plan/PHASES_05_06_SERVICES.md`
- `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md` sections 6, 10.2, 10.4, AC-04, AC-24
- `.agent/developer/agent.md`

## 3. Changes Made

- **Files Created:**
  - `lib/features/recycling_guide/data/firebase_recycling_guide_repository.dart`
  - `test/features/home/backend_summary_test.dart`
  - `test/features/recycling_guide/firebase_guide_test.dart`
- **Files Modified:**
  - `lib/features/activity/domain/models/recycling_summary.dart`
  - `lib/features/activity/data/mock_activity_repository.dart`
  - `lib/features/activity/data/firebase_activity_repository.dart`
  - `lib/features/home/presentation/widgets/impact_summary_card.dart`
  - `lib/app/providers/app_providers.dart`
- **Impact to other modules:** Home summary weight is explicitly presented as
  estimated. Firebase summary reads only `residentStats`; mock summary retains
  fixture behavior while exposing accepted counts. Guide rates are composed from
  the active policy, with eligibility independent from the broad paper display
  category.

## 4. Technical Decisions & Deviations

- Estimated kilograms are derived from accepted verified item counts using
  `MaterialWeightConstants`; pending, empty, excluded, and unresolved records
  do not contribute.
- Firebase guide reads the active policy pointer and policy-specific guide
  documents. Historical receipt models are not rewritten.
- Cardboard is not made eligible merely because the UI groups it under paper;
  eligibility is determined by the active policy class list.
- The existing `RecyclingSummary` DTO remains compatible and now carries
  optional accepted counts.

## 5. Phase 5 Deliverables

| Deliverable | Completion | Description |
|-------------|------------|-------------|
| residentStats summary adapter | ✅ | Compact counters and derived estimated kg |
| Honest Home estimate label | ✅ | Existing layout retained; label changed to Estimated recycled |
| Current policy guide adapter | ✅ | Active policy pointer, rates, materials, steps |
| Historical policy isolation | ✅ | Adapter composes current guide only; receipt records are untouched |
| Focused automated gate | ✅ | 6 BK-P05-B tests pass with existing Home/guide regressions |
| Emulator/live policy/index evidence | ⚠️ | Requires configured Firebase environment and authenticated app |

## Execution Evidence

- Base revision: `f696686` plus current uncommitted BK-P05-A changes
- `flutter analyze` passed with no issues
- `flutter test test\features\home\backend_summary_test.dart test\features\recycling_guide\firebase_guide_test.dart test\features\home\home_screen_test.dart test\features\recycling_guide\recycling_guide_test.dart` passed (6 tests)
- No active Flutter application was connected for hot restart.
- Commit: explicit uncommitted state; unrelated untracked assets preserved.
