/**
 * App-level backup runner.
 *
 * Why this exists on top of the K8s `pg_dump` CronJob: the admin UI at
 * `/admin/backup` lets an operator trigger a backup from the product itself
 * (audit trail + retention policy), and that needs a real writer on the
 * same process as the Next.js app. This module handles:
 *
 *   - Postgres deployments \u2192 shell out to `pg_dump` (connection string from
 *     DATABASE_URL / DIRECT_DATABASE_URL). The runner fails the run with a
 *     clear message if `pg_dump` is missing from the image.
 *   - SQLite deployments   \u2192 file-copy the database file on disk (sqlite's
 *     snapshot-under-read-lock is safe enough for the admin-triggered
 *     cadence this is used at).
 *
 * Destination is resolved through `lib/backups/storage.ts` \u2014 today the only
 * wired adapter is `local:<path>`. Cloud adapters slot in there once
 * credentials exist.
 *
 * Every run creates a `BackupLog` row. Status transitions are strictly
 * linear: RUNNING \u2192 (SUCCESS | FAILED), with `sizeBytes` / `finishedAt`
 * set on success and `failureReason` set on failure.
 */

import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { prisma } from '@wow/db';
import { parseDestination, timestampedFileName, writeBackup, type ParsedDestination } from './storage';

export type BackupTrigger = 'MANUAL' | 'SCHEDULED';

export interface RunBackupOptions {
  trigger: BackupTrigger;
  triggeredById?: string | null;
}

export interface RunBackupResult {
  logId: string;
  status: 'SUCCESS' | 'FAILED';
  uri?: string;
  sizeBytes?: number;
  failureReason?: string;
}

const DEFAULT_LOCAL_DIR = process.env['BACKUP_LOCAL_DIR'] ?? './backups';

function resolveDatabaseDriver(dbUrl: string): 'postgres' | 'sqlite' | 'unknown' {
  if (!dbUrl) return 'unknown';
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) return 'postgres';
  if (dbUrl.startsWith('file:')) return 'sqlite';
  return 'unknown';
}

function sqliteFilePath(dbUrl: string, cwd = process.cwd()): string {
  // `file:./dev.db` or `file:/absolute/path/dev.db`. Strip the scheme.
  const raw = dbUrl.slice('file:'.length);
  if (raw.startsWith('/')) return raw;
  return `${cwd.replace(/\/$/, '')}/${raw}`;
}

function runPgDump(dbUrl: string, timeoutMs = 10 * 60 * 1000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'pg_dump',
      ['--format=custom', '--no-owner', '--no-acl', '--dbname', dbUrl],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`pg_dump timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.stderr.on('data', (c: Buffer) => errChunks.push(c));
    child.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            'pg_dump not found on PATH. Add postgresql-client to the runtime image (e.g. `apk add --no-cache postgresql-client`) or switch the backup destination to cloud snapshots.',
          ),
        );
        return;
      }
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const stderr = Buffer.concat(errChunks).toString('utf8').trim();
        reject(new Error(`pg_dump exited with code ${code}${stderr ? `: ${stderr}` : ''}`));
      }
    });
  });
}

async function produceBackupContents(
  dbUrl: string,
): Promise<{ contents: Buffer; ext: string }> {
  const driver = resolveDatabaseDriver(dbUrl);
  if (driver === 'postgres') {
    const contents = await runPgDump(dbUrl);
    return { contents, ext: 'dump' };
  }
  if (driver === 'sqlite') {
    const filePath = sqliteFilePath(dbUrl);
    // `stat` first so a missing file surfaces a clearer error than a generic
    // ENOENT from `readFile`.
    await stat(filePath);
    const contents = await readFile(filePath);
    return { contents, ext: 'db' };
  }
  throw new Error(
    `Unsupported DATABASE_URL scheme. Got "${dbUrl.slice(0, 16)}\u2026"; expected postgres:// or file:`,
  );
}

/**
 * Execute a backup end-to-end: resolve destination, dump the database,
 * write the artifact, and transition the BackupLog row.
 */
export async function runBackup(options: RunBackupOptions): Promise<RunBackupResult> {
  const settings = await prisma.backupSettings.findUnique({ where: { id: 'singleton' } });
  const destinationRaw = settings?.destinationPath ?? 'local:./backups';
  const parsed: ParsedDestination = parseDestination(destinationRaw, DEFAULT_LOCAL_DIR);

  const log = await prisma.backupLog.create({
    data: {
      trigger: options.trigger,
      status: 'RUNNING',
      destination: destinationRaw,
      triggeredById: options.triggeredById ?? null,
    },
  });

  try {
    const dbUrl = process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? '';
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not set \u2014 cannot run backup');
    }
    const { contents, ext } = await produceBackupContents(dbUrl);
    const fileName = timestampedFileName('wow-refund', ext);
    const written = await writeBackup(parsed, fileName, contents);

    await prisma.backupLog.update({
      where: { id: log.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        sizeBytes: BigInt(written.sizeBytes),
        destination: written.uri,
      },
    });
    return { logId: log.id, status: 'SUCCESS', uri: written.uri, sizeBytes: written.sizeBytes };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.backupLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        failureReason: message.slice(0, 2000),
      },
    });
    return { logId: log.id, status: 'FAILED', failureReason: message };
  }
}
