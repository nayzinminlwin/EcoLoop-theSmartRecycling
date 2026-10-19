from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import Protocol

from ecoloop_vision.domain.models import NormalizedResult, ProcessingInput


class DetectorPort(Protocol):
    def detect(self, image: ProcessingInput) -> NormalizedResult: ...


class SpecialistPort(Protocol):
    def classify(self, image: ProcessingInput, crop: Path | None = None) -> NormalizedResult: ...


class ProviderResponse(Protocol):
    def get(self, key: str, default: object = None) -> object: ...


JsonObject = Mapping[str, object]
