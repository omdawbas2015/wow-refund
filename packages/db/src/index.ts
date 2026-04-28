import { PrismaClient, Prisma } from '@prisma/client';
import { piiExtension } from './pii-extension';

/**
 * Singleton Prisma client with the PII encryption/hash extension
 * attached.
 *
 * The extension is a pure query-level transform (encrypt on write,
 * decrypt on read, rewrite where.customerEmail → customerEmailHash),
 * so the public shape of the client is unchanged — we cast the
 * $extends() return back to `PrismaClient` so every call site that
 * imports `prisma` sees the same type it always did.
 *
 * The extension is safe to attach unconditionally: it is a no-op when
 * neither PII_ENCRYPTION_KEY nor PII_HASH_KEY are configured, so local
 * dev + pre-rollout deploys behave identically.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createClient = (): PrismaClient => {
  const raw = new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['error', 'warn']
        : ['error'],
  });
  return raw.$extends(piiExtension) as unknown as PrismaClient;
};

export const prisma: PrismaClient = global.__prisma ?? createClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}

export { Prisma };
export * from '@prisma/client';
export * as seedData from './seed-data';
export { hashEmailDb, hashPhoneDb } from './pii-hash-db';
