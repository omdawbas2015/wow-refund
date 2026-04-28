import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseDestination, writeBackup, timestampedFileName } from './storage';

describe('parseDestination', () => {
  it('parses local: prefix', () => {
    const r = parseDestination('local:/var/backups/wow', '/tmp/fb');
    expect(r).toEqual({ kind: 'local', dir: path.resolve('/var/backups/wow') });
  });

  it('falls back to the default dir when destination is blank or "local"', () => {
    expect(parseDestination('', '/tmp/fb')).toEqual({ kind: 'local', dir: path.resolve('/tmp/fb') });
    expect(parseDestination('local', '/tmp/fb')).toEqual({ kind: 'local', dir: path.resolve('/tmp/fb') });
  });

  it('parses s3:// URIs', () => {
    expect(parseDestination('s3://wow-backups/prod', '/tmp')).toEqual({
      kind: 's3',
      bucket: 'wow-backups',
      prefix: 'prod',
    });
    expect(parseDestination('s3://wow-backups', '/tmp')).toEqual({
      kind: 's3',
      bucket: 'wow-backups',
      prefix: '',
    });
  });

  it('parses gs:// URIs', () => {
    expect(parseDestination('gs://wow-backups/prod', '/tmp')).toEqual({
      kind: 'gcs',
      bucket: 'wow-backups',
      prefix: 'prod',
    });
  });

  it('treats a bare path as local', () => {
    expect(parseDestination('/srv/backups', '/tmp/fb')).toEqual({
      kind: 'local',
      dir: path.resolve('/srv/backups'),
    });
  });
});

describe('writeBackup', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'wow-backup-test-'));
  });

  it('writes a local file and returns size', async () => {
    const result = await writeBackup({ kind: 'local', dir }, 'hello.json', '{"ok":true}');
    expect(result.uri).toBe(`local:${path.join(dir, 'hello.json')}`);
    expect(result.sizeBytes).toBe(11);
    const read = await readFile(path.join(dir, 'hello.json'), 'utf8');
    expect(read).toBe('{"ok":true}');
    const stats = await stat(path.join(dir, 'hello.json'));
    expect(stats.size).toBe(11);
  });

  it('rejects gcs destinations until wired up', async () => {
    await expect(
      writeBackup({ kind: 'gcs', bucket: 'b', prefix: 'p' }, 'x', ''),
    ).rejects.toThrow(/not yet implemented/);
  });

  it('fails s3 with a clear error when credentials are missing', async () => {
    // Credentials not set in the test env — surface the expected message
    // so we never silently skip an S3 backup in prod.
    const origAws = process.env['AWS_ACCESS_KEY_ID'];
    const origBak = process.env['BACKUP_S3_ACCESS_KEY_ID'];
    delete process.env['AWS_ACCESS_KEY_ID'];
    delete process.env['BACKUP_S3_ACCESS_KEY_ID'];
    try {
      await expect(
        writeBackup({ kind: 's3', bucket: 'b', prefix: 'p' }, 'x', 'hello'),
      ).rejects.toThrow(/AWS credentials/);
    } finally {
      if (origAws) process.env['AWS_ACCESS_KEY_ID'] = origAws;
      if (origBak) process.env['BACKUP_S3_ACCESS_KEY_ID'] = origBak;
    }
  });
});

describe('timestampedFileName', () => {
  it('formats a UTC stamp', () => {
    const d = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(timestampedFileName('wow', 'sql', d)).toBe('wow-20260102T030405Z.sql');
    expect(timestampedFileName('wow', '.sql', d)).toBe('wow-20260102T030405Z.sql');
  });
});
