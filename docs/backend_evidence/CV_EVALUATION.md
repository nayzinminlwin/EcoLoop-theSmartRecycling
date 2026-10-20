# BK-P07-B Frozen CV Evaluation

**Captured:** 2026-10-19  
**Status:** BLOCKED — evaluation dataset is not labeled or frozen  
**Specification:** ECOLOOP-SPEC-001 v1.1, §18 and CV acceptance requirements  
**Provider scope:** Hosted Roboflow A/B/D and Gemini APIs only; no training or weight export

## Executed tooling

The evaluation scaffold and deterministic metric tests are implemented in:

- `services/vision/src/ecoloop_vision/tools/evaluate.py`
- `services/vision/tests/test_evaluation_metrics.py`

The tool validates scene-group/split integrity, reviewed frozen inputs, one-to-one box matching, wrong labels, duplicate/false objects, missed objects, and the declared precision/count/auto-completion denominators. It accepts provider-output cases separately from the expected annotations; labels are never sent to runtime providers.

## Actual commands

Working directory: `services/vision/`

```text
uv sync --frozen --group test
uv run pytest tests/test_evaluation_metrics.py
uv run python -m ecoloop_vision.tools.evaluate --manifest ..\..\datasets\evaluation\manifest.json --output .evaluation-output\cv-evaluation.json
```

The final command is expected to produce `BLOCKED` until a frozen reviewed subset exists.

## Current evidence

The current manifest is `evaluation-2026-10-18-v0` and contains:

- 15 inventoried candidates
- 0 labeled images
- 0 development images
- 0 frozen-evaluation images
- 0 second-reviewed images

Therefore the following required gates are **NOT_RUN**, not passed:

- Actual A, B, fusion, applicable D, and Gemini comparison
- Per-case provider-output/digest references
- Rewarded-classification precision >=95%
- Exact visible-object count >=90% on clear supported batches
- Verified auto-completion >=70% on clear supported non-empty batches

No target was lowered and no expected label, filename, or provider output was injected into runtime evaluation. Existing [MODEL_ACCESS.md](MODEL_ACCESS.md) remains a single-image provider smoke result and is not accuracy evidence.

## Required unblock

The labeling owner must provide a permission-checked, approximately 100-image manifest with scene groups, development/frozen split, complete annotations, second review, and an annotation/configuration digest. Then run the tool with saved provider outputs whose image/model/preprocessing/config identities match the frozen cases.
