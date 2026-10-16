# Phase 5 — Recycling Guide and Configured Point Rates

**Status:** Completed  
**Date:** 16 October 2026  
**Plan reference:** `docs/FIGMA_USER_APP_TO_FLUTTER_IMPLEMENTATION_PLAN.md`,
Phase 5

## Scope

Phase 5 delivers the resident recycling guide at `/guide`. The feature is
mock-only and does not initialize or call Firebase services. Guide content is
loaded from a typed JSON fixture through a repository seam so the future scan
flow can reuse the same material-rate rules.

## Architecture

### Domain models

- `RecyclingMaterial`
  - `id`
  - `MaterialType`
  - display title and preparation tip
  - allowlisted icon key
  - stable sort order
- `RecyclingStep`
  - `id`
  - display order
  - instruction
- `MaterialRate`
  - material type
  - display name
  - integer `pointsPerItem`
  - eligibility flag
  - `pointsFor(itemCount)` calculation
- `RecyclingGuideContent`
  - hero copy
  - to-do and to-avoid lists
  - points disclaimer
- `RecyclingGuide`
  - composed read model containing content, materials, steps, and rates

All models support JSON round-trips. The composed guide is a read response and
is not treated as a persisted Firestore document.

### Repository and state

`MockRecyclingGuideRepository`:

- Reads `assets/mock/recycling_guide/guide.json`.
- Uses `MockApi` for simulated asynchronous delay and failure behavior.
- Sorts materials by `sortOrder` and steps by `order`.
- Caches the current guide in memory.
- Emits updates through a broadcast stream.
- Keeps `getGuide()` and `watchGuide()` consistent after `updateGuide()`.
- Exposes no Firebase, network, emulator, or external service calls.

Riverpod exposes the repository through
`recyclingGuideRepositoryProvider`. The presentation stream is defined in
`recyclingGuideProvider`, and a one-shot `RecyclingGuideController` remains
available for refresh operations.

## Fixture content

The fixture contains:

- Plastic bottles — empty and rinse
- Glass bottles — remove lids
- Metal cans — clean and dry
- Paper and cardboard — flatten first
- Three to-do items
- Three to-avoid items
- Five smart-bin instructions
- Plastic: 5 points per item
- Aluminium: 8 points per item
- Paper: 3 points per item

Example calculations are count-based:

- 2 plastic items = 10 points
- 2 aluminium items = 16 points
- 4 paper items = 12 points

Rates do not use weight fields. Weight conversion remains a separate domain
concern for impact summaries.

## UI behavior

`RecyclingGuideScreen` renders:

1. Guide heading and hero panel
2. Material cards
3. To-do and to-avoid columns
4. Smart-bin steps
5. Configured points-per-item table
6. Points disclaimer

The material grid uses two columns when space permits and one column on narrow
layouts. Optional sections are omitted when their repository lists are empty.
Unknown icon keys fall back to the generic recycle icon.

The screen has loading and retryable error states. Home's existing guide
quick-action navigates to `/guide`, and the route is also directly addressable.

## Files added

- `lib/features/recycling_guide/domain/models/`
- `lib/features/recycling_guide/domain/repositories/recycling_guide_repository.dart`
- `lib/features/recycling_guide/data/mock_recycling_guide_repository.dart`
- `lib/features/recycling_guide/presentation/`
- `assets/mock/recycling_guide/guide.json`
- `test/features/recycling_guide/recycling_guide_test.dart`

## Files updated

- `lib/app/providers/app_providers.dart`
- `lib/app/router/app_router.dart`
- `lib/core/presentation/app_copy.dart`
- `pubspec.yaml`

## Verification

- `flutter test test/features/recycling_guide` — passed
- `flutter test` — all 25 tests passed
- `flutter analyze` — no issues
- `flutter build web` — passed
- `git diff --check` — passed
- Protected Android Firebase files remained unchanged

The VS Code DTD instance was discovered and connected, but it had no active
Flutter application. A hot-restart attempt therefore could not run against a
connected app.
