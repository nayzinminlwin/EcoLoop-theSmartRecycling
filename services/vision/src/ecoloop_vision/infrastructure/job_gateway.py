from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

import requests
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from ecoloop_vision.logging import emit_structured


class GatewayError(RuntimeError):
    def __init__(self, message: str, *, retryable: bool = True) -> None:
        super().__init__(message)
        self.retryable = retryable


class GatewayTokenProvider(Protocol):
    def __call__(self, audience: str) -> str: ...


def attached_identity_token(audience: str) -> str:
    if not audience.strip():
        raise GatewayError("Gateway audience is required", retryable=False)
    return id_token.fetch_id_token(Request(), audience)


@dataclass(frozen=True)
class JobClaim:
    job_id: str
    batch_id: str
    attempt_id: str
    deadline_at: str
    asset_id: str
    asset_version: str
    content_sha256: str
    configuration_version: str
    artifact_prefix: str
    trace_id: str
    state: str


class JobGateway:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        audience: str | None = None,
        timeout_seconds: float = 10.0,
        session: requests.Session | None = None,
        token_provider: GatewayTokenProvider = attached_identity_token,
    ) -> None:
        self.base_url = (base_url or os.getenv("ECOLOOP_WORKER_GATEWAY_URL", "")).rstrip("/")
        self.audience = audience or os.getenv("ECOLOOP_WORKER_AUDIENCE", self.base_url)
        self.timeout_seconds = timeout_seconds
        self.session = session or requests.Session()
        self.token_provider = token_provider

    def claim(self, job_id: str) -> JobClaim:
        payload = self._call("claim", {"jobId": job_id})
        claim = _mapping(payload)
        return JobClaim(
            job_id=_string(claim, "jobId"),
            batch_id=_string(claim, "batchId"),
            attempt_id=_string(claim, "attemptId"),
            deadline_at=_string(claim, "deadlineAt"),
            asset_id=_string(_mapping(claim["source"]), "assetId"),
            asset_version=_string(_mapping(claim["source"]), "assetVersion"),
            content_sha256=_string(_mapping(claim["source"]), "contentSha256"),
            configuration_version=_string(claim, "configurationVersion"),
            artifact_prefix=_string(claim, "artifactPrefix"),
            trace_id=_string(claim, "traceId"),
            state=_string(claim, "state"),
        )

    def checkpoint(self, claim: JobClaim, stage: str, output_reference: str) -> Mapping[str, Any]:
        return self._call("checkpoint", {
            "jobId": claim.job_id,
            "attemptId": claim.attempt_id,
            "stage": stage,
            "outputReference": output_reference,
        })

    def complete(self, claim: JobClaim, findings: Mapping[str, Any], references: list[str]) -> Mapping[str, Any]:
        return self._call("complete", {
            "jobId": claim.job_id,
            "attemptId": claim.attempt_id,
            "expectedDecisionVersion": 0,
            "findings": findings,
            "artifactReferences": references,
        })

    def fail(self, claim: JobClaim, reason: str) -> Mapping[str, Any]:
        return self._call("fail", {
            "jobId": claim.job_id,
            "attemptId": claim.attempt_id,
            "reason": reason[:240],
        })

    def read_current_result(self, job_id: str) -> Mapping[str, Any]:
        return self._call("readCurrentResult", {"jobId": job_id})

    def _call(self, operation: str, data: Mapping[str, Any]) -> Mapping[str, Any]:
        if not self.base_url:
            raise GatewayError("Worker gateway URL is not configured", retryable=False)
        token = self.token_provider(self.audience)
        response = self.session.post(
            self.base_url,
            json={"operation": operation, **data},
            headers={"Authorization": f"Bearer {token}"},
            timeout=self.timeout_seconds,
        )
        try:
            body = response.json()
        except ValueError as error:
            raise GatewayError("Worker gateway returned invalid JSON") from error
        if response.status_code >= 400:
            error = _mapping(body.get("error", body))
            raise GatewayError(
                str(error.get("message", f"Worker gateway returned HTTP {response.status_code}")),
                retryable=bool(error.get("retryable", response.status_code >= 500)),
            )
        data_value = body.get("data")
        if not isinstance(data_value, Mapping):
            raise GatewayError("Worker gateway response did not contain data", retryable=False)
        emit_structured(level=20, event="vision.gateway_call", fields={"operation": operation, "status": "accepted"})
        return data_value


def _mapping(value: object) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise GatewayError("Worker gateway payload is invalid", retryable=False)
    return value


def _string(value: Mapping[str, Any], key: str) -> str:
    item = value.get(key)
    if not isinstance(item, str) or not item:
        raise GatewayError(f"Worker gateway payload is missing {key}", retryable=False)
    return item
