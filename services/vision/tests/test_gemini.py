from ecoloop_vision.adapters.gemini import validate_gemini_response


def test_crop_response_labels_existing_candidate_once():
    result = validate_gemini_response(
        {"objects": [{"label": "plastic_bottle", "count": 1, "candidateId": "object-0001",
                      "box": {"x1": 0.1, "y1": 0.2, "x2": 0.8, "y2": 0.9}}]},
        mode="crop",
        candidate_id="object-0001",
    )
    assert result.status == "resolved"
    assert result.findings[0].candidate_id == "object-0001"
    assert result.findings[0].count == 1


def test_crop_ignores_provider_geometry_because_crop_coordinates_are_not_used():
    result = validate_gemini_response(
        {"objects": [{"label": "plastic_bottle", "count": 1, "confidence": 0.95,
                      "candidateId": "object-0001",
                      "box": {"x1": 12, "y1": 18, "x2": 96, "y2": 120}}]},
        mode="crop",
        candidate_id="object-0001",
    )
    assert result.status == "resolved"
    assert result.findings[0].box is None


def test_full_image_inventory_expands_distinct_objects_without_detector_agreement():
    result = validate_gemini_response(
        {"objects": [
            {"label": "plastic_bottle", "count": 2},
            {"label": "cardboard_item", "count": 1},
        ]},
        mode="full_image",
    )
    assert result.status == "resolved"
    assert [finding.count for finding in result.findings] == [2, 1]


def test_invalid_or_unsupported_fallback_is_explicitly_unresolved():
    invalid = validate_gemini_response(
        {"objects": [{"label": "metal_can", "count": 1}]},
        mode="full_image",
    )
    assert invalid.status == "unresolved"
    assert invalid.reason_code == "unsupported_or_invalid_label"

    mismatch = validate_gemini_response(
        {"objects": [{"label": "plastic_bottle", "count": 1, "candidateId": "other"}]},
        mode="crop",
        candidate_id="object-0001",
    )
    assert mismatch.reason_code == "candidate_identity_mismatch"


def test_empty_inventory_is_not_accepted_as_empty_batch():
    result = validate_gemini_response({"objects": []}, mode="full_image")
    assert result.status == "unresolved"
    assert result.reason_code == "empty_inventory_requires_review"
