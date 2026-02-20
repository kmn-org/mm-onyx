# OpenTelemetry Frontend Integration Guide

## Overview

Questa guida spiega come integrare OpenTelemetry nel frontend Next.js di MM-Onyx.

## Step 1: Installare le dipendenze

Aggiungi le seguenti dipendenze al `package.json`:

```bash
cd web
npm install --save \
  @opentelemetry/api \
  @opentelemetry/sdk-trace-web \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/context-zone \
  @opentelemetry/instrumentation \
  @opentelemetry/instrumentation-fetch \
  @opentelemetry/instrumentation-xml-http-request \
  @opentelemetry/instrumentation-document-load \
  @opentelemetry/instrumentation-user-interaction \
  @opentelemetry/core
```

## Step 2: Inizializzare OpenTelemetry

### 2.1 Creare un provider component

Crea `web/components/providers/OtelProvider.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { initializeOpenTelemetry, getCorrelationId } from '@/lib/observability/otel-setup';

export function OtelProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize only on client side
    if (typeof window !== 'undefined') {
      initializeOpenTelemetry({
        serviceName: 'mm-onyx-frontend',
        serviceVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        otlpEndpoint: process.env.NEXT_PUBLIC_OTEL_ENDPOINT || 'http://localhost:4318/v1/traces',
        environment: process.env.NODE_ENV,
        enabled: process.env.NEXT_PUBLIC_OTEL_ENABLED !== 'false',
      });

      // Log correlation ID for debugging
      console.info('[Observability] Session Correlation ID:', getCorrelationId());
    }
  }, []);

  return <>{children}</>;
}
```

### 2.2 Aggiungere il provider al layout root

Modifica `web/app/layout.tsx`:

```tsx
import { OtelProvider } from '@/components/providers/OtelProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <OtelProvider>
          {/* Your existing providers */}
          {children}
        </OtelProvider>
      </body>
    </html>
  );
}
```

## Step 3: Configurare le variabili d'ambiente

Crea/modifica `web/.env.local`:

```bash
# OpenTelemetry Configuration
NEXT_PUBLIC_OTEL_ENABLED=true
NEXT_PUBLIC_OTEL_ENDPOINT=http://localhost:4318/v1/traces
NEXT_PUBLIC_APP_VERSION=1.0.0
```

Per production, usa l'endpoint del collector:
```bash
NEXT_PUBLIC_OTEL_ENDPOINT=http://otel-collector:4318/v1/traces
```

## Step 4: Utilizzare il tracing nel codice

### 4.1 Tracciare chiamate API

Crea un wrapper per le chiamate API in `web/lib/api/client.ts`:

```typescript
import { tracedFetch, trackError } from '@/lib/observability/otel-setup';

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await tracedFetch(
      `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    trackError(error as Error, {
      endpoint,
      method: options?.method || 'GET',
    });
    throw error;
  }
}
```

### 4.2 Tracciare azioni utente

```typescript
import { trackUserAction, withSpan } from '@/lib/observability/otel-setup';

// In un component
function ChatInput() {
  const sendMessage = async (message: string) => {
    // Track user action
    trackUserAction('send_chat_message', {
      message_length: message.length,
    });

    // Wrap async operation in span
    await withSpan(
      'chat_completion',
      async () => {
        const response = await apiCall('/api/chat', {
          method: 'POST',
          body: JSON.stringify({ message }),
        });
        return response;
      },
      {
        'chat.message_length': message.length,
      }
    );
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      sendMessage(formData.get('message') as string);
    }}>
      <input name="message" />
      <button type="submit">Send</button>
    </form>
  );
}
```

### 4.3 Tracciare page views

Crea un hook custom in `web/hooks/usePageTracking.ts`:

```typescript
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/observability/otel-setup';

export function usePageTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname, {
        search: searchParams?.toString(),
      });
    }
  }, [pathname, searchParams]);
}
```

Usa nel layout o nei componenti:

```tsx
'use client';

import { usePageTracking } from '@/hooks/usePageTracking';

export function PageTracker() {
  usePageTracking();
  return null;
}
```

### 4.4 Tracciare search queries

```typescript
import { withSpan } from '@/lib/observability/otel-setup';

