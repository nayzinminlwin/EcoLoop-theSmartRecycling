# BK-P05-E Flutter Reward Offer and Redemption Wiring

- **Unit:** BK-P05-E
- **Role:** Flutter implementation / integration executor
- **Specification:** current offer version/cost, durable redemption request, ambiguous recovery, helpful conflict states, committed receipt/voucher display, resident-scoped counts
- **Base source revision + dirty/source-bundle identity:** Existing uncommitted BK-P05-A through BK-P05-D work; no commit created
- **Files created/modified:**
  - `../../../lib/features/rewards/data/firebase_rewards_repository.dart`
  - `../../../lib/features/rewards/domain/models/reward.dart`
  - `../../../lib/features/rewards/domain/repositories/rewards_repository.dart`
  - `../../../lib/features/rewards/data/mock_rewards_repository.dart`
  - `../../../lib/features/rewards/presentation/screens/rewards_screen.dart`
  - `../../../lib/app/providers/app_providers.dart`
  - `../../../lib/core/data/app_failure.dart`
  - `../../../lib/core/firebase/command_client.dart`
  - `../../../test/features/rewards/backend_redemption_test.dart`
- **Contract/config/model versions:** `backend.v1`; reward `offerVersion`
- **Commands actually run + working directory + result:**
  - `dart format ...` from repository root — passed
  - `flutter analyze` — passed
  - Focused reward tests including `backend_redemption_test.dart` — passed
  - `git diff --check` — passed with normal tracker line-ending warning
- **Environment/project mode:** Deterministic Flutter tests; Firebase repository is injectable; no live Firebase/emulator evidence
- **Example requestId / traceId:** Test request `request-1`; deterministic test trace `0123456789abcdef0123456789abcdef`
- **Evidence paths:** `../../../test/features/rewards/backend_redemption_test.dart`, `../../../test/features/rewards/rewards_screen_test.dart`
- **Defect IDs and unresolved blockers:** No active Flutter app was connected to DTD, so hot restart was unavailable. Emulator/live agreement of balance and receipt remains pending.
- **Commit SHA or explicit uncommitted status:** Uncommitted
- **Next unit and required read set:** BK-P05-F; voucher lifecycle model/controller/detail/query behavior

## Implementation notes

Firebase rewards now reads catalog documents and resident-scoped vouchers, binds the repository through the Firebase provider, and sends `offerVersion` plus `displayedCost` through the durable `CommandClient`. The UI keeps the same request key for retries, maps offer changes, limits, and insufficient balance to distinct messages, invalidates wallet/reward/voucher state after success, and displays the committed voucher code. The backend callable accepts the command client's wrapped payload and returns the immutable redemption snapshot fields.
