/**
 * Deterministic HMAC hash for encrypted PII.
 *
 * Problem: once `customerEmail` is encrypted with AES-GCM, every
 * ciphertext for the same plaintext is DIFFERENT (because the IV is
 * random). That breaks exact-match lookups like
 * `findMany({ where: { customerEmail: "x@y.z" }})`.
 *
 * Solution: alongside the encrypted value, store a separate column
 * `customerEmailHash` = HMAC-SHA256(PII_HASH_KEY, normalized(email)).
 * The hash is deterministic, so two rows with the same email have the
 * same hash, and the column is indexable for O(log n) equality lookup.
 *
 * The HMAC KEY is deliberately separate from the AES encryption key:
 *   - AES key can rotate without rebuilding hash columns.
 *   - Hash-key compromise does NOT reveal plaintext (no reversal).
 *   - Plaintext guessing requires the hash key, so a DB-only dump can't
 *     rebuild the email→customer mapping.
 *
 * Normalization (emails only): lowercased + trimmed. That means
 * `A@B.C` and `a@b.c ` collide as expected. Phones get digits-only
 * normalization.
 *
 * Storage format: 64-char lowercase hex.
 */
import { createHmac } from 'node:crypto';

function getKey(): Buffer | null {
  const raw = process.env['PII_HASH_KEY'];
  if (!raw) return null;
  const buf = Buffer.from(raw, 'hex');
  if (buf.length < 16) {
    throw new Error(
      `PII_HASH_KEY must be at least 16 bytes (32 hex chars). Got ${buf.length}.`,
    );
  }
  return buf;
}

export function isHashEnabled(): boolean {
  return !!process.env['PII_HASH_KEY'];
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function hashEmail(email: string | null | undefined): string | null {
  if (email == null || email === '') return null;
  const key = getKey();
  if (!key) return null;
  return createHmac('sha256', key).update(normalizeEmail(email)).digest('hex');
}

export function hashPhone(phone: string | null | undefined): string | null {
  if (phone == null || phone === '') return null;
  const key = getKey();
  if (!key) return null;
  return createHmac('sha256', key).update(normalizePhone(phone)).digest('hex');
}

/** Shape-based email detector for search UX. Not security-critical. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Shape-based phone detector: 8+ digits after stripping formatting. */
export function looksLikePhone(value: string): boolean {
  return /^\+?[\d\s()-]{8,}$/.test(value.trim());
}
