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

  it('rejects cloud destinations until wired up', async () => {
    await expect(
      writeBackup({ kind: 's3', bucket: 'b', prefix: 'p' }, 'x', ''),
    ).rejects.toThrow(/not yet implemented/);
    await expect(
      writeBackup({ kind: 'gcs', bucket: 'b', prefix: 'p' }, 'x', ''),
    ).rejects.toThrow(/not yet implemented/);
  });
});

describe('timestampedFileName', () => {
  it('formats a UTC stamp', () => {
    const d = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(timestampedFileName('wow', 'sql', d)).toBe('wow-20260102T030405Z.sql');
    expect(timestampedFileName('wow', '.sql', d)).toBe('wow-20260102T030405Z.sql');
  });
});
