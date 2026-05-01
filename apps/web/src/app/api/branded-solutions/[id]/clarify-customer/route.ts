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
 * POST /api/branded-solutions/[id]/clarify-customer
 *
 * Body: { questions: string }
 *
 * Emails the original customer asking for clarification (`questions`
 * is a free-text bullet list filled by the agent), then flips the
 * ticket to WAITING_FOR_CUSTOMER. When the customer's reply arrives
 * via the inbound webhook the ticket is bumped back to IN_PROGRESS.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const agent = await requireAvailableAgent(session.user.id);
  if (!agent) {
    return NextResponse.json(
      { error: 'AGENT_AWAY', message: 'Set yourself Available before contacting the customer.' },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  let body: { questions?: string };
  try {
    body = (await req.json()) as { questions?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const questions = (body.questions ?? '').trim();
  if (questions.length === 0) {
    return NextResponse.json({ error: 'questions text is required' }, { status: 400 });
  }

  const before = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: { status: 'WAITING_FOR_CUSTOMER' },
  });

  await prisma.maintenanceStatusHistory.create({
    data: {
      requestId: id,
      fromStatus: before.status,
      toStatus: 'WAITING_FOR_CUSTOMER',
      action: 'EMAILED_CUSTOMER_FOR_CLARIFICATION',
      note: questions.length > 280 ? `${questions.slice(0, 280)}…` : questions,
      actorId: session.user.id,
    },
  });

  let emailError: string | null = null;
  try {
    await dispatchEmail({
      templateKey: 'MAINT_CUSTOMER_CLARIFY',
      locale: 'en',
      to: before.email,
      variables: {
        customerName: before.customerName,
        machineModel: before.machineModel,
        storeName: before.storeName,
        questions,
      },
      context: { type: 'SYSTEM', id },
    });
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Email failed';
    console.error('[branded-solutions/clarify-customer] email failed:', err);
  }

  broadcast({
    type: 'maintenance.updated',
    data: { id: updated.id, ticketRef: updated.ticketRef, status: 'WAITING_FOR_CUSTOMER' },
  });

  return NextResponse.json({ ok: true, request: updated, emailError });
}
