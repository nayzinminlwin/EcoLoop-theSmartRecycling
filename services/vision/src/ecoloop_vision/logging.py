from __future__ import annotations

import json
import logging
import time
from contextvars import ContextVar
from collections.abc import Mapping
from typing import Any


LOGGER = logging.getLogger("ecoloop_vision")
_context: ContextVar[dict[str, Any]] = ContextVar("ecoloop_vision_context", default={})


def set_context(**fields: Any) -> None:
    _context.set({key: value for key, value in fields.items() if value is not None})


def clear_context() -> None:
    _context.set({})


def _redact(value: Any, key: str | None = None, depth: int = 0) -> Any:
    if depth > 4:
        return "[truncated]"
    if key and any(marker in key.lower() for marker in ("token", "authorization", "api_key", "secret", "password", "voucher")):
        return "[REDACTED]"
    if isinstance(value, str):
        import re
        return re.sub(r"([?&](?:token|key|signature|sig|auth|code)=)[^&]*", r"\1[REDACTED]", value, flags=re.IGNORECASE)
    if isinstance(value, Mapping):
        return {str(entry_key): _redact(entry_value, str(entry_key), depth + 1) for entry_key, entry_value in list(value.items())[:64]}
    if isinstance(value, list):
        return [_redact(entry, depth=depth + 1) for entry in value[:32]]
    return value


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
        **_context.get(),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "severity": "INFO",
        "event": event,
        "service": "ecoloop-vision",
        "provider": provider,
        "modelId": model_id,
        "status": status,
        "latencyMs": round((time.perf_counter() - started_at) * 1000, 2),
        "schemaVersion": 1,
    }
    if details:
        payload["details"] = _redact(details)
    LOGGER.info(json.dumps(payload, ensure_ascii=True, default=str))


def emit_structured(
    *,
    level: int,
    event: str,
    fields: Mapping[str, Any] | None = None,
    error: BaseException | None = None,
) -> None:
    payload: dict[str, Any] = {
        **_context.get(),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
        "severity": logging.getLevelName(level),
        "event": event,
        "service": "ecoloop-vision",
        "schemaVersion": 1,
    }
    if fields:
        payload.update(_redact(fields))
    if error is not None:
        payload["errorCode"] = type(error).__name__
        payload["errorMessage"] = str(error)[:240]
    LOGGER.log(level, json.dumps(payload, ensure_ascii=True, default=str))
