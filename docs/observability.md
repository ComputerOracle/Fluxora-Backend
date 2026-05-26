# Observability and Distributed Tracing

Fluxora uses OpenTelemetry to create distributed traces across HTTP, Express, PostgreSQL (`pg`), Redis (`ioredis`), and outbound HTTP calls.

## Startup

Tracing is initialized in `src/index.ts` **before** application bootstrapping, so all instrumentation hooks are active before `app.ts` creates middleware/routes.

## Configuration

- `OTEL_SDK_DISABLED=true` disables telemetry completely and short-circuits startup (no SDK initialization, no exporter creation, and no runtime crash path from telemetry setup).
- `OTEL_EXPORTER_OTLP_ENDPOINT` sets your collector endpoint (for example `http://otel-collector:4318`).
- `OTEL_LOG_LEVEL=debug` enables OTel SDK diagnostic logs.

Exporter behavior:
- Spans are sent via OTLP HTTP to `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`.
- If endpoint is unavailable (collector down, network failure, timeout), exporter errors are logged by OTel diagnostics and contained by the SDK; Fluxora continues serving requests.

## Context propagation

- Inbound W3C `traceparent` headers are automatically extracted by OpenTelemetry HTTP instrumentation.
- Outbound HTTP calls carry propagated trace context.
- Express route spans are linked with DB/Redis/RPC child spans through active context propagation.

## Security assumptions

`src/tracing/hooks.ts` includes `scrubSpanAttributes` to redact common PII/secrets from custom business span attributes. Never attach raw credentials, JWTs, or user emails to spans.

## Local verification

1. Start an OTLP-compatible collector (Jaeger/Tempo/OTel Collector).
2. Set `OTEL_EXPORTER_OTLP_ENDPOINT`.
3. Run Fluxora and issue API requests.
4. Confirm traces include Express spans and downstream child spans.
