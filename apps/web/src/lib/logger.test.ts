import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('lib/logger', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    delete process.env['LOG_LEVEL'];
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('emits structured output via pino', async () => {
    const { logger } = await import('./logger');
    logger.info('hello');
    logger.warn('careful');
    logger.error('boom');
    // pino writes directly to process.stdout
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('child(bindings) returns a logger with same API', async () => {
    const { logger } = await import('./logger');
    const scoped = logger.child({ requestId: 'abc' });
    expect(scoped).toBeDefined();
    expect(typeof scoped.info).toBe('function');
    expect(typeof scoped.error).toBe('function');
    scoped.info({ caseId: 'c1' }, 'created');
    expect(stdoutSpy).toHaveBeenCalled();
  });

  it('exports Logger type', async () => {
    const mod = await import('./logger');
    expect(mod.logger).toBeDefined();
  });
});
