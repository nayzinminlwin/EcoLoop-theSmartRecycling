# Live reference-data seeding and registered QR images

- **Captured:** 2026-10-20 02:45 +08:00
- **User request:** Seed genuine application sample/reference data first; choose reasonable demo defaults and provide the bin QR image.
- **Source base:** `efa364a`, branch `dev`, with the scoped seeding changes currently uncommitted.
- **Project/database:** `ecoloop-thesmartrecycling` / **`ecoloop-db`**
- **Storage:** `ecoloop-thesmartrecycling.firebasestorage.app`
- **Seed identity:** `ecoloop-demo-reference-v1`
- **Result:** **56 Firestore reference documents created, 16 actual image objects uploaded, 6 registered QR PNGs generated and independently decoded.** Subsequent live verification found 56 existing target records, zero missing records, zero conflicts, and verified stored object bytes/generations.

## 1. Your primary recycling bin

| Field | Value |
| --- | --- |
| Display name | EcoLoop Demo Bin |
| Location | Demonstration Booth |
| Bin ID | `bin-demo-main` |
| QR mapping ID | `qr-demo-main` |
| QR content | **`ecoloop://bin/qr-demo-main`** |
| Capacity | 2,000 software-estimated space points |
| Initial occupancy | 0 |
| Initial collection cycle | `bin-demo-main-cycle-001` |
| Bin state | Enabled, online, available; no owner/session reservation |

**Use this PNG on the demonstration bin:**

[Open the primary QR PNG](../../../functions/.seed-output/demo-v1/qr/qr-demo-main.png)

[Open the printable QR sheet](../../../functions/.seed-output/demo-v1/PRINT_QR_CODES.html)

The PNG is 1024×1024, black on white, with a four-module quiet border and medium error correction. Print without cropping the white border, or display it on a second screen. QR content is the registered mapping ID, not a website URL and not a secret. The EcoLoop in-app scanner resolves it through the database. Editing the bin's display name/location does not change that stable QR identity.

## 2. Scenario QR images

| QR ID / filename | Registered bin | Initial sample state |
| --- | --- | --- |
| `qr-demo-main.png` | `bin-demo-main` | Main demonstration bin, empty |
| `qr-sample-near-full.png` | `bin-sample-near-full` | 1,900 / 2,000 spc, 95% |
| `qr-sample-full.png` | `bin-sample-full` | 2,000 / 2,000 spc, 100% |
| `qr-sample-offline.png` | `bin-sample-offline` | Online flag false |
| `qr-sample-disabled.png` | `bin-sample-disabled` | Bin enabled flag false |
| `qr-sample-disabled-code.png` | `bin-demo-main` | This extra QR mapping is disabled; primary mapping remains enabled |

All six PNGs are under `functions/.seed-output/demo-v1/qr/`. The near-full/full openings explicitly carry synthetic sample-scenario metadata and are not represented as measured physical occupancy or earned deposits. A busy reservation is created by a real session during later testing, not invented against a nonexistent resident.

## 3. Created reference data

| Collection/content | Records | Meaning |
| --- | ---: | --- |
| `bins` | 5 | Main bin plus clearly named sample scenarios |
| `binCycles` | 5 | Auditable initial cycles/openings |
| `binOperations` | 5 | Empty owner-private reservation records |
| `binQrMappings` | 6 | Registered stable QR→bin mappings |
| `simulationAssets` | 16 | Real prepared image bytes, MIME/geometry/hash/exact Storage generation |
| `rewardCategories` | 2 | Food & drink, Shopping |
| `rewards` | 4 | Snack 10, cafe 25, meal 50, shopping 75 points; explicit demonstration-only terms |
| `guideContent`, `guideMaterials`, `guideSteps` | 3 | Policy-aware guidance, five accepted classes, six journey instructions |
| `scanContent` | 1 | Real-mode scan instruction reference |
| `policies` | 1 | Immutable `policy-v1`, full reward/space/fallback rules |
| `policyPointers` | 1 | Initial active policy pointer |
| `modelRegistry` | 4 | Hosted A/B/D and `gemini-3.8-flash` identities; no keys or accuracy claims |
| `processingConfigurations` | 1 | `demo-vision-v1` reference bounds/thresholds, marked not yet deployed |
| `processingAvailability` | 1 | Paused pending actual backend/worker refactor verification |
| `notificationDefaults` | 1 | Supported initial preference values |
| **Total** | **56** | Reference/configuration records only |

