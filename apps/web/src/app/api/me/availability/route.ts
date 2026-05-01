import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { broadcast } from '@/lib/events/bus';
import { pickNextAgent, markAssigned } from '@/lib/maintenance/round-robin';
import { dispatchNotifications } from '@/lib/notifications/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — return the caller's current availability + presence-window. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, isAvailable: true, availableSince: true, lastAutoAssignedAt: true },
  });
  return NextResponse.json(u);
}

/**
 * POST — toggle availability.
 *
 * Body: { isAvailable: boolean }
 *
 * When flipping ON we scoop pending tickets out of the pool — if any
 * are sitting unassigned, the freshly-Available agent grabs the
 * oldest one immediately so the user doesn't wait for the next
 * intake to start working.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  let body: { isAvailable?: unknown };
  try {
    body = (await req.json()) as { isAvailable?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const isAvailable = Boolean(body.isAvailable);

  const now = new Date();
  const before = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAvailable: true, availableSince: true },
  });
  if (!before) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // Close out the previous presence-log row, then open a new one with
  // the resulting state. Doing both atomically would require Prisma's
  // interactive tx — for SQLite the two-step insert is safe enough.
  await prisma.agentPresenceLog.updateMany({
    where: { userId: session.user.id, endedAt: null },
    data: { endedAt: now },
  });
  await prisma.agentPresenceLog.create({
    data: {
      userId: session.user.id,
      state: isAvailable ? 'AVAILABLE' : 'AWAY',
      startedAt: now,
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      isAvailable,
      availableSince: isAvailable ? now : null,
    },
  });

  // When flipping ON, sweep the unassigned pool so the agent picks up
  // backlogged tickets. We hand them at most one ticket here so other
  // newly-Available agents can also grab work — round-robin during
  // intake covers the rest.
  let claimed: { id: string; ticketRef: string } | null = null;
  if (isAvailable && !before.isAvailable) {
    const pending = await prisma.maintenanceRequest.findFirst({
      where: { status: 'PENDING', assignedToId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (pending) {
      // Re-use the round-robin picker so we honor permission gating;
      // if it returns this user we proceed, otherwise we let the
      // chosen user keep the assignment.
      const pick = await pickNextAgent();
      const targetUserId = pick?.userId ?? session.user.id;
      const updated = await prisma.maintenanceRequest.update({
        where: { id: pending.id },
        data: {
          status: 'IN_PROGRESS',
          assignedToId: targetUserId,
          assignedAt: now,
          assignmentReason: pick?.reason ?? `Picked from pool by ${session.user.name} on going Available`,
        },
      });
      await markAssigned(targetUserId, now);
      await prisma.maintenanceStatusHistory.create({
        data: {
          requestId: pending.id,
          fromStatus: 'PENDING',
          toStatus: 'IN_PROGRESS',
          action: 'AUTO_ASSIGNED_FROM_POOL',
          note: 'Pulled from pending pool when agent went Available',
          actorId: targetUserId,
        },
      });
      await dispatchNotifications({
        userIds: [targetUserId],
        type: 'MAINT_REQUEST_ASSIGNED',
        title: `New maintenance request: ${updated.ticketRef}`,
        body: `${updated.customerName} · ${updated.storeName}`,
        href: `/help-desk/branded-solutions/${updated.id}`,
        contextType: 'MAINT',
        contextId: updated.id,
      });
      broadcast({
        type: 'maintenance.updated',
        data: { id: updated.id, ticketRef: updated.ticketRef, status: 'IN_PROGRESS' },
      });
      if (targetUserId === session.user.id) {
        claimed = { id: updated.id, ticketRef: updated.ticketRef };
      }
    }
  }

  // Tell every open viewer that an agent's presence flipped — sidebars
  // / "who's available" badges update without polling.
  broadcast({
    type: 'agent.presence',
    data: {
      userId: session.user.id,
      name: session.user.name,
      isAvailable,
      since: isAvailable ? now.toISOString() : null,
    },
  });

  return NextResponse.json({
    ok: true,
    isAvailable,
    availableSince: isAvailable ? now.toISOString() : null,
    pulledFromPool: claimed,
  });
}
