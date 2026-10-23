# Phase 3 Gap Remediation Plan

**Date:** 2026-10-19
**Scope:** BK-P03-A through BK-P03-D
**Source of truth:** `PHASES_03_04_RECYCLING.md`, `EXECUTION_PROTOCOL.md`, `ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md`
**Audit input:** `docs/archive/backend_evidence/PHASE_3_AUDIT_AND_GAPS.md`

## Objective

Move Phase 3 from:

```text
IMPLEMENTED / NOT VERIFIED
```

to:

```text
VERIFIED
```

by closing the ten recorded gaps, wiring the composed inspection path into the operator probe, and capturing the required real-provider evidence without making unsupported accuracy or production-cost claims.

Phase 3 must remain independent of Firestore, Firebase settlement, and resident accounting. The Python inspection service produces auditable vision findings and evidence only.

## Completion definition

Phase 3 may be marked `VERIFIED` only when all of the following are true:

1. Detector, specialist, and Gemini outputs are normalized into one composed inspection result.
2. Crop fallback updates the existing candidate exactly once.
3. Full-image fallback creates distinct, traceable findings under a separate count protocol.
4. Provider failures, malformed output, exhausted budget, and unresolved decisions become explicit review/error outcomes.
5. All provider calls are bounded by configured per-call, total-time, crop, object, and retry limits.
6. D4 stage events contain actual stage latency, counts, fallback usage, and errors without secrets.
7. Replay consumes saved image, raw A/B/D/Gemini responses, and configuration, and reproduces the same result and overlay.
8. The operator probe invokes the composed inspection service rather than raw provider probes.
9. Coordinate semantics are explicit: normalized coordinates for canonical findings and pixel coordinates for image operations/overlays.
10. The real evidence matrix is executed and documented:
    - mixed supported image
    - confidently excluded image
    - empty/unknown image
    - specialist/crop fallback
    - full-image fallback
    - provider failure/review path
11. Focused and full vision tests pass.
12. The tracker, dev log, evidence files, and handoff identify all remaining blockers honestly.

## Work sequence

Implement the work packages in order. Each package has a gate. Do not start the next package if its predecessor's gate fails, except for independent test-fixture preparation.

```text
P3-R1 Contract and result model
        ↓
P3-R2 Fallback application and outcome policy
        ↓
P3-R3 Budgets, deadlines, and diagnostics
        ↓
P3-R4 Full replay and overlay reproducibility
        ↓
P3-R5 Operator probe integration
        ↓
P3-R6 Real-provider evidence matrix
        ↓
P3-R7 Final verification and tracker handoff
```

---

## P3-R1 — Stabilize the canonical inspection result and coordinate contract

**Closes:** P3-GAP-01, P3-GAP-02, P3-GAP-10
**Prerequisite:** none beyond the current BK-P03-A/B/C implementation

### Target files

Modify:

- `services/vision/src/ecoloop_vision/domain/models.py`
- `services/vision/src/ecoloop_vision/domain/resolution.py`
- `services/vision/src/ecoloop_vision/application/inspect_image.py`
- `services/vision/src/ecoloop_vision/adapters/gemini.py`
- `services/vision/src/ecoloop_vision/infrastructure/images.py`

Add or modify:

- `services/vision/tests/test_inspect_image.py`
- `services/vision/tests/test_gemini.py`
- `services/vision/tests/test_normalization.py`

### Instructions

1. Define one explicit coordinate representation for the canonical result.
   - Keep `pixel_box` for crop and overlay operations.
   - Add `normalized_box` with finite values in `[0, 1]` for findings and serialized output.
   - Convert only at a named boundary using original image width and height.
   - Reject inverted, non-finite, or out-of-range normalized geometry.
2. Extend `ResolvedObject` or its replacement with:
   - stable object ID
   - normalized box
   - optional pixel box
   - raw labels
   - source model IDs
   - source evidence IDs
   - rule ID
   - eligibility
   - resolution status
   - reason code
3. Add a pure fallback-application function. It must:
   - locate a crop fallback by `candidate_id`
   - replace or enrich the existing candidate decision exactly once
   - preserve the original detector evidence
   - never add a second object for a crop response
   - retain unresolved status when the fallback is invalid or unsupported
4. Add a full-image fallback materializer. It must:
   - create distinct object IDs scoped to the inspection
   - preserve `mode: full_image`
   - retain count and optional normalized geometry
   - reject duplicate identities or invalid count/geometry
   - keep full-image findings distinct from detector-proposal findings
