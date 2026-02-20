"""
OpenTelemetry Setup for MM-Onyx
Configures distributed tracing, metrics, and logging with OTLP export
"""

import logging
import os
from typing import Optional

from opentelemetry import trace, metrics
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION, DEPLOYMENT_ENVIRONMENT
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

logger = logging.getLogger(__name__)


def get_otel_resource(service_name: str = "mm-onyx-api", service_version: str = "1.0.0") -> Resource:
    """Create OpenTelemetry resource with service attributes"""
    return Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
        DEPLOYMENT_ENVIRONMENT: os.getenv("ENVIRONMENT", "production"),
        "service.namespace": "mm-onyx",
        "service.instance.id": os.getenv("HOSTNAME", "unknown"),
    })


def setup_tracing(
    otlp_endpoint: Optional[str] = None,
    service_name: str = "mm-onyx-api",
    service_version: str = "1.0.0"
) -> TracerProvider:
    """
    Setup OpenTelemetry tracing with OTLP exporter

    Args:
        otlp_endpoint: OTLP collector endpoint (default: from OTEL_EXPORTER_OTLP_ENDPOINT env)
        service_name: Name of the service
        service_version: Version of the service

    Returns:
        TracerProvider instance
    """
    # Get endpoint from env or use default
    endpoint = otlp_endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")

    # Create resource
    resource = get_otel_resource(service_name, service_version)

    # Create tracer provider
    tracer_provider = TracerProvider(resource=resource)

    # Create OTLP span exporter
    try:
        otlp_exporter = OTLPSpanExporter(
            endpoint=endpoint,
            insecure=True  # Use insecure for local development
        )

        # Add batch span processor
        span_processor = BatchSpanProcessor(otlp_exporter)
        tracer_provider.add_span_processor(span_processor)

        logger.info(f"OpenTelemetry tracing configured with endpoint: {endpoint}")
    except Exception as e:
        logger.error(f"Failed to configure OTLP span exporter: {e}")
        # Continue without OTLP export in case of error

    # Set as global tracer provider
    trace.set_tracer_provider(tracer_provider)

    # Set global propagator for context propagation
    set_global_textmap(TraceContextTextMapPropagator())

    return tracer_provider


def setup_metrics(
    otlp_endpoint: Optional[str] = None,
    service_name: str = "mm-onyx-api",
    service_version: str = "1.0.0",
    export_interval_millis: int = 60000  # 60 seconds
) -> MeterProvider:
    """
    Setup OpenTelemetry metrics with OTLP exporter

    Args:
        otlp_endpoint: OTLP collector endpoint
        service_name: Name of the service
        service_version: Version of the service
        export_interval_millis: Interval for exporting metrics

    Returns:
        MeterProvider instance
    """
    # Get endpoint from env or use default
    endpoint = otlp_endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")

    # Create resource
    resource = get_otel_resource(service_name, service_version)

    # Create OTLP metric exporter
    try:
        otlp_exporter = OTLPMetricExporter(
            endpoint=endpoint,
            insecure=True
        )

        # Create metric reader
        metric_reader = PeriodicExportingMetricReader(
            otlp_exporter,
            export_interval_millis=export_interval_millis
        )

        # Create meter provider
        meter_provider = MeterProvider(
            resource=resource,
            metric_readers=[metric_reader]
        )

        # Set as global meter provider
        metrics.set_meter_provider(meter_provider)

        logger.info(f"OpenTelemetry metrics configured with endpoint: {endpoint}")

        return meter_provider
    except Exception as e:
        logger.error(f"Failed to configure OTLP metric exporter: {e}")
        # Return basic meter provider without OTLP export
        meter_provider = MeterProvider(resource=resource)
        metrics.set_meter_provider(meter_provider)
        return meter_provider


