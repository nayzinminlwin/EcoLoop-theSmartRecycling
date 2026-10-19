from __future__ import annotations

import hashlib
import os
from collections.abc import Callable, Mapping
from datetime import datetime, timezone
from typing import Any, Protocol
from urllib.request import Request, urlopen

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
    template = os.getenv("ECOLOOP_ASSET_URL_TEMPLATE", "")
    if not template:
        raise RuntimeError("ECOLOOP_ASSET_URL_TEMPLATE is not configured")
    url = template.format(asset_id=claim.asset_id, asset_version=claim.asset_version)
    with urlopen(Request(url, method="GET"), timeout=10) as response:
        content_type = response.headers.get_content_type()
        content = response.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise RuntimeError("Committed image exceeds the 10 MiB limit")
    if hashlib.sha256(content).hexdigest() != claim.content_sha256:
        raise RuntimeError("Committed image digest does not match the job source")
    return decode_image(content, content_type)


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
        return gateway.read_current_result(job_id)
    set_context(jobId=claim.job_id, attemptId=claim.attempt_id, traceId=claim.trace_id)
    try:
        remaining_ms = _remaining_ms(claim.deadline_at, now())
        if remaining_ms <= 0:
            raise TimeoutError("The committed processing deadline has passed")
        image = source_loader(claim)
        if image.sha256 != claim.content_sha256:
            raise RuntimeError("Loaded source digest does not match the claimed source")
        gateway.checkpoint(claim, "source_loaded", f"{claim.artifact_prefix}source.json")
        config = InspectionConfig(
            config_id=claim.configuration_version,
            total_budget_ms=max(1_000, min(30_000, remaining_ms - 1_000)),
            call_timeout_ms=max(500, min(15_000, remaining_ms - 1_000)),
        )
        result = (inspection_runner or _default_runner)(image, config)
        references = artifacts.write(prefix=claim.artifact_prefix, image=image.content, result=result)
        gateway.checkpoint(claim, "artifacts_written", references[0])
        findings = _findings(claim, image, result)
        try:
            return gateway.complete(claim, findings, references)
        except Exception as error:
            recovered = gateway.read_current_result(job_id)
            if recovered.get("result") is not None:
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

    return inspect_image(
        image,
        config=config,
        detector_provider=lambda model_id, _image: run_roboflow(
            image_path=_write_temp_image(image), model_id=model_id, config=probe
        )["response"],
    )


def _findings(claim: JobClaim, image: ProcessingInput, result: InspectionResult) -> Mapping[str, Any]:
    findings = []
    for item in result.objects:
        findings.append({
            "objectId": item.object_id,
            "resolution": item.resolution,
            "eligibility": item.eligibility,
            "box": {"x1": item.box[0], "y1": item.box[1], "x2": item.box[2], "y2": item.box[3]},
            "evidence": {"modelIds": list(item.model_ids), "rawLabel": ",".join(item.raw_labels)},
            "confidence": item.confidence,
            "reasonCode": item.reason_code,
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


def _remaining_ms(deadline_at: str, current: datetime) -> int:
    deadline = datetime.fromisoformat(deadline_at.replace("Z", "+00:00"))
    return round((deadline - current.astimezone(timezone.utc)).total_seconds() * 1000)


def _write_temp_image(image: ProcessingInput):
    import tempfile
    from pathlib import Path

    suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(image.content_type, ".img")
    path = Path(tempfile.gettempdir()) / f"ecoloop-{image.sha256}{suffix}"
    path.write_bytes(image.content)
    return path
