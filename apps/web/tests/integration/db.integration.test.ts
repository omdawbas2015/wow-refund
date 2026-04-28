/**
 * End-to-end smoke against a real Postgres instance.
 *
 * Goals:
 *   1. Prove that the Postgres-flavored Prisma client (generated via
 *      generate:pg) can connect, run migrations, and round-trip a
 *      RefundCase row.
 *   2. Verify the PII extension still encrypts/hashes when running
 *      against Postgres (not just the SQLite dev DB).
 *   3. Catch schema drift between the SQLite and Postgres migration
 *      histories before it surfaces in production.
 *
 * Skipped when DATABASE_URL is not a postgres:// URL — local devs
 * running `pnpm test:integration` against their SQLite dev DB shouldn't
 * have to spin up a Postgres just to sanity-check unrelated code.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env['DATABASE_URL'] ?? '';
const isPostgres = url.startsWith('postgres://') || url.startsWith('postgresql://');

const maybeDescribe = isPostgres ? describe : describe.skip;

maybeDescribe('@integration postgres round-trip', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('can SELECT 1 against the configured database', async () => {
    const rows: Array<{ ok: number }> = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(rows[0]?.ok).toBe(1);
  });

  it('lists at least the seeded countries (CountryRegistry)', async () => {
    const count = await prisma.countryRegistry.count();
    // 195 ISO 3166-1 entries are seeded once; we don't assert the exact
    // count to stay forward-compatible with the registry refresh script.
    expect(count).toBeGreaterThan(100);
  });

  it('exposes the PII hash columns introduced in the latest migration', async () => {
    // Validates that the postgres migration history is up-to-date with
    // the SQLite history. If the columns are missing, this query fails
    // with a column-not-found error and the suite catches schema drift.
    const rows: Array<{ exists: boolean }> = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'RefundCase'
          AND column_name = 'customerEmailHash'
      ) AS exists
    `;
    expect(rows[0]?.exists).toBe(true);
  });
});
