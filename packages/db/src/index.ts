import { PrismaClient, Prisma } from '@prisma/client';
import { piiExtension } from './pii-extension';

/**
 * Singleton Prisma client with PII encryption extension.
 * In development, hot-reload creates many clients → leak warnings.
 * Cache on globalThis to avoid this.
 *
 * The PII extension transparently encrypts customerEmail / customerPhone
 * on write and decrypts on read when PII_ENCRYPTION_KEY is set.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createClient = () =>
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

const basePrisma: PrismaClient = global.__prisma ?? createClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = basePrisma;
}

// Apply PII encryption extension. The extended client is type-compatible
// with PrismaClient for all existing call sites.
export const prisma = basePrisma.$extends(piiExtension) as unknown as PrismaClient;

export { Prisma };
export * from '@prisma/client';
export * as seedData from './seed-data';
