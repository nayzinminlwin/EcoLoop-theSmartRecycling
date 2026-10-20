from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Box = tuple[float, float, float, float]


@dataclass(frozen=True)
class DetectionCandidate:
    object_id: str
    source_id: str | None
    model_id: str
    model_version: str | None
    raw_label: str
    class_id: str | int | None
    score: float
    score_semantics: Literal["provider_probability", "provider_score"]
    box: Box


@dataclass(frozen=True)
class ScoreVector:
    model_id: str
    model_version: str | None
    predicted_classes: tuple[str, ...]
    scores: dict[str, float]
    score_semantics: Literal["provider_probability", "provider_score"]


@dataclass(frozen=True)
class ProcessingInput:
    content: bytes
    content_type: str
    sha256: str
    width: int
    height: int


@dataclass(frozen=True)
class NormalizedResult:
    model_id: str
    model_version: str | None
    candidates: tuple[DetectionCandidate, ...] = ()
    score_vector: ScoreVector | None = None
    raw_response: object | None = None
    error: str | None = None


@dataclass(frozen=True)
class StageOutcome:
    stage: str
    status: Literal["success", "unresolved", "provider_error", "invalid_response", "budget_exhausted", "review_required"]
    reason_code: str | None = None
    error_type: str | None = None
