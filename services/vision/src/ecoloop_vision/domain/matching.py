from __future__ import annotations

from dataclasses import dataclass
from math import hypot

from ecoloop_vision.domain.models import Box, DetectionCandidate
from ecoloop_vision.domain.taxonomy import classify_candidate


@dataclass(frozen=True)
class MatchingConfig:
    iou_threshold: float = 0.5
    center_distance_ratio: float = 0.35
    size_ratio_tolerance: float = 2.5


@dataclass(frozen=True)
class CandidateGroup:
    group_id: str
    candidates: tuple[DetectionCandidate, ...]
    box: Box


def intersection_over_union(left: Box, right: Box) -> float:
    intersection = _intersection(left, right)
    if intersection == 0:
        return 0.0
    return intersection / (_area(left) + _area(right) - intersection)


def reconcile_candidates(
    candidates: tuple[DetectionCandidate, ...] | list[DetectionCandidate],
    *,
    config: MatchingConfig = MatchingConfig(),
) -> tuple[CandidateGroup, ...]:
    ordered = sorted(candidates, key=lambda item: (item.object_id, item.model_id, item.raw_label))
    parent = {candidate.object_id: candidate.object_id for candidate in ordered}
    models = {candidate.object_id: {candidate.model_id} for candidate in ordered}
    pairs: list[tuple[float, str, str]] = []
    for index, left in enumerate(ordered):
        for right in ordered[index + 1:]:
            if left.model_id == right.model_id or not _compatible(left, right):
                continue
            score = _match_score(left, right, config)
            if score is not None:
                pairs.append((score, left.object_id, right.object_id))
    for _, left_id, right_id in sorted(pairs, key=lambda item: (-item[0], item[1], item[2])):
        left_root = _root(parent, left_id)
        right_root = _root(parent, right_id)
        if left_root != right_root and models[left_root].isdisjoint(models[right_root]):
            parent[right_root] = left_root
            models[left_root].update(models[right_root])

    grouped: dict[str, list[DetectionCandidate]] = {}
    for candidate in ordered:
        grouped.setdefault(_root(parent, candidate.object_id), []).append(candidate)
    return tuple(
        CandidateGroup(
            group_id=f"object-{index:04d}",
            candidates=tuple(items),
            box=_enclosing_box(tuple(item.box for item in items)),
        )
        for index, items in enumerate(sorted(grouped.values(), key=lambda group: group[0].object_id), start=1)
    )


def _compatible(left: DetectionCandidate, right: DetectionCandidate) -> bool:
    left_label = classify_candidate(left)
    right_label = classify_candidate(right)
    if left_label.specificity == "false_detection" or right_label.specificity == "false_detection":
        return False
    if left_label.specificity == "part" or right_label.specificity == "part":
        cap = left if left_label.specificity == "part" else right
        object_candidate = right if cap is left else left
        return classify_candidate(object_candidate).parent == "plastic"
    if left_label.canonical and right_label.canonical:
        return True
    if left_label.parent and right_label.parent:
        return left_label.parent == right_label.parent
    specific = left_label if left_label.canonical else right_label
    generic = right_label if left_label.canonical else left_label
    return specific.parent == generic.parent


def _match_score(left: DetectionCandidate, right: DetectionCandidate, config: MatchingConfig) -> float | None:
    if _is_attached_cap(left, right) or _is_attached_cap(right, left):
        return 1.0
    overlap = intersection_over_union(left.box, right.box)
    if overlap < config.iou_threshold:
        return None
    left_center = _center(left.box)
    right_center = _center(right.box)
    center_distance = hypot(left_center[0] - right_center[0], left_center[1] - right_center[1])
    diagonal = max(hypot(left.box[2] - left.box[0], left.box[3] - left.box[1]), 1e-9)
    if center_distance / diagonal > config.center_distance_ratio:
        return None
    left_area = max(_area(left.box), 1e-9)
    right_area = max(_area(right.box), 1e-9)
    if max(left_area, right_area) / min(left_area, right_area) > config.size_ratio_tolerance:
        return None
    return overlap


def _is_attached_cap(cap: DetectionCandidate, bottle: DetectionCandidate) -> bool:
    cap_label = classify_candidate(cap)
    bottle_label = classify_candidate(bottle)
    if cap_label.specificity != "part" or bottle_label.canonical != "plastic_bottle":
        return False
    cap_center = _center(cap.box)
    bottle_height = bottle.box[3] - bottle.box[1]
    return (
        bottle.box[0] <= cap_center[0] <= bottle.box[2]
        and bottle.box[1] <= cap_center[1] <= bottle.box[1] + bottle_height * 0.35
    )


def _root(parent: dict[str, str], value: str) -> str:
    while parent[value] != value:
        parent[value] = parent[parent[value]]
        value = parent[value]
    return value


def _center(box: Box) -> tuple[float, float]:
    return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)


def _area(box: Box) -> float:
    return max(0.0, box[2] - box[0]) * max(0.0, box[3] - box[1])


def _intersection(left: Box, right: Box) -> float:
    width = max(0.0, min(left[2], right[2]) - max(left[0], right[0]))
    height = max(0.0, min(left[3], right[3]) - max(left[1], right[1]))
    return width * height


def _enclosing_box(boxes: tuple[Box, ...]) -> Box:
    return (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )
