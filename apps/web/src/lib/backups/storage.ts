/**
 * Storage adapters for app-level backups.
 *
 * Each destination string has the shape `<scheme>:<path>`:
 *
 *   local:/var/backups/wow
 *   local:./backups
 *   s3://bucket/prefix          (not yet implemented)
 *   gs://bucket/prefix          (not yet implemented)
 *
 * For now only `local` is wired up \u2014 the manual / cron backup runner falls
 * back to a sensible default (`local:./backups` under the app cwd) when the
 * admin form leaves the destination path blank. Cloud adapters will slot in
 * here as separate modules once credentials are available.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { putS3Object } from './s3';

export type ParsedDestination =
  | { kind: 'local'; dir: string }
  | { kind: 's3'; bucket: string; prefix: string }
  | { kind: 'gcs'; bucket: string; prefix: string };

export function parseDestination(destination: string, fallbackLocalDir: string): ParsedDestination {
  const raw = destination.trim();
  if (!raw || raw === 'local') {
    return { kind: 'local', dir: path.resolve(fallbackLocalDir) };
  }
  if (raw.startsWith('local:')) {
    const dir = raw.slice('local:'.length).trim() || fallbackLocalDir;
    return { kind: 'local', dir: path.resolve(dir) };
  }
  if (raw.startsWith('s3://')) {
    const rest = raw.slice('s3://'.length);
    const slash = rest.indexOf('/');
    return slash === -1
      ? { kind: 's3', bucket: rest, prefix: '' }
      : { kind: 's3', bucket: rest.slice(0, slash), prefix: rest.slice(slash + 1) };
  }
  if (raw.startsWith('gs://')) {
    const rest = raw.slice('gs://'.length);
    const slash = rest.indexOf('/');
    return slash === -1
      ? { kind: 'gcs', bucket: rest, prefix: '' }
      : { kind: 'gcs', bucket: rest.slice(0, slash), prefix: rest.slice(slash + 1) };
  }
  // Bare path like `/var/backups/wow` or `./backups` \u2014 treat as local.
  return { kind: 'local', dir: path.resolve(raw) };
}

export interface BackupWriteResult {
  uri: string;
  sizeBytes: number;
}

export async function writeBackup(
  parsed: ParsedDestination,
  fileName: string,
  contents: Buffer | string,
): Promise<BackupWriteResult> {
  const payload = typeof contents === 'string' ? Buffer.from(contents, 'utf8') : contents;

  if (parsed.kind === 'local') {
    await mkdir(parsed.dir, { recursive: true });
    const absPath = path.join(parsed.dir, fileName);
    await writeFile(absPath, payload);
    return { uri: `local:${absPath}`, sizeBytes: payload.byteLength };
  }

  if (parsed.kind === 's3') {
    const key = parsed.prefix ? `${parsed.prefix.replace(/\/+$/, '')}/${fileName}` : fileName;
    await putS3Object({ bucket: parsed.bucket, key, body: payload });
    return { uri: `s3://${parsed.bucket}/${key}`, sizeBytes: payload.byteLength };
  }

  // gcs is intentionally still a stub — owner hasn't requested GCS; if we
  // wire it, do it as a focused PR with its own creds path. Today we fail
  // loudly rather than silently.
  throw new Error(
    `Backup destination "${parsed.kind}" is not yet implemented. Use local:<path> or s3://bucket/prefix.`,
  );
}

export function timestampedFileName(prefix: string, ext: string, now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${prefix}-${y}${m}${d}T${hh}${mm}${ss}Z.${ext.replace(/^\./, '')}`;
}
