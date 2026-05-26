type NodeSDKLike = { start: () => Promise<void> | void; shutdown: () => Promise<void> };

let sdk: NodeSDKLike | null = null;

function asBool(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true';
}

export function initTracing(): void {
  if (asBool(process.env.OTEL_SDK_DISABLED) || sdk) return;

  void (async () => {
    try {
      const [{ NodeSDK }, { getNodeAutoInstrumentations }, { OTLPTraceExporter }] = await Promise.all([
        import('@opentelemetry/sdk-node'),
        import('@opentelemetry/auto-instrumentations-node'),
        import('@opentelemetry/exporter-trace-otlp-http'),
      ]);

      const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      const traceExporter = endpoint
        ? new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` })
        : new OTLPTraceExporter();

      sdk = new NodeSDK({
        traceExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-express': { enabled: true },
            '@opentelemetry/instrumentation-pg': { enabled: true },
            '@opentelemetry/instrumentation-ioredis': { enabled: true },
            '@opentelemetry/instrumentation-http': { enabled: true },
          }),
        ],
      });

      await Promise.resolve(sdk.start());
    } catch (err) {
      console.error('OpenTelemetry initialization failed (continuing without tracing):', err);
    }
  })();
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } catch (err) {
    console.error('OpenTelemetry shutdown failed:', err);
  } finally {
    sdk = null;
  }
}
