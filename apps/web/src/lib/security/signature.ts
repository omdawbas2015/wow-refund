/**
 * HMAC-SHA256 body signing helpers for Power Automate webhooks.
 *
 * Both inbound and outbound webhook flows use a shared secret to prove the
 * caller. We sign the raw request body (not just the URL / timestamp) so the
 * signature doubles as an integrity check.
 *
 * Format: lowercase hex digest of HMAC-SHA256(rawBody, secret).
 *
 *   const sig = signBody(rawBody, secret);                         // outbound
 *   const ok  = verifyBodySignature(rawBody, headerSig, secret);   // inbound
 *
 * `verifyBodySignature` is constant-time via `timingSafeEqual` and tolerates
 * unequal-length inputs without throwing.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export function signBody(body: string, secret: string): string {
  if (!secret) throw new Error('signBody: secret is required');
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

/**
 * Constant-time comparison of the expected HMAC hex digest against a
 * caller-provided header value. Returns `false` for empty / unequal-length
 * inputs instead of throwing so routes can branch on a single boolean.
 */
export function verifyBodySignature(body: string, providedSignature: string, secret: string): boolean {
  if (!body || !providedSignature || !secret) return false;
  // Accept `sha256=<hex>` prefix for tools that use that convention.
  const normalized = providedSignature.startsWith('sha256=') ? providedSignature.slice(7) : providedSignature;
  const expected = signBody(body, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(normalized, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Constant-time equality for the legacy contract where the header value is
 * the shared secret itself. Kept as a separate helper so callers have to
 * opt into the legacy behavior (typically behind a deprecation warning).
 */
export function legacyEqualsSecret(providedHeader: string, secret: string): boolean {
  if (!providedHeader || !secret) return false;
  const a = Buffer.from(providedHeader, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
