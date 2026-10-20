import io

from PIL import Image

from ecoloop_vision.domain.models import ProcessingInput
from ecoloop_vision.infrastructure.images import crop_candidate


def image_input() -> ProcessingInput:
    stream = io.BytesIO()
    Image.new("RGB", (100, 80), "white").save(stream, format="PNG")
    return ProcessingInput(stream.getvalue(), "image/png", "unused", 100, 80)


def test_crop_preserves_source_identity_and_bounded_padding():
    crop, metadata = crop_candidate(
        image_input(),
        object_id="object-0001",
        box=(20, 20, 60, 60),
        padding_ratio=0.1,
    )
    assert metadata.source_object_id == "object-0001"
    assert metadata.source_box == (20, 20, 60, 60)
    assert metadata.crop_box == (16.0, 16.0, 64.0, 64.0)
    assert (crop.width, crop.height) == (48, 48)


def test_crop_rejects_unbounded_padding():
    try:
        crop_candidate(image_input(), object_id="object-0001", box=(1, 1, 10, 10), padding_ratio=0.3)
    except ValueError as error:
        assert "padding" in str(error)
    else:
        raise AssertionError("Expected oversized padding to fail")
