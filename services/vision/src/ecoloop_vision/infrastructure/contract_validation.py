from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


_CONTRACT_ROOT_CANDIDATES = [Path("/app/contracts/backend/v1")]
for parent in Path(__file__).resolve().parents:
    _CONTRACT_ROOT_CANDIDATES.append(parent / "contracts" / "backend" / "v1")
CONTRACT_ROOT = next(
    (path for path in _CONTRACT_ROOT_CANDIDATES if path.is_dir()),
    _CONTRACT_ROOT_CANDIDATES[-1],
)


def validate_contract(name: str, value: Any, *, contract_root: Path = CONTRACT_ROOT) -> None:
    schema_path = contract_root / f"{name}.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(value)
    if name == "findings":
        _validate_findings_semantics(value)


def validate_normalized_box(box: dict[str, float]) -> None:
    coordinates = (box["x1"], box["y1"], box["x2"], box["y2"])
    if any(not isinstance(value, (int, float)) or value != value or value in (float("inf"), float("-inf")) for value in coordinates):
        raise ValueError("Finding box must be finite and ordered")
    if box["x1"] > box["x2"] or box["y1"] > box["y2"]:
        raise ValueError("Finding box must be finite and ordered")


def _validate_findings_semantics(value: Any) -> None:
    for finding in value["findings"]:
        box = finding["box"]
        if box is not None:
            validate_normalized_box(box)
            if any(coordinate < 0 or coordinate > 1 for coordinate in box.values()):
                raise ValueError("Finding box must be normalized")
