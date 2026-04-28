import { describe, it, expect } from 'vitest';
import { signBody, verifyBodySignature, legacyEqualsSecret } from './signature';

describe('signBody / verifyBodySignature', () => {
  const secret = 'test-secret-123';
  const body = JSON.stringify({ hello: 'world', n: 1 });

  it('signs deterministically', () => {
    expect(signBody(body, secret)).toBe(signBody(body, secret));
  });

  it('verifies a matching signature', () => {
    const sig = signBody(body, secret);
    expect(verifyBodySignature(body, sig, secret)).toBe(true);
  });

  it('accepts sha256= prefix', () => {
    const sig = signBody(body, secret);
    expect(verifyBodySignature(body, `sha256=${sig}`, secret)).toBe(true);
  });

  it('rejects a wrong signature', () => {
    expect(verifyBodySignature(body, 'deadbeef', secret)).toBe(false);
  });

  it('rejects a signature for a different body', () => {
    const sig = signBody(body, secret);
    expect(verifyBodySignature(body + 'x', sig, secret)).toBe(false);
  });

  it('rejects a signature for a different secret', () => {
    const sig = signBody(body, secret);
    expect(verifyBodySignature(body, sig, 'other-secret')).toBe(false);
  });

  it('returns false for empty inputs', () => {
    expect(verifyBodySignature('', 'x', secret)).toBe(false);
    expect(verifyBodySignature(body, '', secret)).toBe(false);
    expect(verifyBodySignature(body, 'x', '')).toBe(false);
  });

  it('throws when signing without a secret', () => {
    expect(() => signBody(body, '')).toThrow();
  });
});

describe('legacyEqualsSecret', () => {
  const secret = 'plaintext-shared-secret';

  it('accepts matching', () => {
    expect(legacyEqualsSecret(secret, secret)).toBe(true);
  });

  it('rejects different length', () => {
    expect(legacyEqualsSecret(secret + 'x', secret)).toBe(false);
  });

  it('rejects empty', () => {
    expect(legacyEqualsSecret('', secret)).toBe(false);
    expect(legacyEqualsSecret(secret, '')).toBe(false);
  });
});
