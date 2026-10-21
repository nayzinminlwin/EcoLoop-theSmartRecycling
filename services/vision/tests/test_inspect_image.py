import io
import json
import math
import threading
from pathlib import Path

from PIL import Image
import pytest

from ecoloop_vision.application.inspect_image import InspectionConfig, inspect_image, result_to_dict
from ecoloop_vision.application.run_job import _findings
from ecoloop_vision.infrastructure.images import decode_image
from ecoloop_vision.infrastructure.overlays import render_overlay
from ecoloop_vision.tools.replay import replay


def image_input():
    stream = io.BytesIO()
    Image.new("RGB", (100, 80), "white").save(stream, format="PNG")
    return decode_image(stream.getvalue(), "image/png")


def detector_response(label: str, x: float = 50):
    return {
        "version": 1,
        "image": {"width": 100, "height": 80},
        "predictions": [{
            "x": x, "y": 40, "width": 20, "height": 30,
            "class": label, "confidence": 0.9,
        }],
    }


def test_inspection_composes_detectors_and_preserves_stage_evidence():
    result = inspect_image(
        image_input(),
        detector_provider=lambda model_id, _image: detector_response(
            "Pet_Bottle" if model_id.startswith("waste") else "Plastic bottle"
        ),
    )
    assert len(result.groups) == 1
    assert result.objects[0].resolution == "plastic_bottle"
    assert set(result.detector_results) == {"A", "B"}
    assert result_to_dict(result)["input_sha256"] == result.input_sha256


def test_empty_detector_path_uses_bounded_full_image_fallback():
    calls = []

    def gemini(_image, mode, _object_id):
        calls.append(mode)
        return {"objects": [{"label": "plastic_bottle", "count": 1}]}

    result = inspect_image(
        image_input(),
        detector_provider=lambda _model_id, _image: {
            "image": {"width": 100, "height": 80},
            "predictions": [],
        },
        gemini_provider=gemini,
    )
    assert calls == ["full_image"]
    assert result.fallbacks[0].mode == "full_image"
    assert result.fallbacks[0].result.status == "resolved"
    assert result.objects[0].resolution == "plastic_bottle"
    assert result.objects[0].object_id.startswith("gemini-full-")


def test_replay_writes_manifest_and_explainable_overlay(tmp_path: Path):
    image = image_input()
    image_path = tmp_path / "input.png"
    image_path.write_bytes(image.content)
    raw_path = tmp_path / "raw.json"
    raw_path.write_text(json.dumps({
        "detectors": {
            "A": detector_response("Pet_Bottle"),
            "B": detector_response("Plastic bottle"),
        }
    }), encoding="utf-8")
    output = tmp_path / "replay"
    manifest = replay(image_path=image_path, raw_path=raw_path, output_dir=output)
    assert manifest["input"]["sha256"] == image.sha256
    assert len(manifest["configFingerprint"]) == 64
    assert (output / "manifest.json").exists()
    assert (output / "overlay.png").exists()
    render_overlay(image.content, (), output / "empty-overlay.png")
    assert (output / "empty-overlay.png").exists()


def test_provider_failures_are_explicit_outcomes():
    result = inspect_image(
        image_input(),
        detector_provider=lambda _model_id, _image: (_ for _ in ()).throw(RuntimeError("secret")),
    )
    assert all(outcome.status == "provider_error" for outcome in result.outcomes)
    assert result.detector_results["A"].error == "RuntimeError"


def test_provider_failure_with_detected_objects_is_uncertain():
    result = inspect_image(
        image_input(),
        detector_provider=lambda model_id, _image: (
            detector_response("Pet_Bottle") if model_id.startswith("waste") else
            (_ for _ in ()).throw(RuntimeError("provider unavailable"))
        ),
    )
    assert result.objects
    assert result.inventory_state == "uncertain"


def test_worker_findings_use_normalized_boxes_and_native_model_ids():
    image = image_input()
    result = inspect_image(
        image,
        detector_provider=lambda model_id, _image: detector_response("Pet_Bottle"),
    )
    findings = _findings(
        type("Claim", (), {
            "job_id": "job-001", "attempt_id": "attempt-001",
            "asset_id": "asset-001", "asset_version": "v1",
        })(),
        image,
        result,
    )
    finding = findings["findings"][0]
    assert finding["box"] == {"x1": 0.4, "y1": 0.3125, "x2": 0.6, "y2": 0.6875}
    assert finding["evidence"]["modelIds"]