Real sign-in/recycling/redemption will create residents, wallets, history, jobs, findings, ledger entries, review tickets, issued vouchers and delivery events. This seed did not invent completed activity, free balances, inference answers or issued merchant vouchers. The sample offers make no real merchant partnership/fulfilment claim.

All 16 files in `assets/trash_images/` are valid supported raster sources. Despite its extension, **`trash10.svg` contains PNG pixels**; it was registered as `image/png` and uploaded as `source.png` without changing the original file. Runtime source names are generic and contain no expected answer hints. Original source files remain local/untracked as before; model training/labeling was not performed.

## 4. Rerun and write behavior

- The old default-database/merge-and-reset behavior was replaced. The named database is explicit in CLI, live transport, and emulator tests.
- Live access uses the existing authenticated gcloud session; tokens are captured only in memory. No ADC login file/service-account key/provider secret was created or exposed.
- Preview reads all target references and existing Storage objects before mutations. Content/policy conflicts stop before cloud writes.
- Missing Storage objects use generation-match-zero creation. Existing bytes are downloaded/hash checked; a different generation/content is not silently substituted.
- All missing Firestore documents are published in one atomic create-only commit with `exists:false` preconditions after durable source generations exist.
- Existing bins/cycles/reservations/active pointer/availability settings are preserved, including occupancy after collection and operator changes. Existing policy/offer/source conflicts require explicit reconciliation rather than overwrite.
- A failed upload/commit may leave immutable unpublished source objects; rerunning checks and reuses them. It never resets residents, wallets, deposits or buckets.
- Generated reports/QR sheets are under the existing ignored `.seed-output` directory and can be regenerated from the manifest.

## 5. Commands actually run

From `functions/`:

```powershell
npm.cmd run build
npm.cmd run seed:dry-run
npm.cmd run seed:preview:live
$env:JAVA_TOOL_OPTIONS='-Xms64m -Xmx256m'
$env:NODE_OPTIONS='--max-old-space-size=256'
npm.cmd run test:seed
$env:ECOLOOP_SEED_LIVE='true'
npm.cmd run seed:live
npm.cmd run seed:verify:live
```

From `services/vision/`:

```powershell
$env:OPENBLAS_NUM_THREADS='1'
$env:OMP_NUM_THREADS='1'
uv run --frozen python ../../tools/backend/verify_seed_qr.py ../../functions/.seed-output/demo-v1/verify-live-report.json
```

Results:

- Functions source/tools build passed.
- Four Firestore/Storage emulator tests passed: complete actual sources/catalog/QR mapping, preservation after business/operator changes, same-version policy conflict preventing partial writes, and accidental default-database rejection.
- Live preview: 56 creates, zero target conflicts; apply: 56 creates and successful readback.
- Independent live verification: 56 preserved, zero creates, all 16 actual Storage contents/generations hash-checked.
- OpenCV decoded all six generated PNG images and matched each to its verified registered payload; `cloudRecordsVerified=true`.
- Primary PNG was also inspected visually.

Local full machine-readable evidence:

```text
functions/.seed-output/demo-v1/dry-run-report.json
functions/.seed-output/demo-v1/preview-live-report.json
functions/.seed-output/demo-v1/live-report.json
functions/.seed-output/demo-v1/verify-live-report.json
```

## 6. Refactor handoff

The data/QR prerequisite is ready. **`processingAvailability/global` is intentionally paused**, and `demo-vision-v1` is reference configuration rather than a claimed deployed working pipeline. The audit's Firebase client/database/rules/DTO/worker defects still need the planned repairs before a complete app scan/inference journey can succeed.

A1/A2 must consume the actual records: canonical policy keys, Firestore Timestamp dates, exact `storagePath` + `storageGeneration`, `scanContent/default`, and `qr-demo-main` distinct from `bin-demo-main`. Do not reseed fake history to conceal an empty feed or duplicate wallets to accommodate the old wrong reader path. Re-enable processing only after the actual end-to-end worker/settlement gate passes.
