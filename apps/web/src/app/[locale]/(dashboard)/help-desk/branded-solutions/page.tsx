import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { BrandedSolutionsClient } from './client';

export const dynamic = 'force-dynamic';

/**
 * Branded Solutions pool — Help Desk page that surfaces external
 * maintenance requests submitted via the Microsoft Form. The server
 * component fetches the initial list (so first paint is fully
 * rendered HTML) and hands off to a client component that subscribes
 * to /api/branded-solutions/stream for live updates.
 */
export default async function BrandedSolutionsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [rows, supervisors, me] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        assignedTo: { select: { id: true, name: true, email: true, isAvailable: true } },
        closedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.maintenanceCountrySupervisor.findMany({
      where: { isActive: true },
      orderBy: [{ countryName: 'asc' }, { name: 'asc' }],
      select: { id: true, countryName: true, name: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, isAvailable: true, availableSince: true },
    }),
  ]);

  return (
    <BrandedSolutionsClient
      initialRows={rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        assignedAt: r.assignedAt ? r.assignedAt.toISOString() : null,
        closedAt: r.closedAt ? r.closedAt.toISOString() : null,
      }))}
      supervisors={supervisors}
      currentUser={
        me
          ? {
              id: me.id,
              name: me.name,
              isAvailable: me.isAvailable,
              availableSince: me.availableSince ? me.availableSince.toISOString() : null,
            }
          : { id: session.user.id, name: session.user.name, isAvailable: false, availableSince: null }
      }
    />
  );
}
