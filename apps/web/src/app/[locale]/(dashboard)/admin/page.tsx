import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { auth } from '@/auth';
import { Globe, Tag, CreditCard, AlertTriangle, Mail, Users, Settings, ShieldAlert, Timer, ChevronRight, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

const SECTIONS = [
  { href: '/admin/countries', icon: Globe, title: 'Countries' },
  { href: '/admin/brands', icon: Tag, title: 'Brands' },
  { href: '/admin/payment-methods', icon: CreditCard, title: 'Payment methods' },
  { href: '/admin/root-causes', icon: AlertTriangle, title: 'Root causes' },
  { href: '/admin/email-templates', icon: Mail, title: 'Email templates' },
  { href: '/admin/users', icon: Users, title: 'Users & roles' },
  { href: '/admin/pending-approvals', icon: Users, title: 'Pending signups' },
  { href: '/admin/settings', icon: Settings, title: 'Settings' },
  { href: '/admin/fraud-signals', icon: ShieldAlert, title: 'Fraud signals' },
  { href: '/admin/sla-rules', icon: Timer, title: 'SLA rules' },
  { href: '/admin/maintenance-supervisors', icon: Wrench, title: 'Branded Solutions supervisors' },
];

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-4">
      <PageHeader title="Administration" />
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="block">
            <Card className="group flex h-14 flex-row items-center gap-3 px-3 transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-card-hover">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent-cream))] text-primary">
                <s.icon className="h-3.5 w-3.5" />
              </div>
              <span className="flex-1 truncate text-[13px] font-semibold text-heading">{s.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
