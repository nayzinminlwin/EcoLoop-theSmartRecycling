from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path
from typing import Any

from PIL import Image

from ecoloop_vision.adapters.detectors import run_roboflow
from ecoloop_vision.adapters.specialist import run_gemini
from ecoloop_vision.config import ProbeConfig
from ecoloop_vision.logging import configure_logging, emit_event


MODELS = {
    "A": "waste-detection-0momv/6",
    "B": "yolo-waste-detection/1",
    "D": "waste-classification-rjo28/2",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe hosted EcoLoop vision providers")
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--enable-roboflow", action="store_true")
    parser.add_argument("--enable-gemini", action="store_true")
    args = parser.parse_args()

    if not args.image.is_file():
        raise FileNotFoundError(args.image)
    if not args.enable_roboflow and not args.enable_gemini:
        parser.error("enable at least one provider")

    configure_logging()
    config = ProbeConfig.from_environment()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    image_info = _image_info(args.image)
    output: dict[str, Any] = {
        "probeVersion": "bk-p00-b.1",
        "image": image_info,
        "providers": {},
    }
    emit_event(
        event="vision.probe_started",
        provider="orchestrator",
        model_id="A/B/D/Gemini",
        status="started",
        started_at=time.perf_counter(),
        details=image_info,
    )

    if args.enable_roboflow:
        for role, model_id in MODELS.items():
            try:
                result = run_roboflow(
                    image_path=args.image,
                    model_id=model_id,
                    config=config,
                )
                output["providers"][role] = {
                    "provider": "roboflow",
                    "modelId": model_id,
                    "status": "success",
                    "response": _json_safe(result["response"]),
                }
            except Exception as error:
                output["providers"][role] = {
                    "provider": "roboflow",
                    "modelId": model_id,
                    "status": "error",
                    "errorType": type(error).__name__,
                    "error": str(error),
                }

    if args.enable_gemini:
        try:
            output["providers"]["Gemini"] = {
                "provider": "gemini",
                "status": "success",
                **run_gemini(image_path=args.image, config=config),
            }
        except Exception as error:
            output["providers"]["Gemini"] = {
                "provider": "gemini",
                "modelId": config.gemini_model,
                "status": "error",
                "errorType": type(error).__name__,
                "error": str(error),
            }

    destination = args.output_dir / "probe.json"
    destination.write_text(
        json.dumps(output, indent=2, ensure_ascii=True, default=str),
        encoding="utf-8",
    )
    print(destination)


def _image_info(path: Path) -> dict[str, Any]:
    with Image.open(path) as image:
        width, height = image.size
        image_format = image.format
    return {
        "fileName": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "width": width,
        "height": height,
        "format": image_format,
        "bytes": path.stat().st_size,
    }


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if hasattr(value, "model_dump"):
        return _json_safe(value.model_dump())
    if hasattr(value, "dict"):
        return _json_safe(value.dict())
    return value


if __name__ == "__main__":
    main()
