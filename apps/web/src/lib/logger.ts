/**
 * Structured logger built on pino.
 *
 * Node.js runtime: real pino with JSON output, pretty-printing in dev.
 * Edge runtime:    lightweight console shim (pino is not edge-compatible).
 *
 * API surface mirrors pino: logger.info(obj, msg), logger.child(bindings).
 * All existing call sites continue to work unchanged.
 *
 * Sprint G #28. OTel trace context is injected automatically when the
 * OTel SDK is active (see instrumentation.ts).
 */
import pino from 'pino';

type Level = 'debug' | 'info' | 'warn' | 'error';

const level: Level =
  (process.env['LOG_LEVEL'] as Level | undefined) ??
  (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');

const isNode = typeof process !== 'undefined' && process.versions?.node;

const isTest = process.env['NODE_ENV'] === 'test' || !!process.env['VITEST'];

function createPinoLogger() {
  return pino({
    level,
    // pino-pretty uses a worker thread (async) — skip it in tests
    ...(process.env['NODE_ENV'] !== 'production' && !isTest
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Mixin injects OTel trace context when available
    mixin() {
      try {
        const otelApi = require('@opentelemetry/api') as typeof import('@opentelemetry/api');
        const span = otelApi.trace.getActiveSpan();
        if (span) {
          const ctx = span.spanContext();
          return {
            traceId: ctx.traceId,
            spanId: ctx.spanId,
          };
        }
      } catch {
        // OTel not available — skip
      }
      return {};
    },
  });
}

// Edge-compatible fallback that matches the pino API surface
function createEdgeLogger() {
  const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  const minLevel = LEVELS[level] ?? 20;

  function emit(lvl: Level, payload: Record<string, unknown> | string, msg?: string) {
    if (LEVELS[lvl] < minLevel) return;
    const base = {
      level: lvl,
      time: new Date().toISOString(),
      msg: typeof payload === 'string' ? payload : msg,
      ...(typeof payload === 'object' && payload !== null ? payload : {}),
    };
    const fn = lvl === 'error' ? console.error : lvl === 'warn' ? console.warn : console.log;
    fn(JSON.stringify(base));
  }

  const make = (bindings: Record<string, unknown> = {}) => ({
    debug: (p: Record<string, unknown> | string, m?: string) =>
      emit('debug', { ...bindings, ...(typeof p === 'object' && p !== null ? p : {}) }, typeof p === 'string' ? p : m),
    info: (p: Record<string, unknown> | string, m?: string) =>
      emit('info', { ...bindings, ...(typeof p === 'object' && p !== null ? p : {}) }, typeof p === 'string' ? p : m),
    warn: (p: Record<string, unknown> | string, m?: string) =>
      emit('warn', { ...bindings, ...(typeof p === 'object' && p !== null ? p : {}) }, typeof p === 'string' ? p : m),
    error: (p: Record<string, unknown> | string, m?: string) =>
      emit('error', { ...bindings, ...(typeof p === 'object' && p !== null ? p : {}) }, typeof p === 'string' ? p : m),
    child: (b: Record<string, unknown>) => make({ ...bindings, ...b }),
  });

  return make();
}

export const logger = isNode ? createPinoLogger() : createEdgeLogger();

export type Logger = typeof logger;
