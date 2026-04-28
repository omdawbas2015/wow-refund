import { describe, it, expect } from 'vitest';
import { generateRequestId, readRequestId, requestIdHeader } from './request-id';

describe('request-id', () => {
  it('generates distinct base64url values', () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{10,}$/);
  });

  it('header name is x-request-id', () => {
    expect(requestIdHeader()).toBe('x-request-id');
  });

  it('reads header case-insensitively', () => {
    const h1 = new Headers({ 'x-request-id': 'abc' });
    const h2 = new Headers({ 'X-Request-Id': 'def' });
    expect(readRequestId(h1)).toBe('abc');
    // Headers normalizes name, so upper-case lookup still finds it
    expect(readRequestId(h2)).toBe('def');
  });

  it('returns null when header absent', () => {
    const h = new Headers();
    expect(readRequestId(h)).toBeNull();
  });
});
