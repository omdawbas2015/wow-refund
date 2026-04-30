import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { upsertSettingAction } from '@/app/actions/admin-extras';
import {
  Users,
  ClipboardList,
  Globe,
  Tag,
  Building2,
  CreditCard,
  AlertTriangle,
  Timer,
  ShieldAlert,
  Workflow,
  Mail,
  MessageSquare,
  CalendarRange,
  CalendarClock,
  Activity,
  History,
  CloudUpload,
  ToggleLeft,
  Palette,
  Server,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Admin Settings hub.
 *
 * Acts as the single entry point for everything an admin can configure.
 * The sidebar is intentionally trimmed to daily-use links — every other
 * admin surface is reachable from this page, grouped into six categories
 * so related controls cluster together. The workspace key/value config
 * (SLA thresholds, company info, feature flags) lives in the bottom
 * section so a single page covers "navigate to admin area" + "tweak
 * workspace toggles" without bouncing between routes.
 */

interface SettingLink {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface SettingGroup {
  title: string;
  description: string;
  links: SettingLink[];
}

const GROUPS: SettingGroup[] = [
  {
    title: 'People & Access',
    description: 'Who can sign in, what role they hold, and who is waiting for approval.',
    links: [
      {
        href: '/admin/users',
        label: 'Users',
        description: 'Manage roles, country scope, and account status.',
        icon: Users,
      },
      {
        href: '/admin/pending-approvals',
        label: 'User requests',
        description: 'New signup requests waiting for an admin to assign role + country.',
        icon: ClipboardList,
      },
    ],
  },
  {
    title: 'Geography & Brands',
    description: 'Activate countries, link brands, and manage branches.',
    links: [
      {
        href: '/admin/countries',
        label: 'Countries',
        description: 'Activate countries, set manager email, cutoff time, and brands.',
        icon: Globe,
      },
      {
        href: '/admin/brands',
        label: 'Brands',
        description: 'Brand catalog used by cases, promo, and reports.',
        icon: Tag,
      },
      {
        href: '/admin/branches',
        label: 'Branches',
        description: 'Per-country branches that cases reference.',
        icon: Building2,
      },
    ],
  },
  {
    title: 'Workflow Rules',
    description: 'Catalog values and automation that drive how cases flow.',
    links: [
      {
        href: '/admin/payment-methods',
        label: 'Payment methods',
        description: 'Methods available when an agent records a refund component.',
        icon: CreditCard,
      },
      {
        href: '/admin/root-causes',
        label: 'Root causes',
        description: 'Reasons agents pick when filing a case.',
        icon: AlertTriangle,
      },
      {
        href: '/admin/sla-rules',
        label: 'SLA rules',
        description: 'Warning and breach thresholds per case stage.',
        icon: Timer,
      },
      {
        href: '/admin/fraud-signals',
        label: 'Fraud signals',
        description: 'Heuristics that flag suspicious refund activity.',
        icon: ShieldAlert,
      },
      {
        href: '/admin/automation-rules',
        label: 'Automation rules',
        description: 'Conditional actions triggered on case events.',
        icon: Workflow,
      },
    ],
  },
  {
    title: 'Communication',
    description: 'Email templates and the live log of what was sent.',
    links: [
      {
        href: '/admin/email-templates',
        label: 'Email templates',
        description: 'Edit subject and body for every outbound email.',
        icon: Mail,
      },
      {
        href: '/admin/store-templates',
        label: 'Store templates',
        description: 'Templated messages used by the help-desk store flow.',
        icon: MessageSquare,
      },
      {
        href: '/admin/email-log',
        label: 'Email log',
        description: 'Delivered, failed, and queued outbound messages.',
        icon: Mail,
      },
    ],
  },
  {
    title: 'Schedules & Reports',
    description: 'Recurring jobs and cron status.',
    links: [
      {
        href: '/admin/batch-schedules',
        label: 'Batch schedules',
        description: 'Approval, KNET, and Aura batch run schedules.',
        icon: CalendarRange,
      },
      {
        href: '/admin/scheduled-reports',
        label: 'Scheduled reports',
        description: 'Reports emailed to recipients on a cron schedule.',
        icon: CalendarClock,
      },
      {
        href: '/admin/cron-status',
        label: 'Cron status',
        description: 'Last-run times for every server-side cron.',
        icon: Activity,
      },
    ],
  },
  {
    title: 'System',
    description: 'Audit trail, backups, modules, and system info.',
    links: [
      {
        href: '/admin/audit-log',
        label: 'Audit log',
        description: 'Append-only record of every administrative action.',
        icon: History,
      },
      {
        href: '/admin/backup',
        label: 'Backup',
        description: 'Backup history and one-click run-now.',
        icon: CloudUpload,
      },
      {
        href: '/admin/modules',
        label: 'Modules',
        description: 'Toggle optional modules on or off workspace-wide.',
        icon: ToggleLeft,
      },
      {
        href: '/admin/design-tokens',
        label: 'Design tokens',
        description: 'Live preview of the design system primitives.',
        icon: Palette,
      },
      {
        href: '/admin/system-info',
        label: 'System info',
        description: 'Versions, environment, and build metadata.',
        icon: Server,
      },
    ],
  },
];

const COMMON_SETTINGS: Array<{ key: string; label: string; description: string; type: 'text' | 'number' | 'boolean' }> = [
  { key: 'sla.warning_days', label: 'SLA warning threshold (days)', description: 'Send a warning when an open case reaches this age.', type: 'number' },
  { key: 'sla.breach_days', label: 'SLA breach threshold (days)', description: 'Mark a case as breached after this many days open.', type: 'number' },
  { key: 'duplicate.window_days', label: 'Duplicate detection window (days)', description: 'How far back to look for duplicate orders.', type: 'number' },
  { key: 'company.legal_name', label: 'Company legal name', description: 'Used in customer-facing emails.', type: 'text' },
  { key: 'company.support_email', label: 'Support email', description: 'Reply-to address on outbound customer emails.', type: 'text' },
  { key: 'feature.dark_mode', label: 'Allow dark mode', description: 'Show theme toggle in user profile.', type: 'boolean' },
  { key: 'feature.aura_sidecar', label: 'Aura sidecar', description: 'Enable Aura points return on cases.', type: 'boolean' },
];

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const all = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  const map = new Map(all.map((s) => [s.key, s.value]));

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-8 py-10">
      <div>
        <h1 className="text-display-md font-semibold tracking-tight text-heading">Admin settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Every administrative surface for the workspace. The sidebar keeps only daily-use links; everything else lives here so admin tools stay grouped and out of the way.
        </p>
      </div>

      <div className="space-y-10">
        {GROUPS.map((group) => (
          <section key={group.title} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-heading">{group.title}</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{group.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-start gap-3.5 rounded-xl border border-border/50 bg-surface p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary transition-colors group-hover:bg-primary/12">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{link.label}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {link.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-4 border-t border-border pt-8">
        <div>
          <h2 className="text-heading-md text-heading">Workspace configuration</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Workspace-wide key/value settings. Changes apply immediately to all users.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {COMMON_SETTINGS.map((s) => {
            const current = map.get(s.key) ?? '';
            return (
              <Card key={s.key}>
                <CardHeader>
                  <CardTitle className="text-base">{s.label}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={upsertSettingAction} className="flex items-end gap-3">
                    <input type="hidden" name="key" value={s.key} />
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">
                        Current: <span className="font-mono">{current || '(not set)'}</span>
                      </label>
                      {s.type === 'boolean' ? (
                        <select
                          name="value"
                          defaultValue={current || 'false'}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                        >
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>
                      ) : (
                        <input
                          type={s.type === 'number' ? 'number' : 'text'}
                          name="value"
                          defaultValue={current}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                        />
                      )}
                    </div>
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    >
                      Save
                    </button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All settings</CardTitle>
            <CardDescription>Raw view of every key/value pair stored in the database.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Key</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {all.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground">
                      No settings configured yet.
                    </td>
                  </tr>
                ) : (
                  all.map((s) => (
                    <tr key={s.key}>
                      <td className="p-3 font-mono text-xs">{s.key}</td>
                      <td className="p-3 text-xs">{s.value}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {s.updatedAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
