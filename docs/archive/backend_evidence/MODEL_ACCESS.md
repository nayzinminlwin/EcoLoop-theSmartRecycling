# BK-P00-B Hosted Model Access Evidence

**Captured:** 2026-10-18
**Unit:** BK-P00-B — Real A/B/D and Gemini access probe
**Role:** Integration executor
**Specification:** ECOLOOP-SPEC-001 v1.1 sections 7 and 20
**Base revision:** `21fbb5fa3e2876c1a32b6fb8971b629211178123`
**Input:** `../../../assets/trash_images/trash8.jpg`
**Input SHA-256:** `d60c8101b0795e01826dad830e3df4ea831161db6feacdc2e5668dc7d9f480e6`
**Input dimensions:** 574×348 JPEG, 22,699 bytes

## Execution

The probe uses hosted provider APIs only. It does not download weights, train models, upload datasets, or run a local inference runtime.

| Item | Result |
|---|---|
| Python | 3.12.10 |
| uv | 0.13.1 |
| Probe package lock | `../../../services/vision/uv.lock` |
| Roboflow client | `inference-sdk` 0.64.8 |
| Gemini client | `google-genai` 1.75.0 |
| Roboflow API URL | `https://serverless.roboflow.com` |
| Gemini model | `gemini-3.8-flash` |
| Credential values | Present in the local environment; never logged or stored |

Commands run from `../../../services/vision`:

```text
uv lock
uv sync --frozen
uv run python -m ecoloop_vision.tools.probe_models --help
uv run python -m ecoloop_vision.tools.probe_models --image ..\..\assets\trash_images\trash8.jpg --output-dir .probe-output\trash8-rerun --enable-roboflow --enable-gemini
```

The first attempt exposed an SDK-version mismatch before any Roboflow request: the installed `InferenceConfiguration` does not accept the documentation's `api_key_transport` argument. The adapter was corrected to the installed `InferenceHTTPClient(api_url, api_key)` signature and the complete probe was rerun.

## Real provider results

| Role | Model/version | Status | Round-trip latency | Returned shape |
|---|---|---:|---:|---|
| A | `waste-detection-0momv/6` | Success | 7,044.15 ms | Detector object with two predictions |
| B | `yolo-waste-detection/1` | Success | 5,210.23 ms | Detector object with one prediction |
| D | `waste-classification-rjo28/2` | Success | 8,492.01 ms | Multi-label class-to-score map; `predicted_classes` contains `Plastic Bottle` |
| Gemini | `gemini-3.8-flash` | Success | 10,036.26 ms | Structured JSON object inventory |

Roboflow response metadata identified the resolved backend as ONNX/FP32 for all three calls. A and B returned pixel-coordinate boxes using `x`, `y`, `width`, and `height`; normalization and one-to-one reconciliation are future P03 work and were not claimed here.

### A

Returned two `Pet_Bottle` detections, class ID 3, with confidences approximately 0.7411 and 0.6958. The response image dimensions were 574×348.

### B

Returned one `Plastic bottle` detection, class ID 24, confidence approximately 0.9911. The response image dimensions were 574×348.

### D

Returned all 18 class scores, not one forced single label. The highest observed class was:

```text
Plastic Bottle: 0.9389400482177734 (class ID 10)
```

The lower scores remain part of the raw multi-label evidence and must not be interpreted as additional objects.

### Gemini

The structured response contained seven `plastic_bottle` objects, each with count 1 and descriptive notes. Usage metadata:

```text
promptTokenCount: 1142
candidatesTokenCount: 171
totalTokenCount: 2160
```

This is a provider smoke result, not an accuracy result. It does not establish that seven is the correct physical-object count, nor does it establish eligibility, calibration, matching quality, or automatic settlement safety.

## Redacted raw evidence

The complete JSON response is retained locally at:

```text
services/vision/.probe-output/trash8-rerun/probe.json
```

That directory is ignored and is not a source artifact. It contains provider inference IDs and response data but no API keys. It must not be uploaded as a public artifact without the operator's review.

## Cost and limitations

- Provider requests were real and successful.
- Per-call monetary cost was not returned by the APIs and was not independently measured in this probe.
- Roboflow server-side model memory/GPU usage is not measurable from this client and is not claimed.
- The image is one representative smoke input, not the frozen evaluation set.
- No detector normalization, matching, crop specialist orchestration, taxonomy resolution, retry policy, or fallback decision was executed.
- No production Cloud Run request was made.

The all-provider cost path remains a follow-up measurement/configuration item before M0 is claimed complete.

## Next unit

BK-P00-C was subsequently deployed and independently probed; see [DEPLOYMENT.md](DEPLOYMENT.md) and [COST_AND_LATENCY.md](COST_AND_LATENCY.md). Provider pricing/quota references remain open and must be resolved before claiming the M0 affordability gate. The next implementation unit is BK-P01-A.
