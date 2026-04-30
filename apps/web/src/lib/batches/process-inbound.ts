import { prisma } from '@wow/db';
import {
  APPROVAL_BATCH_NUMBER_REGEX,
  KNET_BATCH_NUMBER_REGEX,
  AURA_BATCH_NUMBER_REGEX,
} from '@wow/validators';
import { parseApprovalReply } from './parse-reply';
import { parseArnReply } from './parse-arn';

export interface ProcessOutcome {
  intent:
    | 'APPROVAL_RESPONSE'
    | 'KNET_ARN_REPLY'
    | 'AURA_CONFIRMATION'
    | 'CUSTOMER_REPLY'
    | 'IGNORED'
    | 'UNAUTHORIZED_SENDER'
    | 'UNCLEAR_INTENT';
  payload?: Record<string, unknown>;
  linkedBatchId?: string;
  linkedCaseId?: string;
  linkedComponentId?: string;
}

/**
 * Optional pre-parsed result from an upstream AI step (e.g. an AI Builder /
 * GPT prompt action inside a Power Automate flow). When present this is the
 * authoritative source of truth and replaces the heuristic regex parsers
 * below — but only for matching intents.
 *
 * `intent === 'UNCLEAR'` lets the AI explicitly say "I cannot tell"; we then
 * never auto-decide the batch and just record the inbound row as FAILED so
 * a human can review.
 */
export interface AiParsedReply {
  intent:
    | 'APPROVAL_RESPONSE'
    | 'KNET_ARN_REPLY'
    | 'AURA_CONFIRMATION'
    | 'CUSTOMER_REPLY'
    | 'UNCLEAR';
  confidence?: number;
  /** Used by approval / aura handlers when no per-case decisions are given. */
  blanket?: 'APPROVED' | 'REJECTED';
  /** Per-case decisions; case numbers must match `RefundCase.caseNumber`. */
  perCase?: Array<{ caseNumber: string; decision: 'APPROVED' | 'REJECTED' }>;
  /** Used by KNET handler — maps customer-visible order/case numbers to ARNs. */
  arns?: Array<{ caseNumber: string; arn: string }>;
  /** Free-text reason returned when intent === 'UNCLEAR'. */
  reason?: string;
}

export interface ProcessInboundArgs {
  fromEmail: string;
  subject: string;
  rawBody: string;
  /** Optional AI-parsed payload from Power Automate. */
  aiParsed?: AiParsedReply;
}

/**
 * Inspect an inbound email body and dispatch it to the right handler.
 *
 * The function is conservative: when classification is ambiguous it returns
 * `IGNORED` so a human can review the inbound row in the admin panel later.
 * Calls into prisma so the per-handler updates participate in the same DB.
 */
export async function processInboundReply(
  args: ProcessInboundArgs,
): Promise<ProcessOutcome> {
  const { fromEmail, subject, rawBody, aiParsed } = args;

  // If the AI step explicitly says it can't classify the email, we never
  // touch the batches — humans handle the inbound row from the admin panel.
  if (aiParsed?.intent === 'UNCLEAR') {
    await prisma.auditLog.create({
      data: {
        actorEmail: fromEmail,
        action: 'inbound.ai_unclear',
        entityType: 'INBOUND_EMAIL',
        entityId: subject.slice(0, 200),
        afterData: JSON.stringify({
          reason: aiParsed.reason ?? 'AI returned UNCLEAR intent',
          confidence: aiParsed.confidence ?? null,
        }),
      },
    });
    return {
      intent: 'UNCLEAR_INTENT',
      payload: {
        reason: aiParsed.reason ?? 'AI returned UNCLEAR intent',
        confidence: aiParsed.confidence ?? null,
      },
    };
  }

  const haystack = `${subject}\n${rawBody}`;
  const approvalMatch = haystack.match(APPROVAL_BATCH_NUMBER_REGEX);
  const knetMatch = haystack.match(KNET_BATCH_NUMBER_REGEX);
  const auraMatch = haystack.match(AURA_BATCH_NUMBER_REGEX);

  // The AI's intent (when provided) takes precedence over the regex-based
  // dispatch — so a forwarded thread that contains both an APR-* number and
  // a KNT-* number is still routed to the right handler.
  const intent = aiParsed?.intent ?? null;

  if (approvalMatch?.length && (intent === null || intent === 'APPROVAL_RESPONSE')) {
    return await applyApprovalReply(approvalMatch[0]!, fromEmail, rawBody, aiParsed);
  }
  if (knetMatch?.length && (intent === null || intent === 'KNET_ARN_REPLY')) {
    return await applyKnetArnReply(knetMatch[0]!, fromEmail, rawBody, aiParsed);
  }
  if (auraMatch?.length && (intent === null || intent === 'AURA_CONFIRMATION')) {
    return await applyAuraConfirmation(auraMatch[0]!, fromEmail, rawBody, aiParsed);
  }

  return { intent: 'IGNORED' };
}

