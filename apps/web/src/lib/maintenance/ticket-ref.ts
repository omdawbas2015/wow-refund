import { prisma } from '@wow/db';

/**
 * Generate a fresh, gap-tolerant ticket ref of the form
 * `MR-YYYY-NNNNNN` (e.g. `MR-2026-000147`). The numeric tail is taken
 * from a count of existing rows for the current calendar year plus one
 * — under the SQLite uniqueness constraint a duplicate triggers the
 * caller to retry, so we don't need a perfect monotonic sequence.
 */
export async function generateTicketRef(now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = `MR-${year}-`;
  // Count existing tickets for this year. Race-tolerant because the
  // actual write is guarded by `ticketRef @unique` — on collision the
  // caller increments and tries again.
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const endOfYear = new Date(Date.UTC(year + 1, 0, 1));
  const count = await prisma.maintenanceRequest.count({
    where: {
      createdAt: {
        gte: startOfYear,
        lt: endOfYear,
      },
    },
  });
  const next = count + 1;
  return `${prefix}${String(next).padStart(6, '0')}`;
}
