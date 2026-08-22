"""
OpenTelemetry Distributed Tracing Configuration and Context Propagation.
Provides Tracer initialization, W3C trace context extraction/injection across processes,
and helper utilities for correlating traces with structured logs.
"""

import logging
from typing import Dict, Optional, Tuple

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

logger = logging.getLogger(__name__)

# Singleton tracer initialization state
_INITIALIZED = False


def init_tracer_provider(service_name: str = "eval-studio-ai") -> TracerProvider:
    """
    Initializes the global OpenTelemetry TracerProvider.

    Args:
        service_name (str): Service name attached to resource attributes.

    Returns:
        TracerProvider: Configured tracer provider instance.
    """
    global _INITIALIZED
    current_provider = trace.get_tracer_provider()

    if isinstance(current_provider, TracerProvider):
        return current_provider

    provider = TracerProvider()
    trace.set_tracer_provider(provider)
    _INITIALIZED = True
    return provider


def get_tracer(name: str = "eval-studio-ai"):
    """Returns a tracer instance from the global tracer provider."""
    return trace.get_tracer(name)


def get_current_trace_and_span_id() -> Tuple[Optional[str], Optional[str]]:
    """
    Retrieves the currently active OpenTelemetry trace_id and span_id formatted as hex strings.

    Returns:
        Tuple[Optional[str], Optional[str]]: (trace_id, span_id) or (None, None) if no active span.
    """
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        ctx = span.get_span_context()
        trace_id = format(ctx.trace_id, "032x")
        span_id = format(ctx.span_id, "016x")
        return trace_id, span_id
    return None, None


def inject_trace_context(carrier: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """
    Injects the active OpenTelemetry W3C trace context (traceparent/tracestate)
    into a dictionary (e.g. environment variables or HTTP headers).

    Args:
        carrier (Optional[Dict[str, str]]): Target dictionary to populate.

    Returns:
        Dict[str, str]: Carrier dictionary with injected traceparent headers.
    """
    target = {} if carrier is None else carrier
    TraceContextTextMapPropagator().inject(target)
    return target


def extract_trace_context(carrier: Dict[str, str]):
    """
    Extracts W3C trace context from carrier dictionary.

    Args:
        carrier (Dict[str, str]): Source dictionary containing trace headers.

    Returns:
        Context: OpenTelemetry Context.
    """
    return TraceContextTextMapPropagator().extract(carrier)
