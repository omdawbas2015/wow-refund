/**
 * Request-ID propagation.
 *
 * The Next.js middleware stamps `x-request-id` on every inbound request
 * (echoing an incoming one or generating a fresh nanoid-ish value).
 * Downstream route handlers can read it back via `getRequestId()` and
 * feed it into `logger.child({ requestId })` so every log line for the
 * request is correlatable.
 *
 * Header shape is the widely-supported `x-request-id`. The same value
 * is also mirrored onto the OUTBOUND response so clients and upstream
 * proxies can echo it back when they file a bug report.
 */

import { randomBytes } from 'node:crypto';

const HEADER = 'x-request-id';

export function requestIdHeader(): string {
  return HEADER;
}

export function generateRequestId(): string {
  // 16 random bytes → 22-char base64url. Short enough to fit in a log
  // line without bloat, long enough that collisions are not a concern.
  return randomBytes(16).toString('base64url');
}

/**
 * Read the request ID from a Headers/NextRequest-like object. Returns
 * the existing value if present (case-insensitive), else null.
 */
export function readRequestId(headers: { get(name: string): string | null }): string | null {
  return headers.get(HEADER) ?? headers.get(HEADER.toUpperCase());
}
