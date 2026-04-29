import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  hashEmail,
  hashPhone,
  normalizeEmail,
  normalizePhone,
  isHashEnabled,
  looksLikeEmail,
  looksLikePhone,
} from './pii-hash';

const VALID_KEY = 'a'.repeat(64);

describe('pii-hash', () => {
  const originalKey = process.env['PII_HASH_KEY'];

  beforeEach(() => {
    process.env['PII_HASH_KEY'] = VALID_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env['PII_HASH_KEY'];
    else process.env['PII_HASH_KEY'] = originalKey;
  });

  it('normalizes email and phone consistently', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(normalizePhone('+965 555 12-34')).toBe('965555 12-34'.replace(/\D/g, ''));
  });

  it('hashEmail is deterministic + differs for different inputs', () => {
    const a = hashEmail('alice@example.com');
    const b = hashEmail('ALICE@example.com');
    const c = hashEmail('bob@example.com');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashPhone normalizes to digits', () => {
    expect(hashPhone('+965-555 1234')).toBe(hashPhone('9655551234'));
  });

  it('returns null for null/empty input', () => {
    expect(hashEmail(null)).toBeNull();
    expect(hashEmail('')).toBeNull();
    expect(hashPhone(null)).toBeNull();
    expect(hashPhone('')).toBeNull();
  });

  it('returns null when no key configured (no-op mode)', () => {
    delete process.env['PII_HASH_KEY'];
    expect(isHashEnabled()).toBe(false);
    expect(hashEmail('x@y.z')).toBeNull();
    expect(hashPhone('+96512345678')).toBeNull();
  });

  it('throws when key is too short', () => {
    process.env['PII_HASH_KEY'] = 'short';
    expect(() => hashEmail('x@y.z')).toThrow(/at least 16 bytes/);
  });

  it('looksLikeEmail / looksLikePhone shape checks', () => {
    expect(looksLikeEmail('a@b.co')).toBe(true);
    expect(looksLikeEmail('just-a-string')).toBe(false);
    expect(looksLikePhone('+965 555 1234')).toBe(true);
    expect(looksLikePhone('REF-KW-2026-1')).toBe(false);
  });
});
