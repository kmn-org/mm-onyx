"""
Business Metrics for MM-Onyx
Custom metrics for tracking business-level events and KPIs
"""

import time
from typing import Optional, Dict, Any
from functools import wraps

from opentelemetry import trace
from opentelemetry.metrics import Counter, Histogram, UpDownCounter

from onyx.observability.otel_setup import get_meter


class BusinessMetrics:
    """
    Business metrics collector for MM-Onyx

    Tracks:
    - Chat completions
    - Search queries
    - Document indexing
    - LLM calls
    - User activity
    - Error rates
    """

    def __init__(self):
        self.meter = get_meter("mm-onyx-business")

        # Chat metrics
        self.chat_completions_counter = self.meter.create_counter(
            name="chat_completions_total",
            description="Total number of chat completions",
            unit="1"
        )
        self.chat_duration_histogram = self.meter.create_histogram(
            name="chat_completion_duration_seconds",
            description="Duration of chat completions",
            unit="s"
        )
        self.chat_tokens_counter = self.meter.create_counter(
            name="chat_tokens_total",
            description="Total tokens used in chat",
            unit="1"
        )

        # Search metrics
        self.search_queries_counter = self.meter.create_counter(
            name="search_queries_total",
            description="Total number of search queries",
            unit="1"
        )
        self.search_duration_histogram = self.meter.create_histogram(
            name="search_query_duration_seconds",
            description="Duration of search queries",
            unit="s"
        )

        # Indexing metrics
        self.indexing_documents_counter = self.meter.create_counter(
            name="indexing_documents_total",
            description="Total documents indexed",
            unit="1"
        )
        self.indexing_failures_counter = self.meter.create_counter(
            name="indexing_failures_total",
            description="Total indexing failures",
            unit="1"
        )
        self.indexing_attempts_counter = self.meter.create_counter(
            name="indexing_attempts_total",
            description="Total indexing attempts",
            unit="1"
        )

        # LLM metrics
        self.llm_calls_counter = self.meter.create_counter(
            name="llm_calls_total",
            description="Total LLM API calls",
            unit="1"
        )
        self.llm_duration_histogram = self.meter.create_histogram(
            name="llm_call_duration_seconds",
            description="Duration of LLM calls",
            unit="s"
        )
        self.llm_errors_counter = self.meter.create_counter(
            name="llm_errors_total",
            description="Total LLM errors",
            unit="1"
        )

        # User activity metrics
        self.active_users_gauge = self.meter.create_up_down_counter(
            name="active_users",
            description="Number of active users",
            unit="1"
        )
        self.user_sessions_counter = self.meter.create_counter(
            name="user_sessions_total",
            description="Total user sessions",
            unit="1"
        )

        # Embedding metrics
        self.embedding_generation_counter = self.meter.create_counter(
            name="embedding_generation_total",
            description="Total embeddings generated",
            unit="1"
        )
        self.embedding_duration_histogram = self.meter.create_histogram(
            name="embedding_generation_duration_seconds",
            description="Duration of embedding generation",
            unit="s"
        )

    def record_chat_completion(
        self,
        duration_seconds: float,
        success: bool = True,
        model: Optional[str] = None,
        tokens_used: Optional[int] = None,
        **attributes
    ):
        """Record a chat completion event"""
        attrs = {"success": str(success).lower()}
        if model:
            attrs["model"] = model
        attrs.update(attributes)

        self.chat_completions_counter.add(1, attrs)
        self.chat_duration_histogram.record(duration_seconds, attrs)

        if tokens_used:
            self.chat_tokens_counter.add(tokens_used, attrs)

    def record_search_query(
        self,
        duration_seconds: float,
        results_count: int = 0,
        query_type: str = "hybrid",
        **attributes
    ):
        """Record a search query event"""
        attrs = {
            "query_type": query_type,
            "has_results": str(results_count > 0).lower()
        }
        attrs.update(attributes)

        self.search_queries_counter.add(1, attrs)
        self.search_duration_histogram.record(duration_seconds, attrs)

    def record_document_indexing(
        self,
        success: bool = True,
        document_count: int = 1,
        connector_type: Optional[str] = None,
        **attributes
    ):
        """Record document indexing event"""
        attrs = {"success": str(success).lower()}
        if connector_type:
            attrs["connector"] = connector_type
        attrs.update(attributes)

        self.indexing_attempts_counter.add(1, attrs)

        if success:
            self.indexing_documents_counter.add(document_count, attrs)
        else:
            self.indexing_failures_counter.add(1, attrs)

    def record_llm_call(
        self,
        duration_seconds: float,
        provider: str,
        model: str,
        success: bool = True,
        **attributes
    ):
        """Record an LLM API call"""
        attrs = {
            "provider": provider,
            "model": model,
            "success": str(success).lower()
        }
        attrs.update(attributes)

        self.llm_calls_counter.add(1, attrs)
        self.llm_duration_histogram.record(duration_seconds, attrs)

        if not success:
            self.llm_errors_counter.add(1, attrs)

    def record_embedding_generation(
        self,
        duration_seconds: float,
        count: int = 1,
        model: Optional[str] = None,
        **attributes
    ):
        """Record embedding generation"""
        attrs = {}
        if model:
            attrs["model"] = model
        attrs.update(attributes)

        self.embedding_generation_counter.add(count, attrs)
        self.embedding_duration_histogram.record(duration_seconds, attrs)


# Global instance
_business_metrics: Optional[BusinessMetrics] = None


def get_business_metrics() -> BusinessMetrics:
    """Get or create global business metrics instance"""
    global _business_metrics
    if _business_metrics is None:
        _business_metrics = BusinessMetrics()
    return _business_metrics


# Convenience functions

def track_chat_completion(duration: float, success: bool = True, **kwargs):
    """Track a chat completion"""
    get_business_metrics().record_chat_completion(duration, success, **kwargs)


def track_search_query(duration: float, results_count: int = 0, **kwargs):
    """Track a search query"""
    get_business_metrics().record_search_query(duration, results_count, **kwargs)


def track_document_indexing(success: bool = True, document_count: int = 1, **kwargs):
    """Track document indexing"""
    get_business_metrics().record_document_indexing(success, document_count, **kwargs)


def track_llm_call(duration: float, provider: str, model: str, success: bool = True, **kwargs):
    """Track an LLM call"""
    get_business_metrics().record_llm_call(duration, provider, model, success, **kwargs)


# Decorators for automatic tracking

def trace_operation(operation_name: str, attributes: Optional[Dict[str, Any]] = None):
    """
    Decorator to automatically create spans for operations

    Usage:
        @trace_operation("search_documents", {"type": "semantic"})
        def search_documents(query: str):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            tracer = trace.get_tracer(__name__)
            with tracer.start_as_current_span(
                operation_name,
                attributes=attributes or {}
            ) as span:
                try:
                    result = await func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(
                        trace.Status(trace.StatusCode.ERROR, str(e))
                    )
                    span.record_exception(e)
                    raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            tracer = trace.get_tracer(__name__)
            with tracer.start_as_current_span(
                operation_name,
                attributes=attributes or {}
            ) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_status(trace.Status(trace.StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(
                        trace.Status(trace.StatusCode.ERROR, str(e))
                    )
                    span.record_exception(e)
                    raise

        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator
