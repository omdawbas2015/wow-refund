import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — list all supervisor mappings (admin / maintenance.admin). */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const rows = await prisma.maintenanceCountrySupervisor.findMany({
    orderBy: [{ countryName: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ rows });
}

/** POST — create a supervisor mapping. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const required = ['countryName', 'name', 'email'];
  const missing = required.filter((k) => typeof body[k] !== 'string' || (body[k] as string).trim().length === 0);
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing fields', missing }, { status: 400 });
  }
  try {
    const row = await prisma.maintenanceCountrySupervisor.create({
      data: {
        countryName: (body['countryName'] as string).trim(),
        name: (body['name'] as string).trim(),
        email: (body['email'] as string).trim(),
        phone: typeof body['phone'] === 'string' ? (body['phone'] as string).trim() : null,
        notes: typeof body['notes'] === 'string' ? (body['notes'] as string).trim() : null,
        isActive: body['isActive'] !== false,
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'CREATE_FAILED', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 400 },
    );
  }
}
