from __future__ import annotations

import json
import logging
import time
from collections.abc import Mapping
from typing import Any


LOGGER = logging.getLogger("ecoloop_vision")


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
    )


def emit_event(
    *,
    event: str,
    provider: str,
    model_id: str,
    status: str,
    started_at: float,
    details: Mapping[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {
        "event": event,
        "provider": provider,
        "modelId": model_id,
        "status": status,
        "latencyMs": round((time.perf_counter() - started_at) * 1000, 2),
    }
    if details:
        payload["details"] = dict(details)
    LOGGER.info(json.dumps(payload, ensure_ascii=True, default=str))
