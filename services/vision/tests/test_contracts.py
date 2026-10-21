from pathlib import Path

import pytest

from ecoloop_vision.infrastructure.contract_validation import validate_contract, validate_normalized_box


def test_valid_command_and_unknown_snapshot():
    validate_contract(
        "commands",
        {
            "schemaVersion": "backend.v1",
            "operation": "submitInspection",
            "requestId": "request-001",
            "payload": {
                "sessionId": "session-001",
                "assetId": "asset-001",
                "assetVersion": "v1",
                "expectedVersion": 2,
            },
        },
    )
    validate_contract(
        "snapshots",
        {
            "kind": "batch",
            "schemaVersion": "backend.v1",
            "batchId": "batch-001",
            "ownerId": "resident-001",
            "sessionId": "session-001",
            "assetId": "asset-001",
            "policyVersion": "policy-v1",
            "status": "review",
            "totalDetectedObjectCount": None,
            "pointsAwarded": None,
            "spaceContributionSpc": 50,
            "decisionVersion": 0,
        },
    )


def test_injection_and_geometry_rejected():
    with pytest.raises(Exception):
        validate_contract(
            "commands",
            {
                "schemaVersion": "backend.v1",
                "operation": "submitInspection",
                "requestId": "request-001",
                "payload": {
                    "sessionId": "session-001",
                    "assetId": "asset-001",
                    "assetVersion": "v1",
                    "expectedVersion": 2,
                    "ownerId": "resident-other",
                },
            },
        )
    with pytest.raises(ValueError):
        validate_normalized_box({"x1": 0.8, "y1": 0.1, "x2": 0.2, "y2": 0.9})


def test_findings_accept_normalized_provider_model_reference_and_reject_bad_geometry():
    finding = {
        "objectId": "object-001",
        "resolution": "plastic_bottle",
        "eligibility": "eligible",
        "box": {"x1": 0.1, "y1": 0.2, "x2": 0.8, "y2": 0.9},
        "evidence": {
            "modelIds": ["waste-detection-0momv/6"],
            "rawLabel": "Pet_Bottle",
        },
        "confidence": 0.9,
        "reasonCode": "matched",
    }
    validate_contract("findings", {
        "schemaVersion": "backend.v1",
        "source": "worker",
        "jobId": "job-001",
        "attemptId": "attempt-001",
        "image": {
            "assetId": "asset-001",
            "assetVersion": "v1",
            "contentSha256": "a" * 64,
            "width": 100,
            "height": 80,
        },
        "findings": [finding],
        "inventoryState": "resolved",
    })
    finding["box"] = {"x1": 0.8, "y1": 0.2, "x2": 0.2, "y2": 0.9}
    with pytest.raises(Exception):
        validate_contract("findings", {
            "schemaVersion": "backend.v1",
            "source": "worker",
            "jobId": "job-001",
            "attemptId": "attempt-001",
            "image": {
                "assetId": "asset-001",
                "assetVersion": "v1",
                "contentSha256": "a" * 64,
                "width": 100,
                "height": 80,
            },
            "findings": [finding],
            "inventoryState": "resolved",
        })


def test_explicit_contract_root_can_be_packaged():
    assert (Path(__file__).parents[1] / "src" / "ecoloop_vision" / "infrastructure" / "contract_validation.py").exists()
