from __future__ import annotations

import time
import mimetypes
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from ecoloop_vision.config import ProbeConfig
from ecoloop_vision.domain.models import NormalizedResult, ScoreVector
from ecoloop_vision.logging import emit_event


def run_gemini(
    *,
    image_path: Path,
    config: ProbeConfig,
    mode: str = "full_image",
    candidate_id: str | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    client = genai.Client(api_key=config.gemini_api_key)
    try:
        response = client.models.generate_content(
            model=config.gemini_model,
            contents=[
                types.Part.from_bytes(
                    data=image_path.read_bytes(),
                    mime_type=mimetypes.guess_type(image_path.name)[0] or "image/jpeg",
                ),
                _prompt(mode, candidate_id),
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema={
                    "type": "OBJECT",
                    "properties": {
                        "objects": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "label": {"type": "STRING"},
                                    "count": {"type": "INTEGER"},
                                    "confidence": {"type": "NUMBER"},
                                    "candidateId": {"type": "STRING"},
                                    "box": {
                                        "type": "OBJECT",
                                        "properties": {
                                            "x1": {"type": "NUMBER"}, "y1": {"type": "NUMBER"},
                                            "x2": {"type": "NUMBER"}, "y2": {"type": "NUMBER"},
                                        },
                                    },
                                    "notes": {"type": "STRING"},
                                },
                                "required": ["label", "count", "confidence"],
                            },
                        },
                    },
                    "required": ["objects"],
                },
            ),
        )
    except Exception as error:
        emit_event(
            event="vision.provider_request",
            provider="gemini",
            model_id=config.gemini_model,
            status="error",
            started_at=started,
            details={"errorType": type(error).__name__},
        )
        raise
    emit_event(
        event="vision.provider_request",
        provider="gemini",
        model_id=config.gemini_model,
        status="success",
        started_at=started,
        details={"responseType": type(response).__name__},
    )
    return {
        "modelId": config.gemini_model,
        "text": response.text,
        "usageMetadata": _usage_metadata(response),
    }


def _prompt(mode: str, candidate_id: str | None) -> str:
    labels = "plastic_bottle, aluminium_can, glass_bottle, paper_item, paper_bag, cardboard_item, unknown"
    if mode == "crop":
        return (
            f"Inspect only the supplied crop for candidate {candidate_id or 'unknown'}. "
            f"Return exactly one physical object or an unresolved empty list. Allowed canonical labels: {labels}. "
            "Use count=1, include confidence from 0 to 1 and candidateId when resolving. Do not infer hidden objects."
        )
    return (
        f"Inventory the supplied pixels one physical object per item. Allowed canonical labels: {labels}. "
        "Return bounded JSON with distinct objects, count=1 for each object, normalized box when visible, "
        "and confidence from 0 to 1. Box coordinates must be normalized decimals from 0 to 1, never 0-1000. "
        "Do not use filenames, display labels, expected answers, or hidden objects."
    )


def _usage_metadata(response: Any) -> dict[str, Any] | None:
    metadata = getattr(response, "usage_metadata", None)
    if metadata is None:
        return None
    return {
        "promptTokenCount": getattr(metadata, "prompt_token_count", None),
        "candidatesTokenCount": getattr(metadata, "candidates_token_count", None),
        "totalTokenCount": getattr(metadata, "total_token_count", None),
    }


def normalize_specialist_response(
    response: Any,
    *,
    model_id: str,
) -> NormalizedResult:
    if not isinstance(response, dict):
        raise ValueError("Specialist response must be an object")
    raw_scores = response.get("class_scores", response.get("scores", {}))
    if not isinstance(raw_scores, dict):
        raise ValueError("Specialist class scores must be an object")
    scores: dict[str, float] = {}
    for label, value in raw_scores.items():
        if not isinstance(label, str) or not isinstance(value, (int, float)) or not 0 <= value <= 1:
            raise ValueError("Specialist scores must map labels to probabilities")
        scores[label] = float(value)
    predicted = response.get("predicted_classes", [])
    if not isinstance(predicted, list) or not all(isinstance(label, str) for label in predicted):
        raise ValueError("Specialist predicted_classes must be an array of strings")
    model_version = str(response["version"]) if response.get("version") is not None else (
        model_id.rsplit("/", 1)[-1] if "/" in model_id else None
    )
    return NormalizedResult(
        model_id=model_id,
        model_version=model_version,
        score_vector=ScoreVector(
            model_id=model_id,
            model_version=model_version,
            predicted_classes=tuple(predicted),
            scores=scores,
            score_semantics="provider_probability",
        ),
        raw_response=response,
    )
