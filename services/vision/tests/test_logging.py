import json
import logging

from ecoloop_vision.logging import clear_context, emit_structured, set_context


def test_structured_event_has_context_and_redacts_secrets(caplog):
    clear_context()
    set_context(traceId="a" * 32, requestId="request-1")
    with caplog.at_level(logging.INFO, logger="ecoloop_vision"):
        emit_structured(
            level=logging.INFO,
            event="inspection.submission_committed",
            fields={"token": "sentinel-token", "url": "https://example.test?code=sentinel-code"},
        )
    payload = json.loads(caplog.records[-1].message)
    assert payload["traceId"] == "a" * 32
    assert payload["requestId"] == "request-1"
    assert "sentinel-token" not in caplog.records[-1].message
    assert "sentinel-code" not in caplog.records[-1].message
    clear_context()


def test_error_event_is_safe(caplog):
    clear_context()
    with caplog.at_level(logging.ERROR, logger="ecoloop_vision"):
        emit_structured(level=logging.ERROR, event="vision.stage_failed", error=ValueError("provider secret"))
    payload = json.loads(caplog.records[-1].message)
    assert payload["severity"] == "ERROR"
    assert payload["errorCode"] == "ValueError"
    assert payload["errorMessage"] == "provider secret"