5. Ensure D score vectors remain evidence, not object counts.
6. Ensure fallback labels pass through the same taxonomy and eligibility rules as detector labels.
   - `cardboard_item` remains excluded.
   - `unknown` remains unresolved.
   - generic `can`/`glass` cannot become specific subtypes without supported evidence.
7. Define the inventory state from final materialized findings, not merely from whether a provider returned JSON.
8. Add tests for:
   - valid crop fallback resolving one existing object
   - invalid crop fallback preserving unresolved status
   - full-image fallback creating two distinct objects
   - full-image fallback count validation
   - duplicate fallback identity rejection
   - normalized/pixel coordinate conversion
   - out-of-range and inverted geometry
   - D evidence not increasing physical object count

### Gate

```powershell
Set-Location 'D:\alexyy\projects\EcoLoop_theSmartRecycling\services\vision'
uv run --group test pytest tests\test_normalization.py tests\test_gemini.py tests\test_inspect_image.py
```

Expected result: all focused tests pass and serialized findings contain explicit normalized geometry.

---

## P3-R2 — Make failures and uncertainty explicit review outcomes

**Closes:** P3-GAP-03, P3-GAP-04
**Depends on:** P3-R1

### Target files

Modify:

- `services/vision/src/ecoloop_vision/application/inspect_image.py`
- `services/vision/src/ecoloop_vision/adapters/gemini.py`
- `services/vision/src/ecoloop_vision/domain/models.py`
- `services/vision/src/ecoloop_vision/application/ports.py`

Add or modify:

- `services/vision/tests/test_inspect_image.py`
- `services/vision/tests/test_gemini.py`

### Instructions

1. Introduce an explicit stage outcome model:
   - `success`
   - `unresolved`
   - `provider_error`
   - `invalid_response`
   - `budget_exhausted`
   - `review_required`
2. Never let a provider exception escape the composition boundary as an uncategorized failure.
3. Catch only provider-boundary exceptions and convert them to an outcome containing:
   - provider
   - model ID
   - stage
   - stable error code
   - redacted error type/message
   - whether the result requires review
4. Preserve successful A results if B fails, but do not silently auto-credit a path that requires unavailable evidence. The decision policy must explicitly state whether the resulting batch is:
   - resolved by a validated single-model path, or
   - review-required because the failed provider was required for that case.
5. Change malformed Gemini JSON handling from an uncategorized `ValueError` to an explicit invalid-response result at the adapter boundary.
6. Distinguish:
   - empty valid inventory
   - malformed inventory
   - unsupported label
   - provider unavailable
   - quota/deadline failure
   - unresolved material decision
7. Add tests for detector failure, D failure, Gemini failure, invalid JSON, quota-like failure, and fallback-unavailable review behavior.

### Gate

```powershell
Set-Location 'D:\alexyy\projects\EcoLoop_theSmartRecycling\services\vision'
uv run --group test pytest tests\test_inspect_image.py tests\test_gemini.py
```

Expected result: every failure path returns a typed, reviewable result; no provider exception leaks from `inspect_image`.

---

## P3-R3 — Add bounded budgets, deadlines, retries, and D4 diagnostics

**Closes:** P3-GAP-05, P3-GAP-06
**Depends on:** P3-R2

### Target files

Modify:

- `services/vision/src/ecoloop_vision/application/inspect_image.py`
- `services/vision/src/ecoloop_vision/application/ports.py`
- `services/vision/src/ecoloop_vision/adapters/detectors.py`
- `services/vision/src/ecoloop_vision/adapters/specialist.py`
- `services/vision/src/ecoloop_vision/adapters/gemini.py`
- `services/vision/src/ecoloop_vision/logging.py`

Add or modify:

- `services/vision/tests/test_inspect_image.py`
- `services/vision/tests/test_logging.py`
- `services/vision/tests/test_provider_budget.py`

### Instructions

1. Add an immutable `InspectionBudget` configuration with explicit values for:
   - total inspection milliseconds
   - per-provider-call milliseconds
   - maximum detector calls
   - maximum specialist crops
   - maximum Gemini crop calls
   - maximum full-image Gemini calls
   - maximum retries per provider
   - maximum output objects
2. Inject a clock or monotonic timer into the application service. Do not call wall-clock time directly from decision logic.
3. Make provider ports accept a deadline or remaining budget.
4. Implement bounded retries:
   - retry only classified transient provider failures
   - never retry malformed output
   - never retry after the total budget is exhausted
   - record attempt count
