from __future__ import annotations

import hashlib
import json
import os
import time
from collections.abc import Callable, Mapping
from dataclasses import replace
from datetime import datetime, timezone
from typing import Any, Protocol
from google.cloud import storage

from ecoloop_vision.application.inspect_image import InspectionConfig, InspectionResult, inspect_image
from ecoloop_vision.config import ProbeConfig
from ecoloop_vision.domain.models import ProcessingInput
from ecoloop_vision.infrastructure.artifacts import ArtifactWriter
from ecoloop_vision.infrastructure.images import decode_image
from ecoloop_vision.infrastructure.job_gateway import JobClaim, JobGateway
from ecoloop_vision.logging import clear_context, emit_structured, set_context


class SourceLoader(Protocol):
    def __call__(self, claim: JobClaim) -> ProcessingInput: ...


class InspectionRunner(Protocol):
    def __call__(self, image: ProcessingInput, config: InspectionConfig) -> InspectionResult: ...


def load_committed_source(claim: JobClaim) -> ProcessingInput:
    if not claim.storage_path or not claim.storage_generation:
        raise RuntimeError("Committed source path and generation are required")
    bucket_name = os.getenv("ECOLOOP_SOURCE_BUCKET", "").strip()
    if not bucket_name:
        raise RuntimeError("ECOLOOP_SOURCE_BUCKET is not configured")
    blob = storage.Client().bucket(bucket_name).blob(
        claim.storage_path, generation=claim.storage_generation
    )
    blob.reload()
    if str(blob.generation) != claim.storage_generation:
        raise RuntimeError("Committed source generation does not match the job")
    content_type = blob.content_type or claim.mime_type or ""
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise RuntimeError("Committed source MIME type is unsupported")
    content = blob.download_as_bytes(start=0, end=10 * 1024 * 1024)
    if len(content) > 10 * 1024 * 1024:
        raise RuntimeError("Committed image exceeds the 10 MiB limit")
    if hashlib.sha256(content).hexdigest() != claim.content_sha256:
        raise RuntimeError("Committed image digest does not match the job source")
    image = decode_image(content, content_type)
    if image.width * image.height > 40_000_000:
        raise RuntimeError("Committed image exceeds the pixel limit")
    return image


def run_job(
    job_id: str,
    *,
    gateway: JobGateway,
    artifacts: ArtifactWriter,
    source_loader: SourceLoader = load_committed_source,
    inspection_runner: InspectionRunner | None = None,
    now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
) -> Mapping[str, Any]:
    claim = gateway.claim(job_id)
    if claim.state == "already_finalized":
        return _require_terminal_result(gateway.read_current_result(job_id))
    set_context(jobId=claim.job_id, attemptId=claim.attempt_id, traceId=claim.trace_id)
    try:
        remaining_ms = min(
            _remaining_ms(claim.deadline_at, now()),
            _remaining_ms(claim.lease_expires_at, now()),
        )
        if remaining_ms <= 0:
            raise TimeoutError("The committed processing deadline has passed")
        source_started_at = time.perf_counter()
        image = source_loader(claim)
        if image.sha256 != claim.content_sha256:
            raise RuntimeError("Loaded source digest does not match the claimed source")
        emit_structured(level=20, event="vision.stage_completed", fields={
            "stage": "source_load",
            "durationMs": round((time.perf_counter() - source_started_at) * 1000, 2),
            "bytes": len(image.content),
            "width": image.width,
            "height": image.height,
        })
        config = InspectionConfig(
            config_id=claim.configuration_version,
            total_budget_ms=max(1_000, min(60_000, remaining_ms - 1_000)),
            call_timeout_ms=max(500, min(15_000, remaining_ms - 1_000)),
        )
        inspection_started_at = time.perf_counter()
        result = (inspection_runner or _default_runner)(image, config)
        emit_structured(level=20, event="vision.stage_completed", fields={
            "stage": "inspection",
            "durationMs": round((time.perf_counter() - inspection_started_at) * 1000, 2),
            "inventoryState": result.inventory_state,
            "objectCount": len(result.objects),
        })
        artifact_started_at = time.perf_counter()
        references = artifacts.write(prefix=claim.artifact_prefix, image=image.content, result=result)
        emit_structured(level=20, event="vision.stage_completed", fields={
            "stage": "artifacts",
            "durationMs": round((time.perf_counter() - artifact_started_at) * 1000, 2),
            "referenceCount": len(references),
        })
        gateway.checkpoint(claim, "artifacts_written", references[0])
        findings = _findings(claim, image, result)
        try:
            return gateway.complete(claim, findings, references)
        except Exception as error:
            recovered = gateway.read_current_result(job_id)
            if _is_terminal_result(recovered):
                return recovered
            raise error
    except Exception as error:
        emit_structured(level=40, event="vision.job_failed", error=error)
        try:
            gateway.fail(claim, str(error))
        except Exception as fail_error:
            emit_structured(level=40, event="vision.gateway_fail_failed", error=fail_error)
        raise
    finally:
        clear_context()


