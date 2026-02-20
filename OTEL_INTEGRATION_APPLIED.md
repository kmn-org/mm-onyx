# ✅ OpenTelemetry Integration Applied

## Modifiche Completate

Tutte le modifiche necessarie per integrare OpenTelemetry in MM-Onyx sono state applicate con successo!

---

## 📝 Riepilogo delle Modifiche

### 1. ✅ Dipendenze OpenTelemetry Aggiunte

**File modificato**: `pyproject.toml`

Aggiunte le seguenti dipendenze nella sezione `backend`:
```toml
# OpenTelemetry Core
opentelemetry-api==1.22.0
opentelemetry-sdk==1.22.0
opentelemetry-instrumentation==0.43b0

# OpenTelemetry OTLP Exporters
opentelemetry-exporter-otlp-proto-grpc==1.22.0
opentelemetry-exporter-otlp-proto-http==1.22.0

# OpenTelemetry Auto-instrumentation packages
opentelemetry-instrumentation-fastapi==0.43b0
opentelemetry-instrumentation-sqlalchemy==0.43b0
opentelemetry-instrumentation-redis==0.43b0
opentelemetry-instrumentation-requests==0.43b0
opentelemetry-instrumentation-httpx==0.43b0
opentelemetry-instrumentation-logging==0.43b0
```

### 2. ✅ Backend Modificato

**File modificato**: `backend/onyx/main.py`

**Import aggiunti:**
```python
from onyx.observability import setup_observability
from onyx.observability import correlation_id_middleware
```

**Inizializzazione nella funzione `lifespan`:**
```python
# Initialize OpenTelemetry Observability
try:
    setup_observability(
        app=None,
        service_name="mm-onyx-api",
        service_version=__version__,
    )
    logger.info("OpenTelemetry observability initialized successfully")
except Exception as e:
    logger.warning(f"Failed to initialize OpenTelemetry: {e}")
```

**Instrumentazione FastAPI in `get_application`:**
```python
# Instrument FastAPI with OpenTelemetry
try:
    from onyx.observability import instrument_fastapi
    instrument_fastapi(application)
    logger.info("FastAPI instrumented with OpenTelemetry")
except Exception as e:
    logger.warning(f"Failed to instrument FastAPI with OpenTelemetry: {e}")
```

**Correlation ID Middleware:**
```python
# Add Correlation ID Middleware for distributed tracing
try:
    application.middleware("http")(correlation_id_middleware)
    logger.info("Correlation ID middleware added for OpenTelemetry tracing")
except Exception as e:
    logger.warning(f"Failed to add correlation ID middleware: {e}")
```

### 3. ✅ Docker Compose Aggiornato

**File modificato**: `deployment/docker_compose/docker-compose.yml`

**Variabili d'ambiente aggiunte a `api_server`:**
```yaml
# OpenTelemetry Observability Configuration
- OTEL_ENABLED=${OTEL_ENABLED:-true}
- OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-http://otel-collector:4317}
- OTEL_SERVICE_NAME=mm-onyx-api
- OTEL_SERVICE_VERSION=${IMAGE_TAG:-latest}
- ENVIRONMENT=${ENVIRONMENT:-production}
```

**Variabili d'ambiente aggiunte a `background`:**
```yaml
# OpenTelemetry Observability Configuration
- OTEL_ENABLED=${OTEL_ENABLED:-true}
- OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_EXPORTER_OTLP_ENDPOINT:-http://otel-collector:4317}
- OTEL_SERVICE_NAME=mm-onyx-background
- OTEL_SERVICE_VERSION=${IMAGE_TAG:-latest}
- ENVIRONMENT=${ENVIRONMENT:-production}
```

**Rete observability aggiunta:**
```yaml
networks:
  # Networks: connect to both internal and observability networks
  networks:
    - default
    - mm-onyx-observability
```

**Definizione reti alla fine del file:**
```yaml
networks:
  # Default network for mm-onyx services
  default:
    name: onyx_default
  # External observability network for telemetry export
  mm-onyx-observability:
    external: true
    name: mm-onyx-observability
```

### 4. ✅ Variabili d'Ambiente Configurate

**File già presente**: `deployment/docker_compose/.env`

