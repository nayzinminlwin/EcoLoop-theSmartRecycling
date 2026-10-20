from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Protocol

from google.cloud import storage

from ecoloop_vision.application.inspect_image import InspectionResult, result_to_dict
from ecoloop_vision.infrastructure.overlays import render_overlay


class ArtifactWriter(Protocol):
    def write(self, *, prefix: str, image: bytes, result: InspectionResult) -> list[str]: ...


class LocalArtifactWriter:
    def __init__(self, root: Path) -> None:
        self.root = root

    def write(self, *, prefix: str, image: bytes, result: InspectionResult) -> list[str]:
        safe_prefix = _safe_prefix(prefix)
        directory = self.root / safe_prefix
        directory.mkdir(parents=True, exist_ok=True)
        bundle = directory / "findings.json"
        overlay = directory / "overlay.png"
        bundle.write_text(json.dumps(result_to_dict(result), sort_keys=True, default=str), encoding="utf-8")
        render_overlay(image, result.objects, overlay)
        return [f"{safe_prefix}findings.json", f"{safe_prefix}overlay.png"]


class CloudStorageArtifactWriter:
    def __init__(self, bucket_name: str, client: storage.Client | None = None) -> None:
        if not bucket_name.strip():
            raise ValueError("Artifact bucket name is required")
        self.bucket = (client or storage.Client()).bucket(bucket_name)

    def write(self, *, prefix: str, image: bytes, result: InspectionResult) -> list[str]:
        safe_prefix = _safe_prefix(prefix)
        bundle = json.dumps(result_to_dict(result), sort_keys=True, default=str).encode("utf-8")
        with tempfile.TemporaryDirectory(prefix="ecoloop-artifacts-") as directory:
            overlay = Path(directory) / "overlay.png"
            render_overlay(image, result.objects, overlay)
            self.bucket.blob(f"{safe_prefix}findings.json").upload_from_string(
                bundle, content_type="application/json"
            )
            self.bucket.blob(f"{safe_prefix}overlay.png").upload_from_filename(
                str(overlay), content_type="image/png"
            )
        return [f"{safe_prefix}findings.json", f"{safe_prefix}overlay.png"]


def _safe_prefix(prefix: str) -> str:
    normalized = prefix.replace("\\", "/")
    if not normalized.endswith("/") or normalized.startswith("/") or ".." in normalized.split("/"):
        raise ValueError("Artifact prefix is outside the allowed scope")
    return normalized
