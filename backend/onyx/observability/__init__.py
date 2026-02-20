"""
MM-Onyx Observability Module
OpenTelemetry integration for distributed tracing, metrics, and logging
"""

from onyx.observability.otel_setup import (
    setup_observability,
    get_tracer,
    get_meter,
    instrument_fastapi,
)
from onyx.observability.correlation_middleware import (
    correlation_id_middleware,
    add_correlation_id_to_outgoing_request,
    CORRELATION_ID_HEADER,
)
from onyx.observability.business_metrics import (
    BusinessMetrics,
    track_chat_completion,
    track_search_query,
    track_document_indexing,
    track_llm_call,
)

__all__ = [
    "setup_observability",
    "get_tracer",
    "get_meter",
    "instrument_fastapi",
    "correlation_id_middleware",
    "add_correlation_id_to_outgoing_request",
    "CORRELATION_ID_HEADER",
    "BusinessMetrics",
    "track_chat_completion",
    "track_search_query",
    "track_document_indexing",
    "track_llm_call",
]
