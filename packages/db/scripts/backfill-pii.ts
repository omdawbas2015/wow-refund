/**
 * PII encryption + hash backfill.
 *
 * Run once after PII_ENCRYPTION_KEY and PII_HASH_KEY are configured in
 * production. Reads every RefundCase and PromoAllocation, and for any
 * row whose customerEmail/customerPhone is still plaintext (no `v1:`
 * prefix) OR whose corresponding hash column is NULL, re-writes the
 * row with encrypted fields + hashes.
 *
 * Safe to re-run: rows that already have ciphertext + hash are skipped.
 * Streams in 500-row batches so memory stays flat on large tables.
 *
 * Usage:
 *   PII_ENCRYPTION_KEY=<64hex> PII_HASH_KEY=<32+hex> \
 *     pnpm --filter @wow/db tsx scripts/backfill-pii.ts [--dry-run]
 *
 * --dry-run prints the count of rows that WOULD be updated without
 * writing anything. Always run --dry-run first in prod to sanity-check
 * the impact.
 */
import { PrismaClient } from '@prisma/client';
import { encryptPii, decryptPii } from '../src/pii-crypto';
import { hashEmailDb, hashPhoneDb } from '../src/pii-hash-db';

const BATCH = 500;
const CIPHER_PREFIX = 'v1:';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const raw = new PrismaClient();

  if (!process.env['PII_ENCRYPTION_KEY']) {
    throw new Error('PII_ENCRYPTION_KEY must be set to run the backfill.');
  }
  if (!process.env['PII_HASH_KEY']) {
    throw new Error('PII_HASH_KEY must be set to run the backfill.');
  }

  console.log(`[backfill] mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);

  let caseCount = 0;
  let promoCount = 0;
  let skip = 0;
  // Iterate RefundCase — stream in batches via id ordering + cursor-ish
  // window. findMany with skip+take is O(n²) on large tables but fine
  // for one-off backfill sizes we expect here (< 100k rows).
  while (true) {
    const batch = await raw.refundCase.findMany({
      skip,
      take: BATCH,
      orderBy: { id: 'asc' },
      select: { id: true, customerEmail: true, customerPhone: true, customerEmailHash: true, customerPhoneHash: true },
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      const emailNeedsWrite =
        !row.customerEmail.startsWith(CIPHER_PREFIX) || row.customerEmailHash === null;
      const phoneNeedsWrite =
        row.customerPhone !== null &&
        (!row.customerPhone.startsWith(CIPHER_PREFIX) || row.customerPhoneHash === null);
      if (!emailNeedsWrite && !phoneNeedsWrite) continue;

      caseCount += 1;
      if (dryRun) continue;

      const data: Record<string, unknown> = {};
      if (emailNeedsWrite) {
        // Recover plaintext via decryptPii() if the row is already
        // encrypted but missing its hash — hashing the empty string
        // produced a useless null write before this fix.
        const plainEmail = row.customerEmail.startsWith(CIPHER_PREFIX)
          ? decryptPii(row.customerEmail)
          : row.customerEmail;
        if (!row.customerEmail.startsWith(CIPHER_PREFIX)) {
          data['customerEmail'] = encryptPii(plainEmail);
        }
        data['customerEmailHash'] = hashEmailDb(plainEmail);
      }
      if (phoneNeedsWrite && row.customerPhone) {
        const plainPhone = row.customerPhone.startsWith(CIPHER_PREFIX)
          ? decryptPii(row.customerPhone)
          : row.customerPhone;
        if (!row.customerPhone.startsWith(CIPHER_PREFIX)) {
          data['customerPhone'] = encryptPii(plainPhone);
        }
        data['customerPhoneHash'] = hashPhoneDb(plainPhone);
      }
      // Write via raw client (bypass the extension so we don't
      // double-encrypt a row we already encrypted in-loop above).
      await raw.refundCase.update({ where: { id: row.id }, data });
    }
    skip += batch.length;
  }

  skip = 0;
  while (true) {
    const batch = await raw.promoAllocation.findMany({
      skip,
      take: BATCH,
      orderBy: { id: 'asc' },
      select: { id: true, customerEmail: true, customerEmailHash: true },
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      const needs =
        !row.customerEmail.startsWith(CIPHER_PREFIX) || row.customerEmailHash === null;
      if (!needs) continue;
      promoCount += 1;
      if (dryRun) continue;
      const data: Record<string, unknown> = {};
      // Same recovery path as RefundCase: decryptPii() handles both
      // already-encrypted-with-missing-hash and plaintext rows.
      const plainEmail = row.customerEmail.startsWith(CIPHER_PREFIX)
        ? decryptPii(row.customerEmail)
        : row.customerEmail;
      if (!row.customerEmail.startsWith(CIPHER_PREFIX)) {
        data['customerEmail'] = encryptPii(plainEmail);
      }
      data['customerEmailHash'] = hashEmailDb(plainEmail);
      await raw.promoAllocation.update({ where: { id: row.id }, data });
    }
    skip += batch.length;
  }

  console.log(
    `[backfill] ${dryRun ? 'would update' : 'updated'}: ${caseCount} refund_case, ${promoCount} promo_allocation`,
  );
  await raw.$disconnect();
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
