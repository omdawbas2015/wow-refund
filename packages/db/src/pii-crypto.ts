/**
 * AES-256-GCM helpers for PII at rest — used by the Prisma extension.
 *
 * Mirror of apps/web/src/lib/crypto/pii.ts because the Prisma extension
 * lives inside @wow/db and can't reach across workspaces into the app.
 * Kept in sync by hand: both files share the same storage format
 * (`v1:<iv>:<ct>:<tag>`) so rows written by either path are
 * interchangeable.
 *
 * Pass-through when PII_ENCRYPTION_KEY is unset so local dev and
 * pre-rollout deploys keep working.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'v1:';

function getKey(): Buffer | null {
  const raw = process.env['PII_ENCRYPTION_KEY'];
  if (!raw) return null;
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== KEY_LEN) {
    throw new Error(`PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got ${buf.length}.`);
  }
  return buf;
}

export function encryptPii(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

export function decryptPii(value: string): string {
  const key = getKey();
  if (!key) return value;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext row
  const parts = value.split(':');
  if (parts.length !== 4) return value;
  try {
    const iv = Buffer.from(parts[1]!, 'hex');
    const enc = Buffer.from(parts[2]!, 'hex');
    const tag = Buffer.from(parts[3]!, 'hex');
    if (tag.length !== TAG_LEN) return value;
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return value;
  }
}
