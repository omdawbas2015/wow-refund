/**
 * Scheduled retry sweep for FAILED EmailLog rows.
 *
 * Runs every 15 minutes. For each row that:
 *   - has status = 'FAILED'
 *   - is older than 5 minutes (backoff window)
 *   - is younger than 24 hours (don't retry ancient failures)
 *   - has fewer than `maxAutoRetries` sibling rows with the same
 *     (templateKey, to, subject)
 *
 * …calls `dispatchEmail` via the `override` channel, which creates a new
 * EmailLog row for the retry attempt.
 *
 * Not a replacement for the admin's manual bulk-resend (/admin/email-log)
 * — humans should still take action on rows that exhaust automatic
 * retries, but the sweep handles transient infra blips automatically.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronAuth } from '@/lib/cron/auth';
import { sweepFailedEmails } from '@/lib/email/retry';

export const dynamic = 'force-dynamic';

async function handle(req: NextRequest): Promise<NextResponse> {
  const authFailure = verifyCronAuth(req);
  if (authFailure) return authFailure;

  const outcome = await sweepFailedEmails();
  return NextResponse.json({ ok: true, ...outcome });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
