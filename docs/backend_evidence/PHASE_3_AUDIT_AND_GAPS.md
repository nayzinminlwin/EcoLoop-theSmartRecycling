# Phase 3 Audit and Gaps

**Date:** 2026-10-18
**Scope:** BK-P03-A through BK-P03-D
**Authority:** `docs/backend_plan/PHASES_03_04_RECYCLING.md`, `docs/backend_plan/EXECUTION_PROTOCOL.md`, and `docs/ECOLOOP_BACKEND_AND_CV_SPECIFICATION.md`

## Executive conclusion

Phase 3 is substantially scaffolded and locally tested, but it is **not yet verified or complete** against the plan's end-to-end requirements.

The current tracker status of `IMPLEMENTED` for BK-P03-A through BK-P03-D is accurate. The phase must not be marked `VERIFIED` or `COMPLETE` until the gaps below are resolved and the required real-provider evidence is captured.

## Current implementation and local evidence

| Unit | Current state | Local evidence |
| --- | --- | --- |
| BK-P03-A | Implemented normalization seams | Hosted detector/specialist normalization, image decoding, coordinate transforms, score semantics, and tests |
| BK-P03-B | Implemented deterministic decision seams | Geometry-aware grouping, taxonomy, eligibility separation, cap handling, false-detection handling, and tests |
| BK-P03-C | Implemented fallback validation seams | Bounded crops, crop identity checks, allowed labels, geometry validation, and explicit empty-inventory handling |
| BK-P03-D | Implemented composition scaffolding | Provider-injected inspection service, replay manifest, and explainable overlay renderer |

The complete local vision suite passed with **26 tests**. This validates deterministic local behavior only; it does not establish live provider behavior, accuracy, latency, cost, or production readiness.

## Findings

### P3-GAP-01 — Fallback results are not applied to final findings

**Severity:** High
**Affected code:** `services/vision/src/ecoloop_vision/application/inspect_image.py`

The inspection service records D and Gemini results as evidence but does not merge validated fallback results into `InspectionResult.objects`.

Consequences:

- A valid Gemini crop classification does not resolve the existing candidate.
- A valid Gemini full-image inventory does not create findings.
- D specialist evidence cannot influence taxonomy resolution.
- The composed result may remain unresolved or empty despite valid fallback output.

This fails the P03-C requirement that crop fallback label the existing candidate and the P03-D requirement to compose the complete inspection result.

### P3-GAP-02 — Full-image fallback findings are not materialized

**Severity:** High
**Affected code:** `services/vision/src/ecoloop_vision/application/inspect_image.py`, `adapters/gemini.py`

Full-image Gemini entries are validated into `GeminiResult`, but are not converted into distinct traceable resolved objects. The specification requires separate full-image findings and a separately evaluated count protocol.

### P3-GAP-03 — Provider failures do not become explicit review outcomes

**Severity:** High
**Affected code:** `services/vision/src/ecoloop_vision/application/inspect_image.py`

Detector provider exceptions propagate out of the application service. They are not represented as `NormalizedResult.error`, stage evidence, or a reviewable technical outcome.

The specification requires provider failure, malformed output, quota exhaustion, and unresolved results to produce explicit outcomes and reasons for review.

### P3-GAP-04 — Malformed Gemini JSON escapes as an uncategorized exception

**Severity:** Medium
**Affected code:** `services/vision/src/ecoloop_vision/adapters/gemini.py`

Invalid JSON raises `ValueError` before it can become an explicit unresolved/error result. The application boundary should classify malformed provider output consistently with other fallback failures.

### P3-GAP-05 — No deadline, retry, or total provider-call budget

**Severity:** High
**Affected code:** `services/vision/src/ecoloop_vision/application/inspect_image.py`, provider adapters

The implementation limits crop/object counts but has no:

- Per-provider deadline
- Total inspection time budget
- Bounded retry policy
- Explicit provider-call budget
- Injected clock for deterministic budget enforcement

These controls are required by P03-C and P03-D to prevent unbounded fallback work.

### P3-GAP-06 — Required D4 stage diagnostics are not emitted

**Severity:** High
**Affected code:** `services/vision/src/ecoloop_vision/application/inspect_image.py`

Diagnostics are currently concentrated in raw provider adapters. The composed service does not emit stage events for:

- Detector counts
- Matching groups
- Resolution outcomes
- Specialist usage
- Gemini fallback usage
- Stage latency
- Errors and review reasons

This does not yet satisfy the P03-D requirement to emit actual latency, counts, fallback usage, and errors.

### P3-GAP-07 — Replay does not cover the complete pipeline

**Severity:** High
**Affected code:** `services/vision/src/ecoloop_vision/tools/replay.py`

Replay currently consumes detector responses only. It does not replay saved:

