from __future__ import annotations

from dataclasses import dataclass

from ecoloop_vision.domain.matching import CandidateGroup
from ecoloop_vision.domain.models import Box
from ecoloop_vision.domain.taxonomy import TaxonomyLabel, classify_candidate

ELIGIBLE_CLASSES = frozenset({"plastic_bottle", "aluminium_can", "glass_bottle", "paper_item", "paper_bag"})


@dataclass(frozen=True)
class ResolvedObject:
    object_id: str
    resolution: str
    eligibility: str
    box: Box
    normalized_box: Box
    model_ids: tuple[str, ...]
    raw_labels: tuple[str, ...]
    confidence: float
    rule_id: str
    reason_code: str


def resolve_groups(
    groups: tuple[CandidateGroup, ...] | list[CandidateGroup],
    *,
    image_width: int | None = None,
    image_height: int | None = None,
) -> tuple[ResolvedObject, ...]:
    return tuple(resolve_group(group, image_width=image_width, image_height=image_height) for group in groups)


def aggregate_counts(objects: tuple[ResolvedObject, ...] | list[ResolvedObject]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in objects:
        if item.reason_code == "false_detection":
            continue
        counts[item.resolution] = counts.get(item.resolution, 0) + 1
    return counts


def resolve_group(
    group: CandidateGroup,
    *,
    image_width: int | None = None,
    image_height: int | None = None,
) -> ResolvedObject:
    labels = tuple(classify_candidate(candidate) for candidate in group.candidates)
    specific = {label.canonical for label in labels if label.canonical and label.specificity == "specific"}
    false_detection = any(label.specificity == "false_detection" for label in labels)
    if false_detection:
        return _result(group, "unknown", "excluded", "false_detection", "rule.false_detection", labels, image_width, image_height)
    if len(specific) > 1:
        return _result(group, "unknown", "unresolved", "ambiguous", "rule.conflicting_specific_labels", labels, image_width, image_height)
    canonical = next(iter(specific), None)
    if canonical is None:
        return _result(group, "unknown", "unresolved", "unsupported_label", "rule.no_specific_subtype", labels, image_width, image_height)
    if canonical == "unknown":
        return _result(group, "unknown", "unresolved", "unsupported_label", "rule.unknown_label", labels, image_width, image_height)
    eligible = "eligible" if canonical in ELIGIBLE_CLASSES else "excluded"
    return _result(group, canonical, eligible, "matched", "rule.specific_taxonomy", labels, image_width, image_height)


def _result(
    group: CandidateGroup,
    resolution: str,
    eligibility: str,
    reason_code: str,
    rule_id: str,
    labels: tuple[TaxonomyLabel, ...],
    image_width: int | None,
    image_height: int | None,
) -> ResolvedObject:
    normalized_box = _normalize_box(group.box, image_width, image_height)
    return ResolvedObject(
        object_id=group.group_id,
        resolution=resolution,
        eligibility=eligibility,
        box=group.box,
        normalized_box=normalized_box,
        model_ids=tuple(dict.fromkeys(candidate.model_id for candidate in group.candidates)),
        raw_labels=tuple(candidate.raw_label for candidate in group.candidates),
        confidence=max(candidate.score for candidate in group.candidates),
        rule_id=rule_id,
        reason_code=reason_code,
    )


def _normalize_box(box: Box, image_width: int | None, image_height: int | None) -> Box:
    if image_width is None or image_height is None:
        return box
    if image_width <= 0 or image_height <= 0:
        raise ValueError("Image dimensions must be positive")
    return (
        box[0] / image_width,
        box[1] / image_height,
        box[2] / image_width,
        box[3] / image_height,
    )
