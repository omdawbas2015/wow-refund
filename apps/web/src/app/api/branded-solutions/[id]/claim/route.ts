import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { broadcast } from '@/lib/events/bus';
import { requireAvailableAgent } from '@/lib/maintenance/agent-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/branded-solutions/[id]/claim
 *
 * Lets an Available agent grab a PENDING ticket out of the pool when
 * round-robin couldn't auto-assign (e.g. nobody was available at
 * intake time, or the previous owner went Away). The action moves
 * status from PENDING → IN_PROGRESS and sets `assignedTo` to the
 * caller.
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const agent = await requireAvailableAgent(session.user.id);
  if (!agent) {
    return NextResponse.json(
      { error: 'AGENT_AWAY', message: 'Set yourself Available to claim tickets.' },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;

  const before = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  if (before.status === 'CLOSED' || before.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'TERMINAL', message: `Ticket already ${before.status}.` },
      { status: 409 },
    );
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      status: before.status === 'PENDING' ? 'IN_PROGRESS' : before.status,
      assignedToId: session.user.id,
      assignedAt: new Date(),
      assignmentReason: `Claimed by ${agent.name}`,
    },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, isAvailable: true } },
    },
  });

  // Mark this user as the most recent to receive an assignment so
  // round-robin skips them on the very next intake.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastAutoAssignedAt: new Date() },
  });

  await prisma.maintenanceStatusHistory.create({
    data: {
      requestId: id,
      fromStatus: before.status,
      toStatus: updated.status,
      action: 'CLAIMED',
      note: `Claimed by ${agent.name}`,
      actorId: session.user.id,
    },
  });

  broadcast({
    type: 'maintenance.updated',
    data: { id: updated.id, ticketRef: updated.ticketRef, status: updated.status },
  });

  return NextResponse.json({ ok: true, request: updated });
}
