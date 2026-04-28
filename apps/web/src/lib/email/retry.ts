/**
 * Shared retry logic for FAILED EmailLog rows.
 *
 * Used by both the admin "bulk resend" button and the scheduled
 * `/api/cron/email-retry` sweep. Each retry creates a NEW EmailLog row
 * (via dispatchEmail's override channel) so the original failure stays
 * as evidence and the retry is independently auditable.
 *
 * Attempt capping: an original row is a candidate for automatic retry
 * only if the number of sibling rows with the same `(templateKey, to,
 * subject)` tuple is below `MAX_AUTO_RETRIES`. This is a cheap proxy for
 * "don't loop forever on a permanently broken address" without needing
 * a `retryCount` schema column.
 */

import { prisma } from '@wow/db';
import type { EmailPayload } from './dispatcher';
import { dispatchEmail } from './dispatcher';

export interface EmailRetryCandidate {
  id: string;
  templateKey: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  subject: string;
  body: string;
  contextType: string | null;
  contextId: string | null;
}

export interface EmailRetryOutcome {
  considered: number;
  delivered: number;
  failed: number;
  skippedTooManyAttempts: number;
}

export interface RetrySweepOptions {
  /** Newest-allowed age in ms. Older rows are skipped (not retried). */
  maxAgeMs?: number;
  /** Minimum delay after the original failure before we retry. */
  minAgeMs?: number;
  /** Hard cap of rows to process per sweep. */
  batchLimit?: number;
  /** Max attempts (original + retries) per (templateKey, to, subject). */
  maxAutoRetries?: number;
}

const DEFAULTS: Required<RetrySweepOptions> = {
  maxAgeMs: 24 * 60 * 60 * 1000, // 24h
  minAgeMs: 5 * 60 * 1000, // 5min backoff so infra blips clear
  batchLimit: 100,
  maxAutoRetries: 4, // original + 3 retries
};

function toContextType(
  value: string | null,
): NonNullable<EmailPayload['context']>['type'] | null {
  if (!value) return null;
  const allowed = ['CASE', 'BATCH', 'PROMO', 'STORE', 'OTP', 'AUTH', 'SYSTEM'] as const;
  return (allowed as readonly string[]).includes(value)
    ? (value as NonNullable<EmailPayload['context']>['type'])
    : null;
}

/** Re-send a single failed log through the dispatcher. */
export async function retryEmailLog(candidate: EmailRetryCandidate): Promise<{ delivered: boolean; error?: string; logId: string }> {
  const ctxType = toContextType(candidate.contextType);
  const result = await dispatchEmail({
    templateKey: candidate.templateKey,
    to: candidate.to,
    ...(candidate.cc ? { cc: candidate.cc } : {}),
    ...(candidate.bcc ? { bcc: candidate.bcc } : {}),
    variables: {},
    override: { subject: candidate.subject, body: candidate.body },
    ...(ctxType
      ? {
          context: {
            type: ctxType,
            ...(candidate.contextId ? { id: candidate.contextId } : {}),
          },
        }
      : {}),
  });
  const out: { delivered: boolean; error?: string; logId: string } = {
    delivered: result.delivered,
    logId: result.logId,
  };
  if (result.error) out.error = result.error;
  return out;
}

/**
 * Run an automated sweep across FAILED EmailLog rows. Intended for the
 * cron at /api/cron/email-retry. Respects backoff + attempt cap.
 */
export async function sweepFailedEmails(options: RetrySweepOptions = {}): Promise<EmailRetryOutcome> {
  const cfg = { ...DEFAULTS, ...options };
  const now = Date.now();
  const upperBound = new Date(now - cfg.minAgeMs);
  const lowerBound = new Date(now - cfg.maxAgeMs);

  const candidates = await prisma.emailLog.findMany({
    where: {
      status: 'FAILED',
      createdAt: { gte: lowerBound, lte: upperBound },
    },
    orderBy: { createdAt: 'asc' },
    take: cfg.batchLimit,
    select: {
      id: true,
      templateKey: true,
      to: true,
      cc: true,
      bcc: true,
      subject: true,
      body: true,
      contextType: true,
      contextId: true,
    },
  });

  const outcome: EmailRetryOutcome = {
    considered: candidates.length,
    delivered: 0,
    failed: 0,
    skippedTooManyAttempts: 0,
  };

  for (const row of candidates) {
    // If any sibling row for this destination is already SENT, the
    // recipient already got the email — bail before we send a duplicate.
    // This is the dedupe gate that PR review caught: without it, the
    // sweep keeps re-firing on the original FAILED row even after a
    // prior retry succeeded, because we never mutate the original row.
    const alreadyDelivered = await prisma.emailLog.count({
      where: {
        templateKey: row.templateKey,
        to: row.to,
        subject: row.subject,
        status: 'SENT',
      },
    });
    if (alreadyDelivered > 0) {
      outcome.skippedTooManyAttempts++;
      continue;
    }
    // Count prior attempts (including the current FAILED row) for this
    // logical destination. If we've already tried MAX_AUTO_RETRIES times,
    // stop retrying — the admin can still bulk-resend manually.
    const attempts = await prisma.emailLog.count({
      where: {
        templateKey: row.templateKey,
        to: row.to,
        subject: row.subject,
      },
    });
    if (attempts >= cfg.maxAutoRetries) {
      outcome.skippedTooManyAttempts++;
      continue;
    }
    try {
      const result = await retryEmailLog(row);
      if (result.delivered) outcome.delivered++;
      else outcome.failed++;
    } catch {
      outcome.failed++;
    }
  }
  return outcome;
}
