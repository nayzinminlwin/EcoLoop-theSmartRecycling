from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


CONTRACT_ROOT = Path(__file__).resolve().parents[5] / "contracts" / "backend" / "v1"


def validate_contract(name: str, value: Any, *, contract_root: Path = CONTRACT_ROOT) -> None:
    schema_path = contract_root / f"{name}.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(value)


def validate_normalized_box(box: dict[str, float]) -> None:
    coordinates = (box["x1"], box["y1"], box["x2"], box["y2"])
    if any(not isinstance(value, (int, float)) or value != value or value in (float("inf"), float("-inf")) for value in coordinates):
        raise ValueError("Finding box must be finite and ordered")
    if box["x1"] > box["x2"] or box["y1"] > box["y2"]:
        raise ValueError("Finding box must be finite and ordered")
