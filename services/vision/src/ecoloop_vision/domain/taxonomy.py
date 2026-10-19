from __future__ import annotations

from dataclasses import dataclass

from ecoloop_vision.domain.models import DetectionCandidate


@dataclass(frozen=True)
class TaxonomyLabel:
    raw_label: str
    canonical: str | None
    parent: str | None
    specificity: str


def _key(label: str) -> str:
    return " ".join(label.strip().lower().replace("-", " ").replace("_", " ").split())


_LABELS: dict[str, TaxonomyLabel] = {}


def _register(canonical: str | None, parent: str | None, specificity: str, *labels: str) -> None:
    for label in labels:
        _LABELS[_key(label)] = TaxonomyLabel(label, canonical, parent, specificity)


_register("plastic_bottle", "plastic", "specific", "plastic bottle", "plastic_bottle", "pet bottle", "pet_bottle")
_register("aluminium_can", "can", "specific", "aluminium can", "aluminum can", "aluminium_can")
_register("glass_bottle", "glass", "specific", "glass bottle", "glass_bottle")
_register("paper_item", "paper", "specific", "paper", "paper item", "paper_item")
_register("paper_bag", "paper", "specific", "paper bag", "paper_bag")
_register("cardboard_item", "paper", "specific", "cardboard", "cardboard item", "cardboard_item")
_register(None, "can", "generic", "can", "metal can")
_register(None, "glass", "generic", "glass")
_register(None, "cap", "part", "cap", "bottle cap")
_register("unknown", None, "unknown", "unknown", "unlabeled", "other")
_register(None, None, "false_detection", "background", "noise", "false positive", "false_positive")


def classify_label(label: str) -> TaxonomyLabel:
    normalized = _key(label)
    return _LABELS.get(
        normalized,
        TaxonomyLabel(raw_label=label, canonical=None, parent=None, specificity="unsupported"),
    )


def classify_candidate(candidate: DetectionCandidate) -> TaxonomyLabel:
    return classify_label(candidate.raw_label)
