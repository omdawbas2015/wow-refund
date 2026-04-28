import { describe, it, expect } from 'vitest';
import { redact } from './redact';

describe('redact', () => {
  it('returns primitives unchanged', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact('hi')).toBe('hi');
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
  });

  it('masks secret-shaped keys', () => {
    const r = redact({
      password: 'hunter2',
      apiKey: 'k-123',
      api_key: 'k-456',
      authorization: 'Bearer abc',
      cookie: 'session=xyz',
      sessionSecret: 's',
      keep: 'ok',
    });
    expect(r).toEqual({
      password: '[REDACTED]',
      apiKey: '[REDACTED]',
      api_key: '[REDACTED]',
      authorization: '[REDACTED]',
      cookie: '[REDACTED]',
      sessionSecret: '[REDACTED]',
      keep: 'ok',
    });
  });

  it('masks emails and phones partially', () => {
    const r = redact({
      customerEmail: 'alice@example.com',
      to: 'bob@corp.ae',
      cc: 'verylong@domain.com',
      customerPhone: '+9655551234',
      keep: 'neutral',
    });
    expect(r).toEqual({
      customerEmail: 'a***@example.com',
      to: 'b***@corp.ae',
      cc: 'v***@domain.com',
      customerPhone: '96***34',
      keep: 'neutral',
    });
  });

  it('recurses into nested objects and arrays', () => {
    const r = redact({
      user: { password: 'p', customerEmail: 'x@y.z' },
      list: [{ token: 't' }, { keep: 1 }],
    });
    expect(r).toEqual({
      user: { password: '[REDACTED]', customerEmail: 'x***@y.z' },
      list: [{ token: '[REDACTED]' }, { keep: 1 }],
    });
  });

  it('handles circular references without crashing', () => {
    const a: Record<string, unknown> = { password: 'x' };
    a.self = a;
    const r = redact(a);
    expect((r as { password: string }).password).toBe('[REDACTED]');
  });

  it('does not mutate the input', () => {
    const input = { password: 'p' };
    redact(input);
    expect(input.password).toBe('p');
  });
});
