from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from ecoloop_vision.config import ProbeConfig
from ecoloop_vision.logging import emit_event


def run_gemini(
    *,
    image_path: Path,
    config: ProbeConfig,
) -> dict[str, Any]:
    started = time.perf_counter()
    client = genai.Client(api_key=config.gemini_api_key)
    try:
        response = client.models.generate_content(
            model=config.gemini_model,
            contents=[
                types.Part.from_bytes(
                    data=image_path.read_bytes(),
                    mime_type="image/jpeg",
                ),
                (
                    "Return a structured inventory of visible waste objects in this "
                    "image. Use one object per physical item. Allowed labels are "
                    "plastic_bottle, metal_can, glass_bottle, paper, cardboard, "
                    "other, or unknown. Do not infer hidden objects."
                ),
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
                                    "notes": {"type": "STRING"},
                                },
                                "required": ["label", "count"],
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


def _usage_metadata(response: Any) -> dict[str, Any] | None:
    metadata = getattr(response, "usage_metadata", None)
    if metadata is None:
        return None
    return {
        "promptTokenCount": getattr(metadata, "prompt_token_count", None),
        "candidatesTokenCount": getattr(metadata, "candidates_token_count", None),
        "totalTokenCount": getattr(metadata, "total_token_count", None),
    }
