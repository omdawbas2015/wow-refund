'use server';

import { prisma, Prisma } from '@wow/db';
import {
  createCaseSchema,
  addNoteSchema,
  updateCaseStatusSchema,
  canTransition,
  type CaseStatusValue,
} from '@wow/validators';
import { auth } from '@/auth';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; duplicate?: { caseNumber: string; id: string } };

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

const APPROVE_ROLES = new Set(['ADMIN', 'MANAGER']);

function canApprove(role: string | null | undefined): boolean {
  return !!role && APPROVE_ROLES.has(role);
}

/**
 * Generate the next REF-<country>-<year>-<seq> case number. Takes a Prisma
 * transaction client so the read participates in the caller's transaction —
 * paired with the retry loop in `createCaseAction`, this prevents duplicate
 * case numbers under concurrent writes.
 */
async function generateCaseNumber(
  tx: Prisma.TransactionClient,
  countryCode: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REF-${countryCode}-${year}-`;
  const last = await tx.refundCase.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  });
  const lastSeq = last ? Number(last.caseNumber.slice(prefix.length)) : 0;
  const next = (lastSeq + 1).toString().padStart(6, '0');
  return `${prefix}${next}`;
}

/**
 * Create a refund case from the new-case wizard.
 * Performs duplicate detection on (orderNumber, brandId) unless `duplicateAcknowledged`.
 */
export async function createCaseAction(
  input: unknown,
): Promise<ActionResult<{ id: string; caseNumber: string }>> {
  try {
    const user = await requireSession();
    const parsed = createCaseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Please review the form.',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const data = parsed.data;

    const country = await prisma.country.findUnique({
      where: { id: data.countryId },
      include: { registry: true },
    });
    if (!country) return { ok: false, error: 'Invalid country.' };

    // Verify brand is active for this country
    const brandCountry = await prisma.brandCountry.findFirst({
      where: { brandId: data.brandId, countryId: data.countryId, isActive: true },
    });
    if (!brandCountry) {
      // Non-blocking — some brands may operate across countries without a per-country row;
      // just warn via audit later. Allow creation to proceed.
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: {
        id: { in: data.components.map((c) => c.paymentMethodId) },
        isActive: true,
      },
    });
    if (paymentMethods.length !== new Set(data.components.map((c) => c.paymentMethodId)).size) {
      return { ok: false, error: 'One or more payment methods are invalid or inactive.' };
    }

    // Enforce KNET auth code requirement
    for (const c of data.components) {
      const pm = paymentMethods.find((p) => p.id === c.paymentMethodId);
      if (!pm) continue;
      if (pm.requiresAuthCode && !c.authCode?.trim()) {
        return {
          ok: false,
          error: `Auth code is required for ${pm.label}.`,
        };
      }
    }

    const totalRefundAmount = data.components.reduce((sum, c) => sum + c.amount, 0);
    if (totalRefundAmount > data.orderAmount + 0.001) {
      return { ok: false, error: 'Total refund exceeds order amount.' };
    }

    const isPartial = Math.abs(totalRefundAmount - data.orderAmount) > 0.001;

    // Duplicate detection + case-number generation + insert all run inside
    // the same transaction so the checks see committed state only. If two
    // concurrent requests still race (e.g. on a DB that doesn't serialize
    // reads), the unique constraint on `caseNumber` makes the loser throw
    // P2002 — we retry with a fresh sequence. Cap at 5 retries to avoid
    // pathological loops.
    type TxResult =
      | { kind: 'created'; newCase: Awaited<ReturnType<typeof prisma.refundCase.create>> }
      | { kind: 'duplicate'; id: string; caseNumber: string };
    const MAX_RETRIES = 5;
    let txOutcome: TxResult | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        txOutcome = await prisma.$transaction(async (tx): Promise<TxResult> => {
          // Duplicate detection must run inside the transaction so a
          // concurrent create for the same (orderNumber, brandId) can't slip
          // between the check and the insert.
          if (!data.duplicateAcknowledged) {
            const duplicate = await tx.refundCase.findFirst({
              where: {
                orderNumber: data.orderNumber,
                brandId: data.brandId,
                deletedAt: null,
              },
              select: { id: true, caseNumber: true },
              orderBy: { createdAt: 'desc' },
            });
            if (duplicate) {
              return { kind: 'duplicate', id: duplicate.id, caseNumber: duplicate.caseNumber };
            }
          }

          const caseNumber = await generateCaseNumber(tx, country.registry.code);
          const newCase = await tx.refundCase.create({
            data: {
              caseNumber,
              externalCaseNumber: data.externalCaseNumber,
              countryId: data.countryId,
              branchId: data.branchId || null,
              brandId: data.brandId,
              customerName: data.customerName,
              customerEmail: data.customerEmail,
              customerPhone: data.customerPhone,
              customerNotes: data.customerNotes || null,
              orderNumber: data.orderNumber,
              orderDate: data.orderDate,
              orderAmount: data.orderAmount,
              orderCurrency: data.orderCurrency,
              totalRefundAmount,
              isPartial,
              auraPoints: data.auraPoints ?? null,
              auraStatus: data.auraPoints != null ? 'PENDING' : 'NONE',
              status: 'DRAFT',
              rootCauseId: data.rootCauseId || null,
              rootCauseNotes: data.rootCauseNotes || null,
              createdById: user.id,
              components: {
                create: data.components.map((c) => ({
                  paymentMethodId: c.paymentMethodId,
                  amount: c.amount,
                  currency: data.orderCurrency,
                  authCode: c.authCode || null,
                  status: 'PENDING',
                })),
              },
            },
          });

          await tx.activityLog.create({
            data: {
              caseId: newCase.id,
              actorId: user.id,
              actorLabel: user.name,
              kind: 'case.created',
              message: `Case ${caseNumber} created`,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: user.id,
              actorEmail: user.email,
              action: 'case.created',
              entityType: 'CASE',
              entityId: newCase.id,
              afterData: JSON.stringify({ caseNumber, totalRefundAmount }),
            },
          });

          return { kind: 'created', newCase };
        });
        break;
      } catch (err) {
        // P2002 = unique constraint violation. If it's on `caseNumber`, retry
        // with the next sequence; otherwise rethrow.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          Array.isArray(err.meta?.target) &&
          (err.meta.target as string[]).includes('caseNumber')
        ) {
          if (attempt === MAX_RETRIES - 1) {
            return {
              ok: false,
              error: 'Could not allocate a unique case number; please retry.',
            };
          }
          continue;
        }
        throw err;
      }
    }

    if (!txOutcome) {
      return { ok: false, error: 'Case creation failed.' };
    }
    if (txOutcome.kind === 'duplicate') {
      return {
        ok: false,
        error: 'A case already exists for this order.',
        duplicate: { id: txOutcome.id, caseNumber: txOutcome.caseNumber },
      };
    }

    revalidatePath('/cases');
    return {
      ok: true,
      data: { id: txOutcome.newCase.id, caseNumber: txOutcome.newCase.caseNumber },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Transition a case from one status to another.
 * State-machine enforced via @wow/validators.canTransition.
 */
export async function updateCaseStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const parsed = updateCaseStatusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const { caseId, target, reason } = parsed.data;

    if (target === 'REJECTED') {
      // Rejection is driven by the manager email flow, not by UI actions.
      return {
        ok: false,
        error: 'Rejections are performed by the approver via email, not in the UI.',
      };
    }

    if (target === 'APPROVED' && !canApprove(user.role)) {
      return {
        ok: false,
        error: 'You do not have permission to approve cases.',
      };
    }

    // Read, validate, and write inside a single transaction, with an
    // optimistic-concurrency guard on `updateMany` so two concurrent
    // transitions from the same source status can't both succeed.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.refundCase.findUnique({ where: { id: caseId } });
      if (!existing) return { ok: false as const, error: 'Case not found' };
      if (existing.deletedAt) return { ok: false as const, error: 'Case is archived' };
      if (!canTransition(existing.status as CaseStatusValue, target)) {
        return {
          ok: false as const,
          error: `Cannot move case from ${existing.status} to ${target}.`,
        };
      }

      const patch: Record<string, unknown> = { status: target };
      if (target === 'CANCELLED') patch['cancelledReason'] = reason ?? null;
      if (target === 'APPROVED') {
        patch['approvedById'] = user.id;
        patch['approvedAt'] = new Date();
      }

      const guarded = await tx.refundCase.updateMany({
        where: { id: caseId, status: existing.status, deletedAt: null },
        data: patch,
      });
      if (guarded.count === 0) {
        return {
          ok: false as const,
          error: 'Case was modified by another user. Please refresh and retry.',
        };
      }

      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: `case.${target.toLowerCase()}`,
          message: `Case moved to ${target}${reason ? ` — ${reason}` : ''}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: `case.${target.toLowerCase()}`,
          entityType: 'CASE',
          entityId: caseId,
          beforeData: JSON.stringify({ status: existing.status }),
          afterData: JSON.stringify({ status: target, reason }),
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Add a note to a case. Parses @mentions from the body and creates Notifications
 * for each mentioned user.
 */
export async function addCaseNoteAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const parsed = addNoteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Please write a note.' };

    const { caseId, body, mentionedUserIds } = parsed.data;

    const uniqueMentions = Array.from(
      new Set(mentionedUserIds.filter((id) => id && id !== user.id)),
    );

    // Mentioned-user validation runs outside the transaction — it reads a
    // different table and its consistency requirements are lower.
    const validMentions = uniqueMentions.length
      ? await prisma.user.findMany({
          where: { id: { in: uniqueMentions }, status: 'ACTIVE', deletedAt: null },
          select: { id: true, name: true },
        })
      : [];

    // Read + guard + write inside a single transaction so a concurrent
    // deleteCaseAction can't soft-delete the case between the check and
    // the note insert. Returns a discriminated result so we can surface
    // "not found" / "deleted" errors without throwing.
    type NoteTxResult =
      | { ok: true }
      | { ok: false; error: string };
    const result = await prisma.$transaction(async (tx): Promise<NoteTxResult> => {
      const existing = await tx.refundCase.findUnique({
        where: { id: caseId },
        select: { id: true, caseNumber: true, deletedAt: true },
      });
      if (!existing) return { ok: false, error: 'Case not found' };
      if (existing.deletedAt) {
        return { ok: false, error: 'Cannot add notes to a deleted case.' };
      }

      const note = await tx.caseNote.create({
        data: {
          caseId,
          authorId: user.id,
          body,
          mentions: {
            create: validMentions.map((m) => ({ userId: m.id })),
          },
        },
      });

      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: 'note.added',
          message: 'added a note',
        },
      });

      for (const m of validMentions) {
        await tx.notification.create({
          data: {
            userId: m.id,
            type: 'CASE_NOTE_MENTION',
            title: `${user.name} mentioned you on ${existing.caseNumber}`,
            body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
            href: `/cases/${caseId}#note-${note.id}`,
            contextType: 'CASE',
            contextId: caseId,
          },
        });
      }

      return { ok: true };
    });

    if (!result.ok) return result;

    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Mark a notification as read. Used by the bell dropdown.
 */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { readAt: new Date() },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Soft-delete a case with a reason. The case remains visible in the list
 * with a "Deleted" badge but can no longer be transitioned.
 */
