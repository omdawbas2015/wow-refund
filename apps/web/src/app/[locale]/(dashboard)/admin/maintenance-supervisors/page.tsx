import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Wrench } from 'lucide-react';
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
      <PageHeader
        eyebrow={<><Wrench className="me-1 h-3 w-3" /> Admin · Branded Solutions</>}
        title="Country supervisors"
        description="Maps a country to the maintenance lead who receives location-verification emails when an agent escalates a Branded Solutions ticket. Supervisors are matched against the form’s Country field — case-insensitive, exact match."
      />

      <Card>
        <CardHeader>
          <CardTitle>Supervisor directory</CardTitle>
          <CardDescription>
            Add multiple entries per country if you want fallbacks; the first active row
            (alphabetical by name) is used as the default in the agent&apos;s drawer.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
