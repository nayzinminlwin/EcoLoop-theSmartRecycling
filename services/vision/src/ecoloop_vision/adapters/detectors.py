from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from inference_sdk import InferenceHTTPClient

from ecoloop_vision.config import ProbeConfig
from ecoloop_vision.domain.models import DetectionCandidate, NormalizedResult
from ecoloop_vision.infrastructure.images import original_box
from ecoloop_vision.logging import emit_event


def run_roboflow(
    *,
    image_path: Path,
    model_id: str,
    config: ProbeConfig,
) -> dict[str, Any]:
    started = time.perf_counter()
    client = InferenceHTTPClient(
        api_url=config.roboflow_api_url,
        api_key=config.roboflow_api_key,
    )
    try:
        response = client.infer(str(image_path), model_id=model_id)
    except Exception as error:
        emit_event(
            event="vision.provider_request",
            provider="roboflow",
            model_id=model_id,
            status="error",
            started_at=started,
            details={"errorType": type(error).__name__},
        )
        raise
    emit_event(
        event="vision.provider_request",
        provider="roboflow",
        model_id=model_id,
        status="success",
        started_at=started,
        details={"responseType": type(response).__name__},
    )
    return {"modelId": model_id, "response": response}


def normalize_detector_response(
    response: Any,
    *,
    model_id: str,
    original_width: int,
    original_height: int,
) -> NormalizedResult:
    payload = _mapping(response)
    image = _mapping(payload.get("image"))
    source_width = _positive_int(image.get("width"), original_width)
    source_height = _positive_int(image.get("height"), original_height)
    model_version = _model_version(payload, model_id)
    predictions = payload.get("predictions", [])
    if not isinstance(predictions, list):
        raise ValueError("Detector predictions must be an array")
    candidates: list[DetectionCandidate] = []
    for index, raw in enumerate(predictions):
        item = _mapping(raw)
        label = item.get("class")
        score = item.get("confidence")
        if not isinstance(label, str) or not label.strip():
            raise ValueError("Detector prediction class must be a non-empty string")
        if not isinstance(score, (int, float)) or not 0 <= score <= 1:
            raise ValueError("Detector confidence must be between zero and one")
        box = original_box(
            x=_number(item, "x"),
            y=_number(item, "y"),
            width=_number(item, "width"),
            height=_number(item, "height"),
            source_width=source_width,
            source_height=source_height,
            original_width=original_width,
            original_height=original_height,
        )
        candidates.append(DetectionCandidate(
            object_id=f"{model_id}:{index}",
            source_id=_string(item.get("inference_id")) or _string(item.get("id")),
            model_id=model_id,
            model_version=model_version,
            raw_label=label,
            class_id=item.get("class_id"),
            score=float(score),
            score_semantics="provider_probability",
            box=box,
        ))
    return NormalizedResult(
        model_id=model_id,
        model_version=model_version,
        candidates=tuple(candidates),
        raw_response=response,
    )


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "dict"):
        result = value.dict()
        if isinstance(result, dict):
            return result
    raise ValueError("Provider response must be an object")


def _model_version(payload: dict[str, Any], model_id: str) -> str | None:
    value = payload.get("version") or payload.get("model_version")
    if value is not None:
        return str(value)
    return model_id.rsplit("/", 1)[-1] if "/" in model_id else None


def _positive_int(value: Any, default: int) -> int:
    return int(value) if isinstance(value, (int, float)) and value > 0 else default


def _number(item: dict[str, Any], key: str) -> float:
    value = item.get(key)
    if not isinstance(value, (int, float)):
        raise ValueError(f"Detector prediction {key} must be numeric")
    return float(value)


def _string(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None