5. On budget exhaustion, return `budget_exhausted` and `review_required`; do not return a success-shaped fallback.
6. Emit stage events at command/stage boundaries:
   - inspection started/completed
   - detector stage completed
   - matching completed
   - resolution completed
   - specialist stage completed
   - Gemini fallback completed
   - replay completed
7. Each event must include, where applicable:
   - trace ID
   - input hash
   - config ID/fingerprint
   - provider/model
   - latency
   - candidate/group/finding counts
   - fallback usage
   - error/review reason
8. Use the existing redaction helper. Never log API keys, image bytes, raw secrets, resident data, or unbounded provider responses.
9. Add deterministic fake-clock/fake-provider tests proving:
   - no call occurs after the total deadline
   - retry count is bounded
   - crop/object limits are enforced
   - emitted events contain counts and latency
   - provider errors are redacted

### Gate

```powershell
Set-Location 'D:\alexyy\projects\EcoLoop_theSmartRecycling\services\vision'
uv run --group test pytest tests\test_provider_budget.py tests\test_logging.py tests\test_inspect_image.py
```

Expected result: budget, deadline, retry, and diagnostics tests pass with no unbounded provider path.

---

## P3-R4 — Make replay complete and reproducible

**Closes:** P3-GAP-07, P3-GAP-08
**Depends on:** P3-R1 through P3-R3

### Target files

Modify:

- `services/vision/src/ecoloop_vision/tools/replay.py`
- `services/vision/src/ecoloop_vision/application/inspect_image.py`
- `services/vision/src/ecoloop_vision/infrastructure/overlays.py`

Add or modify:

- `services/vision/tests/test_replay.py`
- `services/vision/tests/test_inspect_image.py`

### Instructions

1. Define a versioned replay input manifest containing:
   - input image path/hash/dimensions/content type
   - registry/model IDs and versions
   - matching/taxonomy/resolution configuration
   - budget configuration
   - raw A response
   - raw B response
   - raw D responses keyed by candidate ID
   - raw Gemini crop responses keyed by candidate ID
   - raw Gemini full-image response
2. Reject replay manifests with:
   - missing required model responses
   - input hash mismatch
   - unsupported replay schema version
   - malformed raw provider payload
   - missing configuration fingerprint
3. Persist:
   - normalized detections
   - matching groups
   - specialist evidence
   - fallback outcomes
   - final resolved objects
   - configuration fingerprint
   - input hash
   - overlay path
4. Ensure replay invokes the same pure composition functions as live inspection. Do not duplicate matching or resolution logic in the CLI.
5. Make overlay output deterministic:
   - stable object ordering
   - stable colors by outcome
   - stable labels
   - explicit image dimensions
6. Run replay twice and compare:
   - manifest semantic content
   - normalized findings
   - object IDs
   - overlay dimensions and hash

### Gate

```powershell
Set-Location 'D:\alexyy\projects\EcoLoop_theSmartRecycling\services\vision'
uv run --group test pytest tests\test_replay.py
```

Expected result: replay of the same manifest produces identical findings and deterministic overlay output.

---

## P3-R5 — Wire the operator probe to composed inspection

**Closes:** P3-GAP-09
**Depends on:** P3-R1 through P3-R4

### Target files

Modify:

- `services/vision/src/ecoloop_vision/main.py`
- `services/vision/src/ecoloop_vision/adapters/detectors.py`
- `services/vision/src/ecoloop_vision/adapters/specialist.py`
- `services/vision/src/ecoloop_vision/adapters/gemini.py`
- `services/vision/Dockerfile` only if artifact/output paths require it

Add or modify:

- `services/vision/tests/test_operator_probe.py`

### Instructions

1. Keep request validation in FastAPI:
   - content type
   - byte limit
   - image decoding
   - provider enablement
2. Move provider invocation into injected adapters or provider factories.
3. Construct the composition service once per request with:
   - verified provider configuration
   - budget configuration
   - trace ID
   - clock
   - artifact output interface
4. The endpoint must return:
   - trace ID
   - input hash/dimensions
   - final inventory state
   - findings
   - review/error reasons
   - provider/model identities
   - fallback usage
   - artifact references
5. Do not return API keys, raw authorization headers, internal stack traces, or unbounded raw responses.
6. Preserve raw evidence only through a controlled private artifact path. Do not expose it as a public resident response.
7. Generate an overlay artifact only after successful image decode and composition.
8. Add endpoint tests using fake providers; do not require live credentials for unit tests.

### Gate

