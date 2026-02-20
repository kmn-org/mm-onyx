# OpenTelemetry Integration Guide for MM-Onyx Backend

## Overview

Questa guida spiega come integrare OpenTelemetry nel backend MM-Onyx per distributed tracing, metrics e logging.

## Step 1: Aggiornare le dipendenze

Aggiungi le seguenti dipendenze al `pyproject.toml`:

```toml
# OpenTelemetry Core
opentelemetry-api = "^1.22.0"
opentelemetry-sdk = "^1.22.0"
opentelemetry-instrumentation = "^0.43b0"

# OTLP Exporters
opentelemetry-exporter-otlp-proto-grpc = "^1.22.0"
opentelemetry-exporter-otlp-proto-http = "^1.22.0"

# Auto-instrumentation packages
opentelemetry-instrumentation-fastapi = "^0.43b0"
opentelemetry-instrumentation-sqlalchemy = "^0.43b0"
opentelemetry-instrumentation-redis = "^0.43b0"
opentelemetry-instrumentation-requests = "^0.43b0"
opentelemetry-instrumentation-httpx = "^0.43b0"
opentelemetry-instrumentation-logging = "^0.43b0"
```

Poi esegui:
```bash
cd backend
poetry install
```

## Step 2: Modificare `backend/onyx/main.py`

### 2.1 Aggiungi gli import

Aggiungi all'inizio del file, dopo gli altri import:

```python
# OpenTelemetry Integration
from onyx.observability import (
    setup_observability,
    correlation_id_middleware,
)
```

### 2.2 Modifica la funzione `lifespan`

Nel context manager `lifespan`, aggiungi dopo `setup_langfuse_if_creds_available()`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ... existing code ...

    # Initialize tracing if credentials are provided
    setup_braintrust_if_creds_available()
    setup_langfuse_if_creds_available()

    # ✨ NEW: Initialize OpenTelemetry Observability
    try:
        from onyx.observability import setup_observability
        setup_observability(
            app=app,
            service_name="mm-onyx-api",
            service_version=__version__,
        )
        logger.info("OpenTelemetry observability initialized successfully")
    except Exception as e:
        logger.warning(f"Failed to initialize OpenTelemetry: {e}")
        # Continue without OpenTelemetry if it fails

    # ... rest of existing code ...
    yield
    # ... cleanup code ...
```

### 2.3 Aggiungi il Correlation ID Middleware

Nella funzione `get_application`, dopo `add_latency_logging_middleware`:

```python
def get_application(lifespan_override: Lifespan | None = None) -> FastAPI:
    application = FastAPI(...)

    # ... existing middlewares ...

    # Add latency logging
    if LOG_ENDPOINT_LATENCY:
        add_latency_logging_middleware(application, logger)

    # ✨ NEW: Add Correlation ID Middleware for tracing
    try:
        from onyx.observability import correlation_id_middleware
        application.middleware("http")(correlation_id_middleware)
        logger.info("Correlation ID middleware added")
    except Exception as e:
        logger.warning(f"Failed to add correlation ID middleware: {e}")

    # ... rest of the code ...
```

## Step 3: Configurare le variabili d'ambiente

Aggiungi al file `.env` nella directory `deployment/docker_compose/`:

```bash
# OpenTelemetry Configuration
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_SERVICE_NAME=mm-onyx-api
OTEL_SERVICE_VERSION=1.0.0
ENVIRONMENT=production

# Optional: Disable OpenTelemetry in development
# OTEL_ENABLED=false
```

## Step 4: Aggiornare docker-compose per connettersi all'observability stack

Modifica `deployment/docker_compose/docker-compose.yml` per aggiungere la rete:

```yaml
services:
  api_server:
    # ... existing config ...
    environment:
      # ... existing env vars ...
      - OTEL_ENABLED=${OTEL_ENABLED:-true}
      - OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-http://otel-collector:4317}
      - OTEL_SERVICE_NAME=mm-onyx-api
      - OTEL_SERVICE_VERSION=${IMAGE_TAG:-latest}
    networks:
      - default
      - mm-onyx-observability  # ✨ NEW: Connect to observability network

  # ... other services ...

networks:
  default:
    name: onyx_default
  mm-onyx-observability:  # ✨ NEW
    external: true
    name: mm-onyx-observability
```

## Step 5: Utilizzare le metriche business

### 5.1 Esempio: Tracciare una chat completion

Nel file `backend/onyx/server/query_and_chat/chat_backend.py`:

```python
from onyx.observability import track_chat_completion, trace_operation
import time

@trace_operation("handle_chat_message", {"type": "chat"})
async def handle_chat_message(message: str, session_id: str):
    start_time = time.time()
    try:
        # ... your chat logic ...
        response = await process_chat(message)

        # Track successful completion
        duration = time.time() - start_time
        track_chat_completion(
            duration=duration,
            success=True,
            model="gpt-4",
            tokens_used=response.get("tokens", 0)
        )

        return response
    except Exception as e:
        # Track failed completion
        duration = time.time() - start_time
        track_chat_completion(
            duration=duration,
            success=False,
            model="gpt-4"
        )
        raise
