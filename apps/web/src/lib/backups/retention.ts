/**
 * Backup retention sweep.
 *
 * After every successful backup the runner calls `pruneOldBackups()` with
 * the retention window from `BackupSettings.retentionDays`. Behaviour:
 *
 *   1. Find every `BackupLog` row whose `startedAt` is older than the
 *      cutoff, regardless of status.
 *   2. For each row whose `destination` is a `local:` URI, delete the
 *      file from disk. Missing files are ignored (idempotent).
 *   3. Delete the `BackupLog` rows.
 *
 * Cloud destinations (`s3://`, `gs://`) are recorded as pruned in the DB,
 * but the object itself is left to the cloud provider's own lifecycle
 * rules (S3 Lifecycle, GCS OLM). That's intentional: delegating retention
 * to the provider is cheaper and survives an app outage.
 */

import { unlink } from 'node:fs/promises';
import { prisma } from '@wow/db';

export interface PruneResult {
  considered: number;
  deletedRows: number;
  deletedFiles: number;
  fileErrors: Array<{ uri: string; reason: string }>;
}

function localPathFromUri(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith('local:')) return uri.slice('local:'.length);
  // Legacy rows stored a bare filesystem path before the `local:` scheme
  // landed — treat absolute paths as local too so they get swept.
  if (uri.startsWith('/')) return uri;
  return null;
}

export async function pruneOldBackups(retentionDays: number): Promise<PruneResult> {
  const result: PruneResult = { considered: 0, deletedRows: 0, deletedFiles: 0, fileErrors: [] };
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return result;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.backupLog.findMany({
    where: { startedAt: { lt: cutoff } },
    select: { id: true, destination: true },
  });
  result.considered = rows.length;
  if (rows.length === 0) return result;

  for (const row of rows) {
    const localPath = localPathFromUri(row.destination);
    if (localPath) {
      try {
        await unlink(localPath);
        result.deletedFiles++;
      } catch (err) {
        const code = (err as NodeJS.ErrnoException | null)?.code;
        // ENOENT: file already gone, treat as success.
        if (code !== 'ENOENT') {
          result.fileErrors.push({
            uri: row.destination,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  const del = await prisma.backupLog.deleteMany({
    where: { id: { in: rows.map((r) => r.id) } },
  });
  result.deletedRows = del.count;
  return result;
}
