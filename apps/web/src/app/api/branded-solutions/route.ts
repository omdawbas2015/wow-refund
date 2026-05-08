import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { ingestMaintenanceRequest } from '@/lib/maintenance/intake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/branded-solutions
 *
 * Returns the maintenance pool list for the dashboard. Filterable by
 * status, country, search-text, and assignee. Authenticated users
 * only — RBAC for read is "any logged-in WOW operator", which matches
 * how /notifications is gated.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const country = url.searchParams.get('country');
  const q = (url.searchParams.get('q') ?? '').trim();
  const mine = url.searchParams.get('mine') === '1';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);

  const where: Parameters<typeof prisma.maintenanceRequest.findMany>[0] extends infer A
    ? A extends { where?: infer W } ? NonNullable<W> : never : never = {};

  if (statusParam) {
    const allowed = ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_SUPERVISOR', 'WAITING_FOR_CUSTOMER', 'CLOSED', 'CANCELLED'];
    const list = statusParam.split(',').map((s) => s.trim()).filter((s) => allowed.includes(s));
    if (list.length > 0) {
      where.status = { in: list as ('PENDING' | 'IN_PROGRESS' | 'WAITING_FOR_SUPERVISOR' | 'WAITING_FOR_CUSTOMER' | 'CLOSED' | 'CANCELLED')[] };
    }
  }
  if (country) {
    where.countryName = { equals: country };
  }
  if (mine) {
    where.assignedToId = session.user.id;
  }
  if (q.length > 0) {
    where.OR = [
      { ticketRef: { contains: q } },
      { customerName: { contains: q } },
      { storeName: { contains: q } },
      { submitterName: { contains: q } },
      { email: { contains: q } },
      { contactNumber: { contains: q } },
      { mrNumber: { contains: q } },
    ];
  }

  const [rows, counts] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, isAvailable: true } },
        closedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.maintenanceRequest.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
}

/**
 * POST /api/branded-solutions
 *
 * Manual creation path for admins / testing — same plumbing as the
 * webhook but gated by auth.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const required = ['countryName', 'customerName', 'storeName', 'submitterName', 'contactNumber', 'email', 'machineModel', 'issueType'];
  const missing = required.filter((k) => typeof body[k] !== 'string' || (body[k] as string).trim().length === 0);
  if (missing.length > 0) {
    return NextResponse.json({ error: 'Missing required fields', missing }, { status: 400 });
  }
  const result = await ingestMaintenanceRequest({
    countryName: body['countryName'] as string,
    cityName: (body['cityName'] as string) ?? null,
    customerName: body['customerName'] as string,
    storeName: body['storeName'] as string,
    location: (body['location'] as string) ?? null,
    submitterName: body['submitterName'] as string,
    contactNumber: body['contactNumber'] as string,
    email: body['email'] as string,
    machineModel: body['machineModel'] as string,
    issueType: body['issueType'] as string,
    source: 'MANUAL',
    raw: body,
  });
  return NextResponse.json({ ok: true, ...result });
}