- Specialist responses
- Gemini crop responses
- Gemini full-image responses
- Matching configuration
- Resolution configuration
- Stage outputs

It also constructs the default `InspectionConfig` instead of faithfully using the saved configuration.

### P3-GAP-08 — Configuration fingerprint is not persisted in replay output

**Severity:** Medium
**Affected code:** `services/vision/src/ecoloop_vision/application/inspect_image.py`, `tools/replay.py`

`configuration_fingerprint()` exists, but replay manifests record only `configId`. They do not persist the fingerprint needed to prove that a replay used the same matching, fallback, and budget configuration.

### P3-GAP-09 — Operator probe is disconnected from composed inspection

**Severity:** High
**Affected code:** `services/vision/src/ecoloop_vision/main.py`

The operator endpoint still invokes raw provider probes directly. It does not invoke `inspect_image`, so the deployed/operator path does not execute:

- A+B reconciliation
- Taxonomy resolution
- D crop fallback
- Gemini fallback
- Final findings composition
- Overlay/artifact generation

The P03-D application service therefore is not yet the production probe path.

### P3-GAP-10 — Coordinate contract needs explicit reconciliation

**Severity:** Medium
**Affected code:** `domain/models.py`, `adapters/detectors.py`, `domain/resolution.py`

The specification requires detector boxes normalized to `[x1, y1, x2, y2]` relative to the original image, while the current implementation stores original-image pixel coordinates in `DetectionCandidate.box`.

Pixel coordinates are useful for cropping and overlays, but the canonical finding contract also requires normalized coordinates in the unit interval. The implementation needs an explicit dual representation or a clearly defined conversion boundary:

- normalized coordinates for canonical findings/contracts
- pixel coordinates for image operations and overlays

## Evidence and gate status

### Passed locally

- BK-P03-A through BK-P03-D focused and regression tests
- Python compilation
- Frozen dependency synchronization
- Replay manifest and overlay generation using synthetic/provider-injected fixtures
- Deterministic matching, taxonomy, fallback validation, and composition behavior

### Not yet verified

- New live A/B/D adapter smoke through the normalization and composition pipeline
- Live Gemini crop fallback
- Live Gemini full-image fallback
- Real mixed-image composed findings
- Real excluded-image composed findings
- Real empty/unknown-image behavior
- Real replay of saved provider responses from the complete pipeline
- Measured stage latency, fallback usage, and provider error telemetry
- Development-set tuning of matching thresholds
- Production/operator endpoint execution through the composed inspection service

The prior P00 provider evidence in `docs/backend_evidence/MODEL_ACCESS.md` proves historical provider access and response shapes, but does not prove the new Phase 3 composition path.

## Required completion work

Before Phase 3 can move beyond `IMPLEMENTED`:

1. Merge D and Gemini fallback results into final candidate/object findings.
2. Materialize full-image Gemini inventory into distinct traceable objects.
3. Convert provider failures and malformed output into explicit review/error evidence.
4. Add injected clock, deadlines, bounded retries, and a total provider-call budget.
5. Emit composed D4 stage events with counts, latency, fallback usage, and errors.
6. Extend replay to consume all saved A/B/D/Gemini responses and saved configuration.
7. Persist and verify the configuration fingerprint in replay manifests.
8. Wire the operator probe to the composed inspection service.
9. Resolve pixel-versus-normalized coordinate semantics at the canonical contract boundary.
10. Run and record the real Phase 3 evidence matrix.

## Status decision

**Phase 3 status: IMPLEMENTED / NOT VERIFIED**

No accuracy, completeness, live fallback, production latency, or production-cost claim should be made from the current local test results.

## Remediation update — 2026-10-19

The remediation plan in [PHASE_3_GAP_REMEDIATION_PLAN.md](../backend_plan/PHASE_3_GAP_REMEDIATION_PLAN.md) was executed through the local implementation gates.

Resolved locally:

- Crop Gemini results now update the existing candidate once.
- Full-image Gemini results now materialize as distinct findings.
- Findings carry normalized geometry alongside pixel geometry.
- Detector/specialist failures and malformed Gemini JSON become explicit outcomes.
- Inspection, matching, resolution, and completion diagnostics are emitted.
- Replay manifests include a configuration fingerprint.
- The operator probe routes through composed inspection rather than the old raw-provider response path.
- Regression suite increased to **27 passing tests**.

Still open:

- Strict per-provider-call deadline and bounded retry implementation.
- Complete replay support for saved D and Gemini raw responses/configuration.
- Live operator endpoint smoke.
- Real mixed/excluded/empty/fallback provider evidence.
- Development-set threshold tuning and overlay evidence.

Therefore the status remains **IMPLEMENTED / NOT VERIFIED**.
