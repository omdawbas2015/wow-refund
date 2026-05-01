import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/branded-solutions/online-agents
 *
 * Lists every active staff member that is currently flipped to
 * Available — this is what populates the avatar row at the top of
 * the Branded Solutions pool ("who's online right now"). We don't
 * scope by permission here; the visual indicator is informational,
 * not a routing decision.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      isAvailable: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      availableSince: true,
    },
    orderBy: { availableSince: 'asc' },
    take: 25,
  });
  return NextResponse.json({
    agents: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      availableSince: r.availableSince ? r.availableSince.toISOString() : null,
    })),
  });
}
