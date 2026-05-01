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
 * Body:
 *   {
 *     note?: string,
 *     supervisorEmails?: string[]   // multiple — agent can pick / add
 *     supervisorEmail?: string      // legacy single-email — still supported
 *   }
 *
 * Resolution order:
 *   1. supervisorEmails — if non-empty, use as-is (we look up the
 *      mapped name per email so the salutation reads "Dear A, B, C").
 *      Anything not in the mapping falls back to "Supervisor".
 *   2. supervisorEmail — single legacy override.
 *   3. Country mapping — every active row matching `countryName`.
 *
 * The first email goes in `to`, the rest are CC'd. Status flips to
 * WAITING_FOR_SUPERVISOR.
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
  let body: { note?: string; supervisorEmail?: string; supervisorEmails?: string[] };
  try {
    body = (await req.json()) as { note?: string; supervisorEmail?: string; supervisorEmails?: string[] };
  } catch {
    body = {};
  }

  const before = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  // Resolve recipients into [{name, email}].
  const recipients = await resolveRecipients(before.countryName, body);
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: 'NO_SUPERVISOR', message: `No supervisor configured for ${before.countryName}. Add one in Admin → Branded Solutions.` },
      { status: 422 },
    );
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: { status: 'WAITING_FOR_SUPERVISOR' },
  });

  const recipientLabel = recipients.map((r) => `${r.name} <${r.email}>`).join('; ');
  await prisma.maintenanceStatusHistory.create({
    data: {
      requestId: id,
      fromStatus: before.status,
      toStatus: 'WAITING_FOR_SUPERVISOR',
      action: 'EMAILED_SUPERVISOR',
      note: `Sent to ${recipientLabel}${body.note ? ` · ${body.note}` : ''}`,
      actorId: session.user.id,
    },
  });

  // "Dear A, B, and C" salutation. One first name when there's only
  // one recipient, otherwise comma-list with Oxford-style "and".
  const greetingNames = recipients.map((r) => r.name);
  const greetingNamesText =
    greetingNames.length <= 1
      ? greetingNames[0] ?? 'Supervisor'
      : greetingNames.length === 2
        ? `${greetingNames[0]} and ${greetingNames[1]}`
        : `${greetingNames.slice(0, -1).join(', ')}, and ${greetingNames[greetingNames.length - 1]}`;

  const [primary, ...rest] = recipients;
  const ccList = rest.map((r) => r.email).join(', ');

  let emailError: string | null = null;
  try {
    await dispatchEmail({
      templateKey: 'MAINT_SUPERVISOR_LOCATION_VERIFY',
      locale: 'en',
      to: primary!.email,
      ...(ccList ? { cc: ccList } : {}),
      variables: {
        supervisorGreeting: `Dear ${greetingNamesText}`,
        recipientsLine: recipients.map((r) => r.name).join(', '),
        countryName: before.countryName,
        ticketRef: before.ticketRef,
        storeName: before.storeName,
        location: before.location ?? '—',
        machineModel: before.machineModel,
        issueType: before.issueType,
        customerName: before.customerName,
        contactNumber: before.contactNumber,
        submitterName: before.submitterName,
        cityName: before.cityName ?? '—',
        agentName: agent.name,
        agentNote: body.note?.trim() ? body.note.trim() : '',
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

  return NextResponse.json({ ok: true, request: updated, recipients, emailError });
}

async function resolveRecipients(
  countryName: string,
  body: { supervisorEmails?: string[]; supervisorEmail?: string },
): Promise<{ name: string; email: string }[]> {
  // Build a lookup name-by-email so explicit overrides still get a
  // friendly greeting when they happen to match a configured row.
  const mapped = await prisma.maintenanceCountrySupervisor.findMany({
    where: { isActive: true },
    select: { name: true, email: true, countryName: true },
  });
  const byEmail = new Map<string, string>();
  for (const m of mapped) {
    byEmail.set(m.email.toLowerCase(), m.name);
  }
  const list = (body.supervisorEmails ?? []).filter((e) => typeof e === 'string' && e.includes('@'));
  if (body.supervisorEmail && body.supervisorEmail.includes('@')) {
    list.push(body.supervisorEmail);
  }
  if (list.length > 0) {
    const seen = new Set<string>();
    const out: { name: string; email: string }[] = [];
    for (const raw of list) {
      const email = raw.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      out.push({ email, name: byEmail.get(email) ?? 'Supervisor' });
    }
    return out;
  }
  // Country-mapping fallback — every active supervisor for that country.
  const country = countryName.trim().toLowerCase();
  return mapped
    .filter((m) => m.countryName.trim().toLowerCase() === country)
    .map((m) => ({ name: m.name, email: m.email }));
}
