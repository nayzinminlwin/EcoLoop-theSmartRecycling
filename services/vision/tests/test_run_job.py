import io
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

from ecoloop_vision.application.inspect_image import inspect_image
from ecoloop_vision.application.run_job import run_job
from ecoloop_vision.infrastructure.artifacts import LocalArtifactWriter
from ecoloop_vision.infrastructure.images import decode_image
from ecoloop_vision.infrastructure.job_gateway import JobClaim


def image_input():
    stream = io.BytesIO()
    Image.new("RGB", (100, 80), "white").save(stream, format="PNG")
    return decode_image(stream.getvalue(), "image/png")


class FakeGateway:
    def __init__(self, claim):
        self.claim_value = claim
        self.calls = []

    def claim(self, job_id):
        self.calls.append(("claim", job_id))
        return self.claim_value

    def checkpoint(self, claim, stage, output_reference):
        self.calls.append(("checkpoint", stage, output_reference))
        return {"state": "checkpointed"}

    def progress(self, claim, *, phase, activity, completed_stages):
        self.calls.append(("progress", phase, activity, completed_stages))
        return {"state": "published"}

    def complete(self, claim, findings, references):
        self.calls.append(("complete", findings, references))
        return {"outcome": "verified", "decisionVersion": 1}

    def fail(self, claim, reason):
        self.calls.append(("fail", reason))
        return {"state": "failed"}

    def read_current_result(self, job_id):
        self.calls.append(("readCurrentResult", job_id))
        return {"result": None}


def claim_for(image):
    return JobClaim(
        job_id="job-1", batch_id="batch-1", attempt_id="attempt-1",
        deadline_at="2030-01-01T00:05:00.000Z", lease_expires_at="2030-01-01T00:04:00.000Z", asset_id="asset-1",
        asset_version="v1", content_sha256=image.sha256,
        configuration_version="inspection-v1",
        artifact_prefix="vision-artifacts/job-1/attempt-1/",
        trace_id="trace-1", state="claimed",
    )


def runner(image, config):
    return inspect_image(
        image,
        detector_provider=lambda _model_id, _image: {
            "image": {"width": 100, "height": 80},
            "predictions": [{
                "x": 50, "y": 40, "width": 20, "height": 30,
                "class": "Pet_Bottle", "confidence": 0.9,
            }],
        },
        config=config,
    )


def test_run_job_claims_writes_scoped_artifacts_and_completes(tmp_path: Path):
    image = image_input()
    gateway = FakeGateway(claim_for(image))

    result = run_job(
        "job-1",
        gateway=gateway,
        artifacts=LocalArtifactWriter(tmp_path),
        source_loader=lambda _claim: image,
        inspection_runner=runner,
        now=lambda: datetime(2029, 12, 31, 23, 59, tzinfo=timezone.utc),
    )

    assert result["outcome"] == "verified"
    assert gateway.calls[0] == ("claim", "job-1")
    assert [call[1] for call in gateway.calls if call[0] == "checkpoint"] == ["artifacts_written"]
    complete = next(call for call in gateway.calls if call[0] == "complete")
    assert complete[1]["image"]["contentSha256"] == image.sha256
    assert (tmp_path / "vision-artifacts" / "job-1" / "attempt-1" / "findings.json").exists()
    assert (tmp_path / "vision-artifacts" / "job-1" / "attempt-1" / "overlay.png").exists()


def test_run_job_recovers_terminal_result_after_ambiguous_completion(tmp_path: Path):
    image = image_input()
    gateway = FakeGateway(claim_for(image))

    def ambiguous_complete(*_args):
        raise RuntimeError("connection reset after commit")

    gateway.complete = ambiguous_complete
    gateway.read_current_result = lambda _job_id: {"result": {"outcome": "verified"}, "state": "succeeded"}

    result = run_job(
        "job-1",
        gateway=gateway,
        artifacts=LocalArtifactWriter(tmp_path),
        source_loader=lambda _claim: image,
        inspection_runner=runner,
        now=lambda: datetime(2029, 12, 31, 23, 59, tzinfo=timezone.utc),
    )

    assert result["result"]["outcome"] == "verified"
    assert not any(call[0] == "fail" for call in gateway.calls)


def test_processing_projection_is_not_accepted_after_ambiguous_completion(tmp_path: Path):
    image = image_input()
    gateway = FakeGateway(claim_for(image))
    gateway.complete = lambda *_args: (_ for _ in ()).throw(RuntimeError("connection reset"))
    gateway.read_current_result = lambda _job_id: {"result": {"outcome": "processing"}, "state": "running"}

    try:
        run_job(
            "job-1",
            gateway=gateway,
            artifacts=LocalArtifactWriter(tmp_path),
            source_loader=lambda _claim: image,
            inspection_runner=runner,
            now=lambda: datetime(2029, 12, 31, 23, 59, tzinfo=timezone.utc),
        )
    except RuntimeError as error:
        assert str(error) == "connection reset"
    else:
        raise AssertionError("A processing projection must not acknowledge completion")
