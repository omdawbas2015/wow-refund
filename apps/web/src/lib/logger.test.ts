import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('lib/logger', () => {
  const originalWrite = process.stdout.write;
  let writeCallCount = 0;

  beforeEach(() => {
    vi.resetModules();
    delete process.env['LOG_LEVEL'];
    writeCallCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stdout.write = ((...args: any[]) => {
      writeCallCount++;
      return originalWrite.apply(process.stdout, args as [string]);
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  it('emits structured output via pino', async () => {
    const { logger } = await import('./logger');
    logger.info('hello');
    logger.warn('careful');
    logger.error('boom');
    expect(writeCallCount).toBeGreaterThan(0);
  });

  it('child(bindings) returns a logger with same API', async () => {
    const { logger } = await import('./logger');
    const scoped = logger.child({ requestId: 'abc' });
    expect(scoped).toBeDefined();
    expect(typeof scoped.info).toBe('function');
    expect(typeof scoped.error).toBe('function');
    scoped.info({ caseId: 'c1' }, 'created');
    expect(writeCallCount).toBeGreaterThan(0);
  });

  it('exports Logger type', async () => {
    const mod = await import('./logger');
    expect(mod.logger).toBeDefined();
  });
});
