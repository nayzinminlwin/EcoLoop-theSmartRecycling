from collections.abc import Mapping

from ecoloop_vision.infrastructure.job_gateway import JobGateway


class Response:
    status_code = 200

    def json(self):
        return {"status": "committed", "data": {
            "jobId": "job-1", "batchId": "batch-1", "attemptId": "attempt-1",
            "deadlineAt": "2030-01-01T00:05:00.000Z",
            "source": {"assetId": "asset-1", "assetVersion": "v1", "contentSha256": "a" * 64},
            "configurationVersion": "inspection-v1",
            "artifactPrefix": "vision-artifacts/job-1/attempt-1/",
            "traceId": "trace-1", "state": "claimed",
        }}


class Session:
    def __init__(self):
        self.calls = []

    def post(self, url, *, json, headers, timeout):
        self.calls.append((url, json, headers, timeout))
        return Response()


def test_gateway_uses_attached_identity_token_audience_and_envelope():
    session = Session()
    gateway = JobGateway(
        base_url="https://gateway.example/internal",
        audience="https://gateway.example",
        session=session,
        token_provider=lambda audience: f"token-for-{audience}",
    )

    claim = gateway.claim("job-1")

    assert claim.attempt_id == "attempt-1"
    assert session.calls[0][0] == "https://gateway.example/internal"
    assert session.calls[0][1] == {"operation": "claim", "jobId": "job-1"}
    assert session.calls[0][2]["Authorization"] == "Bearer token-for-https://gateway.example"
