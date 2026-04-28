/**
 * Tiny structured logger.
 *
 * Goal: give the app a single place to emit JSON log lines without
 * forcing pino into the bundle. pino is heavy, edge-incompatible, and
 * the next-edge runtime panics if you pull it in via the wrong barrel.
 *
 * Writes structured JSON to stdout in production (parseable by any log
 * drain / OTel collector) and a human-friendly console line in dev.
 *
 * Every emit is additionally:
 *   1. Redacted: secrets and PII-shaped fields are masked before they
 *      leave the process — see lib/observability/redact.ts.
 *   2. Exported to OTLP: when OTEL_EXPORTER_OTLP_ENDPOINT is set, the
 *      record is batched and POSTed as OTLP/HTTP logs (Datadog Agent,
 *      Grafana, Honeycomb, self-hosted collector all accept this).
 *
 * API mirrors pino: logger.info(obj, msg), logger.warn, logger.error.
 */

import { redact } from './observability/redact';
import { otlpRecord } from './observability/otlp';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel: Level =
  (process.env.LOG_LEVEL as Level | undefined) ??
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const isProd = process.env.NODE_ENV === 'production';

function emit(level: Level, payload: Record<string, unknown> | string, msg?: string) {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  const message = typeof payload === 'string' ? payload : msg;
  const raw = {
    level,
    time: new Date().toISOString(),
    pid: typeof process !== 'undefined' ? process.pid : undefined,
    msg: message,
    ...(typeof payload === 'object' && payload !== null ? payload : {}),
  };
  const base = redact(raw);
  if (isProd) {
    // Structured JSON line — log drains / OTel collectors can parse this.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(base));
  } else {
    const fn =
      level === 'error'
        ? console.error
        : level === 'warn'
          ? console.warn
          : console.log;
    fn(`[${level}] ${base.msg ?? ''}`, base);
  }
  // Fire-and-forget OTLP export. Cheap no-op when unconfigured.
  otlpRecord(level, base as Record<string, unknown>, message ?? '');
}

export const logger = {
  debug(payload: Record<string, unknown> | string, msg?: string) {
    emit('debug', payload, msg);
  },
  info(payload: Record<string, unknown> | string, msg?: string) {
    emit('info', payload, msg);
  },
  warn(payload: Record<string, unknown> | string, msg?: string) {
    emit('warn', payload, msg);
  },
  error(payload: Record<string, unknown> | string, msg?: string) {
    emit('error', payload, msg);
  },
  /** Bind context (e.g. request id, user id) and return a child logger. */
  child(bindings: Record<string, unknown>) {
    return {
      debug: (p: Record<string, unknown> | string, m?: string) =>
        emit('debug', { ...bindings, ...(typeof p === 'object' && p !== null ? p : {}) }, typeof p === 'string' ? p : m),
      info: (p: Record<string, unknown> | string, m?: string) =>
        emit('info', { ...bindings, ...(typeof p === 'object' && p !== null ? p : {}) }, typeof p === 'string' ? p : m),
      warn: (p: Record<string, unknown> | string, m?: string) =>
        emit('warn', { ...bindings, ...(typeof p === 'object' && p !== null ? p : {}) }, typeof p === 'string' ? p : m),
      error: (p: Record<string, unknown> | string, m?: string) =>
        emit('error', { ...bindings, ...(typeof p === 'object' && p !== null ? p : {}) }, typeof p === 'string' ? p : m),
    };
  },
};

export type Logger = typeof logger;