async function searchDocuments(query: string) {
  return withSpan(
    'search_query',
    async () => {
      const results = await apiCall('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      return results;
    },
    {
      'search.query': query,
      'search.query_length': query.length,
    }
  );
}
```

### 4.5 Error tracking

Crea un error boundary con tracking:

```tsx
'use client';

import React from 'react';
import { trackError } from '@/lib/observability/otel-setup';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track error with OpenTelemetry
    trackError(error, {
      component: errorInfo.componentStack,
      'error.boundary': true,
    });

    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Step 5: Configurare Next.js per OTLP export

### 5.1 Configurare CORS nel backend

Assicurati che il backend accetti richieste CORS dal frontend.

In `backend/onyx/main.py`, verifica che CORS sia configurato:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID", "X-Request-ID"],
)
```

### 5.2 Proxy per OTLP in sviluppo

Se hai problemi CORS in development, aggiungi un proxy in `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/otel/:path*',
        destination: 'http://localhost:4318/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```

Poi usa endpoint relativo:
```bash
NEXT_PUBLIC_OTEL_ENDPOINT=/otel/v1/traces
```

## Step 6: Testing

### 6.1 Verifica inizializzazione

Apri la console del browser e cerca:
```
[OpenTelemetry] Initialized successfully
[Observability] Session Correlation ID: xxx-xxx-xxx
```

### 6.2 Verifica trace nel network

1. Apri DevTools → Network
2. Filtra per "v1/traces"
3. Dovresti vedere richieste POST con span data

### 6.3 Verifica in Grafana

1. Apri Grafana: http://localhost:3001
2. Vai su Explore
3. Seleziona "Tempo"
4. Query: `{service.name="mm-onyx-frontend"}`
5. Dovresti vedere le trace del frontend

## Step 7: Best Practices

### 7.1 Non tracciare tutto

Evita di creare span per ogni piccola operazione. Traccia solo:
- Chiamate API
- Operazioni async significative
- Azioni utente importanti
- Page views
- Errori

### 7.2 Usa attributi significativi

Aggiungi sempre attributi utili agli span:
```typescript
withSpan('operation', () => {...}, {
  'user.id': userId,
  'operation.type': 'search',
  'data.size': dataLength,
});
```

### 7.3 Gestisci gli errori

Traccia sempre gli errori:
```typescript
try {
  await operation();
} catch (error) {
  trackError(error as Error, { context: 'operation_name' });
  throw error;
}
```

### 7.4 Performance

- Usa BatchSpanProcessor (già configurato)
- Non bloccare il rendering per tracing
- Disabilita in development se rallenta

### 7.5 Privacy

Non includere dati sensibili negli span:
- ❌ Password, token, PII
- ✅ IDs, lunghezze, stati, tipi

## Step 8: Troubleshooting

### Le trace non appaiono in Grafana

1. Verifica la console del browser per errori
2. Verifica il network tab per chiamate a `/v1/traces`
3. Verifica che CORS sia configurato correttamente
4. Verifica che OTel Collector sia running

### CORS errors

Aggiungi l'origin del frontend alle allowed origins:
- Nel collector config
- Nel backend CORS config

### Performance issues

Se il tracing rallenta l'app:
1. Aumenta `scheduledDelayMillis` nel BatchSpanProcessor
2. Riduci `maxQueueSize`
3. Disabilita UserInteractionInstrumentation

### Span non vengono inviati

Verifica che:
1. L'endpoint OTLP sia raggiungibile
2. La rete non blocchi le richieste
3. Il browser supporti fetch API

## Esempi Completi

### Chat Component con full tracing

```tsx
'use client';

import { useState } from 'react';
import { tracedFetch, trackUserAction, withSpan, trackError } from '@/lib/observability/otel-setup';

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (content: string) => {
    trackUserAction('chat_message_sent', {
      message_length: content.length,
    });

    setLoading(true);

    try {
      const response = await withSpan(
        'chat_completion',
        async () => {
          return await tracedFetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ message: content }),
          });
        },
        {
          'chat.message_length': content.length,
        }
      );

      const data = await response.json();
      setMessages([...messages, { role: 'user', content }, data]);
    } catch (error) {
      trackError(error as Error, {
        operation: 'chat_completion',
        message_length: content.length,
      });
      // Handle error in UI
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Chat UI */}
    </div>
  );
}
```

## Monitoraggio End-to-End

Con questa configurazione, puoi tracciare un user journey completo:

1. **Frontend**: User clicca "Send message"
2. **Frontend→Backend**: Fetch con correlation ID
3. **Backend→Vespa**: Search con correlation ID propagato
4. **Backend→Ollama**: LLM call con correlation ID
5. **Backend→Frontend**: Response con correlation ID

Tutti questi step saranno visibili in Grafana come una singola trace distribuita!
