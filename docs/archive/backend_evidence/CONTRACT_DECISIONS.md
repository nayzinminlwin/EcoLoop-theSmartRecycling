# Contract decisions

## BK-P01-A

- **CD-001:** Canonical exchange contracts use JSON Schema Draft 2020-12 and the literal `schemaVersion: "backend.v1"`. Readers must reject unsupported versions rather than silently coercing them.
- **CD-002:** `commands.schema.json` is a closed envelope for transport metadata, while command payloads remain open until each operation receives its operation-specific domain schema in BK-P01-B/C. Server-owned owner, award, wallet, count, and capacity fields are not part of resident inputs.
- **CD-003:** `snapshots.schema.json` uses a tagged `kind` union so session, asset, bin, batch, and receipt records cannot be confused while sharing one versioned transport resource.
- **CD-004:** Findings boxes are normalized finite values in the inclusive unit interval. Ordering (`x1 <= x2`, `y1 <= y2`) is a domain invariant to be enforced by the findings validator until JSON Schema 2020-12 custom validation is wired.
- **CD-005:** The golden corpus is a deterministic business fixture, not model evidence. It contains no source filenames, image hints, credentials, or provider output.
