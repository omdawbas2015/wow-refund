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
 * POST /api/branded-solutions/[id]/send-to-supervisor
 *
 * Body: { note?: string, supervisorEmail?: string }
 *
 * Looks up the country supervisor for `request.countryName`, emails
 * them the location-verification template, and flips the ticket status
 * to WAITING_FOR_SUPERVISOR. The agent can override which supervisor
 * receives the email via `supervisorEmail` when the country mapping
 * has multiple entries.
 */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const agent = await requireAvailableAgent(session.user.id);
  if (!agent) {
    return NextResponse.json(
      { error: 'AGENT_AWAY', message: 'Set yourself Available before contacting the supervisor.' },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  let body: { note?: string; supervisorEmail?: string };
  try {
    body = (await req.json()) as { note?: string; supervisorEmail?: string };
  } catch {
    body = {};
  }

  const before = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // Resolve supervisor: explicit override > country mapping.
  let supervisor: { name: string; email: string } | null = null;
  if (body.supervisorEmail && body.supervisorEmail.includes('@')) {
    supervisor = { name: 'Country Supervisor', email: body.supervisorEmail };
  } else {
    const map = await prisma.maintenanceCountrySupervisor.findFirst({
      where: { countryName: before.countryName, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (map) supervisor = { name: map.name, email: map.email };
  }
  if (!supervisor) {
    return NextResponse.json(
      { error: 'NO_SUPERVISOR', message: `No active supervisor configured for ${before.countryName}. Add one in Admin → Branded Solutions.` },
      { status: 422 },
    );
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: { status: 'WAITING_FOR_SUPERVISOR' },
  });

  await prisma.maintenanceStatusHistory.create({
    data: {
      requestId: id,
      fromStatus: before.status,
      toStatus: 'WAITING_FOR_SUPERVISOR',
      action: 'EMAILED_SUPERVISOR',
      note: `Sent to ${supervisor.name} <${supervisor.email}>${body.note ? ` · ${body.note}` : ''}`,
      actorId: session.user.id,
    },
  });

  let emailError: string | null = null;
  try {
    await dispatchEmail({
      templateKey: 'MAINT_SUPERVISOR_LOCATION_VERIFY',
      locale: 'en',
      to: supervisor.email,
      variables: {
        supervisorName: supervisor.name,
        countryName: before.countryName,
        ticketRef: before.ticketRef,
        storeName: before.storeName,
        location: before.location ?? '—',
        machineModel: before.machineModel,
        issueType: before.issueType,
        customerName: before.customerName,
        contactNumber: before.contactNumber,
        submitterName: before.submitterName,
      },
      context: { type: 'SYSTEM', id },
    });
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'Email failed';
    console.error('[branded-solutions/send-to-supervisor] email failed:', err);
  }

  broadcast({
    type: 'maintenance.updated',
    data: { id: updated.id, ticketRef: updated.ticketRef, status: 'WAITING_FOR_SUPERVISOR' },
  });

  return NextResponse.json({ ok: true, request: updated, supervisor, emailError });
}