Configurazione OpenTelemetry già presente:
```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_SERVICE_NAME=mm-onyx-api
ENVIRONMENT=production
```

---

## 🚀 Prossimi Passi per Attivare l'Observability

### Step 1: Installare le dipendenze Python

```bash
cd D:\MaticMind\NORA\mm-onyx

# Reinstalla le dipendenze con uv (o il package manager che usi)
uv sync

# Oppure se usi pip in un venv
# pip install -e .
```

### Step 2: Avviare l'Observability Stack

```bash
cd D:\MaticMind\NORA\observability

# Avvia tutti i servizi di observability
docker compose up -d

# Verifica che siano tutti running
docker compose ps

# Dovresti vedere:
# - otel-collector (healthy)
# - grafana (healthy)
# - tempo (healthy)
# - loki (healthy)
# - prometheus (healthy)
```

### Step 3: Creare la Rete Observability

Prima di riavviare MM-Onyx, crea la rete esterna:

```bash
# La rete viene creata automaticamente dall'observability stack
# Verifica che esista:
docker network ls | grep mm-onyx-observability

# Se non esiste, creala manualmente:
docker network create mm-onyx-observability
```

### Step 4: Riavviare MM-Onyx

```bash
cd D:\MaticMind\NORA\mm-onyx\deployment\docker_compose

# Ricostruisci e riavvia i container
docker compose down
docker compose build --no-cache api_server background
docker compose up -d

# Verifica i log per vedere se OpenTelemetry si è inizializzato
docker logs api_server -f

# Dovresti vedere:
# INFO: OpenTelemetry observability initialized successfully
# INFO: FastAPI instrumented with OpenTelemetry
# INFO: Correlation ID middleware added for OpenTelemetry tracing
```

### Step 5: Verificare il Funzionamento

#### 5.1 Controlla i log del container

```bash
docker logs api_server | grep -i "opentelemetry\|otel"
```

**Output atteso:**
```
INFO: OpenTelemetry observability initialized successfully
INFO: FastAPI instrumented with OpenTelemetry
INFO: Correlation ID middleware added for OpenTelemetry tracing
```

#### 5.2 Verifica la connettività con OTel Collector

```bash
# Testa che api_server possa raggiungere il collector
docker exec api_server ping -c 2 otel-collector

# Testa la porta OTLP
docker exec api_server nc -zv otel-collector 4317
```

**Output atteso:**
```
otel-collector (172.x.x.x:4317) open
```

#### 5.3 Genera traffico e controlla le trace

1. **Apri il frontend**: http://localhost:3000
2. **Esegui alcune azioni**:
   - Fai una ricerca
   - Invia un messaggio in chat
   - Naviga tra le pagine

3. **Apri Grafana**: http://localhost:3001
   - Username: `admin`
   - Password: `admin`

4. **Vai su Explore** (icona bussola nella sidebar)

5. **Seleziona datasource "Tempo"**

6. **Esegui questa query TraceQL**:
   ```traceql
   {service.name="mm-onyx-api"}
   ```

7. **Dovresti vedere le trace**! 🎉

#### 5.4 Controlla i log in Loki

1. In Grafana Explore, **seleziona datasource "Loki"**

2. **Esegui questa query LogQL**:
   ```logql
   {job="mm-onyx-api"}
   ```

3. **Dovresti vedere i log dell'API server**

#### 5.5 Controlla le metriche in Prometheus

1. In Grafana Explore, **seleziona datasource "Prometheus"**

2. **Esegui questa query PromQL**:
   ```promql
   rate(http_requests_total{job="mm-onyx-api"}[5m])
   ```

3. **Dovresti vedere le metriche delle richieste HTTP**

---

## 🐛 Troubleshooting

### Problema: Container non si avvia

**Errore**: `ModuleNotFoundError: No module named 'opentelemetry'`

**Soluzione**:
```bash
# Reinstalla le dipendenze
cd D:\MaticMind\NORA\mm-onyx
uv sync

# Ricostruisci l'immagine
cd deployment/docker_compose
docker compose build --no-cache api_server
docker compose up -d
```

### Problema: Non vedo "OpenTelemetry initialized" nei log

**Possibili cause**:
1. Le dipendenze non sono state installate
2. C'è un errore nell'import

