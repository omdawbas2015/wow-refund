/**
 * Scheduled app-level backup runner.
 *
 * Called by Vercel Cron (or any external scheduler) once per hour. The
 * endpoint:
 *
 *   1. Verifies the shared `CRON_SECRET` via `verifyCronAuth`.
 *   2. Loads `BackupSettings` \u2014 skips when the feature is disabled.
 *   3. Checks the configured cron expression against the previous run so we
 *      don't double-run when the scheduler fires ahead of schedule.
 *   4. Delegates the actual dump + write to `lib/backups/run-backup.ts` so
 *      manual and scheduled backups share identical BackupLog semantics.
 *
 * Returns a JSON summary so the scheduler's run history is self-describing.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@wow/db';
import { verifyCronAuth } from '@/lib/cron/auth';
import { isDueSince, parseCron } from '@/lib/scheduled-reports/cron';
import { runBackup } from '@/lib/backups/run-backup';

export const dynamic = 'force-dynamic';

async function handle(req: NextRequest): Promise<NextResponse> {
  const authFailure = verifyCronAuth(req);
  if (authFailure) return authFailure;

  const settings = await prisma.backupSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings || !settings.enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'disabled' });
  }

  const now = new Date();
  // Use `updatedAt` as a coarse lower bound when we've never recorded a
  // SUCCESS \u2014 better than NULL, which `isDueSince` treats as "always due".
  const last = await prisma.backupLog.findFirst({
    where: { status: 'SUCCESS' },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true, startedAt: true },
  });
  const lastRunAt = last?.finishedAt ?? last?.startedAt ?? null;

  let due = true;
  try {
    const spec = parseCron(settings.cronExpr);
    due = isDueSince(spec, lastRunAt, now);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        skipped: true,
        reason: `Invalid cron expression in BackupSettings: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 },
    );
  }

  if (!due) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not-due' });
  }

  const result = await runBackup({ trigger: 'SCHEDULED', triggeredById: null });
  return NextResponse.json({
    ok: result.status === 'SUCCESS',
    logId: result.logId,
    status: result.status,
    ...(result.uri ? { uri: result.uri } : {}),
    ...(result.sizeBytes !== undefined ? { sizeBytes: result.sizeBytes } : {}),
    ...(result.failureReason ? { failureReason: result.failureReason } : {}),
  });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
