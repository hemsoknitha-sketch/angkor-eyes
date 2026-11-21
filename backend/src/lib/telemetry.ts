import { env } from '../config';
import { logger } from './logger';

/**
 * Telemetry stubs: OpenTelemetry + Sentry wiring points.
 * Real exporters are enabled only when SENTRY_DSN / OTEL endpoint are set;
 * the rest of the code calls these helpers unconditionally so instrumentation
 * is uniform and never crashes when telemetry is off.
 */
let sentryEnabled = false;
try {
  if (env.SENTRY_DSN) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/node') as typeof import('@sentry/node');
    Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0.1 });
    sentryEnabled = true;
  }
} catch (err) {
  logger.warn({ err }, 'sentry init failed — continuing without Sentry');
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  logger.error({ err, ...context }, 'captured exception');
  if (!sentryEnabled) return;
  try {
    const Sentry = require('@sentry/node') as typeof import('@sentry/node');
    Sentry.captureException(err, { extra: context });
  } catch { /* telemetry must never break the request */ }
}

export function startSpan<T>(name: string, fn: () => T): T {
  // OpenTelemetry span stub: when OTEL_EXPORTER_OTLP_ENDPOINT is set, the
  // deployment wires @opentelemetry/sdk-node here. Until then this is a
  // no-op wrapper that preserves the call shape.
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    logger.debug({ span: name }, 'otel span (exporter configured — wire sdk-node in deployment)');
  }
  return fn();
}

export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  logger.debug({ metric: name, value, ...tags }, 'metric');
}