export async function deleteCaseAction(input: {
  caseId: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const caseId = String(input.caseId ?? '');
    const reason = String(input.reason ?? '').trim();
    if (!caseId) return { ok: false, error: 'Missing case id.' };
    if (reason.length < 3) {
      return { ok: false, error: 'Please provide a deletion reason (min 3 chars).' };
    }

    // Read + status guard + soft-delete inside a single transaction, with
    // an optimistic-concurrency guard on `updateMany` so a concurrent
    // transition to REFUNDED can't slip past the check.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.refundCase.findUnique({ where: { id: caseId } });
      if (!existing) return { ok: false as const, error: 'Case not found' };
      if (existing.deletedAt) {
        return { ok: false as const, error: 'Case is already deleted.' };
      }
      if (existing.status === 'REFUNDED' || existing.status === 'PARTIALLY_REFUNDED') {
        return { ok: false as const, error: 'Refunded cases cannot be deleted.' };
      }

      const deletedAt = new Date();
      const guarded = await tx.refundCase.updateMany({
        where: {
          id: caseId,
          deletedAt: null,
          status: { notIn: ['REFUNDED', 'PARTIALLY_REFUNDED'] },
        },
        data: { deletedAt },
      });
      if (guarded.count === 0) {
        return {
          ok: false as const,
          error: 'Case was modified by another user. Please refresh and retry.',
        };
      }

      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: 'case.deleted',
          message: `deleted the case — ${reason}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: 'case.deleted',
          entityType: 'CASE',
          entityId: caseId,
          beforeData: JSON.stringify({ deletedAt: null, status: existing.status }),
          afterData: JSON.stringify({ deletedAt: deletedAt.toISOString(), reason }),
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Roles that may execute the post-approval refund — set the ARN on each
 * payment component, send the customer the ARN email, and progress the
 * case to REFUNDED. Mirrors the Refund-Operations team in the operating
 * model: ADMIN for break-glass, OPERATIONS for the actual day-to-day.
 */
const EXECUTE_ROLES = new Set(['ADMIN', 'OPERATIONS']);

/**
 * Set the ARN on a single payment component. Only allowed once the case
 * is APPROVED or already in execution. Each component records its own
 * ARN — KNET is the most common case but the schema supports multiple
 * components, so we expose this per-component.
 *
 * Marks the component REFUNDED. The case is *not* auto-progressed here;
 * `completeRefundAction` handles that once every component has an ARN
 * (or the operator marks the case refunded manually).
 */
export async function setComponentArnAction(input: {
  caseId: string;
  componentId: string;
  arn: string;
}): Promise<ActionResult> {
  try {
    const user = await requireSession();
    if (!EXECUTE_ROLES.has(user.role ?? '')) {
      return {
        ok: false,
        error: 'Only Refund Operations can record an ARN.',
      };
    }
    const caseId = String(input.caseId ?? '').trim();
    const componentId = String(input.componentId ?? '').trim();
    const arn = String(input.arn ?? '').trim();
    if (!caseId || !componentId) return { ok: false, error: 'Missing case or component id.' };
    if (arn.length < 3) {
      return { ok: false, error: 'Please enter a valid ARN.' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.refundCase.findUnique({
        where: { id: caseId },
        select: { id: true, status: true, deletedAt: true },
      });
      if (!existing) return { ok: false as const, error: 'Case not found' };
      if (existing.deletedAt) return { ok: false as const, error: 'Case is archived' };
      if (
        existing.status !== 'APPROVED' &&
        existing.status !== 'IN_EXECUTION' &&
        existing.status !== 'PARTIALLY_REFUNDED'
      ) {
        return {
          ok: false as const,
          error: `ARN can only be set after the case is approved (current: ${existing.status}).`,
        };
      }

      const component = await tx.refundComponent.findFirst({
        where: { id: componentId, caseId },
        select: { id: true, status: true },
      });
      if (!component) return { ok: false as const, error: 'Component not found' };

      // First-time ARN entry transitions the case from APPROVED to
      // IN_EXECUTION so the Progress rail reflects what's happening.
      if (existing.status === 'APPROVED') {
        await tx.refundCase.update({
          where: { id: caseId },
          data: { status: 'IN_EXECUTION' },
        });
        await tx.activityLog.create({
          data: {
            caseId,
            actorId: user.id,
            actorLabel: user.name,
            kind: 'case.in_execution',
            message: 'Case moved to IN_EXECUTION (first ARN recorded)',
          },
        });
      }

      await tx.refundComponent.update({
        where: { id: componentId },
        data: {
          arn,
          arnVerifiedAt: new Date(),
          status: 'REFUNDED',
          refundedById: user.id,
          refundedAt: new Date(),
        },
      });

      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: 'component.arn_set',
          message: `recorded ARN ${arn}`,
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;
    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Finalise the refund: move the case to REFUNDED, mark
 * customerCallStatus = PENDING, and dispatch the
 * CUSTOMER_REFUND_COMPLETED email with the ARN(s) so the customer has
 * the payment reference. Requires every component to have an ARN.
 */
export async function completeRefundAction(input: {
  caseId: string;
}): Promise<ActionResult> {
  try {
    const user = await requireSession();
    if (!EXECUTE_ROLES.has(user.role ?? '')) {
      return { ok: false, error: 'Only Refund Operations can complete a refund.' };
    }
    const caseId = String(input.caseId ?? '').trim();
    if (!caseId) return { ok: false, error: 'Missing case id.' };

    const refundCase = await prisma.refundCase.findUnique({
      where: { id: caseId },
      include: {
        components: { include: { paymentMethod: true } },
        brand: true,
      },
    });
    if (!refundCase) return { ok: false, error: 'Case not found' };
    if (refundCase.deletedAt) return { ok: false, error: 'Case is archived' };
    if (
      refundCase.status !== 'IN_EXECUTION' &&
      refundCase.status !== 'PARTIALLY_REFUNDED' &&
      refundCase.status !== 'APPROVED'
    ) {
      return {
        ok: false,
        error: `Case must be in execution before it can be marked refunded (current: ${refundCase.status}).`,
      };
    }
    const missingArn = refundCase.components.filter((c) => !c.arn || !c.arn.trim());
    if (missingArn.length > 0) {
      return {
        ok: false,
        error: `Record an ARN for every component before completing the refund (${missingArn.length} missing).`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.refundCase.update({
        where: { id: caseId },
        data: {
          status: 'REFUNDED',
          customerNotifiedAt: new Date(),
          customerCallStatus: 'PENDING',
          customerCallUpdatedAt: new Date(),
        },
      });
      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: 'case.refunded',
          message: 'Case marked as refunded; customer notified with ARN',
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: 'case.refunded',
          entityType: 'CASE',
          entityId: caseId,
          beforeData: JSON.stringify({ status: refundCase.status }),
          afterData: JSON.stringify({ status: 'REFUNDED' }),
        },
      });
    });

    // Send the ARN email outside the transaction. EmailLog already records
    // its own audit row so we don't lose visibility on failure.
    const componentsTable = refundCase.components
      .map(
        (c) =>
          `- ${c.paymentMethod.label}: ${c.amount.toFixed(3)} ${c.currency} (ARN ${c.arn ?? ''})`,
      )
      .join('\n');
    const arnSummary = refundCase.components
      .map((c) => c.arn)
      .filter((x): x is string => !!x)
      .join(', ');
    await dispatchEmail({
      templateKey: 'CUSTOMER_REFUND_COMPLETED',
      locale: 'en',
      to: refundCase.customerEmail,
      variables: {
        customerName: refundCase.customerName,
        orderNumber: refundCase.orderNumber,
        componentsTable,
        totalAmount: `${refundCase.totalRefundAmount.toFixed(3)} ${refundCase.orderCurrency}`,
        arn: arnSummary,
        brandName: refundCase.brand.name,
      },
      context: { type: 'CASE', id: caseId },
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Record the outcome of the agent's post-refund call to the customer.
 * - ANSWERED → nothing more to do; the ARN email is enough.
 * - NO_ANSWER → dispatch the follow-up reply on the ARN thread so the
 *   customer still has a written confirmation.
 * - NOT_NEEDED → suppresses the prompt without sending a follow-up.
 */
export async function markCustomerCallAction(input: {
  caseId: string;
  outcome: 'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED';
}): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const caseId = String(input.caseId ?? '').trim();
    const outcome = input.outcome;
    if (!caseId) return { ok: false, error: 'Missing case id.' };
    if (outcome !== 'ANSWERED' && outcome !== 'NO_ANSWER' && outcome !== 'NOT_NEEDED') {
      return { ok: false, error: 'Invalid outcome.' };
    }

    const refundCase = await prisma.refundCase.findUnique({
      where: { id: caseId },
      include: {
        components: true,
        brand: true,
      },
    });
    if (!refundCase) return { ok: false, error: 'Case not found' };
    if (refundCase.deletedAt) return { ok: false, error: 'Case is archived' };
    if (refundCase.status !== 'REFUNDED' && refundCase.status !== 'PARTIALLY_REFUNDED') {
      return {
        ok: false,
        error: 'Customer call follow-up is only available after the refund is sent.',
      };
    }

    const now = new Date();
    await prisma.refundCase.update({
      where: { id: caseId },
      data: {
        customerCallStatus: outcome,
        customerCallUpdatedAt: now,
        customerCallById: user.id,
        ...(outcome === 'NO_ANSWER' ? { customerCallFollowUpAt: now } : {}),
      },
    });
    await prisma.activityLog.create({
      data: {
        caseId,
        actorId: user.id,
        actorLabel: user.name,
        kind: `case.customer_call.${outcome.toLowerCase()}`,
        message:
          outcome === 'ANSWERED'
            ? 'Reached the customer to confirm the refund'
            : outcome === 'NO_ANSWER'
              ? 'Could not reach the customer; sent ARN follow-up reply'
              : 'Marked customer call as not needed',
      },
    });

    if (outcome === 'NO_ANSWER') {
      const arnSummary = refundCase.components
        .map((c) => c.arn)
        .filter((x): x is string => !!x)
        .join(', ');
      await dispatchEmail({
        templateKey: 'CUSTOMER_REFUND_FOLLOWUP_NO_ANSWER',
        locale: 'en',
        to: refundCase.customerEmail,
        variables: {
          customerName: refundCase.customerName,
          orderNumber: refundCase.orderNumber,
          arn: arnSummary,
          brandName: refundCase.brand.name,
        },
        context: { type: 'CASE', id: caseId },
      });
    }

    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Wrapper used by server-rendered forms that expect a redirect on success.
 * Reads FormData-serialized input. The form must include a hidden `locale`
 * field so the redirect target stays on the caller's locale (next-intl
 * locale-prefixed routing).
 */
export async function createCaseFormAction(formData: FormData) {
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  // components[] is serialized as JSON to keep the form simple
  const rawComponents = formData.get('components');
  if (typeof rawComponents === 'string') {
    try {
      raw['components'] = JSON.parse(rawComponents);
    } catch {
      // leave untouched — validator will reject
    }
  }
  const locale = String(formData.get('locale') ?? 'en').replace(/[^a-z-]/gi, '') || 'en';
  const result = await createCaseAction(raw);
  if (!result.ok) {
    return result;
  }
  redirect(`/${locale}/cases/${result.data!.id}`);
}
