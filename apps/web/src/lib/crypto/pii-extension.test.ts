import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rewriteWhere } from '@wow/db/pii-extension';
import { hashEmailDb, hashPhoneDb } from '@wow/db/pii-hash-db';

const KEY = 'b'.repeat(64);

describe('pii-extension rewriteWhere', () => {
  const originalKey = process.env['PII_HASH_KEY'];

  beforeEach(() => {
    process.env['PII_HASH_KEY'] = KEY;
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env['PII_HASH_KEY'];
    else process.env['PII_HASH_KEY'] = originalKey;
  });

  it('rewrites top-level customerEmail equality to hash lookup', () => {
    const out = rewriteWhere({ customerEmail: 'alice@example.com' });
    const expected = hashEmailDb('alice@example.com');
    expect(out).toEqual({ customerEmailHash: expected });
  });

  it('rewrites {equals: …} syntax', () => {
    const out = rewriteWhere({ customerEmail: { equals: 'bob@corp.ae' } });
    expect(out).toEqual({ customerEmailHash: hashEmailDb('bob@corp.ae') });
  });

  it('rewrites nested OR / AND / NOT', () => {
    const out = rewriteWhere({
      AND: [
        { status: 'APPROVED' },
        {
          OR: [
            { customerEmail: 'x@y.z' },
            { NOT: { customerEmail: 'block@bad.com' } },
          ],
        },
      ],
    }) as Record<string, unknown>;
    const and = out['AND'] as Array<Record<string, unknown>>;
    const or = and[1]!['OR'] as Array<Record<string, unknown>>;
    expect(or[0]).toEqual({ customerEmailHash: hashEmailDb('x@y.z') });
    expect(or[1]!['NOT']).toEqual({ customerEmailHash: hashEmailDb('block@bad.com') });
  });

  it('leaves contains queries untouched (documented limitation)', () => {
    const input = { customerEmail: { contains: 'example' } };
    const out = rewriteWhere(input);
    expect(out).toEqual(input);
  });

  it('rewrites customerPhone similarly', () => {
    const out = rewriteWhere({ customerPhone: '+965 555 1234' });
    expect(out).toEqual({ customerPhoneHash: hashPhoneDb('+965 555 1234') });
  });

  it('no-ops when hash key unset', () => {
    delete process.env['PII_HASH_KEY'];
    const input = { customerEmail: 'alice@example.com' };
    const out = rewriteWhere(input);
    // hashEmailDb returns null → customerEmail stays plaintext
    expect(out).toEqual(input);
  });
});
