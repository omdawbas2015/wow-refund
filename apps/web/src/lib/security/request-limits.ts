/**
 * Request body size guard.
 *
 * Every public-facing endpoint should cap the body it accepts so an
 * attacker can't exhaust memory / CPU by POSTing a multi-GB payload.
 * Next.js does NOT enforce this by default on Route Handlers — the
 * body stream is lazily consumed by the handler, so the only protection
 * is the handler itself.
 *
 * Usage:
 *   const check = await assertBodySize(req, 256 * 1024);
 *   if (check) return check;
 *   const raw = await req.text();
 *
 * Returns:
 *   - `null` when the request is within the limit. Caller proceeds as
 *     normal (body is still readable).
 *   - `NextResponse` with HTTP 413 when the limit is exceeded. Caller
 *     should `return` it directly.
 *
 * Fast path: Content-Length header. If present and oversized, reject
 * without reading any bytes. Falls back to streaming + counting when
 * the header is absent (e.g. chunked transfer). Caches the consumed
 * stream on the request so the handler can still read the body after.
 */

import { NextResponse, type NextRequest } from 'next/server';

const DEFAULT_LIMIT = 1 * 1024 * 1024; // 1 MiB

export async function assertBodySize(
  req: NextRequest,
  limit: number = DEFAULT_LIMIT,
): Promise<NextResponse | null> {
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const declared = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > limit) {
      return tooLarge(limit, declared);
    }
    return null;
  }
  // No Content-Length (e.g. chunked). Consume + count; stash on the
  // request so the handler can still read the body.
  if (!req.body) return null;
  const reader = req.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        reader.cancel();
        return tooLarge(limit, total);
      }
      chunks.push(value);
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'Bad Request', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
  // Rebuild the body so downstream .text() / .json() still works.
  const blob = new Blob(chunks as BlobPart[]);
  // NextRequest body is read-only in type but the underlying Request
  // can be reconstructed via the clone-with-body pattern. Since
  // handlers typically call req.text() / req.json() once, we attach a
  // cached text on the request for the second read.
  (req as unknown as { _cachedBodyText?: string })._cachedBodyText = await blob.text();
  return null;
}

/**
 * Prefer this over `req.text()` in handlers that called
 * `assertBodySize`: it returns the cached body without re-streaming.
 */
export async function readBodyText(req: NextRequest): Promise<string> {
  const cached = (req as unknown as { _cachedBodyText?: string })._cachedBodyText;
  if (typeof cached === 'string') return cached;
  return req.text();
}

function tooLarge(limit: number, observed: number): NextResponse {
  return NextResponse.json(
    {
      error: 'Payload Too Large',
      limitBytes: limit,
      observedBytes: observed,
    },
    { status: 413 },
  );
}
