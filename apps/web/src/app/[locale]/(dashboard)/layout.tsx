import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { BackLink } from '@/components/layout/back-link';
import { CommandPalette } from '@/components/layout/command-palette';
import { getModuleToggleStatuses } from '@/lib/module-toggles';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { locale } = await params;
  const moduleStatuses = await getModuleToggleStatuses();
  const disabledModules = moduleStatuses.filter((m) => !m.isEnabled).map((m) => m.key);

  // Fetch pending access requests so the sidebar can show a notification
  // badge on the User Access Requests row when there's work waiting. Only
  // admins act on them — for everyone else the count stays zero.
  const pendingAccessRequestCount =
    session.user.role === 'ADMIN'
      ? await prisma.user.count({ where: { status: 'PENDING' } })
      : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        role={session.user.role ?? null}
        disabledModules={disabledModules}
        pendingAccessRequestCount={pendingAccessRequestCount}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          userName={session.user.name ?? ''}
          userEmail={session.user.email ?? ''}
          currentLocale={locale}
        />
        <BackLink />
        <main className="scrollbar-thin flex-1 overflow-y-auto bg-background">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette role={session.user.role ?? null} />
    </div>
  );
}
