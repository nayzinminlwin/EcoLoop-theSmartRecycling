from ecoloop_vision.domain.matching import MatchingConfig, intersection_over_union, reconcile_candidates
from ecoloop_vision.domain.models import DetectionCandidate


def candidate(object_id: str, model_id: str, label: str, box: tuple[float, float, float, float], score: float = 0.8):
    return DetectionCandidate(object_id, None, model_id, "1", label, None, score, "provider_probability", box)


def test_duplicate_boxes_match_one_to_one_and_unmatched_candidates_survive():
    groups = reconcile_candidates([
        candidate("a-1", "A", "Pet_Bottle", (0, 0, 10, 10)),
        candidate("b-1", "B", "Plastic bottle", (1, 1, 9, 9)),
        candidate("b-2", "B", "Aluminum can", (20, 0, 30, 10)),
    ])
    assert len(groups) == 2
    assert sorted(len(group.candidates) for group in groups) == [1, 2]


def test_adjacent_touching_objects_are_not_merged_by_overlap_rule():
    groups = reconcile_candidates([
        candidate("a-1", "A", "Pet_Bottle", (0, 0, 10, 10)),
        candidate("b-1", "B", "Plastic bottle", (10, 0, 20, 10)),
    ])
    assert len(groups) == 2
    assert intersection_over_union((0, 0, 10, 10), (10, 0, 20, 10)) == 0


def test_attached_cap_can_match_bottle_but_loose_cap_remains_separate():
    groups = reconcile_candidates([
        candidate("a-1", "A", "Plastic bottle", (0, 0, 10, 20)),
        candidate("b-1", "B", "Bottle cap", (3, 0, 7, 4)),
        candidate("b-2", "B", "Bottle cap", (20, 20, 24, 24)),
    ])
    assert sorted(len(group.candidates) for group in groups) == [1, 2]


def test_geometry_can_group_conflicting_specific_classes_for_resolution():
    groups = reconcile_candidates([
        candidate("a-1", "A", "Plastic bottle", (0, 0, 10, 10)),
        candidate("b-1", "B", "Glass bottle", (1, 1, 9, 9)),
    ], config=MatchingConfig(iou_threshold=0.1))
    assert len(groups) == 1
