/**
 * OpenTelemetry Setup for MM-Onyx Frontend
 *
 * NOTA: Questo file è un placeholder.
 * L'integrazione frontend OpenTelemetry è opzionale e può essere aggiunta dopo
 * che il backend funziona correttamente.
 *
 * Per ora, usa solo il correlation ID senza OpenTelemetry SDK completo.
 */

let correlationId: string | null = null;

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get current correlation ID
 */
export function getCorrelationId(): string {
  if (!correlationId) {
    correlationId = generateCorrelationId();
  }
  return correlationId;
}

/**
 * Set correlation ID (useful when receiving from backend)
 */
export function setCorrelationId(id: string) {
  correlationId = id;
}

/**
 * Add correlation ID to fetch headers
 */
export function addCorrelationIdToHeaders(
  headers: HeadersInit = {}
): HeadersInit {
  const headersObj = new Headers(headers);
  headersObj.set('X-Correlation-ID', getCorrelationId());
  headersObj.set('X-Request-ID', getCorrelationId());
  return headersObj;
}

/**
 * Wrapper for fetch with automatic correlation ID
 */
export async function tracedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // Add correlation ID to headers
  const headers = addCorrelationIdToHeaders(init?.headers);

  // Make request with updated headers
  return fetch(input, {
    ...init,
    headers,
  });
}

// Stub functions for compatibility
export function initializeOpenTelemetry(config?: any): void {
  console.info('[Observability] Frontend OpenTelemetry disabled - using correlation ID only');
}

export function getTracer(name?: string) {
  return null;
}

export function withSpan<T>(
  spanName: string,
  fn: () => T | Promise<T>,
  attributes?: Record<string, any>
): T | Promise<T> {
  // Just execute the function without tracing
  return fn();
}

export function trackPageView(path: string, metadata?: Record<string, any>) {
  // Stub - no-op
}

export function trackUserAction(action: string, metadata?: Record<string, any>) {
  // Stub - no-op
}

export function trackError(error: Error, context?: Record<string, any>) {
  // Log to console for debugging
  console.error('[Observability] Error tracked:', error.message, context);
}
