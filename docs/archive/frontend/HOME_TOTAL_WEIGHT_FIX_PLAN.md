# Home Total Weight: Fix Plan

- **Date:** 2026-10-21
- **Status:** Proposed after code inspection; implementation has not started.
- **Assessment:** More than a small refactor: backend aggregation, existing-data
  repair, and mixed-material mock parity are involved. Three phases are sufficient.

## Expected behavior

Use the same resident and verified transactions as the **Verified deposits**
counter. Sum the accepted material quantities from every verified transaction,
including every material line in a mixed-material transaction, and display the
combined kilograms. Processing, review, rejected, empty, and excluded outcomes
contribute nothing; ineligible lines within verified transactions also contribute
nothing. A review contributes once it is resolved as verified.

The current receipt models contain item counts, not measured kilograms. Keep the
existing **Estimated recycled** label and the established conversion factors in
`../../../lib/core/domain/material_weight_constants.dart`:

| Material | Estimated kg per accepted item |
| --- | ---: |
| Plastic | 0.025 |
| Aluminium | 0.015 |
| Paper | 0.050 |
| Glass | 0.200 |

`total kg = sum(accepted count for each material × that material's kg per item)`

## Confirmed cause and relevant code

| File / method | Finding |
| --- | --- |
| `../../../lib/features/home/presentation/widgets/impact_summary_card.dart` | Already displays `summary.verifiedWeightKg` using `AppFormatters.weight`. |
| `../../../lib/features/home/presentation/controllers/home_controller.dart` | Gets the summary from `ActivityRepository.watchSummary()`. Recent activity is separately limited to two deposits, so it cannot supply the lifetime total. |
| `../../../lib/features/activity/data/firebase_activity_repository.dart`, `_summaryFromStats` | Derives kg from `acceptedItemCounts`, a map keyed by `plastic`, `aluminium`, `paper`, and `glass`. A missing map produces zero kg even when the deposit counter increases. |
| `../../../functions/src/infrastructure/firestore/settlement_store.ts`, `finalizeInspection` and `resolveReview` | Update `verifiedBatchCount` and scalar `acceptedItemCount`, but never write the material-count map Flutter expects. Review statistics are currently inside the positive-points branch. |
| `../../../functions/src/infrastructure/firestore/accounts_store.ts`, `newStats` | Initializes scalar counts and `estimatedWeightKg: 0`, but no material-count map. Flutter does not read this `estimatedWeightKg` field. Merely displaying it would leave the issue unresolved. |
| `../../../lib/features/activity/data/mock_activity_repository.dart`, `_readSummary` | Applies one transaction's material type to all accepted items, which is incorrect for mixed-material transactions. |
| `../../../lib/features/activity/domain/models/deposit_transaction.dart`, `fromJson` | Does not restore serialized `lines`, although `toJson` writes them and the backend parser supports them. Mock store reads therefore lose mixed-material details. |
| `../../../test/features/home/backend_summary_test.dart` | Supplies a synthetic material-count map, so it passes even though the real settlement writer never produces that map. |

## Phase 1 — Populate the material totals during settlement

**Files:** `../../../functions/src/infrastructure/firestore/settlement_store.ts`,
`../../../functions/src/infrastructure/firestore/accounts_store.ts`, and a small shared
backend aggregation helper if needed.

1. Establish `acceptedItemCounts` as the cumulative source for weight. Initialize
   all four material keys to zero for new residents. Keep keys compatible with
   Flutter's `MaterialType` wire values, rather than receipt class names.
2. Aggregate every eligible `plan.lines` entry by material. Map `plastic_bottle`
   to plastic, `aluminium_can` to aluminium, `glass_bottle` to glass, and
   `paper_item` / `paper_bag` to paper. Share this mapping between settlement and
   historical repair. Ignore ineligible and unsupported lines.
3. In both settlement paths, add these counts to the resident's existing map in
   the same Firestore transaction as the verified-deposit count. Preserve the
   existing replay/version protections so retries cannot add the same batch twice.
4. Gate statistics on verified status and accepted items, independently of whether
   points are positive. In `resolveReview`, separate the statistics update from
   the wallet-credit branch; a verified zero-point batch must still count.

**Done when:** Each verified batch adds exactly one deposit and the correct
material quantities. Review contributes only after verification. Flutter can
derive the total through its existing stats stream and conversion constants.

## Phase 2 — Rebuild totals for existing residents

**Add:** A focused, rerunnable tool such as
`../../../functions/tools/rebuild_resident_material_counts.ts`.

1. Read each resident's complete verified deposit history using pagination and
   `ownerId`; aggregate eligible `lines` with the Phase 1 helper. Count deposits
   once by document ID. Surface legacy records with missing material details
   explicitly rather than inventing a material for their total object count.
2. Replace `acceptedItemCounts` with the reconstructed absolute totals. Do not
   increment the existing map: rerunning must produce the same result. Compare
   against `verifiedBatchCount` and report discrepancies for investigation.
3. Deploy the new settlement writer before repairing history. Protect the repair
   commit with the stats document's update-time precondition; if settlement
   changes stats during pagination, retry that resident's reconstruction. This
   prevents a repair from overwriting newly added material quantities.
4. Support an explicit resident ID, project/database selection, and a preview
   showing counts and derived kg. Use the existing named database configuration
   (`ecoloop-db`), rather than implicitly targeting Firestore's default database.

**Done when:** Historical and future deposits both contribute, and running the
repair twice or alongside a new settlement does not double-count or lose weight.

## Phase 3 — Align mocks and verify end-to-end updates

**Files:** `deposit_transaction.dart`, `mock_activity_repository.dart`, and the
existing tests listed below.

1. Parse optional `lines` in the legacy/mock JSON reader while preserving support
   for old single-material fixtures. In mock summaries, aggregate each eligible
   line separately; use transaction material/count only when there are no lines.
   Derive both the material-count map and kg from those same quantities.
2. Extend `../../../functions/tests/emulator/settlement.test.ts` to cover mixed materials,
   cumulative batches, replay, review-to-verified, and verified zero-point
   settlement. Test repair idempotency and conflict/retry behavior with real
   Firestore emulator writes.
3. Extend `../../../test/features/home/backend_summary_test.dart` and
   `../../../test/features/activity/mock_activity_repository_test.dart` for initial and
   streamed totals, mixed materials, resident isolation, and nonverified rows.
4. Add a focused update case to `../../../test/features/home/home_screen_test.dart`: one
   verified transaction with 2 plastic, 2 aluminium, 1 paper, and 1 glass item
   produces **0.33 kg**; a second verified glass item produces **0.53 kg** without
   reopening the page. Also include a history longer than the recent-activity
   limit to confirm the total is not limited to the two preview rows.
5. Check that the summary stream reaches the home controller on changes. Adjust
   that subscription only if the live-update test exposes a separate stale-state
   issue. Retain full precision during aggregation and format only for display.

**Verification commands:**

From `../../../functions`:

```text
npm run build
npm run test:unit
npm run test:settlement
```

From the repository root:

```text
flutter analyze
flutter test test/features/home test/features/activity
```

**Acceptance:** Verified count and estimated kg update together; mixed materials
use their respective weights; existing history is included; retries and repair
reruns leave totals unchanged; the home page updates without a manual refresh.
