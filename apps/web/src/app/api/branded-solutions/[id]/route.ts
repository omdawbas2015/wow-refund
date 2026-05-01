import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { broadcast } from '@/lib/events/bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/branded-solutions/[id] — full ticket + history. */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const row = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, isAvailable: true } },
      closedBy: { select: { id: true, name: true } },
      history: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true } } },
      },
    },
  });
  if (!row) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json(row);
}

/**
 * PATCH /api/branded-solutions/[id]
 *
 * Update editable fields (status, mrNumber, location, etc.) and append
 * a status-history entry. Used for inline edits on the detail panel.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const before = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only allow agent-editable fields. Status changes go through the
  // dedicated endpoints (close, send-to-supervisor, clarify-customer)
  // so each transition writes a meaningful history note.
  const data: Parameters<typeof prisma.maintenanceRequest.update>[0]['data'] = {};
  const editable = [
    'cityName',
    'location',
    'machineModel',
    'issueType',
    'customerName',
    'storeName',
    'contactNumber',
    'email',
  ] as const;
  for (const k of editable) {
    if (k in body) {
      const v = body[k];
      if (v === null || (typeof v === 'string')) {
        (data as Record<string, unknown>)[k] = v ?? null;
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No editable fields supplied' }, { status: 400 });
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, name: true, email: true, isAvailable: true } },
    },
  });

  await prisma.maintenanceStatusHistory.create({
    data: {
      requestId: id,
      fromStatus: before.status,
      toStatus: updated.status,
      action: 'EDITED',
      note: `Updated fields: ${Object.keys(data).join(', ')}`,
      actorId: session.user.id,
    },
  });

  broadcast({
    type: 'maintenance.updated',
    data: { id: updated.id, ticketRef: updated.ticketRef, status: updated.status },
  });

  return NextResponse.json(updated);
}
