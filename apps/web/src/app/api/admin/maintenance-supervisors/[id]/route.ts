import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH — update a supervisor mapping. */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const data: Parameters<typeof prisma.maintenanceCountrySupervisor.update>[0]['data'] = {};
  for (const k of ['countryName', 'name', 'email', 'phone', 'notes'] as const) {
    if (k in body && typeof body[k] === 'string') {
      const v = (body[k] as string).trim();
      (data as Record<string, unknown>)[k] = v.length === 0 ? null : v;
    }
  }
  if ('isActive' in body) data.isActive = Boolean(body['isActive']);
  try {
    const row = await prisma.maintenanceCountrySupervisor.update({ where: { id }, data });
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json(
      { error: 'UPDATE_FAILED', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 400 },
    );
  }
}

/** DELETE — remove a supervisor mapping. */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  await prisma.maintenanceCountrySupervisor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
