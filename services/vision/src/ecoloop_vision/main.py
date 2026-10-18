from __future__ import annotations

import hashlib
import secrets
import time
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from ecoloop_vision.adapters.detectors import run_roboflow
from ecoloop_vision.adapters.specialist import run_gemini
from ecoloop_vision.config import ProbeConfig
from ecoloop_vision.logging import configure_logging, emit_event


MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
app = FastAPI(title="EcoLoop Vision Orchestrator", version="0.1.0")
configure_logging()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "ecoloop-vision"}


@app.get("/health")
def health() -> dict[str, str]:
    return healthz()


@app.post("/operator/probe")
async def operator_probe(
    image: Annotated[UploadFile, File(...)],
    enable_roboflow: Annotated[bool, Form()] = True,
    enable_gemini: Annotated[bool, Form()] = True,
) -> dict:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported image content type")
    if not enable_roboflow and not enable_gemini:
        raise HTTPException(status_code=400, detail="At least one provider is required")

    content = await image.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds 10 MiB limit")
    suffix = _suffix(image.content_type)
    temp_path = Path("/tmp") / f"probe-{secrets.token_hex(12)}{suffix}"
    temp_path.write_bytes(content)
    try:
        try:
            with Image.open(temp_path) as decoded:
                width, height = decoded.size
                decoded.verify()
        except (UnidentifiedImageError, OSError) as error:
            raise HTTPException(status_code=400, detail="Invalid image data") from error

        config = ProbeConfig.from_environment()
        trace_id = _trace_id()
        result = {
            "traceId": trace_id,
            "image": {
                "sha256": hashlib.sha256(content).hexdigest(),
                "width": width,
                "height": height,
                "bytes": len(content),
                "contentType": image.content_type,
            },
            "providers": {},
        }
        if enable_roboflow:
            for role, model_id in (
                ("A", "waste-detection-0momv/6"),
                ("B", "yolo-waste-detection/1"),
                ("D", "waste-classification-rjo28/2"),
            ):
                started = time.perf_counter()
                try:
                    response = run_roboflow(
                        image_path=temp_path,
                        model_id=model_id,
                        config=config,
                    )
                    result["providers"][role] = {
                        "status": "success",
                        "modelId": model_id,
                        "response": response["response"],
                    }
                except Exception as error:
                    result["providers"][role] = {
                        "status": "error",
                        "modelId": model_id,
                        **_safe_error(error),
                    }
                emit_event(
                    event="vision.operator_probe_completed",
                    provider="roboflow",
                    model_id=model_id,
                    status=result["providers"][role]["status"],
                    started_at=started,
                    details={"traceId": trace_id},
                )
        if enable_gemini:
            started = time.perf_counter()
            try:
                result["providers"]["Gemini"] = {
                    "status": "success",
                    **run_gemini(image_path=temp_path, config=config),
                }
            except Exception as error:
                result["providers"]["Gemini"] = {
                    "status": "error",
                    "modelId": config.gemini_model,
                    **_safe_error(error),
                }
            emit_event(
                event="vision.operator_probe_completed",
                provider="gemini",
                model_id=config.gemini_model,
                status=result["providers"]["Gemini"]["status"],
                started_at=started,
                details={"traceId": trace_id},
            )
        return result
    finally:
        temp_path.unlink(missing_ok=True)


def _suffix(content_type: str | None) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(content_type or "", ".img")


def _trace_id() -> str:
    return secrets.token_hex(16)


def _safe_error(error: Exception) -> dict[str, str]:
    message = " ".join(str(error).split())
    for marker in ("api_key=", "Authorization: Bearer "):
        if marker in message:
            message = message.split(marker, 1)[0] + marker + "<redacted>"
    return {
        "errorType": type(error).__name__,
        "errorMessage": message[:500],
    }