def setup_logging(
    otlp_endpoint: Optional[str] = None,
    service_name: str = "mm-onyx-api",
    service_version: str = "1.0.0"
) -> Optional[LoggerProvider]:
    """
    Setup OpenTelemetry logging with OTLP exporter

    Args:
        otlp_endpoint: OTLP collector endpoint
        service_name: Name of the service
        service_version: Version of the service

    Returns:
        LoggerProvider instance or None if setup fails
    """
    # Get endpoint from env or use default
    endpoint = otlp_endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")

    # Create resource
    resource = get_otel_resource(service_name, service_version)

    try:
        # Create OTLP log exporter
        otlp_exporter = OTLPLogExporter(
            endpoint=endpoint,
            insecure=True
        )

        # Create logger provider
        logger_provider = LoggerProvider(resource=resource)

        # Add batch log processor
        logger_provider.add_log_record_processor(
            BatchLogRecordProcessor(otlp_exporter)
        )

        # Instrument logging module
        LoggingInstrumentor().instrument(
            set_logging_format=True,
            log_level=logging.INFO
        )

        # Add OTLP handler to root logger
        handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
        logging.getLogger().addHandler(handler)

        logger.info(f"OpenTelemetry logging configured with endpoint: {endpoint}")

        return logger_provider
    except Exception as e:
        logger.error(f"Failed to configure OTLP log exporter: {e}")
        return None


def instrument_fastapi(app):
    """
    Instrument FastAPI app with OpenTelemetry

    Args:
        app: FastAPI application instance
    """
    try:
        FastAPIInstrumentor.instrument_app(
            app,
            excluded_urls="/health,/metrics,/openapi.json,/docs,/redoc"
        )
        logger.info("FastAPI instrumented with OpenTelemetry")
    except Exception as e:
        logger.error(f"Failed to instrument FastAPI: {e}")


def instrument_libraries():
    """
    Instrument common libraries with OpenTelemetry auto-instrumentation
    """
    try:
        # Instrument SQLAlchemy
        SQLAlchemyInstrumentor().instrument()
        logger.info("SQLAlchemy instrumented")
    except Exception as e:
        logger.warning(f"Failed to instrument SQLAlchemy: {e}")

    try:
        # Instrument Redis
        RedisInstrumentor().instrument()
        logger.info("Redis instrumented")
    except Exception as e:
        logger.warning(f"Failed to instrument Redis: {e}")

    try:
        # Instrument requests library
        RequestsInstrumentor().instrument()
        logger.info("Requests library instrumented")
    except Exception as e:
        logger.warning(f"Failed to instrument requests: {e}")

    try:
        # Instrument httpx library
        HTTPXClientInstrumentor().instrument()
        logger.info("HTTPX library instrumented")
    except Exception as e:
        logger.warning(f"Failed to instrument httpx: {e}")


def setup_observability(
    app=None,
    service_name: str = "mm-onyx-api",
    service_version: str = "1.0.0",
    otlp_endpoint: Optional[str] = None,
    enable_tracing: bool = True,
    enable_metrics: bool = True,
    enable_logging: bool = True
):
    """
    Complete OpenTelemetry setup for MM-Onyx

    Args:
        app: FastAPI application instance (optional)
        service_name: Name of the service
        service_version: Version of the service
        otlp_endpoint: OTLP collector endpoint
        enable_tracing: Enable distributed tracing
        enable_metrics: Enable metrics export
        enable_logging: Enable log export
    """
    # Check if observability is enabled
    if not os.getenv("OTEL_ENABLED", "true").lower() == "true":
        logger.info("OpenTelemetry observability is disabled")
        return

    logger.info("Initializing OpenTelemetry observability...")

    # Setup tracing
    if enable_tracing:
        setup_tracing(otlp_endpoint, service_name, service_version)

    # Setup metrics
    if enable_metrics:
        setup_metrics(otlp_endpoint, service_name, service_version)

    # Setup logging
    if enable_logging:
        setup_logging(otlp_endpoint, service_name, service_version)

    # Instrument libraries
    instrument_libraries()

    # Instrument FastAPI if provided
    if app:
        instrument_fastapi(app)

    logger.info("OpenTelemetry observability initialization complete")


def get_tracer(name: str = "mm-onyx"):
    """Get a tracer instance"""
    return trace.get_tracer(name)


def get_meter(name: str = "mm-onyx"):
    """Get a meter instance"""
    return metrics.get_meter(name)
