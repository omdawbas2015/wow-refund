import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const findMany = vi.fn();
const deleteMany = vi.fn();

vi.mock('@wow/db', () => ({
  prisma: {
    backupLog: {
      findMany: (...args: unknown[]) => findMany(...args),
      deleteMany: (...args: unknown[]) => deleteMany(...args),
    },
  },
}));

// eslint-disable-next-line import/first
import { pruneOldBackups } from './retention';

describe('pruneOldBackups', () => {
  let dir: string;

  beforeEach(async () => {
    findMany.mockReset();
    deleteMany.mockReset();
    dir = await mkdtemp(path.join(tmpdir(), 'wow-retention-test-'));
  });

  it('no-ops when retentionDays is 0 or negative', async () => {
    await expect(pruneOldBackups(0)).resolves.toEqual({
      considered: 0,
      deletedRows: 0,
      deletedFiles: 0,
      fileErrors: [],
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('deletes old local files and their log rows', async () => {
    const a = path.join(dir, 'a.dump');
    const b = path.join(dir, 'b.dump');
    await writeFile(a, 'A');
    await writeFile(b, 'B');

    findMany.mockResolvedValueOnce([
      { id: '1', destination: `local:${a}` },
      { id: '2', destination: `local:${b}` },
    ]);
    deleteMany.mockResolvedValueOnce({ count: 2 });

    const res = await pruneOldBackups(7);
    expect(res).toEqual({
      considered: 2,
      deletedRows: 2,
      deletedFiles: 2,
      fileErrors: [],
    });
    const remaining = await readdir(dir);
    expect(remaining).toEqual([]);
  });

  it('treats missing files as success (idempotent)', async () => {
    findMany.mockResolvedValueOnce([
      { id: '1', destination: `local:${path.join(dir, 'gone.dump')}` },
    ]);
    deleteMany.mockResolvedValueOnce({ count: 1 });
    const res = await pruneOldBackups(1);
    expect(res.deletedRows).toBe(1);
    expect(res.deletedFiles).toBe(0); // file already absent, ENOENT swallowed
    expect(res.fileErrors).toEqual([]);
  });

  it('skips filesystem step for cloud destinations, still deletes rows', async () => {
    findMany.mockResolvedValueOnce([
      { id: '1', destination: 's3://bucket/prefix/old.dump' },
    ]);
    deleteMany.mockResolvedValueOnce({ count: 1 });
    const res = await pruneOldBackups(3);
    expect(res.deletedRows).toBe(1);
    expect(res.deletedFiles).toBe(0);
    expect(res.fileErrors).toEqual([]);
  });
});
