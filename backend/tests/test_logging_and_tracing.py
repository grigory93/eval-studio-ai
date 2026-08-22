"""
Unit tests for Structured JSON Logging and OpenTelemetry Distributed Tracing.
"""

import json
import logging
import pytest
from app.core.logging_config import JSONLogFormatter, setup_logging
from app.core.sandbox import sandbox_manager
from app.core.tracing import (
    extract_trace_context,
    get_current_trace_and_span_id,
    get_tracer,
    init_tracer_provider,
    inject_trace_context,
)


def test_json_log_formatter_basic():
    formatter = JSONLogFormatter()
    record = logging.LogRecord(
        name="app.test",
        level=logging.INFO,
        pathname="/app/test.py",
        lineno=42,
        msg="Sample intent log message",
        args=(),
        exc_info=None,
    )
    record.eval_id = "eval-12345678"
    record.phase = "intent"
    record.sample_id = "sample-001"

    formatted_str = formatter.format(record)
    parsed = json.loads(formatted_str)

    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "app.test"
    assert parsed["message"] == "Sample intent log message"
    assert parsed["eval_id"] == "eval-12345678"
    assert parsed["phase"] == "intent"
    assert parsed["sample_id"] == "sample-001"
    assert "timestamp" in parsed
    assert "line" in parsed


def test_setup_logging_configuration():
    setup_logging(log_level="DEBUG", json_format=True, redact_pii_enabled=True)
    root = logging.getLogger()
    assert root.level == logging.DEBUG
    assert len(root.handlers) >= 1
    assert isinstance(root.handlers[0].formatter, JSONLogFormatter)


def test_tracer_initialization_and_span():
    init_tracer_provider("test-service")
    tracer = get_tracer("test-tracer")

    with tracer.start_as_current_span("test_span") as span:
        trace_id, span_id = get_current_trace_and_span_id()
        assert trace_id is not None
        assert len(trace_id) == 32
        assert span_id is not None
        assert len(span_id) == 16


def test_trace_context_injection_and_extraction():
    init_tracer_provider("test-service")
    tracer = get_tracer("test-tracer")

    carrier = {}
    with tracer.start_as_current_span("parent_span"):
        inject_trace_context(carrier)
        assert "traceparent" in carrier

    extracted_ctx = extract_trace_context(carrier)
    assert extracted_ctx is not None


def test_sandbox_env_vars_contain_trace_context():
    init_tracer_provider("test-service")
    tracer = get_tracer("test-tracer")

    with tracer.start_as_current_span("eval_parent_span"):
        env = sandbox_manager.get_sandbox_env_vars()
        assert "traceparent" in env
        assert "GOOGLE_GENAI_USE_VERTEXAI" in env