/**
 * Verify the inbound `fromEmail` is actually allowed to drive a decision
 * on this batch. We accept either:
 *   - the batch's own `recipientEmails` list (case-insensitive), or
 *   - any active User in the DB whose role.key is in `extraRoles`
 *     (and, when given, whose primaryCountryId matches `countryId`).
 *
 * On rejection we write an audit row and return false so the caller can
 * short-circuit with an UNAUTHORIZED_SENDER outcome.
 */
async function isAuthorizedSender(opts: {
  fromEmail: string;
  recipientEmails: string;
  extraRoles: ReadonlyArray<string>;
  countryId?: string | null;
  batchEntityType: string;
  batchEntityId: string;
}): Promise<boolean> {
  const sender = opts.fromEmail.trim().toLowerCase();
  if (!sender) return false;

  // Match resolve-approver.ts: recipientEmails uses comma OR semicolon
  // separators (Outlook serializes recipient lists with `;` while our
  // own UI defaults to `,`). Splitting on only one of them rejects
  // legitimate managers — see Devin Review on PR #21.
  const recipients = opts.recipientEmails
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (recipients.includes(sender)) return true;

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: sender },
      status: 'ACTIVE',
      deletedAt: null,
    },
    include: { role: true },
  });
  if (
    user?.role &&
    opts.extraRoles.includes(user.role.key) &&
    (!opts.countryId || user.primaryCountryId === opts.countryId)
  ) {
    return true;
  }

  await prisma.auditLog.create({
    data: {
      actorEmail: opts.fromEmail,
      action: 'inbound.unauthorized_sender',
      entityType: opts.batchEntityType,
      entityId: opts.batchEntityId,
      afterData: JSON.stringify({
        recipients,
        extraRoles: opts.extraRoles,
        countryId: opts.countryId ?? null,
      }),
    },
  });
  return false;
}

