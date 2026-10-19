# Dev Log: Rewards - Catalog, redemption, and owned vouchers

**Date and Time :** 2026-10-16 17:45  
**Agent:** AI assistant using Copilot SDK in VS Code  
**Moderator:** Alex  
**Status:** Completed

## 1. Objective

Implement Phase 7's mock-backed rewards marketplace, atomic point redemption,
resident-owned vouchers, and voucher detail routes while preserving the
stateful in-memory Firebase boundary.

## 2. Reference Documents

- `docs/FIGMA_USER_APP_TO_FLUTTER_IMPLEMENTATION_PLAN.md` — Phase 7
- `docs/archive/FLUTTER_UI_EXECUTION_LOG.md` — completed Phases 1–6 decisions
- `EcoLoop_AI_Figma_Design_Artifacts/src/App.tsx` — `Rewards` source surface
- `EcoLoop_AI_Figma_Design_Artifacts/src/index.css` — reward and voucher styling
- `.agent/templates/dev_log_template.md`

## 3. Changes Made

- **Files Created:**
  - `lib/features/rewards/domain/models/reward_category.dart`
  - `lib/features/rewards/domain/models/reward.dart`
  - `lib/features/rewards/domain/models/resident_voucher.dart`
  - `lib/features/rewards/domain/models/reward_redemption.dart`
  - `lib/features/rewards/domain/repositories/rewards_repository.dart`
  - `lib/features/rewards/data/mock_rewards_repository.dart`
  - `lib/features/rewards/presentation/controllers/rewards_controller.dart`
  - `lib/features/rewards/presentation/controllers/vouchers_controller.dart`
  - `lib/features/rewards/presentation/screens/rewards_screen.dart`
  - `lib/features/rewards/presentation/screens/vouchers_screen.dart`
  - `lib/features/rewards/presentation/screens/voucher_detail_screen.dart`
  - `lib/features/rewards/presentation/widgets/reward_card.dart`
  - `lib/features/rewards/presentation/widgets/reward_redemption_dialog.dart`
  - `lib/features/rewards/presentation/widgets/voucher_tile.dart`
  - `assets/mock/rewards/categories.json`
  - `assets/mock/rewards/catalog.json`
  - `assets/mock/rewards/vouchers.json`
  - `assets/mock/rewards/redemptions.json`
  - `test/features/rewards/mock_rewards_repository_test.dart`
  - `test/features/rewards/rewards_screen_test.dart`
  - `test/features/rewards/vouchers_screen_test.dart`
  - this development log
- **Files Modified:**
  - `lib/app/providers/app_providers.dart`
  - `lib/app/router/app_router.dart`
  - `lib/core/mock/mock_seed_loader.dart`
  - `lib/core/mock/mock_scenario.dart`
  - `lib/core/presentation/app_copy.dart`
  - `pubspec.yaml`
- **Impact to other modules:** Redemption uses the existing `MockDataStore`
  wallet transaction, so wallet providers and Home observe the debited balance.
  The repository keeps redemption and voucher records separate and publishes
  catalog/voucher stream changes after committed mutations.

## 4. Technical Decisions & Deviations

- The seeded catalog uses themed `artKey` placeholders and nullable image URLs;
  no Storage or network integration was introduced.
- Redemption serializes through a repository mutation queue and checks balance,
  expiry, activity, and per-resident limits again at confirmation time.
- A stable idempotency key is generated when a confirmation dialog opens and is
  retained across failed confirmation retries.
- The shared mock wallet store is updated only after eligibility checks. A
  failed or insufficient-point operation leaves wallet and voucher state
  unchanged.
- The repository loads the declared reward/category/voucher/redemption fixture
  envelopes through `MockSeedLoader`; injected lists remain available for
  focused tests. Wallet reward thresholds now derive from the active,
  unexpired catalog rather than a duplicate hard-coded cost list.
- Voucher reads are scoped to the active resident, and both category/status
  route filters normalize unknown query values back to their unfiltered views.
- The Phase 7 category/status query parameters are owned by the router and
  screens; unknown voucher status values resolve to the unfiltered list.

## 5. Phase 7 Deliverables

| Deliverable | Completion | Description |
|---|---|---|
| Typed reward contracts | ✅ | Catalog, category, voucher, redemption, and receipt models with flat stored maps |
| Mock rewards repository | ✅ | Delayed reads/writes, stateful streams, expiry/limit checks, idempotent atomic debit |
| Rewards UI | ✅ | Category filters, responsive catalog cards, confirmation/error flow, success feedback |
| Voucher UI | ✅ | Filtered list, voucher preview/detail, copy-code feedback |
| Routes and fixtures | ✅ | `/rewards`, `/vouchers`, `/vouchers/:voucherId`, and mock reward envelopes |
| Mock-only boundary | ✅ | No Firebase SDK, Storage, network, or external service calls |
| Focused tests | ✅ | Model fallback, redemption idempotency/concurrency, catalog and voucher screens |

## 6. Next Steps / Known Issues

- Phase 8 can extend the existing account repository and Settings route.
- DTD was connected successfully, but no Flutter app was active in VS Code, so
  the required hot restart could not run.
- Tester verification should cover narrow text-scaled layouts, used/expired
  voucher fixtures, malformed route IDs, and retry behavior after injected
  repository failures.
