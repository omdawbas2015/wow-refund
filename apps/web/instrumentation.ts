/**
 * Next.js 15 instrumentation hook.
 *
 * Initialises:
 *   1. OpenTelemetry SDK (when OTEL_EXPORTER_OTLP_ENDPOINT is set)
 *   2. Sentry Node/Edge SDK (when SENTRY_DSN is set)
 *
 * Both are no-ops when their respective env vars are absent.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // OpenTelemetry — Node.js only
    if (process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const { getNodeAutoInstrumentations } = await import(
        '@opentelemetry/auto-instrumentations-node'
      );
      const { OTLPTraceExporter } = await import(
        '@opentelemetry/exporter-trace-otlp-http'
      );
      const { resourceFromAttributes } = await import('@opentelemetry/resources');

      const sdk = new NodeSDK({
        resource: resourceFromAttributes({
          'service.name': 'wow-refund-web',
          'service.version': process.env['npm_package_version'] ?? '0.0.0',
        }),
        traceExporter: new OTLPTraceExporter(),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
          }),
        ],
      });

      sdk.start();
    }

    // Sentry — Node.js
    if (process.env['SENTRY_DSN']) {
      await import('./sentry.server.config');
    }
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    // Sentry — Edge
    if (process.env['SENTRY_DSN']) {
      await import('./sentry.edge.config');
    }
  }
}