async function applyApprovalReply(
  batchNumber: string,
  fromEmail: string,
  rawBody: string,
  aiParsed?: AiParsedReply,
): Promise<ProcessOutcome> {
  const batch = await prisma.approvalBatch.findUnique({
    where: { batchNumber },
    include: { cases: { select: { id: true, caseNumber: true, status: true } } },
  });
  if (!batch) {
    return { intent: 'IGNORED', payload: { reason: 'unknown approval batch', batchNumber } };
  }
  if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
    return { intent: 'IGNORED', payload: { reason: 'batch closed', batchNumber } };
  }

  // Only the manager(s) we sent the batch to — or another active country
  // manager / admin for this country — can drive a decision. Any other
  // sender is recorded in the audit log but never moves cases.
  const allowed = await isAuthorizedSender({
    fromEmail,
    recipientEmails: batch.recipientEmails,
    extraRoles: ['MANAGER', 'ADMIN'],
    countryId: batch.countryId,
    batchEntityType: 'APPROVAL_BATCH',
    batchEntityId: batch.id,
  });
  if (!allowed) {
    return {
      intent: 'UNAUTHORIZED_SENDER',
      linkedBatchId: batch.id,
      payload: { reason: 'sender not on approval allowlist', batchNumber, fromEmail },
    };
  }

  const decisions = new Map<string, 'APPROVED' | 'REJECTED'>();

  // Prefer AI-parsed decisions when supplied — the AI sees the whole email
  // (signatures, quoted threads) and is much better than regex at handling
  // "approve all except case X" or natural-language replies.
  if (aiParsed?.intent === 'APPROVAL_RESPONSE') {
    // Apply blanket FIRST so per-case entries can override it. This is the
    // "approve all except X" pattern: blanket=APPROVED + perCase=[REJECTED X].
    if (aiParsed.blanket) {
      for (const c of batch.cases) {
        if (c.status === 'PENDING_APPROVAL') decisions.set(c.caseNumber, aiParsed.blanket);
      }
    }
    for (const entry of aiParsed.perCase ?? []) {
      decisions.set(entry.caseNumber, entry.decision);
    }
  } else {
    const parsed = parseApprovalReply(rawBody);
    for (const entry of parsed.perCase) decisions.set(entry.caseNumber, entry.decision);
    // Blanket fallback only kicks in if the manager didn't list specific cases.
    if (decisions.size === 0 && parsed.blanket) {
      for (const c of batch.cases) {
        if (c.status === 'PENDING_APPROVAL') decisions.set(c.caseNumber, parsed.blanket);
      }
    }
  }

  if (decisions.size === 0) {
    return { intent: 'IGNORED', payload: { reason: 'no decision keywords found' } };
  }

  await prisma.$transaction(async (tx) => {
    let approved = 0;
    let rejected = 0;
    for (const c of batch.cases) {
      const decision = decisions.get(c.caseNumber);
      if (!decision) continue;
      if (c.status !== 'PENDING_APPROVAL') continue;

      const guard = await tx.refundCase.updateMany({
        where: { id: c.id, status: 'PENDING_APPROVAL' },
        data:
          decision === 'APPROVED'
            ? { status: 'APPROVED', approvedAt: new Date() }
            : { status: 'REJECTED', rejectedReason: 'Manager rejected via email' },
      });
      if (guard.count === 0) continue;

      if (decision === 'APPROVED') approved++;
      else rejected++;

      await tx.activityLog.create({
        data: {
          caseId: c.id,
          actorLabel: 'Manager (email)',
          kind: decision === 'APPROVED' ? 'case.approved' : 'case.rejected',
          message:
            decision === 'APPROVED'
              ? `Approved via email reply to batch ${batchNumber}`
              : `Rejected via email reply to batch ${batchNumber}`,
        },
      });
    }

    // Use the authoritative DB count of still-pending cases on this batch
    // instead of the (possibly stale) `batch.approvedCases` / `rejectedCases`
    // values read outside the transaction. This is concurrency-safe even if
    // the magic-link path or another reply landed in parallel.
    const remaining = await tx.refundCase.count({
      where: { approvalBatchId: batch.id, status: 'PENDING_APPROVAL' },
    });
    const allDecided = remaining === 0;

    // Guard the batch close on a non-terminal status so a parallel
    // magic-link decision or cancel can't be silently overwritten. If the
    // guard trips (count===0) the case-level updates above already landed,
    // so we just leave the batch alone — no completedAt clobbering either.
    await tx.approvalBatch.updateMany({
      where: { id: batch.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: {
        approvedCases: { increment: approved },
        rejectedCases: { increment: rejected },
        status: allDecided ? 'COMPLETED' : 'PARTIALLY_DECIDED',
        responseReceivedAt: new Date(),
        responseRawBody: rawBody.slice(0, 8000),
        responseParsed: JSON.stringify(Array.from(decisions.entries())),
        ...(allDecided ? { completedAt: new Date() } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        actorEmail: 'inbound@power-automate',
        action: 'approval_batch.decision_applied',
        entityType: 'BATCH',
        entityId: batch.id,
        afterData: JSON.stringify({ approved, rejected, allDecided }),
      },
    });
  });

  return {
    intent: 'APPROVAL_RESPONSE',
    linkedBatchId: batch.id,
    payload: { decisions: Array.from(decisions.entries()) },
  };
}

async function applyKnetArnReply(
  batchNumber: string,
  fromEmail: string,
  rawBody: string,
  aiParsed?: AiParsedReply,
): Promise<ProcessOutcome> {
  const batch = await prisma.knetBatch.findUnique({
    where: { batchNumber },
    include: { components: { include: { case: { select: { caseNumber: true } } } } },
  });
  if (!batch) {
    return { intent: 'IGNORED', payload: { reason: 'unknown knet batch', batchNumber } };
  }
  if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
    return { intent: 'IGNORED', payload: { reason: 'batch closed', batchNumber } };
  }

  // KNET ARN replies must come from Finance — the team / mailbox we sent
  // the batch to. We accept the explicit recipient(s) plus any ACTIVE user
  // with FINANCE / ADMIN role as a delegation fallback.
  const allowed = await isAuthorizedSender({
    fromEmail,
    recipientEmails: batch.recipientEmails,
    extraRoles: ['FINANCE', 'ADMIN'],
    countryId: null,
    batchEntityType: 'KNET_BATCH',
    batchEntityId: batch.id,
  });
  if (!allowed) {
    return {
      intent: 'UNAUTHORIZED_SENDER',
      linkedBatchId: batch.id,
      payload: { reason: 'sender not on KNET ARN allowlist', batchNumber, fromEmail },
    };
  }

  const arnEntries =
    aiParsed?.intent === 'KNET_ARN_REPLY' && aiParsed.arns?.length
      ? aiParsed.arns.map((a) => ({ caseNumber: a.caseNumber, arn: a.arn }))
      : parseArnReply(rawBody);
  if (arnEntries.length === 0) {
    return { intent: 'IGNORED', payload: { reason: 'no ARN entries parsed' } };
  }

  // Index components by their case number so we can map suggestions back.
  const byCaseNumber = new Map<string, typeof batch.components[number]>();
  for (const c of batch.components) byCaseNumber.set(c.case.caseNumber, c);

  const applied: Array<{ caseNumber: string; arn: string; componentId: string }> = [];
  await prisma.$transaction(async (tx) => {
    for (const entry of arnEntries) {
      const component = byCaseNumber.get(entry.caseNumber);
      if (!component) continue;
      if (component.status === 'REFUNDED') continue;
      const guard = await tx.refundComponent.updateMany({
        where: { id: component.id, arn: null, status: 'AWAITING_ARN' },
        data: {
          arn: entry.arn,
          arnSuggestedAt: new Date(),
          status: 'ARN_RECEIVED',
        },
      });
      if (guard.count === 0) continue;
      applied.push({
        caseNumber: entry.caseNumber,
        arn: entry.arn,
        componentId: component.id,
      });

      await tx.activityLog.create({
        data: {
          caseId: component.caseId,
          actorLabel: 'Finance (email)',
          kind: 'component.arn_suggested',
          message: `Power Automate parsed ARN ${entry.arn} for ${entry.caseNumber}`,
        },
      });

      // (Per-user notifications for the ops desk are deferred until Phase 6
      // adds team-level fan-out; the activity log + operations page surface
      // the new ARN suggestion in the meantime.)
    }

    // Use a real-time count of components still missing an ARN on this
    // batch instead of the (possibly stale) `batch.arnsReceived` value. This
    // handles multi-email replies AND parallel processing correctly.
    const remainingWithoutArn = await tx.refundComponent.count({
      where: { batchId: batch.id, arn: null },
    });
    // Guard the close on a non-terminal status so a parallel cancel / dup
    // webhook can't be silently overwritten back to AWAITING_ARNS.
    await tx.knetBatch.updateMany({
      where: { id: batch.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: {
        arnsReceived: { increment: applied.length },
        responseReceivedAt: new Date(),
        responseRawBody: rawBody.slice(0, 8000),
        responseParsedArns: JSON.stringify(applied),
        status: remainingWithoutArn === 0 ? 'ARNS_RECEIVED' : 'AWAITING_ARNS',
      },
    });
    await tx.auditLog.create({
      data: {
        actorEmail: 'inbound@power-automate',
        action: 'knet_batch.arns_suggested',
        entityType: 'BATCH',
        entityId: batch.id,
        afterData: JSON.stringify(applied),
      },
    });
  });

  return {
    intent: 'KNET_ARN_REPLY',
    linkedBatchId: batch.id,
    payload: { applied },
  };
}

async function applyAuraConfirmation(
  batchNumber: string,
  fromEmail: string,
  rawBody: string,
  aiParsed?: AiParsedReply,
): Promise<ProcessOutcome> {
  const batch = await prisma.auraBatch.findUnique({
    where: { batchNumber },
    include: {
      cases: { select: { id: true, caseNumber: true, auraStatus: true } },
    },
  });
  if (!batch) return { intent: 'IGNORED', payload: { reason: 'unknown aura batch', batchNumber } };
  if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
    return { intent: 'IGNORED', payload: { reason: 'batch closed', batchNumber } };
  }

  // Aura confirmations come from the Aura points operations team. The role
  // for these users in the seeded RBAC is OPERATIONS; ADMIN is allowed as
  // a fallback for break-glass cases.
  const allowed = await isAuthorizedSender({
    fromEmail,
    recipientEmails: batch.recipientEmails,
    extraRoles: ['OPERATIONS', 'ADMIN'],
    countryId: null,
    batchEntityType: 'AURA_BATCH',
    batchEntityId: batch.id,
  });
  if (!allowed) {
    return {
      intent: 'UNAUTHORIZED_SENDER',
      linkedBatchId: batch.id,
      payload: { reason: 'sender not on Aura allowlist', batchNumber, fromEmail },
    };
  }

  // Aura confirmation reuses the approval parser: per-case decisions when the
  // team lists case numbers, plus a blanket fallback for simple replies like
  // "all done" / "confirmed" / "تم". APPROVED → COMPLETED, REJECTED → FAILED.
  const decisions = new Map<string, 'COMPLETED' | 'FAILED'>();
  if (aiParsed?.intent === 'AURA_CONFIRMATION') {
    // Apply blanket FIRST so per-case entries can override it
    // ("all done except X").
    if (aiParsed.blanket) {
      const blanketStatus: 'COMPLETED' | 'FAILED' =
        aiParsed.blanket === 'APPROVED' ? 'COMPLETED' : 'FAILED';
      for (const c of batch.cases) {
        if (c.auraStatus === 'PENDING' || c.auraStatus === 'IN_BATCH') {
          decisions.set(c.caseNumber, blanketStatus);
        }
      }
    }
    for (const entry of aiParsed.perCase ?? []) {
      decisions.set(
        entry.caseNumber,
        entry.decision === 'APPROVED' ? 'COMPLETED' : 'FAILED',
      );
    }
  } else {
    const parsed = parseApprovalReply(rawBody);
    for (const entry of parsed.perCase) {
      decisions.set(
        entry.caseNumber,
        entry.decision === 'APPROVED' ? 'COMPLETED' : 'FAILED',
      );
    }
    if (decisions.size === 0 && parsed.blanket) {
      const blanketStatus: 'COMPLETED' | 'FAILED' =
        parsed.blanket === 'APPROVED' ? 'COMPLETED' : 'FAILED';
      for (const c of batch.cases) {
        if (c.auraStatus === 'PENDING' || c.auraStatus === 'IN_BATCH') {
          decisions.set(c.caseNumber, blanketStatus);
        }
      }
    }
  }

  if (decisions.size === 0) {
    return { intent: 'IGNORED', payload: { reason: 'no aura decisions parsed' } };
  }

  let completed = 0;
  await prisma.$transaction(async (tx) => {
    for (const [caseNumber, status] of decisions) {
      // Only confirm cases that were claimed by THIS batch — protects against
      // unrelated `IN_BATCH` cases being collateral-damaged by a stray reply.
      const guard = await tx.refundCase.updateMany({
        where: {
          caseNumber,
          auraBatchId: batch.id,
          auraStatus: { in: ['PENDING', 'IN_BATCH'] },
        },
        data: {
          auraStatus: status,
          auraProcessedAt: new Date(),
        },
      });
      if (guard.count === 0) continue;
      if (status === 'COMPLETED') completed++;

      const updatedCase = await tx.refundCase.findUnique({
        where: { caseNumber },
        select: { id: true },
      });
      if (updatedCase) {
        await tx.activityLog.create({
          data: {
            caseId: updatedCase.id,
            actorLabel: 'Aura team (email)',
            kind: status === 'COMPLETED' ? 'aura.completed' : 'aura.failed',
            message:
              status === 'COMPLETED'
                ? `Aura points refunded (batch ${batchNumber})`
                : `Aura refund failed (batch ${batchNumber})`,
          },
        });
      }
    }

    // Use the authoritative DB count (post-update) so multi-email replies AND
    // FAILED cases both contribute to closing the batch — the batch is "done"
    // once every case has a terminal Aura status, regardless of which side.
    const remaining = await tx.refundCase.count({
      where: {
        auraBatchId: batch.id,
        auraStatus: { in: ['PENDING', 'IN_BATCH'] },
      },
    });
    const allDone = remaining === 0;
    // Guard the close on a non-terminal status so a parallel cancel / dup
    // webhook can't be silently overwritten and `completedAt` can't be
    // nulled out on an already-completed batch.
    await tx.auraBatch.updateMany({
      where: { id: batch.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: {
        completedCases: { increment: completed },
        responseReceivedAt: new Date(),
        responseRawBody: rawBody.slice(0, 8000),
        responseParsed: JSON.stringify(Array.from(decisions.entries())),
        status: allDone ? 'COMPLETED' : 'AWAITING',
        ...(allDone ? { completedAt: new Date() } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorEmail: 'inbound@power-automate',
        action: 'aura_batch.confirmation_applied',
        entityType: 'BATCH',
        entityId: batch.id,
        afterData: JSON.stringify(Array.from(decisions.entries())),
      },
    });
  });

  return {
    intent: 'AURA_CONFIRMATION',
    linkedBatchId: batch.id,
    payload: { decisions: Array.from(decisions.entries()) },
  };
}
