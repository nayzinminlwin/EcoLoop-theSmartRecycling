# BK-P05-F Voucher Use UI and Time-Correct Lists

- **Unit:** BK-P05-F
- **Role:** Flutter implementation / integration executor
- **Specification:** demo metadata, owner/demo/time-guarded use, committed use refresh, copy-code independence, time-correct available/used/expired lists
- **Base source revision + dirty/source-bundle identity:** Existing uncommitted BK-P05-A through BK-P05-E work; no commit created
- **Files created/modified:**
  - `lib/features/rewards/domain/models/resident_voucher.dart`
  - `lib/features/rewards/domain/repositories/rewards_repository.dart`
  - `lib/features/rewards/data/mock_rewards_repository.dart`
  - `lib/features/rewards/data/firebase_rewards_repository.dart`
  - `lib/features/rewards/presentation/controllers/vouchers_controller.dart`
  - `lib/features/rewards/presentation/screens/voucher_detail_screen.dart`
  - `lib/features/rewards/presentation/screens/vouchers_screen.dart`
  - `lib/core/firebase/command_client.dart`
  - `test/features/rewards/voucher_lifecycle_test.dart`
  - `test/features/rewards/voucher_queries_test.dart`
- **Contract/config/model versions:** `backend.v1`; durable `useResidentDemoVoucher`; voucher status and `offerVersion`
- **Commands actually run + working directory + result:**
  - `dart format ...` from repository root — passed
  - `flutter analyze` — passed
  - Focused reward/lifecycle/widget tests — passed
- **Environment/project mode:** Deterministic Flutter tests; no emulator/live Firebase evidence
- **Example requestId / traceId:** Mock `use-1`; no live trace
- **Evidence paths:** `test/features/rewards/voucher_lifecycle_test.dart`, `test/features/rewards/voucher_queries_test.dart`
- **Defect IDs and unresolved blockers:** No active Flutter app was connected to DTD, so hot restart was unavailable. Emulator/backend agreement for duplicate use, ownership, demo metadata, and time-bound queries remains pending.
- **Commit SHA or explicit uncommitted status:** Uncommitted
- **Next unit and required read set:** BK-P06-A; durable notification dispatcher and notification contract

## Implementation notes

Voucher detail now watches by ID, keeps Copy code independent, and exposes a clearly labeled `Simulate voucher use` action only for demo/available vouchers. Use results invalidate the detail provider and display the committed used state. Voucher list/detail projections call `statusAt` so stored `available` documents become expired at runtime without mutating wallet state. The mock repository also preserves use idempotency for repeated request keys.
