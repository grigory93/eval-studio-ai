"""
Centralized Structured JSON Logging Configuration with PII Redaction & OTel Trace Correlation.
"""

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.core.tracing import get_current_trace_and_span_id
from app.utils.sanitizer import PIIRedactingFilter


class JSONLogFormatter(logging.Formatter):
    """
    Formats standard library logging records into structured JSON objects with
    OpenTelemetry trace IDs, intent/outcome phases, and evaluation context metadata.
    """

    RESERVED_ATTRS = {
        "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
        "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
        "created", "msecs", "relativeCreated", "thread", "threadName",
        "processName", "process", "message",
    }

    def format(self, record: logging.LogRecord) -> str:
        timestamp_str = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat()

        # Extract OTel trace & span ID
        trace_id, span_id = get_current_trace_and_span_id()

        payload: Dict[str, Any] = {
            "timestamp": timestamp_str,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Correlate distributed tracing if available
        if trace_id:
            payload["trace_id"] = trace_id
        if span_id:
            payload["span_id"] = span_id

        # Extract contextual attributes from extra or record attributes
        context_keys = [
            "eval_id", "sample_id", "phase", "event_type",
            "category", "status", "duration_ms", "tools_called",
            "score", "error_code",
        ]
        for key in context_keys:
            if hasattr(record, key):
                payload[key] = getattr(record, key)

        # Collect any additional arbitrary custom extras
        extras = {
            k: v for k, v in record.__dict__.items()
            if k not in self.RESERVED_ATTRS and k not in payload and not k.startswith("_")
        }
        if extras:
            payload["extra"] = extras

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False)


def setup_logging(
    log_level: str = "INFO",
    json_format: bool = True,
    redact_pii_enabled: bool = True,
) -> None:
    """
    Configures application-wide logging handlers, formatters, and filters.

    Args:
        log_level (str): Minimum severity level ('DEBUG', 'INFO', 'WARNING', 'ERROR').
        json_format (bool): Whether to format logs as structured JSON (default: True).
        redact_pii_enabled (bool): Whether to attach PIIRedactingFilter to handlers (default: True).
    """
    root_logger = logging.getLogger()
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    # Remove existing handlers to avoid duplicates
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(numeric_level)

    if redact_pii_enabled:
        stream_handler.addFilter(PIIRedactingFilter())

    if json_format:
        stream_handler.setFormatter(JSONLogFormatter())
    else:
        standard_format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        stream_handler.setFormatter(logging.Formatter(standard_format))

    root_logger.addHandler(stream_handler)

    # Suppress verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("google.auth").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
