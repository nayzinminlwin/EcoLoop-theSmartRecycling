from __future__ import annotations

import os
import hashlib
import json
from pathlib import Path
from dataclasses import dataclass


@dataclass(frozen=True)
class ProbeConfig:
    roboflow_api_key: str
    gemini_api_key: str
    roboflow_api_url: str = "https://serverless.roboflow.com"
    gemini_model: str = "gemini-3.8-flash"
    detector_a_model: str = "waste-detection-0momv/6"
    detector_b_model: str = "yolo-waste-detection/1"
    specialist_model: str = "waste-classification-rjo28/2"
    registry_digest: str = ""

    @classmethod
    def from_environment(cls) -> "ProbeConfig":
        missing = [
            name
            for name in ("ROBOFLOW_API_KEY", "GEMINI_API_KEY")
            if not os.getenv(name)
        ]
        if missing:
            raise RuntimeError(
                "Missing required provider environment variable(s): "
                + ", ".join(missing)
            )
        registry_path = Path(__file__).parents[2] / "model_registry.json"
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        models = registry.get("models", {})
        if not isinstance(models, dict):
            raise RuntimeError("Model registry is invalid")
        try:
            detector_a = str(models["A"]["modelId"])
            detector_b = str(models["B"]["modelId"])
            specialist = str(models["D"]["modelId"])
            gemini = str(models["Gemini"]["modelId"])
        except (KeyError, TypeError):
            raise RuntimeError("Model registry is missing required model IDs")
        digest = hashlib.sha256(
            json.dumps(registry, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        return cls(
            roboflow_api_key=os.environ["ROBOFLOW_API_KEY"],
            gemini_api_key=os.environ["GEMINI_API_KEY"],
            gemini_model=gemini,
            detector_a_model=detector_a,
            detector_b_model=detector_b,
            specialist_model=specialist,
            registry_digest=digest,
        )
