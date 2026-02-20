"""
Correlation ID Middleware for MM-Onyx
Ensures correlation ID is propagated across all requests and logged
"""

import uuid
from typing import Callable, Awaitable

from fastapi import Request, Response
from opentelemetry import trace
from opentelemetry.trace import SpanKind

from shared_configs.contextvars import ONYX_REQUEST_ID_CONTEXTVAR


# Header name for correlation ID
CORRELATION_ID_HEADER = "X-Correlation-ID"
REQUEST_ID_HEADER = "X-Request-ID"


def generate_correlation_id() -> str:
    """Generate a new correlation ID"""
    return str(uuid.uuid4())


async def correlation_id_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """
    Middleware to handle correlation ID propagation

    Flow:
    1. Check for existing correlation ID in headers
    2. Generate new one if not present
    3. Store in context var
    4. Add to OpenTelemetry span attributes
    5. Propagate to response headers
    """
    # Get or generate correlation ID
    correlation_id = request.headers.get(CORRELATION_ID_HEADER)
    if not correlation_id:
        correlation_id = generate_correlation_id()

    # Also check for standard request ID header
    request_id = request.headers.get(REQUEST_ID_HEADER)
    if not request_id:
        request_id = correlation_id

    # Store correlation ID in context var (for logging)
    ONYX_REQUEST_ID_CONTEXTVAR.set(correlation_id)

    # Add correlation ID to current OpenTelemetry span
    current_span = trace.get_current_span()
    if current_span and current_span.is_recording():
        current_span.set_attribute("correlation.id", correlation_id)
        current_span.set_attribute("http.request.id", request_id)
        current_span.set_attribute("http.method", request.method)
        current_span.set_attribute("http.url", str(request.url))
        current_span.set_attribute("http.user_agent", request.headers.get("user-agent", "unknown"))

        # Add user information if available
        if hasattr(request.state, "user") and request.state.user:
            current_span.set_attribute("user.id", str(request.state.user.id))
            current_span.set_attribute("user.email", request.state.user.email)

    # Process request
    response = await call_next(request)

    # Add correlation ID to response headers
    response.headers[CORRELATION_ID_HEADER] = correlation_id
    response.headers[REQUEST_ID_HEADER] = request_id

    # Add to span if available
    if current_span and current_span.is_recording():
        current_span.set_attribute("http.status_code", response.status_code)

    return response


def add_correlation_id_to_outgoing_request(headers: dict, correlation_id: str = None) -> dict:
    """
    Helper function to add correlation ID to outgoing HTTP requests

    Args:
        headers: Existing headers dict
        correlation_id: Correlation ID to use (defaults to current context)

    Returns:
        Updated headers dict
    """
    if correlation_id is None:
        correlation_id = ONYX_REQUEST_ID_CONTEXTVAR.get()

    if correlation_id:
        headers[CORRELATION_ID_HEADER] = correlation_id
        headers[REQUEST_ID_HEADER] = correlation_id

    return headers