```powershell
Set-Location 'D:\alexyy\projects\EcoLoop_theSmartRecycling\services\vision'
uv run --group test pytest tests\test_operator_probe.py
```

Expected result: the operator endpoint returns composed findings and never bypasses the inspection service.

---

## P3-R6 — Execute the real-provider evidence matrix

**Closes:** all remaining evidence blockers
**Depends on:** P3-R5 and verified provider credentials/access

### Required inputs

- Existing smoke image from the registry
- At least one mixed supported image
- At least one confidently excluded image
- At least one empty/unknown image
- At least one image/crop that exercises D or Gemini crop fallback
- At least one no-proposal image that exercises full-image Gemini fallback

Use actual pixels. Do not use filenames, labels, dataset annotations, or expected answers as inference hints.

### Instructions

1. Run the operator probe with explicit output directories and provider enablement.
2. Record for every case:
   - input SHA-256
   - dimensions and content type
   - provider/model/version identities
   - stage latencies
   - detector counts
   - group counts
   - resolved/unresolved/excluded counts
   - fallback mode and call count
   - usage metadata where available
   - error/review outcomes
   - manifest and overlay paths
3. Preserve redacted raw responses privately. Do not commit secrets.
4. Run the replay tool against saved raw responses.
5. Compare live and replay:
   - input hash
   - configuration fingerprint
   - normalized detections
   - groups
   - findings
   - fallback decisions
6. Record unavailable cases explicitly. A missing provider credential or unavailable model must remain a blocker, not a fabricated pass.
7. Keep accuracy claims separate from functional smoke evidence. Do not claim the CV acceptance thresholds from smoke cases.

### Evidence targets

Add or update:

- `docs/archive/backend_evidence/PHASE_3_REAL_PROVIDER_EVIDENCE.md`
- `docs/archive/backend_evidence/PHASE_3_REPLAY_MATRIX.md`
- `docs/archive/test_logs/2026-10-19_BK-P03_Phase3_QA.md`

### Gate

The evidence matrix is complete only when each required case has either:

- actual live/replay evidence with artifact references, or
- a clearly documented external blocker with the exact missing credential/access/input and affected gate.

---

## P3-R7 — Final verification and handoff

**Depends on:** P3-R1 through P3-R6

### Instructions

1. Run the focused tests for each changed area.
2. Run the complete vision suite.
3. Run frozen dependency synchronization.
4. Run Python compilation and whitespace checks.
5. Review the operator endpoint and replay output for secret leakage.
6. Inspect `git status --short` and stage only current-unit files if commit authorization exists.
7. Update:
   - `docs/archive/backend_plan/EXECUTION_TRACKER.md`
   - the current BK-P03 dev log
   - the Phase 3 audit document with resolved gaps and remaining blockers
8. Change each unit from `IMPLEMENTED` to `VERIFIED` only if its own gate and required evidence pass.
9. Do not mark the M3 gate complete while real-provider or required replay evidence is missing.
10. Identify BK-P04-A as the single next executable unit only after the Phase 3 handoff is coherent.

### Final validation commands

```powershell
Set-Location 'D:\alexyy\projects\EcoLoop_theSmartRecycling\services\vision'
uv sync --frozen --group test
uv run --group test pytest tests
python -m compileall -q src\ecoloop_vision
```

From the repository root:

```powershell
git diff --check
git status --short
```

## Risk controls

- Do not add a local model runtime or download weights.
- Do not substitute a different hosted model/version without an explicit registry and evaluation update.
- Do not merge detector totals, specialist labels, or Gemini counts without object-identity rules.
- Do not treat empty detector output as an empty batch before full-image fallback policy is applied.
- Do not turn a provider failure into a successful or confidently excluded result.
- Do not expose raw provider payloads or credentials through the operator response.
- Do not claim precision, recall, coverage, latency, or cost thresholds from synthetic tests or a small smoke sample.
- Do not alter Phase 4 settlement/accounting behavior while closing Phase 3 gaps.

## Planned status transitions

| Unit | Current | Target after remediation |
| --- | --- | --- |
| BK-P03-A | IMPLEMENTED | VERIFIED after coordinate contract and live normalization evidence |
| BK-P03-B | IMPLEMENTED | VERIFIED after threshold evidence and real mixed/excluded findings |
| BK-P03-C | IMPLEMENTED | VERIFIED after live crop/full-image fallback evidence |
| BK-P03-D | IMPLEMENTED | VERIFIED after composed operator probe, complete replay, diagnostics, and evidence matrix |
