# Phase 3 Real Provider Evidence

**Date:** 2026-10-19
**Mode:** live hosted-provider calls with globally configured credentials
**Models:** A `waste-detection-0momv/6`, B `yolo-waste-detection/1`, D `waste-classification-rjo28/2`, Gemini `gemini-3.8-flash`

## Execution

The matrix was run from `services/vision/` with:

```powershell
uv sync --frozen --group test
uv run --group test python <live matrix runner>
```

The runner used actual pixels from `assets/trash_images`, the composed `inspect_image` service, bounded provider calls, and redacted manifests. API keys were not printed or written to artifacts.

Raw provider manifests and replay outputs are in the ignored local directory:

```text
services/vision/.probe-output/phase3-20261019/
```

## Inputs and composed results

| Input | SHA-256 | Dimensions | A detections | B detections | Groups | Final objects | Inventory state | Fallback result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `trash11.jpg` | `333547ec6d70977bc05c125646a0be6dd684cf6cace6d8b9fd5ddf52904a0464` | 447x447 | 5 | 1 | 6 | 6 | resolved | none |
| `trash3.webp` | `78e708e9e00a40e3c426c54c5deecd3bc4491589afc8d733f8f0a53fa4566d8f` | 800x534 | 0 | 1 | 1 | 1 unresolved | resolved-with-review | Gemini crop unresolved: unsupported/invalid label |
| `trash909.png` | `1a893e69c71b4681622bbb9a967fe2e670549219b9aa8396244dd3780aaa84c5` | 316x200 | 0 | 0 | 0 | 0 | uncertain | Gemini full-image unresolved: empty inventory requires review |
| `trash6.jpeg` | `9d27a2ff2fa95be5933279b87432b0c6751b5e12e53ac380516e74067fc0e711` | 300x168 | 2 | 1 | 3 | 3 | resolved | none |

### Resolved object summaries

- `trash11.jpg`: five `plastic_bottle` objects and one `glass_bottle`; all were classified eligible by the current taxonomy.
- `trash3.webp`: one detector proposal remained unresolved after the crop fallback; no automatic material decision was made.
- `trash909.png`: both detectors produced no proposals; full-image Gemini returned an empty inventory, which correctly remained review-required rather than becoming an accepted empty batch.
- `trash6.jpeg`: three `plastic_bottle` objects; all were classified eligible by the current taxonomy.

These are functional smoke observations, not accuracy or acceptance-rate measurements.

## Replay evidence

Each live raw manifest was replayed without provider calls:

| Input | Replay object count | Replay fallback count | Overlay |
| --- | ---: | ---: | --- |
| `trash11.jpg` | 6 | 0 | `.probe-output/phase3-20261019/trash11-replay/overlay.png` |
| `trash3.webp` | 1 | 1 | `.probe-output/phase3-20261019/trash3-replay/overlay.png` |
| `trash909.png` | 0 | 1 | `.probe-output/phase3-20261019/trash909-replay/overlay.png` |
| `trash6.jpeg` | 3 | 0 | `.probe-output/phase3-20261019/trash6-replay/overlay.png` |

All replay manifests recorded the input SHA-256 and a configuration fingerprint. The replay output preserved the live object/fallback cardinalities for these cases.

## Input limitation

`assets/trash_images/trash10.svg` was present but is vector input, while the current Phase 3 image contract accepts decoded JPEG, PNG, and WebP pixels. It was not passed to the raster provider matrix because silently rasterizing it would change the recorded input artifact. A separate explicitly documented SVG rasterization step would be required if this input must be evaluated.

## Remaining evidence limitations

- The supplied matrix did not establish a confidently excluded cardboard case; no excluded classification claim is made.
- The smoke set is too small to tune matching thresholds or claim precision, recall, coverage, latency, or cost targets.
- Provider adapter logs contain live timing events, but the evidence summary does not freeze a benchmark dataset or acceptance metric.
- The local operator HTTP endpoint was smoke-tested with `trash11.jpg`; health returned `ok`, the multipart probe returned HTTP 200, `inventoryState=resolved`, and six objects. This validates wiring, not production deployment or network behavior.

## Status

Live provider access and replay evidence are now available for four raster cases. Phase 3 remains `IMPLEMENTED / NOT VERIFIED` until the excluded case, operator endpoint smoke, and final QA/handoff gates are completed.
