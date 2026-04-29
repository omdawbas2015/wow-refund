/**
 * AES-256-GCM helpers for PII at rest — used by the Prisma $extends layer.
 *
 * Reads a 32-byte key from PII_ENCRYPTION_KEY (hex-encoded, 64 chars).
 * If the key is missing the helpers are pass-through so dev / preview
 * environments work without any extra setup.
 *
 * Storage format: `v1:<iv-hex>:<ciphertext-hex>:<authTag-hex>`.
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
    throw new Error(
      `PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got ${buf.length}.`,
    );
  }
  return buf;
}

export function piiEncrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return plaintext ?? null;
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

export function piiDecrypt(value: string | null | undefined): string | null {
  if (value == null) return value ?? null;
  const key = getKey();
  if (!key) return value;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext row
  const parts = value.split(':');
  const ivHex = parts[1];
  const encHex = parts[2];
  const tagHex = parts[3];
  if (!ivHex || !encHex || !tagHex) return value;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    if (tag.length !== TAG_LEN) return value;
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return value;
  }
}
