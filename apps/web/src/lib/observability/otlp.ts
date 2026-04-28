/**
 * OTLP/HTTP log exporter.
 *
 * When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, every `logger.*` call is
 * additionally batched and POSTed to `<endpoint>/v1/logs` in OTLP JSON
 * format. Compatible with any OTLP-compliant collector:
 *
 *   - Datadog (Agent with OTLP receiver enabled)
 *   - Grafana Cloud / Loki (via Grafana Agent)
 *   - Honeycomb (with classic key + `OTEL_EXPORTER_OTLP_HEADERS`)
 *   - Self-hosted OpenTelemetry Collector
 *
 * Headers can be passed via `OTEL_EXPORTER_OTLP_HEADERS` as comma-
 * separated `key=value` pairs — matches upstream OTEL SDK convention.
 *
 * Batching: messages accumulate in a buffer and flush every 2 seconds
 * or whenever the buffer hits 100 entries. A flush failure logs locally
 * and drops the batch — we never stall the app on observability.
 */

interface OtlpLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: Array<{ key: string; value: { stringValue: string } }>;
}

const SEVERITY_MAP: Record<string, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

const BATCH_LIMIT = 100;
const FLUSH_INTERVAL_MS = 2000;

let buffer: OtlpLogRecord[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let parsedHeaders: Record<string, string> | null = null;

function endpoint(): string | null {
  const url = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  if (!url) return null;
  const base = url.replace(/\/$/, '');
  return `${base}/v1/logs`;
}

function headers(): Record<string, string> {
  if (parsedHeaders !== null) return parsedHeaders;
  const raw = process.env['OTEL_EXPORTER_OTLP_HEADERS'] ?? '';
  const parsed: Record<string, string> = { 'Content-Type': 'application/json' };
  if (raw) {
    for (const pair of raw.split(',')) {
      const [k, v] = pair.split('=').map((s) => s?.trim());
      if (k && v) parsed[k] = v;
    }
  }
  parsedHeaders = parsed;
  return parsed;
}

function serviceName(): string {
  return process.env['OTEL_SERVICE_NAME'] ?? 'wow-refund-web';
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

async function flush(): Promise<void> {
  const url = endpoint();
  if (!url || buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  const body = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName() } },
            { key: 'deployment.environment', value: { stringValue: process.env['SENTRY_ENV'] ?? process.env.NODE_ENV ?? 'development' } },
          ],
        },
        scopeLogs: [{ scope: { name: 'wow-refund' }, logRecords: batch }],
      },
    ],
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      // Don't let a hung collector block the event loop forever.
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // Explicitly use console.warn — routing through the logger would
    // recurse back into the exporter.
    console.warn(
      '[otlp] log batch export failed, dropping',
      batch.length,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Called by the logger for every emit. Cheap no-op when unconfigured. */
export function otlpRecord(
  level: 'debug' | 'info' | 'warn' | 'error',
  record: Record<string, unknown>,
  message: string,
): void {
  if (!endpoint()) return;
  const attrs: OtlpLogRecord['attributes'] = [];
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined || v === null) continue;
    const stringValue = typeof v === 'string' ? v : JSON.stringify(v);
    attrs.push({ key: k, value: { stringValue } });
  }
  const ts = BigInt(Date.now()) * 1_000_000n;
  buffer.push({
    timeUnixNano: ts.toString(),
    severityNumber: SEVERITY_MAP[level] ?? 9,
    severityText: level.toUpperCase(),
    body: { stringValue: message },
    attributes: attrs,
  });
  if (buffer.length >= BATCH_LIMIT) {
    void flush();
  } else {
    scheduleFlush();
  }
}

/** Test-only: reset state between tests. */
export function __resetOtlpForTests(): void {
  buffer = [];
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  parsedHeaders = null;
}