**Verifica**:
```bash
# Controlla i log completi
docker logs api_server 2>&1 | grep -i "error\|traceback"

# Entra nel container e verifica l'import
docker exec -it api_server python -c "from onyx.observability import setup_observability; print('OK')"
```

### Problema: Errore "network mm-onyx-observability not found"

**Soluzione**:
```bash
# Crea la rete manualmente
docker network create mm-onyx-observability

# Riavvia i container
docker compose up -d
```

### Problema: Le trace non appaiono in Grafana

**Possibili cause**:
1. OTel Collector non è raggiungibile
2. La rete non è configurata correttamente

**Debug**:
```bash
# Verifica che api_server sia connesso alla rete observability
docker inspect api_server | grep -A 10 Networks

# Dovresti vedere sia "onyx_default" che "mm-onyx-observability"

# Controlla i log del collector
docker logs otel-collector

# Cerca errori di connessione
```

### Problema: "Failed to export spans"

**Soluzione**:
```bash
# Verifica che otel-collector sia running
docker ps | grep otel-collector

# Riavvia se necessario
cd D:\MaticMind\NORA\observability
docker compose restart otel-collector
```

---

## 📊 Dashboard e Query Utili

### Dashboard Pre-configurate

1. **User Journey & Traces**
   - Path: Dashboards → MM-Onyx → User Journey & Traces
   - Mostra: Trace timeline, user activity, correlation logs

2. **API Performance**
   - Path: Dashboards → MM-Onyx → API Performance
   - Mostra: Request rate, latency, errors, CPU/memory

3. **System Overview**
   - Path: Dashboards → MM-Onyx → System Overview
   - Mostra: Health status, indexing, backend latencies

### Query TraceQL Utili

```traceql
# Trace di chat completion
{name="chat_completion"}

# Trace lente (> 2 secondi)
{duration > 2s}

# Trace con errori
{status=error}

# Trace per correlation ID specifico
{correlation.id="abc-123-def"}
```

### Query LogQL Utili

```logql
# Log con correlation ID
{job="mm-onyx-api"} |~ "correlation_id"

# Log di errori
{job="mm-onyx-api"} |= "ERROR"

# Log per endpoint specifico
{job="mm-onyx-api"} |~ "POST /api/chat"
```

### Query PromQL Utili

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

---

## 🎯 Metriche Business Custom

Per tracciare eventi business, usa le funzioni nel codice:

```python
from onyx.observability import track_chat_completion, track_search_query, track_document_indexing

# Traccia chat completion
track_chat_completion(
    duration=1.5,
    success=True,
    model="gpt-4",
    tokens_used=150
)

# Traccia search query
track_search_query(
    duration=0.3,
    results_count=10,
    query_type="hybrid"
)

# Traccia document indexing
track_document_indexing(
    success=True,
    document_count=5,
    connector_type="slack"
)
```

---

## 📚 Documentazione Completa

Per maggiori dettagli, consulta:

- **Architettura**: `D:\MaticMind\NORA\OBSERVABILITY_ARCHITECTURE.md`
- **Quick Start**: `D:\MaticMind\NORA\QUICKSTART.md`
- **Observability Stack**: `D:\MaticMind\NORA\observability\README.md`
- **Frontend Integration**: `D:\MaticMind\NORA\mm-onyx\web\OTEL_FRONTEND_INTEGRATION.md`

---

## ✅ Checklist Finale

- [x] Dipendenze OpenTelemetry aggiunte
- [x] Backend modificato per inizializzare OpenTelemetry
- [x] Correlation ID middleware aggiunto
- [x] Docker Compose configurato con rete observability
- [x] Variabili d'ambiente configurate
- [ ] **TODO**: Installare dipendenze (`uv sync`)
- [ ] **TODO**: Avviare observability stack
- [ ] **TODO**: Riavviare MM-Onyx
- [ ] **TODO**: Verificare funzionamento in Grafana

---

## 🎉 Pronto!

Tutti i file sono stati modificati correttamente. Segui gli step sopra per:
1. Installare le dipendenze
2. Avviare l'observability stack
3. Riavviare MM-Onyx
4. Verificare che tutto funzioni

Buon tracing! 🔭