def test_specialist_predictions_are_normalized_as_scores():
    from ecoloop_vision.adapters.specialist import normalize_specialist_response

    result = normalize_specialist_response(
        {
            "version": 2,
            "predictions": {
                "Plastic Bottle": {"confidence": 0.94},
                "Glass Bottles": {"confidence": 0.01},
            },
            "predicted_classes": ["Plastic Bottle"],
        },
        model_id="waste-classification-rjo28/2",
    )
    assert result.score_vector.scores["Plastic Bottle"] == 0.94


def test_low_confidence_eligible_candidate_keeps_specialist_evidence_and_needs_gemini():
    specialist_calls = []
    gemini_calls = []

    def detector(model_id, _image):
        return {
            "image": {"width": 100, "height": 80},
            "predictions": [{
                "x": 50, "y": 40, "width": 20, "height": 30,
                "class": "Pet_Bottle" if model_id.startswith("waste") else "Plastic bottle",
                "confidence": 0.68,
            }],
        }

    def specialist(_image, object_id):
        specialist_calls.append(object_id)
        return {
            "predictions": {"Plastic Bottle": {"confidence": 0.942}},
            "predicted_classes": ["Plastic Bottle"],
        }

    def gemini(_image, mode, object_id):
        gemini_calls.append((mode, object_id))
        return {
            "objects": [{
                "label": "plastic_bottle",
                "count": 1,
                "confidence": 0.95,
                "candidateId": object_id,
            }],
        }

    result = inspect_image(
        image_input(),
        detector_provider=detector,
        specialist_provider=specialist,
        gemini_provider=gemini,
    )

    assert specialist_calls == ["object-0001"]
    assert gemini_calls == [("crop", "object-0001")]
    item = result.objects[0]
    assert item.eligibility == "eligible"
    assert "waste-classification-rjo28/2" in item.model_ids
    assert item.confidence == pytest.approx(0.68)


def test_independent_specialist_crops_run_concurrently_and_reconcile_in_input_order():
    barrier = threading.Barrier(2)

    def detector(model_id, _image):
        x = 25 if model_id.startswith("waste") else 75
        return {
            "image": {"width": 100, "height": 80},
            "predictions": [{
                "x": x, "y": 40, "width": 12, "height": 20,
                "class": "Pet_Bottle", "confidence": 0.68,
            }],
        }

    def specialist(_image, object_id):
        barrier.wait(timeout=1)
        return {
            "predictions": {"Plastic Bottle": {"confidence": 0.942}},
            "predicted_classes": ["Plastic Bottle"],
        }

    result = inspect_image(
        image_input(),
        detector_provider=detector,
        specialist_provider=specialist,
        config=InspectionConfig(max_gemini_crops=0),
    )

    assert [item.object_id for item in result.objects] == ["object-0001", "object-0002"]
    assert [item.model_ids[-1] for item in result.objects] == [
        "waste-classification-rjo28/2",
        "waste-classification-rjo28/2",
    ]
    assert len(result.attempts) == 4


def test_worker_findings_map_internal_specialist_reason_to_contract_reason():
    image = image_input()
    result = inspect_image(
        image,
        detector_provider=lambda _model_id, _image: {
            "image": {"width": 100, "height": 80},
            "predictions": [{
                "x": 50, "y": 40, "width": 20, "height": 30,
                "class": "Pet_Bottle",
                "confidence": 0.68,
            }],
        },
        specialist_provider=lambda _image, _object_id: {
            "predictions": {"Plastic Bottle": {"confidence": 0.942}},
            "predicted_classes": ["Plastic Bottle"],
        },
    )
    findings = _findings(
        type("Claim", (), {
            "job_id": "job-001", "attempt_id": "attempt-001",
            "asset_id": "asset-001", "asset_version": "v1",
        })(),
        image,
        result,
    )
    assert result.objects[0].reason_code == "specialist_evidence"
    assert findings["findings"][0]["reasonCode"] == "matched"


def test_result_to_dict_replaces_non_finite_values():
    result = inspect_image(
        image_input(),
        detector_provider=lambda _model_id, _image: detector_response("Pet_Bottle"),
    )
    result.raw_responses["non_finite"] = math.inf
    assert result_to_dict(result)["raw_responses"]["non_finite"] is None


def test_budget_exhaustion_is_not_reported_as_provider_failure():
    result = inspect_image(
        image_input(),
        detector_provider=lambda _model_id, _image: (_ for _ in ()).throw(RuntimeError("budget_exhausted")),
        config=InspectionConfig(total_budget_ms=1000, max_retries=0),
    )
    assert all(outcome.status == "budget_exhausted" for outcome in result.outcomes)
