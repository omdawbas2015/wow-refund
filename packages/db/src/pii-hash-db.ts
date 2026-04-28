/**
 * Deterministic HMAC hash for encrypted PII — Prisma-extension copy.
 *
 * Keep in sync with apps/web/src/lib/crypto/pii-hash.ts. Both files
 * produce the same digest for the same input so hashes computed in
 * either location are interchangeable.
 */
import { createHmac } from 'node:crypto';

function getKey(): Buffer | null {
  const raw = process.env['PII_HASH_KEY'];
  if (!raw) return null;
  const buf = Buffer.from(raw, 'hex');
  if (buf.length < 16) {
    throw new Error(`PII_HASH_KEY must be at least 16 bytes (32 hex chars). Got ${buf.length}.`);
  }
  return buf;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function hashEmailDb(email: string | null | undefined): string | null {
  if (email == null || email === '') return null;
  const key = getKey();
  if (!key) return null;
  return createHmac('sha256', key).update(normalizeEmail(email)).digest('hex');
}

export function hashPhoneDb(phone: string | null | undefined): string | null {
  if (phone == null || phone === '') return null;
  const key = getKey();
  if (!key) return null;
  return createHmac('sha256', key).update(normalizePhone(phone)).digest('hex');
}
