import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { broadcast } from '@/lib/events/bus';
import { requireAvailableAgent } from '@/lib/maintenance/agent-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/branded-solutions/[id]/close
 *
 * Body: { mrNumber: string }
 *
 * Records the Archibus MR number, transitions the ticket to CLOSED,
 * and emails the customer the confirmation template
 * (`MAINT_CUSTOMER_CONFIRMATION`). Mirrors the Adaptive-Card "Send"
 * flow that previously closed the Teams card.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const agent = await requireAvailableAgent(session.user.id);
  if (!agent) {
    return NextResponse.json(
      { error: 'AGENT_AWAY', message: 'Set yourself Available before closing tickets.' },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  let body: { mrNumber?: string };
  try {
    body = (await req.json()) as { mrNumber?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const mrNumber = (body.mrNumber ?? '').trim();
  if (mrNumber.length === 0) {
    return NextResponse.json({ error: 'mrNumber is required' }, { status: 400 });
  }

  const before = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (before.status === 'CLOSED') {
    return NextResponse.json({ error: 'Already closed', mrNumber: before.mrNumber }, { status: 409 });
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      status: 'CLOSED',
      mrNumber,
      closedAt: new Date(),
      closedById: session.user.id,
    },
  });

  await prisma.maintenanceStatusHistory.create({
    data: {
      requestId: id,
      fromStatus: before.status,
      toStatus: 'CLOSED',
      action: 'CLOSED_WITH_MR',
      note: `MR #${mrNumber} raised in Archibus. Customer notified.`,
      actorId: session.user.id,
    },
  });

  // Fire the customer confirmation email — failure here shouldn't
  // unwind the close (the agent already raised the work order in
  // Archibus). We mark the email log entry FAILED instead and surface
  // the error in the response so the agent can resend manually.
  let emailError: string | null = null;
  try {
    await dispatchEmail({
      templateKey: 'MAINT_CUSTOMER_CONFIRMATION',
      locale: 'en',
      to: before.email,
      variables: {
        mrNumber,
        machineModel: before.machineModel,
        storeName: before.storeName,
        location: before.location ?? '—',
        issueType: before.issueType,
      },
      context: { type: 'SYSTEM', id },
    });
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Email failed';
    console.error('[branded-solutions/close] customer email failed:', err);
  }

  broadcast({
    type: 'maintenance.updated',
    data: { id: updated.id, ticketRef: updated.ticketRef, status: 'CLOSED' },
  });

  return NextResponse.json({ ok: true, request: updated, emailError });
}
