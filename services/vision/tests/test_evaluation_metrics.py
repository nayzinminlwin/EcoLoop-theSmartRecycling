from ecoloop_vision.tools.evaluate import evaluate_manifest, match_objects, score_case, validate_manifest


def box(x1: float, y1: float, x2: float, y2: float) -> dict[str, float]:
    return {"x1": x1, "y1": y1, "x2": x2, "y2": y2}


def annotation(label: str = "plastic_bottle") -> dict:
    return {"objectId": "img-0001-object-01", "bbox": box(0.1, 0.1, 0.4, 0.4), "label": label, "eligibility": "eligible", "difficulty": "clear"}


def frozen_manifest() -> dict:
    return {
        "datasetVersion": "evaluation-2026-10-19-v1",
        "purpose": "evaluation-only",
        "status": "frozen",
        "counts": {"inventoried": 1, "labeled": 1, "development": 0, "frozenEvaluation": 1, "secondReviewed": 1},
        "images": [{
            "imageId": "img-0001", "sceneGroupId": "scene-1", "split": "frozen-evaluation",
            "annotationStatus": "frozen", "category": "clear", "annotations": [annotation()],
        }],
    }


def test_matching_is_one_to_one_and_counts_false_positive():
    matches = match_objects(
        [annotation()],
        [annotation(), {**annotation(), "objectId": "extra", "bbox": box(0.7, 0.7, 0.9, 0.9)}],
    )
    assert len(matches) == 1
    assert score_case([annotation()], [annotation(), {"bbox": box(0.7, 0.7, 0.9, 0.9)}])["falsePositiveCount"] == 1


def test_wrong_label_is_not_rewarded_as_correct():
    result = score_case([annotation()], [{**annotation(), "label": "paper_bag"}])
    assert result["matchedCount"] == 1
    assert result["wrongLabelCount"] == 1
    assert result["autoCompleted"] is False


def test_manifest_validation_requires_frozen_reviewed_inputs():
    report = evaluate_manifest(frozen_manifest())
    assert report["status"] == "READY"
    assert report["sampleSize"] == 1
    assert validate_manifest(frozen_manifest()) == []

    incomplete = frozen_manifest()
    incomplete["images"][0]["annotationStatus"] = "first-reviewed"
    incomplete["counts"]["secondReviewed"] = 0
    assert evaluate_manifest(incomplete)["status"] == "BLOCKED"
