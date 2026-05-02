import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { auth } from '@/auth';
import { Globe, Tag, CreditCard, AlertTriangle, Mail, Users, Settings, ShieldAlert, Timer, ChevronRight, Wrench, Cog } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

const SECTIONS = [
  { href: '/admin/countries', icon: Globe, title: 'Countries', desc: 'Manager email, cutoff time, sort order' },
  { href: '/admin/brands', icon: Tag, title: 'Brands', desc: 'Brand catalog and per-country mapping' },
  { href: '/admin/payment-methods', icon: CreditCard, title: 'Payment methods', desc: 'KNET, Cash, Apple Pay, …' },
  { href: '/admin/root-causes', icon: AlertTriangle, title: 'Root causes', desc: 'Why refunds happen' },
  { href: '/admin/email-templates', icon: Mail, title: 'Email templates', desc: 'Subjects, bodies, locales' },
  { href: '/admin/users', icon: Users, title: 'Users & roles', desc: 'Manage staff access' },
  { href: '/admin/pending-approvals', icon: Users, title: 'Pending signups', desc: 'Approve or reject new signups' },
  { href: '/admin/settings', icon: Settings, title: 'Settings', desc: 'Feature flags and system settings' },
  { href: '/admin/fraud-signals', icon: ShieldAlert, title: 'Fraud signals', desc: 'Heuristic alerts and detection sweeps' },
  { href: '/admin/sla-rules', icon: Timer, title: 'SLA rules', desc: 'Per-country / brand / cause SLA thresholds' },
  { href: '/admin/maintenance-supervisors', icon: Wrench, title: 'Branded Solutions supervisors', desc: 'Per-country maintenance leads for escalation emails' },
];

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-4">
      <PageHeader
        eyebrow={<><Cog className="me-1 h-3 w-3" /> System</>}
        title="Administration"
        description="Static data, copy, and access control. Changes are audit-logged."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="block">
            <Card className="group transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-card-hover">
              <CardHeader className="flex-row items-center gap-3 space-y-0 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-[13.5px]">{s.title}</CardTitle>
                  <CardDescription className="text-[11.5px] leading-snug">{s.desc}</CardDescription>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
