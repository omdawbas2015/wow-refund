import { describe, it, expect } from 'vitest';
import { assertBodySize, readBodyText } from './request-limits';
import type { NextRequest } from 'next/server';

function makeReq(body: string, headers: Record<string, string> = {}): NextRequest {
  const req = new Request('http://localhost/test', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });
  return req as unknown as NextRequest;
}

describe('assertBodySize', () => {
  it('allows payload within limit (Content-Length path)', async () => {
    const body = 'x'.repeat(100);
    const req = makeReq(body, { 'content-length': '100' });
    const res = await assertBodySize(req, 1024);
    expect(res).toBeNull();
  });

  it('rejects oversized payload by Content-Length header without reading body', async () => {
    const req = makeReq('', { 'content-length': '999999' });
    const res = await assertBodySize(req, 1024);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(413);
  });

  it('rejects oversized payload when Content-Length is absent (stream path)', async () => {
    const body = 'x'.repeat(2000);
    const req = makeReq(body);
    // Force remove content-length to exercise the stream path.
    (req as unknown as { headers: Headers }).headers.delete('content-length');
    const res = await assertBodySize(req, 1024);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(413);
  });

  it('caches body so readBodyText returns the original payload', async () => {
    const body = 'payload-content';
    const req = makeReq(body);
    (req as unknown as { headers: Headers }).headers.delete('content-length');
    const check = await assertBodySize(req, 1024);
    expect(check).toBeNull();
    const text = await readBodyText(req);
    expect(text).toBe(body);
  });
});
