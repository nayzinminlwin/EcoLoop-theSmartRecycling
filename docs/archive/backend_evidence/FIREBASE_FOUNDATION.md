# BK-P02-A Firebase Foundation Evidence

**Captured:** 2026-10-18  
**Unit:** BK-P02-A — Existing-project configuration, rules and indexes  
**Specification:** ECOLOOP-SPEC-001 sections 10, 15 and 16  
**Status:** VERIFIED

## Bound resources

| Resource | Verified value |
|---|---|
| Firebase project | `ecoloop-thesmartrecycling` (`353725053297`) |
| Firestore database | `ecoloop-db` in `asia-southeast1` |
| Storage bucket | `ecoloop-thesmartrecycling.firebasestorage.app` in `US-EAST1` |
| Functions runtime | Node.js 22 from `../../../functions` |
| Resident Hosting site | `ecoloop-thesmartrecycling` through the `resident` target |
| Emulator project | `demo-ecoloop` only; no live endpoint fallback in the rules gate |

The project and resource identities come from the BK-P00-A inventory. No new live Firebase project or secret was created. Provider secret references remain server-side only.

## Client access boundary

- Authenticated residents can read enabled bin/catalog/guide projections.
- Residents can read only their own `residents/{uid}` records and owner projections whose stored `ownerId` equals their Auth UID.
- Admin claim holders can read operational resident/job/review records; direct writes remain denied.
- Signed-out clients, cross-resident private reads, direct wallet/batch/session/receipt mutations, and direct configuration writes are denied.
- Simulation source and reward artwork are authenticated-read Storage namespaces.
- Evaluation data is admin-read only.
- Inspection evidence is readable only by its resident owner or an admin; all client writes are denied.
- Trusted Functions/Admin SDK writes bypass client rules through server credentials and are implemented in later units; no client claim is treated as a trusted service identity.

## Declared indexes

The index plan declares owner/time queries for sessions, batches, receipts and notification events, plus status/time ordering for review tickets. The rules and index files are kept at repository root so Firebase CLI deployment uses the verified project configuration without rewriting protected Android files.

## Verification

Command:

```text
cd functions
npm run test:rules
```

Result: PASS. Firebase Firestore and Storage emulators executed `functions/tests/emulator/rules.test.ts`; 5 tests passed:

1. Owner profile and batch reads.
2. Signed-out and cross-resident private-read denial.
3. Authenticated catalog read with forged resident/batch write denial.
4. Admin operational read with direct write denial.
5. Owner-only inspection evidence access and cross-resident/write denial.

Open follow-ups are not hidden by this gate: OAuth authorized domains remain unverified, live deployment permissions/configuration still require the later deployment units, and the trusted server composition is delivered by BK-P02-B onward.
