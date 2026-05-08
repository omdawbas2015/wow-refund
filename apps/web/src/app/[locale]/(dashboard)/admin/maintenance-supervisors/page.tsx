import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SupervisorsManager } from './manager';

export const dynamic = 'force-dynamic';

/**
 * Admin page that drives the country → maintenance supervisor mapping
 * used by Branded Solutions when an agent escalates a ticket. Routes
 * are wired to /api/admin/maintenance-supervisors.
 */
export default async function MaintenanceSupervisorsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const rows = await prisma.maintenanceCountrySupervisor.findMany({
    orderBy: [{ countryName: 'asc' }, { name: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-4">
      <PageHeader title="Country supervisors" />

      <Card>
        <CardContent className="py-4">
          <SupervisorsManager
            initialRows={rows.map((r) => ({
              id: r.id,
              countryName: r.countryName,
              name: r.name,
              email: r.email,
              phone: r.phone,
              notes: r.notes,
              isActive: r.isActive,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