```

### 5.2 Esempio: Tracciare una search query

Nel file che gestisce le ricerche:

```python
from onyx.observability import track_search_query
import time

async def search_documents(query: str):
    start_time = time.time()

    results = await vespa_client.search(query)

    duration = time.time() - start_time
    track_search_query(
        duration=duration,
        results_count=len(results),
        query_type="hybrid"
    )

    return results
```

### 5.3 Esempio: Tracciare l'indexing

Nel file che gestisce l'indexing:

```python
from onyx.observability import track_document_indexing

async def index_documents(documents: list, connector_type: str):
    try:
        # ... indexing logic ...
        await vespa_client.index(documents)

        track_document_indexing(
            success=True,
            document_count=len(documents),
            connector_type=connector_type
        )
    except Exception as e:
        track_document_indexing(
            success=False,
            document_count=len(documents),
            connector_type=connector_type
        )
        raise
```

## Step 6: Propagare Correlation ID a servizi esterni

### 6.1 Per chiamate HTTP a Vespa

```python
from onyx.observability import add_correlation_id_to_outgoing_request
import httpx

async def call_vespa(query: str):
    headers = {
        "Content-Type": "application/json"
    }
    # Add correlation ID to headers
    headers = add_correlation_id_to_outgoing_request(headers)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{VESPA_HOST}/search",
            json={"query": query},
            headers=headers
        )
        return response.json()
```

### 6.2 Per chiamate a Ollama

```python
from onyx.observability import add_correlation_id_to_outgoing_request, track_llm_call
import time
import httpx

async def call_ollama(prompt: str, model: str = "llama2"):
    start_time = time.time()

    headers = {"Content-Type": "application/json"}
    headers = add_correlation_id_to_outgoing_request(headers)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": model, "prompt": prompt},
                headers=headers
            )

        duration = time.time() - start_time
        track_llm_call(
            duration=duration,
            provider="ollama",
            model=model,
            success=True
        )

        return response.json()
    except Exception as e:
        duration = time.time() - start_time
        track_llm_call(
            duration=duration,
            provider="ollama",
            model=model,
            success=False
        )
        raise
```

## Step 7: Testing

### 7.1 Verifica che OpenTelemetry sia attivo

```bash
# Check logs del container api_server
docker logs api_server | grep -i "opentelemetry"

# Dovresti vedere:
# INFO: OpenTelemetry tracing configured with endpoint: http://otel-collector:4317
# INFO: OpenTelemetry metrics configured with endpoint: http://otel-collector:4317
# INFO: OpenTelemetry observability initialization complete
```

### 7.2 Verifica che le trace arrivino a Tempo

1. Apri Grafana: http://localhost:3001
2. Vai su Explore
3. Seleziona datasource "Tempo"
4. Esegui una query: `{service.name="mm-onyx-api"}`
5. Dovresti vedere le trace delle richieste

### 7.3 Verifica le metriche in Prometheus

1. Apri Prometheus: http://localhost:9090
2. Esegui query:
   - `chat_completions_total` - numero di chat completions
   - `search_queries_total` - numero di ricerche
   - `http_request_duration_seconds_bucket` - latenze richieste HTTP

## Step 8: Troubleshooting

### Le trace non appaiono in Grafana

1. Verifica che l'observability stack sia running:
   ```bash
   cd ../observability
   docker compose ps
   ```

2. Verifica i log dell'OTel Collector:
   ```bash
   docker logs otel-collector
   ```

3. Verifica che il network sia connesso:
   ```bash
   docker network inspect mm-onyx-observability
   ```

### Le metriche non vengono esportate

1. Verifica l'endpoint OTLP:
   ```bash
   docker exec api_server env | grep OTEL
   ```

2. Verifica che Prometheus stia scraping:
   - Apri http://localhost:9090/targets
   - Cerca "mm-onyx-api" nella lista

### Errori di connessione

Se vedi errori tipo "Failed to export spans":
1. Verifica che otel-collector sia raggiungibile:
   ```bash
   docker exec api_server ping otel-collector
   ```

2. Controlla che la porta 4317 sia aperta:
   ```bash
   docker exec api_server nc -zv otel-collector 4317
   ```

## Best Practices

1. **Usa trace_operation decorator** per funzioni importanti
2. **Propaga sempre il correlation ID** nelle chiamate esterne
3. **Traccia eventi business** (chat, search, indexing) per metriche significative
4. **Aggiungi attributi custom** agli span per facilitare il debugging
5. **Non tracciare endpoint di health check** (già esclusi nella config)

## Note

- OpenTelemetry è configurato per **fallire silenziosamente** se l'observability stack non è disponibile
- I log continuano a funzionare normalmente anche senza OpenTelemetry
- Prometheus metrics nativo continua a funzionare in parallelo
