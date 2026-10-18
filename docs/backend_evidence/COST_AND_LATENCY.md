# BK-P00-C Cost and Latency Evidence

**Captured:** 2026-10-18
**Unit:** BK-P00-C
**Project/region:** `ecoloop-thesmartrecycling` / `asia-southeast1`
**Input:** `trash8.jpg`, SHA-256 `d60c8101b0795e01826dad830e3df4ea831161db6feacdc2e5668dc7d9f480e6`

## Observed timings

| Request | Result | End-to-end client time |
|---|---|---:|
| Local A/B/D/Gemini probe, first run | A/B/D/Gemini success | approximately 25 seconds across individual provider calls |
| Cloud Run final revision, first full probe | A/B/D/Gemini success | 18,909 ms |
| Cloud Run final revision, warm repeat | A/B/D/Gemini success | 10,039 ms |

Cloud Run revision startup evidence reports:

- Container image import completed before health checking.
- Containers became healthy in 14.14 seconds.
- Revision deployment succeeded in 19.7 seconds.

The first deployed revision did not become healthy because the slim image lacked OpenCV's `libGL.so.1`; this was fixed before the measured final revision. These startup values are deployment observations, not a final cold-start SLO.

## Provider timings

The earlier local provider evidence recorded the first successful hosted calls:

| Provider/model | Local round-trip |
|---|---:|
| A `waste-detection-0momv/6` | 7,044.15 ms |
| B `yolo-waste-detection/1` | 5,210.23 ms |
| D `waste-classification-rjo28/2` | 8,492.01 ms |
| Gemini `gemini-3.8-flash` | 10,036.26 ms |

The final Cloud Run response confirmed successful A/B/D/Gemini calls but did not expose per-stage client timestamps in the public operator response. P01/P03 diagnostics will add bounded stage timing fields.

## Usage and cost status

Gemini usage from the final warm repeat was:

```text
promptTokenCount: 1142
candidatesTokenCount: 307
totalTokenCount: 2103
```

Roboflow returned hosted inference timing fields, but not a monetary charge. Cloud Run billing was not isolated to this single request during this probe. The RM50 monthly target therefore remains an unmeasured planning constraint, not a passed affordability gate.

Required follow-up before claiming M0 affordability:

1. Record the active Roboflow plan, per-call/quota pricing and whether A/B/D are billed separately.
2. Record Gemini pricing/quota for the selected model and request shape.
3. Model approximately 1,500 batches/month using actual call counts and measured fallback usage.
4. Include Cloud Run, Artifact Registry, Cloud Build, Secret Manager, Storage and egress assumptions.

## Memory and provider boundary

No provider GPU/RAM claim is made. Roboflow and Gemini execute remotely. Cloud Run is configured at the initial benchmark of 2 vCPU, 4 GiB, one request per instance, maximum one instance. A process-level memory profile was not captured in this deployment and remains a follow-up measurement.
