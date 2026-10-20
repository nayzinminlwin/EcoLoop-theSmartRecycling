from __future__ import annotations

import json
import os
import secrets
import tempfile
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from ecoloop_vision.adapters.detectors import run_roboflow
from ecoloop_vision.adapters.specialist import run_gemini
from ecoloop_vision.application.inspect_image import inspect_image, result_to_dict
from ecoloop_vision.config import ProbeConfig
from ecoloop_vision.infrastructure.images import decode_image
from ecoloop_vision.application.run_job import run_job
from ecoloop_vision.infrastructure.artifacts import CloudStorageArtifactWriter, LocalArtifactWriter
from ecoloop_vision.infrastructure.job_gateway import JobGateway
from ecoloop_vision.logging import configure_logging


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


@app.post("/tasks/vision")
async def process_task(payload: dict[str, Any]) -> dict[str, Any]:
    job_id = payload.get("jobId")
    if not isinstance(job_id, str) or not job_id:
        raise HTTPException(status_code=400, detail="jobId is required")
    try:
        artifact_bucket = os.getenv("ECOLOOP_ARTIFACT_BUCKET", "").strip()
        if not artifact_bucket:
            raise RuntimeError("ECOLOOP_ARTIFACT_BUCKET is required for task processing")
        writer = CloudStorageArtifactWriter(artifact_bucket)
        result = run_job(
            job_id,
            gateway=JobGateway(),
            artifacts=writer,
        )
        return {"schemaVersion": "backend.v1", "status": "committed", "data": result}
    except Exception as error:
        raise HTTPException(status_code=500, detail="Vision job was not durably accepted") from error


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
    temp_path = Path(tempfile.gettempdir()) / f"probe-{secrets.token_hex(12)}{suffix}"
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
        composed = inspect_image(
            decode_image(content, image.content_type),
            detector_provider=lambda model_id, _image: run_roboflow(
                image_path=temp_path,
                model_id=model_id,
                config=config,
            )["response"],
            specialist_provider=(
                lambda crop, _object_id: _run_crop_roboflow(crop.content, crop.content_type, config)
            ) if enable_roboflow else None,
            gemini_provider=(
                lambda provider_image, _mode, _object_id: _run_gemini_json(provider_image.content, provider_image.content_type, config)
            ) if enable_gemini else None,
        )
        return {
            "traceId": trace_id,
            "image": {
                "sha256": composed.input_sha256,
                "width": width,
                "height": height,
                "bytes": len(content),
                "contentType": image.content_type,
            },
            "inspection": {
                **result_to_dict(composed),
                "inventoryState": composed.inventory_state,
            },
        }
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


def _run_crop_roboflow(content: bytes, content_type: str, config: ProbeConfig) -> Any:
    suffix = _suffix(content_type)
    path = Path(tempfile.gettempdir()) / f"crop-{secrets.token_hex(8)}{suffix}"
    path.write_bytes(content)
    try:
        return run_roboflow(
            image_path=path,
            model_id="waste-classification-rjo28/2",
            config=config,
        )["response"]
    finally:
        path.unlink(missing_ok=True)


def _run_gemini_json(content: bytes, content_type: str, config: ProbeConfig) -> Any:
    suffix = _suffix(content_type)
    path = Path(tempfile.gettempdir()) / f"gemini-{secrets.token_hex(8)}{suffix}"
    path.write_bytes(content)
    try:
        result = run_gemini(image_path=path, config=config)
        return json.loads(result["text"])
    finally:
        path.unlink(missing_ok=True)
