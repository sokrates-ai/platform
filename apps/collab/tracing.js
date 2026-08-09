'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

// Tracing is optional. The service must still start in local/self-hosted
// environments that do not run an OTLP collector.
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  const serviceName = process.env.OTEL_SERVICE_NAME || 'sokrates-collab';
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS,
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    sdk.start();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[otel] failed to start tracing', err);
  }

  const shutdown = () => sdk.shutdown().catch(() => {});
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

