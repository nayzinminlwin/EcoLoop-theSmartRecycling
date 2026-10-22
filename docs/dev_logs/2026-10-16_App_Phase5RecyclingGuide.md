# Dev Log: Flutter App - Phase 5 Recycling Guide and Point Rates

**Date and Time:** 2026-10-16 16:38  
**Agent:** AI assistant using Copilot SDK in VS Code  
**Moderator:** Alex  
**Status:** Completed

## 1. Objective

Implement Phase 5 of the resident Figma-to-Flutter plan: a repository-backed
recycling guide with configured count-based point rates, responsive presentation,
and reusable rules for the later scan flow.

The feature remains mock-only. It does not initialize or call Firebase,
network, emulator, or external service integrations.

## 2. Reference Documents

- `docs/FIGMA_USER_APP_TO_FLUTTER_IMPLEMENTATION_PLAN.md`
- `docs/archive/FLUTTER_UI_EXECUTION_LOG.md`
- `.agent/developer/agent.md`
- `.agent/templates/dev_log_template.md`
- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx`
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css`

## 3. Changes Made

- **Files Created:**
  - `lib/features/recycling_guide/domain/models/recycling_material.dart`
  - `lib/features/recycling_guide/domain/models/recycling_step.dart`
  - `lib/features/recycling_guide/domain/models/material_rate.dart`
  - `lib/features/recycling_guide/domain/models/recycling_guide.dart`
  - `lib/features/recycling_guide/domain/models/recycling_guide_content.dart`
  - `lib/features/recycling_guide/domain/repositories/recycling_guide_repository.dart`
  - `lib/features/recycling_guide/data/mock_recycling_guide_repository.dart`
  - `lib/features/recycling_guide/presentation/controllers/recycling_guide_controller.dart`
  - `lib/features/recycling_guide/presentation/screens/recycling_guide_screen.dart`
  - `lib/features/recycling_guide/presentation/widgets/material_guide_card.dart`
  - `lib/features/recycling_guide/presentation/widgets/recycling_steps_list.dart`
  - `lib/features/recycling_guide/presentation/widgets/material_rates_table.dart`
  - `assets/mock/recycling_guide/guide.json`
  - `test/features/recycling_guide/recycling_guide_test.dart`
- **Files Modified:**
  - `lib/app/providers/app_providers.dart`
  - `lib/app/router/app_router.dart`
  - `lib/core/presentation/app_copy.dart`
  - `pubspec.yaml`
  - `docs/archive/FLUTTER_UI_EXECUTION_LOG.md`
- **Impact to other modules:**
  - Registered `/guide` and connected the existing Home guide action.
  - Added a shared repository/provider seam for later scan classification.
  - No existing Firebase configuration or resident feature data source was
    replaced.

## 4. Technical Decisions & Deviations

- Guide content is split into persisted-style records and a composed
  `RecyclingGuide` read model, matching the plan's Firestore-ready boundary.
- `MaterialRate.pointsFor()` uses integer points per item. It does not derive
  points from weight; impact weight remains owned by the activity domain.
- The mock repository sorts materials and steps, caches in-memory updates, and
  emits changes through a broadcast stream. Later reads and stream snapshots
  therefore remain consistent after `updateGuide()`.
- Material icon keys use an allowlist. Unknown keys fall back to `recycle`
  rather than attempting to load arbitrary asset paths.
- The material grid uses two columns when the available width supports it and
  one column on narrow layouts. Optional lists omit their sections when empty.
- No deviation from the Phase 5 domain fields, fixture envelope, route, or
  mock-only requirements. The DTD runtime check could not run because no
  Flutter app was connected.

## 5. Phase 5 Deliverables

| Deliverable | Completion | Description |
|-------------|------------|-------------|
| Typed guide models | ✅ | Added material, step, rate, content, and composed guide models with JSON round-trips. |
| Guide fixture | ✅ | Added ordered materials, preparation tips, do/avoid lists, five steps, and configured rates. |
| Stateful mock repository | ✅ | Added delayed fixture reads, in-memory update persistence, and guide stream updates. |
| Guide presentation | ✅ | Added hero, material cards, do/avoid sections, steps, rate table, loading, and retryable error states. |
| Route and provider wiring | ✅ | Registered `/guide`, repository provider, stream provider, and asset manifest entry. |
| Point-rate examples | ✅ | 2 plastic = 10 points, 2 aluminium = 16 points, and 4 paper = 12 points. |
| Focused tests | ✅ | Serialization, rate calculations, fixture content, and update persistence coverage pass. |
| Analyzer and regression gate | ✅ | `flutter analyze` and `flutter test` pass. |
| Web build | ✅ | `flutter build web` passes. |
| Connected runtime check | ⚠️ | Hot restart was attempted but no Flutter app was connected to VS Code DTD. |

## 6. Next Steps / Known Issues

- Phase 6 can reuse the guide repository's material rates during scan
  classification.
- Tester should verify the guide visually at 320, 390, and 480 logical pixels,
  including enlarged text and narrow layouts.
- Tester should verify loading, retryable failure, optional empty-section
  behavior, and route entry from Home in a connected Flutter runtime.
- No manual moderator action is required for the implementation. A Flutter
  target must be launched from VS Code for DTD hot restart and visual runtime
  verification.
