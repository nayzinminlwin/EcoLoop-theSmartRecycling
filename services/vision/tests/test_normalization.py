import io

import pytest
from PIL import Image

from ecoloop_vision.adapters.detectors import normalize_detector_response
from ecoloop_vision.adapters.specialist import normalize_specialist_response
from ecoloop_vision.infrastructure.images import decode_image, original_box


def test_decode_image_retains_dimensions_and_hash():
    stream = io.BytesIO()
    Image.new("RGB", (574, 348), "white").save(stream, format="JPEG")
    image = decode_image(stream.getvalue(), "image/jpeg")
    assert (image.width, image.height) == (574, 348)
    assert len(image.sha256) == 64


def test_detector_normalization_converts_provider_pixels_to_original_pixels():
    result = normalize_detector_response(
        {
            "version": 6,
            "image": {"width": 287, "height": 174},
            "predictions": [{
                "x": 143.5, "y": 87, "width": 50, "height": 40,
                "class": "Pet_Bottle", "class_id": 3, "confidence": 0.7411,
                "inference_id": "inference-1",
            }],
        },
        model_id="waste-detection-0momv/6",
        original_width=574,
        original_height=348,
    )
    candidate = result.candidates[0]
    assert candidate.raw_label == "Pet_Bottle"
    assert candidate.source_id == "inference-1"
    assert candidate.box == (287.0, 174.0, 387.0, 254.0)
    assert candidate.score == pytest.approx(0.7411)


def test_specialist_preserves_multilabel_vector_without_creating_objects():
    result = normalize_specialist_response(
        {"class_scores": {"Plastic Bottle": 0.9389400482177734, "Can": 0.02},
         "predicted_classes": ["Plastic Bottle"]},
        model_id="waste-classification-rjo28/2",
    )
    assert result.score_vector is not None
    assert result.score_vector.predicted_classes == ("Plastic Bottle",)
    assert result.candidates == ()
    assert result.score_vector.scores["Can"] == pytest.approx(0.02)


def test_invalid_geometry_and_letterbox_are_rejected_or_inverted():
    with pytest.raises(ValueError):
        original_box(x=0, y=0, width=-1, height=2, source_width=10, source_height=10,
                     original_width=10, original_height=10)
    assert original_box(x=20, y=30, width=20, height=20, source_width=100, source_height=100,
                        original_width=10, original_height=10,
                        letterbox={"scale": 2, "pad_x": 10, "pad_y": 10}) == (5.0, 10.0, 10.0, 10.0)
