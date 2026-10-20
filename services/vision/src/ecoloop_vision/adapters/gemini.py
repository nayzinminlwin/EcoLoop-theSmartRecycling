from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal

from ecoloop_vision.domain.models import Box
from ecoloop_vision.infrastructure.contract_validation import validate_normalized_box

ALLOWED_LABELS = frozenset({
    "plastic_bottle",
    "aluminium_can",
    "glass_bottle",
    "paper_item",
    "paper_bag",
    "cardboard_item",
    "unknown",
})


@dataclass(frozen=True)
class GeminiFinding:
    label: str
    count: int
    notes: str | None
    box: Box | None
    candidate_id: str | None
    confidence: float


@dataclass(frozen=True)
class GeminiResult:
    mode: Literal["crop", "full_image"]
    findings: tuple[GeminiFinding, ...]
    model_id: str
    prompt_version: str
    usage_metadata: dict[str, Any] | None
    status: Literal["resolved", "unresolved", "error"]
    reason_code: str | None = None


def validate_gemini_response(
    response: Any,
    *,
    mode: Literal["crop", "full_image"],
    model_id: str = "gemini-3.8-flash",
    prompt_version: str = "inventory-v1",
    candidate_id: str | None = None,
    max_objects: int = 12,
) -> GeminiResult:
    try:
        payload = _object(response)
    except ValueError:
        return _unresolved(mode, model_id, prompt_version, "invalid_json")
    raw_objects = payload.get("objects")
    if not isinstance(raw_objects, list) or len(raw_objects) > max_objects:
        return _unresolved(mode, model_id, prompt_version, "invalid_schema")
    findings: list[GeminiFinding] = []
    for raw in raw_objects:
        if not isinstance(raw, dict):
            return _unresolved(mode, model_id, prompt_version, "invalid_object")
        label = raw.get("label")
        count = raw.get("count")
        if label not in ALLOWED_LABELS or not isinstance(count, int) or isinstance(count, bool) or count < 1:
            return _unresolved(mode, model_id, prompt_version, "unsupported_or_invalid_label")
        object_candidate_id = raw.get("candidateId")
        if object_candidate_id is not None and not isinstance(object_candidate_id, str):
            return _unresolved(mode, model_id, prompt_version, "invalid_candidate_identity")
        if mode == "crop" and count != 1:
            return _unresolved(mode, model_id, prompt_version, "crop_count_must_be_one")
        if mode == "crop" and candidate_id is not None and object_candidate_id not in (None, candidate_id):
            return _unresolved(mode, model_id, prompt_version, "candidate_identity_mismatch")
        box = _box(raw.get("box"))
        if raw.get("box") is not None and box is None:
            return _unresolved(mode, model_id, prompt_version, "invalid_geometry")
        notes = raw.get("notes")
        confidence = raw.get("confidence", 1.0)
        if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not 0 <= confidence <= 1:
            return _unresolved(mode, model_id, prompt_version, "invalid_confidence")
        if float(confidence) < 0.90:
            return _unresolved(mode, model_id, prompt_version, "low_confidence")
        findings.append(GeminiFinding(
            label=label,
            count=count,
            notes=notes if isinstance(notes, str) else None,
            box=box,
            candidate_id=object_candidate_id or candidate_id,
            confidence=float(confidence),
        ))
    return GeminiResult(
        mode=mode,
        findings=tuple(findings),
        model_id=model_id,
        prompt_version=prompt_version,
        usage_metadata=_usage_metadata(payload.get("usageMetadata")),
        status="resolved" if findings else "unresolved",
        reason_code=None if findings else "empty_inventory_requires_review",
    )


def _object(response: Any) -> dict[str, Any]:
    if isinstance(response, str):
        try:
            response = json.loads(response)
        except json.JSONDecodeError as error:
            raise ValueError("Gemini response is not valid JSON") from error
    if not isinstance(response, dict):
        raise ValueError("Gemini response must be an object")
    return response


def _box(value: Any) -> Box | None:
    if not isinstance(value, dict):
        return None
    try:
        box = {key: float(value[key]) for key in ("x1", "y1", "x2", "y2")}
        validate_normalized_box(box)
    except (KeyError, TypeError, ValueError):
        return None
    if any(value < 0 or value > 1 for value in box.values()):
        return None
    return (box["x1"], box["y1"], box["x2"], box["y2"])


def _usage_metadata(value: Any) -> dict[str, Any] | None:
    return dict(value) if isinstance(value, dict) else None


def _unresolved(mode: Literal["crop", "full_image"], model_id: str, prompt_version: str, reason: str) -> GeminiResult:
    return GeminiResult(
        mode=mode,
        findings=(),
        model_id=model_id,
        prompt_version=prompt_version,
        usage_metadata=None,
        status="unresolved",
        reason_code=reason,
    )
