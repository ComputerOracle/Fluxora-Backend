import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scrubSpanAttributes,
  traceBusinessOperation,
  initializeTracer,
  resetTracer,
  getTracer,
} from '../../src/tracing/hooks.js';

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

describe('tracing hooks business helpers', () => {
  beforeEach(() => {
    resetTracer();
  });

  it('scrubs pii attributes including credentials-like keys', () => {
    const attrs = scrubSpanAttributes({ email: 'a@b.com', token: 'abc', authorization: 'Bearer x', password: 'p', secret: 's', safe: 'ok' });
    expect(attrs.email).toBe('[REDACTED]');
    expect(attrs.token).toBe('[REDACTED]');
    expect(attrs.authorization).toBe('[REDACTED]');
    expect(attrs.password).toBe('[REDACTED]');
    expect(attrs.secret).toBe('[REDACTED]');
    expect(attrs.safe).toBe('ok');
  });

  it('creates business span and emits lifecycle events', async () => {
    initializeTracer({ enabled: true });
    const tracer = getTracer();
    const eventSpy = vi.spyOn(tracer, 'recordEvent');

    await expect(traceBusinessOperation('settlement', 'corr-1', { safe: 1 }, async () => 'done')).resolves.toBe('done');

    expect(eventSpy).toHaveBeenCalledWith(expect.any(Object), 'business.operation.start', { operationName: 'settlement' });
    expect(eventSpy).toHaveBeenCalledWith(expect.any(Object), 'business.operation.end', { operationName: 'settlement' });
  });

  it('creates a root span when no inbound traceparent exists', async () => {
    initializeTracer({ enabled: true });
    await expect(traceBusinessOperation('root', 'corr-2', {}, async () => 1)).resolves.toBe(1);
  });

  it('supports disabled tracing with no crashes', async () => {
    initializeTracer({ enabled: false });
    const recordSpy = vi.spyOn(getTracer(), 'recordEvent');
    await expect(traceBusinessOperation('disabled', 'corr-3', {}, async () => 'ok')).resolves.toBe('ok');
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('handles exporter/hook failures without breaking operation', async () => {
    initializeTracer({
      enabled: true,
      hooks: {
        onEvent: () => { throw new Error('hook failure'); },
      },
    });

    await expect(traceBusinessOperation('resilient', 'corr-4', {}, async () => 'ok')).resolves.toBe('ok');
  });

  it('keeps async flow intact inside traced operation', async () => {
    initializeTracer({ enabled: true });
    const value = await traceBusinessOperation('async', 'corr-5', {}, async () => {
      await sleep(1);
      await sleep(1);
      return 42;
    });
    expect(value).toBe(42);
  });
});
