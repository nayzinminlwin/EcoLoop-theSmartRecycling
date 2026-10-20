from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from ecoloop_vision.application.inspect_image import InspectionConfig, configuration_fingerprint, inspect_image, result_to_dict
from ecoloop_vision.infrastructure.images import decode_image
from ecoloop_vision.infrastructure.overlays import render_overlay


def replay(
    *,
    image_path: Path,
    raw_path: Path,
    output_dir: Path,
) -> dict[str, Any]:
    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    image = decode_image(image_path.read_bytes(), _content_type(image_path))
    responses = raw.get("detectors", {})
    specialists = raw.get("specialists", {})
    gemini = raw.get("gemini", {})
    config = _config_from_manifest(raw.get("config", {}))

    def detector_provider(model_id: str, _image: Any) -> Any:
        role = "A" if model_id.startswith("waste-detection") else "B"
        return responses[role]

    def specialist_provider(_image: Any, object_id: str) -> Any:
        return specialists[object_id]

    def gemini_provider(_image: Any, mode: str, object_id: str | None) -> Any:
        if mode == "full_image":
            return gemini["full_image"]
        return gemini["crop"][object_id or ""]

    result = inspect_image(
        image,
        detector_provider=detector_provider,
        specialist_provider=specialist_provider if specialists else None,
        gemini_provider=gemini_provider if gemini else None,
        config=config,
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "input": {
            "sha256": image.sha256,
            "width": image.width,
            "height": image.height,
        },
        "configId": result.config_id,
        "configFingerprint": configuration_fingerprint(config),
        "result": result_to_dict(result),
        "rawResponses": raw,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    render_overlay(image.content, result.objects, output_dir / "overlay.png")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Replay saved vision responses without provider calls")
    parser.add_argument("image", type=Path)
    parser.add_argument("raw", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    replay(image_path=args.image, raw_path=args.raw, output_dir=args.output)


def _content_type(path: Path) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "application/octet-stream")


def _config_from_manifest(value: Any) -> InspectionConfig:
    if not isinstance(value, dict):
        return InspectionConfig()
    allowed = {
        "config_id": value.get("configId", "inspection-v1"),
        "max_specialist_crops": value.get("maxSpecialistCrops", 8),
        "max_gemini_crops": value.get("maxGeminiCrops", 4),
        "max_full_image_objects": value.get("maxFullImageObjects", 12),
        "max_detector_calls": value.get("maxDetectorCalls", 2),
        "total_budget_ms": value.get("totalBudgetMs", 30_000),
        "call_timeout_ms": value.get("callTimeoutMs", 15_000),
        "max_retries": value.get("maxRetries", 1),
    }
    if not all(isinstance(item, int) and item >= 0 for key, item in allowed.items() if key != "config_id"):
        raise ValueError("Replay configuration contains invalid limits")
    if not isinstance(allowed["config_id"], str):
        raise ValueError("Replay configuration ID must be a string")
    return InspectionConfig(**allowed)


if __name__ == "__main__":
    main()
