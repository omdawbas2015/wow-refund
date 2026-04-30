import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';
import { ApprovalRow } from './approval-row';

export default async function PendingApprovalsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [pending, roles, countries] = await Promise.all([
    prisma.user.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.role.findMany({ where: { key: { not: 'ADMIN' } }, orderBy: { name: 'asc' } }),
    prisma.country.findMany({
      where: { isActive: true },
      include: { registry: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  return (
    <div className="px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">User Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review and approve pending access requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {pending.length} pending request{pending.length === 1 ? '' : 's'}
          </CardTitle>
          <CardDescription>
            Approved users will receive an email with a link to set their password.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No pending requests</div>
          ) : (
            <div className="divide-y divide-border">
              {pending.map((user) => (
                <ApprovalRow
                  key={user.id}
                  user={{
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    createdAtLabel: formatDateTime(user.createdAt, 'en-US'),
                  }}
                  roles={roles.map((r) => ({ id: r.id, label: r.name }))}
                  countries={countries.map((c) => ({
                    id: c.id,
                    label: c.registry.nameEn,
                    flag: c.registry.flag,
                  }))}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