def _default_runner(image: ProcessingInput, config: InspectionConfig) -> InspectionResult:
    probe = ProbeConfig.from_environment()
    from ecoloop_vision.adapters.detectors import run_roboflow
    from ecoloop_vision.adapters.specialist import run_gemini

    return inspect_image(
        image,
        config=replace(
            config,
            detector_models=(probe.detector_a_model, probe.detector_b_model),
            specialist_model=probe.specialist_model,
        ),
        detector_provider=lambda model_id, _image: run_roboflow(
            image_path=_write_temp_image(image), model_id=model_id, config=probe
        )["response"],
        specialist_provider=lambda crop, _object_id: run_roboflow(
            image_path=_write_temp_image(crop), model_id=probe.specialist_model, config=probe
        )["response"],
        gemini_provider=lambda provider_image, mode, object_id: json.loads(run_gemini(
            image_path=_write_temp_image(provider_image),
            config=probe,
            mode=mode,
            candidate_id=object_id,
            timeout_ms=config.call_timeout_ms,
        )["text"]),
    )


def _findings(claim: JobClaim, image: ProcessingInput, result: InspectionResult) -> Mapping[str, Any]:
    findings = []
    for item in result.objects:
        findings.append({
            "objectId": item.object_id,
            "resolution": item.resolution,
            "eligibility": item.eligibility,
            "box": {"x1": item.normalized_box[0], "y1": item.normalized_box[1], "x2": item.normalized_box[2], "y2": item.normalized_box[3]},
            "evidence": {"modelIds": list(item.model_ids), "rawLabel": ",".join(item.raw_labels)},
            "confidence": item.confidence,
            "reasonCode": _contract_reason_code(item.reason_code),
        })
    return {
        "schemaVersion": "backend.v1",
        "source": "worker",
        "jobId": claim.job_id,
        "attemptId": claim.attempt_id,
        "image": {
            "assetId": claim.asset_id,
            "assetVersion": claim.asset_version,
            "contentSha256": image.sha256,
            "width": image.width,
            "height": image.height,
        },
        "findings": findings,
        "inventoryState": result.inventory_state,
    }


def _contract_reason_code(reason_code: str) -> str:
    if reason_code in {"matched", "fallback", "unsupported_label", "ambiguous", "false_detection"}:
        return reason_code
    if reason_code == "specialist_evidence":
        return "matched"
    return "ambiguous"


def _remaining_ms(deadline_at: str, current: datetime) -> int:
    deadline = datetime.fromisoformat(deadline_at.replace("Z", "+00:00"))
    return round((deadline - current.astimezone(timezone.utc)).total_seconds() * 1000)


def _is_terminal_result(response: Mapping[str, Any]) -> bool:
    result = response.get("result")
    if not isinstance(result, Mapping):
        return False
    outcome = result.get("outcome")
    return isinstance(outcome, str) and outcome not in {"processing", "pending"}


def _require_terminal_result(response: Mapping[str, Any]) -> Mapping[str, Any]:
    if not _is_terminal_result(response):
        raise RuntimeError("Worker gateway returned a non-terminal result for a finalized job")
    return response


def _write_temp_image(image: ProcessingInput):
    import tempfile
    from pathlib import Path

    suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(image.content_type, ".img")
    path = Path(tempfile.gettempdir()) / f"ecoloop-{image.sha256}{suffix}"
    path.write_bytes(image.content)
    return path
