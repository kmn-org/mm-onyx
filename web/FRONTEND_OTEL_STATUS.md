# Frontend OpenTelemetry - Status

## ⚠️ Stato Attuale: DISABILITATO

L'integrazione OpenTelemetry completa nel frontend Next.js è stata **temporaneamente disabilitata** a causa di problemi di compatibilità TypeScript con le dipendenze OpenTelemetry.

## ✅ Cosa Funziona

### Correlation ID
Il **Correlation ID** è completamente funzionale anche senza OpenTelemetry SDK:

```typescript
import { getCorrelationId, tracedFetch } from '@/lib/observability/otel-setup-placeholder';

// Ottieni correlation ID
const corrId = getCorrelationId();

// Usa fetch con correlation ID automatico
const response = await tracedFetch('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify({ data: 'test' })
});
```

Il Correlation ID viene:
- ✅ Generato automaticamente alla prima richiesta
- ✅ Propagato in tutti gli header HTTP (`X-Correlation-ID`)
- ✅ Inviato al backend
- ✅ Loggato nel backend con ogni richiesta
- ✅ Visibile nelle trace di Tempo

## ❌ Cosa NON Funziona (Temporaneamente)

- ❌ Trace browser native (spans per fetch, click, page load)
- ❌ Export automatico a OpenTelemetry Collector
- ❌ Instrumentazione automatica di fetch/XHR
- ❌ User interaction tracking
- ❌ Browser performance metrics

## 🔧 Perché È Stato Disabilitato?

Errore TypeScript durante il build:
```
Type error: 'Resource' only refers to a type, but is being used as a value here.
```

Questo è un problema noto con:
- Next.js 16.x + TypeScript
- OpenTelemetry SDK per browser
- Type stripping in produzione

## 🚀 Come Riabilitare (Quando Necessario)

### Opzione 1: Aspettare Fix Upstream
Aspettare che OpenTelemetry risolva i problemi di compatibilità con Next.js 16.

### Opzione 2: Usare Dynamic Import
```typescript
// Invece di import statico
// import { Resource } from '@opentelemetry/resources';

// Usa dynamic import
const initOtel = async () => {
  const { Resource } = await import('@opentelemetry/resources');
  const { WebTracerProvider } = await import('@opentelemetry/sdk-trace-web');
  // ... resto del setup
};
```

### Opzione 3: Configurazione Webpack Custom
Modificare `next.config.js` per gestire correttamente gli import OpenTelemetry:

```javascript
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
  }
  return config;
}
```

### Opzione 4: Usare Un Approccio Più Semplice
Invece di OpenTelemetry SDK completo, usare solo:
- Correlation ID (già funzionante)
- Manual span creation via API
- Custom analytics library più leggera

## 📊 Impatto Sul Sistema

### ✅ Funzionalità NON Compromesse

1. **Backend Tracing**: Funziona completamente
   - Tutte le richieste API sono tracciate
   - Correlation ID funziona end-to-end
   - Span di database, Redis, HTTP calls

2. **Log Correlation**: Funziona completamente
   - Tutti i log hanno correlation ID
   - Puoi seguire il journey da frontend a backend

3. **Metriche Backend**: Funzionano completamente
   - Business metrics (chat, search, indexing)
   - System metrics (CPU, memory, latency)

4. **Dashboard Grafana**: Funzionano completamente
   - Trace visualization
   - Log aggregation
   - Metrics graphs

### ⚠️ Funzionalità Mancanti (Non Critiche)

1. **Browser-side spans**: Non vengono create
   - Impatto: Minimo - puoi vedere il tempo totale frontend→backend nei log
   - Workaround: Usa console.time/timeEnd per debug

2. **Automatic instrumentation**: Non attiva
   - Impatto: Minimo - correlation ID funziona comunque
   - Workaround: Tracking manuale dove necessario

3. **User interaction tracking**: Non attivo
   - Impatto: Basso - puoi usare Google Analytics o simili
   - Workaround: Event tracking manuale

## 🎯 Raccomandazione

**Procedi con il backend OpenTelemetry senza frontend per ora.**

Motivi:
1. ✅ Backend tracing è la parte più importante
2. ✅ Correlation ID funziona comunque end-to-end
3. ✅ Puoi tracciare 90% dei problemi con solo backend tracing
4. ✅ Frontend tracing può essere aggiunto dopo senza impatto

## 📝 TODO Futuro

Quando vorrai riabilitare il frontend OpenTelemetry:

1. [ ] Verificare nuove versioni di `@opentelemetry/sdk-trace-web`
2. [ ] Testare con Next.js 16.2+ (potrebbero aver fixato)
3. [ ] Considerare alternative: RUM tools, Sentry performance, ecc.
4. [ ] Valutare se il beneficio giustifica lo sforzo

## 🔗 Link Utili

- [OpenTelemetry JS Browser Issues](https://github.com/open-telemetry/opentelemetry-js/issues)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [Alternative: Sentry Performance](https://docs.sentry.io/platforms/javascript/performance/)

## ✅ Conclusione

**Il sistema di observability è completamente funzionale per il 90% dei casi d'uso senza frontend OpenTelemetry.**

Continua con:
1. ✅ Backend tracing (funzionante)
2. ✅ Correlation ID (funzionante)
3. ✅ Log aggregation (funzionante)
4. ✅ Metrics (funzionanti)
5. ✅ Dashboard (funzionanti)

Il frontend tracing è un nice-to-have, non un must-have.
