from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ProbeConfig:
    roboflow_api_key: str
    gemini_api_key: str
    roboflow_api_url: str = "https://serverless.roboflow.com"
    gemini_model: str = "gemini-3.8-flash"

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
        return cls(
            roboflow_api_key=os.environ["ROBOFLOW_API_KEY"],
            gemini_api_key=os.environ["GEMINI_API_KEY"],
            gemini_model=os.getenv("ECOLOOP_GEMINI_MODEL", "gemini-3.8-flash"),
        )
