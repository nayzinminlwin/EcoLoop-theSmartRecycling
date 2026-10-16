# EcoLoop resident Flutter UI acceptance

**Phase:** 10  
**Status:** Offline checks complete; device journey pending an available target  
**Clock:** 20 May 2024, 11:00, Asia/Kuala_Lumpur (+08:00)

## Resident surface coverage

| Surface | Route | Acceptance coverage |
| --- | --- | --- |
| Home dashboard | `/home` | Opening wallet, impact, recent activity, quick actions |
| Recycling guide | `/guide` | Material cards, preparation guidance, steps, rates |
| Scan entry | `/scan` | QR simulation and bin lookup |
| Scan stages | `/scan/sessions/:id/{bin,ready,detected,processing,result}` | Guarded transitions, cancellation, verified result |
| History | `/history` | Status/date filters, refresh, empty and error states |
| Rewards | `/rewards` | Catalog, categories, wallet-aware redemption |
| Vouchers | `/vouchers` | Status filter and empty state |
| Voucher detail | `/vouchers/:voucherId` | Direct-link parsing and missing-resource recovery |
| Settings | `/settings` | Profile summary and sign-out |
| Profile | `/settings/profile` | Validation, save, cancel, shared profile refresh |
| Account security | `/settings/security` | Password validation and save |
| Notifications | `/settings/notifications` | Persisted preference switches |
| Signed out | `/signed-out` | Protected-route block and Continue demo |

## Automated acceptance

- `test/fixtures/mock_fixture_integrity_test.dart` validates fixture IDs,
  resident/reward references, date ordering, nullable review/rejection values,
  opening wallet (245), 12 verified deposits, 26 verified items, and 1.04 kg.
- `integration_test/resident_journey_test.dart` covers Home, guide, all scan
  stages, verified result, wallet refresh, Settings, and Profile on a real
  Flutter device.
- Existing feature tests cover review/rejection projections, one-shot read
  retry, idempotent scan completion, redemption atomicity, voucher states,
  profile validation, and signed-out routing.

Run the complete gate from the repository root:

```powershell
flutter pub get
dart format --output=none --set-exit-if-changed lib test integration_test
flutter analyze
flutter test
flutter build web
flutter test integration_test/resident_journey_test.dart -d <available-device-id>
```

In this Phase 10 execution, the unit/widget suite and web build are the
offline checks. A device target must be supplied before the integration test
can be marked executed; no unavailable device is treated as a pass.

## Visual review record

The UI uses the bundled Inter font, centralized theme tokens, a 480 logical
pixel content frame, and the source three-destination shell. The following
functional extensions intentionally use the same theme rather than prototype
shortcuts: voucher detail, editable account forms, notification preferences,
security, scan result, and recoverable missing-resource routes.

Review widths: 390 and 480 are the primary targets; 320 and enlarged text
remain manual follow-up checks on a device or browser. No remote images,
network calls, camera access, or startup Firebase service calls are required.

## Deferred backend work

Goals 3–4 must replace the repository adapters behind the existing contracts
with the **same existing Firebase project** for Firestore, Auth, Storage, App
Check, and Firebase Hosting for the standalone admin web deployment. They must
preserve the document paths, UID `RES-000842`-style identity projection,
`user`/`admin` custom claim mapping, Timestamp conversion, HTTPS URL fields,
stream unsubscribe behavior, and trusted atomic credit/redemption operations
recorded in [`FLUTTER_MOCK_CONTRACTS.md`](FLUTTER_MOCK_CONTRACTS.md).

Physical bin/AI events, real Auth account updates, Storage uploads, merchant
consumption, rules/indexes, SDK initialization, emulator connections, and
deployment are explicitly deferred.
