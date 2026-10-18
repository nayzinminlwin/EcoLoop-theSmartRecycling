from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from inference_sdk import InferenceHTTPClient

from ecoloop_vision.config import ProbeConfig
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
