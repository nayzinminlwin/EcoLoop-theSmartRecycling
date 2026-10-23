# BK-P02-F Repeatable Seed Evidence

**Captured:** 2026-10-18  
**Unit:** BK-P02-F — Repeatable policy/bin/asset/QR/catalog seeding  
**Specification:** ECOLOOP-SPEC-001 sections 8, 10.6 and 10.7  
**Status:** VERIFIED

## Seeder behavior

- `../../../functions/tools/seed.ts` is standalone and does not import Functions handler registration.
- Dry-run is the default. Emulator mode requires the Firebase emulator environment; live mode additionally requires `ECOLOOP_SEED_LIVE=true`.
- The typed manifest seeds the initial policy and pointer, named normal/near-full/full bins, explicit cycles/opening occupancy, QR mappings, reward categories, and a current/future demo reward.
- QR PNGs are generated from the exact stored `ecoloop://bin/<id>` mapping. Generated output is ignored under `../../../functions/.seed-output`.
- Simulation assets use actual repository source files. SHA-256, byte count, MIME type, width, height, version, and storage path are derived from each file. No expected class or answer is stored.
- Emulator/live modes upload the source assets to versioned Storage paths and register their metadata in Firestore.
- Existing documents are merged only after immutable fields match. Conflicting policy/version or asset identity values fail explicitly; no resident or wallet documents are reset.

## Verification

```text
cd functions
npm run build
npm run seed:dry-run
npm run test:seed
```

Results:

- Functions source and tool typecheck: **PASS**.
- Dry-run: **PASS**, writing 17 controlled collection documents and generating 3 QR PNGs plus 3 asset copies.
- Firestore/Storage emulator gate: **PASS — 2 tests**.
  - Repeated seed is harmless and preserves normal (10%), near-full (85%), and full (100%) occupancy cases.
  - Real source image metadata matches the repository file and QR output has a valid PNG signature.
  - Immutable policy conflict is rejected explicitly.

The evaluation manifest remains scaffolding with unlabeled images; this unit does not claim model accuracy or fabricated labels.
