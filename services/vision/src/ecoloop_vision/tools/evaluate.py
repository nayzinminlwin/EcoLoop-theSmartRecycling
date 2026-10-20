from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


SUPPORTED_CLASSES = frozenset({
    "plastic_bottle",
    "aluminium_can",
    "glass_bottle",
    "paper_item",
    "paper_bag",
})
FROZEN_SPLIT = "frozen-evaluation"


@dataclass(frozen=True)
class Match:
    expected_index: int
    prediction_index: int
    iou: float
    label_correct: bool


def validate_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    images = manifest.get("images")
    if not isinstance(images, list):
        return ["images must be an array"]
    if manifest.get("purpose") != "evaluation-only":
        errors.append("purpose must be evaluation-only")
    seen_scene_groups: dict[str, str] = {}
    for image in images:
        image_id = image.get("imageId", "<unknown>")
        status = image.get("annotationStatus")
        split = image.get("split")
        scene_group = image.get("sceneGroupId")
        annotations = image.get("annotations")
        if status != "unlabeled":
            if not scene_group:
                errors.append(f"{image_id}: labeled image requires sceneGroupId")
            if split not in {"development", FROZEN_SPLIT}:
                errors.append(f"{image_id}: labeled image requires an assigned split")
            if not isinstance(annotations, list):
                errors.append(f"{image_id}: labeled image requires annotations")
        if scene_group and split in {"development", FROZEN_SPLIT}:
            prior = seen_scene_groups.setdefault(scene_group, split)
            if prior != split:
                errors.append(f"{image_id}: scene group {scene_group} crosses splits")
        if split == FROZEN_SPLIT and status not in {"second-reviewed", "frozen"}:
            errors.append(f"{image_id}: frozen evaluation image is not second-reviewed/frozen")
    counts = manifest.get("counts", {})
    actual = {
        "inventoried": len(images),
        "labeled": sum(image.get("annotationStatus") != "unlabeled" for image in images),
        "development": sum(image.get("split") == "development" for image in images),
        "frozenEvaluation": sum(image.get("split") == FROZEN_SPLIT for image in images),
        "secondReviewed": sum(image.get("annotationStatus") in {"second-reviewed", "frozen"} for image in images),
    }
    for key, value in actual.items():
        if counts.get(key) != value:
            errors.append(f"counts.{key}={counts.get(key)!r} does not match {value}")
    return errors


def box_iou(left: dict[str, float], right: dict[str, float]) -> float:
    x1 = max(left["x1"], right["x1"])
    y1 = max(left["y1"], right["y1"])
    x2 = min(left["x2"], right["x2"])
    y2 = min(left["y2"], right["y2"])
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    left_area = max(0.0, left["x2"] - left["x1"]) * max(0.0, left["y2"] - left["y1"])
    right_area = max(0.0, right["x2"] - right["x1"]) * max(0.0, right["y2"] - right["y1"])
    union = left_area + right_area - intersection
    return intersection / union if union else 0.0


def match_objects(
    expected: Iterable[dict[str, Any]],
    predictions: Iterable[dict[str, Any]],
    *,
    iou_threshold: float = 0.5,
) -> tuple[Match, ...]:
    expected_items = tuple(expected)
    prediction_items = tuple(predictions)
    candidates = sorted(
        (
            (
                box_iou(expected_item["bbox"], prediction_item["bbox"]),
                expected_index,
                prediction_index,
                expected_item.get("label") == prediction_item.get("label"),
            )
            for expected_index, expected_item in enumerate(expected_items)
            for prediction_index, prediction_item in enumerate(prediction_items)
            if box_iou(expected_item["bbox"], prediction_item["bbox"]) >= iou_threshold
        ),
        reverse=True,
    )
    used_expected: set[int] = set()
    used_predictions: set[int] = set()
    matches: list[Match] = []
    for iou, expected_index, prediction_index, label_correct in candidates:
        if expected_index in used_expected or prediction_index in used_predictions:
            continue
        used_expected.add(expected_index)
        used_predictions.add(prediction_index)
        matches.append(Match(expected_index, prediction_index, iou, label_correct))
    return tuple(matches)


def score_case(expected: list[dict[str, Any]], predictions: list[dict[str, Any]]) -> dict[str, Any]:
    matches = match_objects(expected, predictions)
    correct_labels = sum(match.label_correct for match in matches)
    expected_eligible = sum(item.get("eligibility") == "eligible" for item in expected)
    predicted_eligible = sum(item.get("eligibility") == "eligible" for item in predictions)
    reviewed = any(
        item.get("outcome") == "review" or item.get("eligibility") == "unresolved"
        for item in predictions
    )
    return {
        "expectedCount": len(expected),
        "predictedCount": len(predictions),
        "matchedCount": len(matches),
        "correctLabelCount": correct_labels,
        "missedCount": len(expected) - len(matches),
        "falsePositiveCount": len(predictions) - len(matches),
        "wrongLabelCount": len(matches) - correct_labels,
        "expectedEligibleCount": expected_eligible,
        "predictedEligibleCount": predicted_eligible,
        "exactCount": len(expected) == len(predictions) and len(matches) == len(expected),
        "autoCompleted": (
            bool(expected)
            and not reviewed
            and len(matches) == len(expected)
            and len(predictions) == len(expected)
            and correct_labels == len(expected)
        ),
    }


def evaluate_manifest(manifest: dict[str, Any], predictions: dict[str, Any] | None = None) -> dict[str, Any]:
    errors = validate_manifest(manifest)
    frozen = [image for image in manifest.get("images", []) if image.get("split") == FROZEN_SPLIT]
    report: dict[str, Any] = {
        "datasetVersion": manifest.get("datasetVersion"),
        "manifestSha256": hashlib.sha256(
            json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
        "status": "BLOCKED" if errors or not frozen else "READY",
        "validationErrors": errors,
        "sampleSize": len(frozen),
        "targets": {
            "rewardedClassificationPrecision": ">=0.95",
            "exactVisibleObjectCount": ">=0.90",
            "verifiedAutoCompletion": ">=0.70",
        },
    }
    if predictions is not None and not errors:
        cases = predictions.get("cases", {})
        scores = [
            score_case(image.get("annotations") or [], cases.get(image["imageId"], []))
            for image in frozen
        ]
        clear_supported = [
            score for image, score in zip(frozen, scores)
            if image.get("category") == "clear" and score["expectedCount"] > 0
        ]
        report["scores"] = scores
        report["metrics"] = {
            "rewardedClassificationPrecision": _ratio(
                sum(score["correctLabelCount"] for score in scores),
                sum(score["predictedCount"] for score in scores),
            ),
            "exactVisibleObjectCount": _ratio(
                sum(score["exactCount"] for score in clear_supported), len(clear_supported)
            ),
            "verifiedAutoCompletion": _ratio(
                sum(score["autoCompleted"] for score in clear_supported), len(clear_supported)
            ),
        }
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and score frozen hosted-CV evaluation outputs")
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--predictions", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    predictions = json.loads(args.predictions.read_text(encoding="utf-8")) if args.predictions else None
    report = evaluate_manifest(manifest, predictions)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "sampleSize": report["sampleSize"]}))


def _ratio(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


if __name__ == "__main__":
    main()
