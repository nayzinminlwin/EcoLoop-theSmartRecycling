from ecoloop_vision.domain.matching import reconcile_candidates
from ecoloop_vision.domain.models import DetectionCandidate
from ecoloop_vision.domain.resolution import aggregate_counts, resolve_groups
from ecoloop_vision.domain.taxonomy import classify_label


def candidate(object_id: str, model_id: str, label: str):
    return DetectionCandidate(object_id, None, model_id, "1", label, None, 0.8, "provider_probability", (0, 0, 10, 10))


def test_taxonomy_preserves_specificity_and_generic_materials():
    assert classify_label("Pet_Bottle").canonical == "plastic_bottle"
    assert classify_label("can").canonical is None
    assert classify_label("can").parent == "can"
    assert classify_label("cardboard").canonical == "cardboard_item"


def test_resolution_is_conservative_and_separates_eligibility():
    groups = reconcile_candidates([
        candidate("a-1", "A", "Pet_Bottle"),
        candidate("a-2", "A", "cardboard"),
        candidate("a-3", "A", "can"),
        candidate("a-4", "A", "false_positive"),
    ])
    resolved = resolve_groups(groups)
    by_label = {item.raw_labels[0]: item for item in resolved}
    assert by_label["Pet_Bottle"].resolution == "plastic_bottle"
    assert by_label["Pet_Bottle"].eligibility == "eligible"
    assert by_label["cardboard"].resolution == "cardboard_item"
    assert by_label["cardboard"].eligibility == "excluded"
    assert by_label["can"].eligibility == "unresolved"
    assert by_label["false_positive"].reason_code == "false_detection"


def test_conflicting_specific_evidence_is_reviewable_not_majority_voted():
    groups = reconcile_candidates([
        candidate("a-1", "A", "Plastic bottle"),
        candidate("b-1", "B", "Glass bottle"),
    ],)
    resolved = resolve_groups(groups)
    assert len(resolved) == 1
    assert resolved[0].eligibility == "unresolved"
    assert resolved[0].reason_code == "ambiguous"


def test_counts_are_derived_from_objects_and_exclude_tested_false_detections():
    resolved = resolve_groups(reconcile_candidates([
        candidate("a-1", "A", "Pet_Bottle"),
        candidate("a-2", "A", "cardboard"),
        candidate("a-3", "A", "false_positive"),
    ]))
    assert aggregate_counts(resolved) == {"plastic_bottle": 1, "cardboard_item": 1}
