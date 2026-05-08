import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ProfileForm } from './form';
import {
  MUTABLE_NOTIFICATION_KINDS,
  parseMutedKinds,
} from '@/lib/notifications/dispatch';

/**
 * Self-service profile page. Lets the signed-in user update display fields
 * and language / theme / currency preferences. Email + role + country
 * assignments are admin-only and not surfaced here.
 */
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      nameAr: true,
      phone: true,
      preferredLocale: true,
      preferredCurrency: true,
      preferredTheme: true,
      mutedNotificationKinds: true,
      role: { select: { key: true, name: true } },
      primaryCountryId: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!me) redirect('/login');

  return (
    <div className="space-y-5 px-4 py-4">
      <PageHeader title="Profile" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px]">Personal info</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              initial={{
                name: me.name,
                nameAr: me.nameAr ?? '',
                phone: me.phone ?? '',
                preferredLocale: me.preferredLocale,
                preferredCurrency: me.preferredCurrency ?? '',
                preferredTheme: me.preferredTheme,
                mutedKinds: Array.from(parseMutedKinds(me.mutedNotificationKinds)),
              }}
              mutableKinds={MUTABLE_NOTIFICATION_KINDS}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px]">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Email" value={me.email} />
            <Field label="Role" value={me.role?.name ?? '—'} />
            <Field
              label="Last login"
              value={me.lastLoginAt ? me.lastLoginAt.toLocaleString() : '—'}
            />
            <Field
              label="Member since"
              value={me.createdAt.toLocaleDateString()}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-[12.5px] font-medium text-foreground">{value}</div>
    </div>
  );
}
