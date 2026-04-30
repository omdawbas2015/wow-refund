import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  FileCheck2,
  Filter,
  Maximize2,
  Search as SearchIcon,
  UserPlus,
} from 'lucide-react';
import { type SparkPoint } from './kpi-sparkline';
import { RefundVolumeChart } from './refund-volume-chart';

const RECENT_LIMIT = 6;

const statusTone: Record<
  string,
  'success' | 'warning' | 'destructive' | 'default' | 'secondary'
> = {
  REFUNDED: 'success',
  PARTIALLY_REFUNDED: 'success',
  COMPLETED: 'success',
  APPROVED: 'success',
  PENDING_APPROVAL: 'warning',
  IN_REVIEW: 'warning',
  AWAITING_PAYMENT: 'warning',
  PROCESSING: 'warning',
  REJECTED: 'destructive',
  CANCELLED: 'destructive',
  DRAFT: 'secondary',
};

const SPARK_DAYS = 14;

function lastNDays(n: number, anchor: Date = new Date()): string[] {
  const days: string[] = [];
  const d = new Date(anchor);
  d.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getTime() - i * 86400_000);
    days.push(dd.toISOString().slice(0, 10));
  }
  return days;
}

function bucketByDay(rows: { date: Date }[], days: string[]): SparkPoint[] {
  const map = new Map<string, number>(days.map((d) => [d, 0]));
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return days.map((d) => ({ date: d.slice(5), value: map.get(d) ?? 0 }));
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardHome() {
  const session = await auth();

  const days = lastNDays(SPARK_DAYS);
  const since = new Date(`${days[0]!}T00:00:00.000Z`);
  const prevSince = new Date(since.getTime() - SPARK_DAYS * 86400_000);

  // Gather everything we need in one round-trip. Counts cover the
  // *current* and *previous* SPARK_DAYS windows so we can show a
  // period-over-period delta on each KPI card (matches the Elegance
  // reference's "▲ 25%" / "▼ 1.2%" deltas).
  const [
    totalCases,
    pendingCases,
    completedCases,
    awaitingPaymentCases,
    pendingApprovals,
    casesCreatedRecent,
    casesCreatedPrev,
    casesPendingTrans,
    casesPendingTransPrev,
    casesRefundedTrans,
    casesRefundedTransPrev,
  ] = await Promise.all([
    prisma.refundCase.count({ where: { deletedAt: null } }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'REFUNDED' } }),
    // "Awaiting payment" → cases approved by an admin but not yet executed
    // (still in APPROVED or IN_EXECUTION). These are the rows the Refund
    // Pool needs to pay out next.
    prisma.refundCase.count({
      where: { deletedAt: null, status: { in: ['APPROVED', 'IN_EXECUTION'] } },
    }),
    prisma.user.count({ where: { status: 'PENDING' } }),
    prisma.refundCase.findMany({
      where: { deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.refundCase.count({
      where: { deletedAt: null, createdAt: { gte: prevSince, lt: since } },
    }),
    prisma.auditLog.findMany({
      where: { action: 'case.pending_approval', createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.auditLog.count({
      where: {
        action: 'case.pending_approval',
        createdAt: { gte: prevSince, lt: since },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: 'case.refunded', createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.auditLog.count({
      where: { action: 'case.refunded', createdAt: { gte: prevSince, lt: since } },
    }),
  ]);

  const recentCases = await prisma.refundCase.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: RECENT_LIMIT,
    select: {
      id: true,
      caseNumber: true,
      externalCaseNumber: true,
      status: true,
      totalRefundAmount: true,
      orderCurrency: true,
      updatedAt: true,
      customerName: true,
      customerEmail: true,
      brand: { select: { name: true } },
      country: { select: { registryCode: true, registry: { select: { nameEn: true, flag: true } } } },
    },
  });

  // Daily trend feeds the big Refund Volume area chart. KPI cards
  // intentionally don't carry sparklines so they read like the
  // reference (clean number + delta + date range).
  const trendCreated = bucketByDay(
    casesCreatedRecent.map((r) => ({ date: r.createdAt })),
    days,
  );

  // Date formatting — short range label + full long date for the
  // greeting line.
  const now = new Date();
  const start = new Date(since);
  const dateRangeFmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const fullDateFmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateRange = `${dateRangeFmt.format(start)} \u2014 ${dateRangeFmt.format(now)}, ${now.getFullYear()}`;

  // KPI cards mirror the reference: a soft pastel surface, a faint
  // off-card radial 'glow' that hints at brand color, no sparkline
  // inside the card. The sparkline lives only inside the big Refund
  // Volume card below.
  const stats: {
    label: string;
    valueDisplay: string;
    delta: number;
    surface: string;
    glow: string;
  }[] = [
    {
      label: 'Total cases',
      valueDisplay: totalCases.toLocaleString(),
      delta: deltaPct(casesCreatedRecent.length, casesCreatedPrev),
      surface: 'bg-[hsl(248,92%,97%)] dark:bg-primary/8',
      glow: 'before:bg-[radial-gradient(circle_at_0%_0%,rgba(99,91,255,0.22),transparent_55%)]',
    },
    {
      label: 'Pending approval',
      valueDisplay: pendingCases.toLocaleString(),
      delta: deltaPct(casesPendingTrans.length, casesPendingTransPrev),
      surface: 'bg-[hsl(28,100%,97%)] dark:bg-amber-500/8',
      glow: 'before:bg-[radial-gradient(circle_at_100%_0%,rgba(251,146,60,0.25),transparent_55%)]',
    },
    {
      label: 'Completed',
      valueDisplay: completedCases.toLocaleString(),
      delta: deltaPct(casesRefundedTrans.length, casesRefundedTransPrev),
      surface: 'bg-surface',
      glow: '',
    },
  ];

  const greeting = `${greetingFor(now)}, ${session?.user.name ?? ''}`.trim();

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-display-lg font-semibold tracking-tight text-heading">
          {greeting}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{fullDateFmt.format(now)}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, idx) => {
          const positive = stat.delta >= 0;
          const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;
          return (
            <Card
              key={stat.label}
              className={`relative isolate overflow-hidden border-0 ${stat.surface} before:pointer-events-none before:absolute before:inset-0 before:-z-10 ${stat.glow} animate-fade-in-up`}
              style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-[13px] font-medium text-body">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-[38px] font-bold tabular leading-none tracking-tight text-foreground animate-count-up">
                  {stat.valueDisplay}
                </div>
                <div className="mt-5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/80">{dateRange}</span>
                  <span
                    className={
                      positive
                        ? 'inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-600'
                        : 'inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600'
                    }
                  >
                    <DeltaIcon className="h-3.5 w-3.5" />
                    {Math.abs(stat.delta)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Refund volume</CardTitle>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Daily case volume across all brands and countries.
              </p>
            </div>
            <span className="rounded-lg border border-border/60 bg-surface-subtle px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Last {SPARK_DAYS} days
            </span>
          </CardHeader>
          <CardContent>
            <div className="mt-2 flex items-baseline gap-3">
              <div className="text-3xl font-bold tabular tracking-tight">
                {casesCreatedRecent.length.toLocaleString()}
              </div>
              <span className="text-xs text-muted-foreground">cases · {dateRange}</span>
            </div>
            <div className="mt-4 h-60 w-full">
              <RefundVolumeChart data={trendCreated} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pending tasks</CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Things waiting on you across the workspace.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <PendingTask
                icon={FileCheck2}
                label="Cases pending approval"
                description="Awaiting an admin sign-off"
                count={pendingCases}
                href="/cases?status=PENDING_APPROVAL"
                tone="amber"
              />
              <PendingTask
                icon={UserPlus}
                label="User access requests"
                description="New sign-ups waiting for access"
                count={pendingApprovals}
                href="/admin/pending-approvals"
                tone="rose"
              />
              <PendingTask
                icon={Clock}
                label="Cases awaiting payment"
                description="Approved, queued for the next batch"
                count={awaitingPaymentCases}
                href="/operations"
                tone="primary"
              />
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Recent cases</CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Latest activity across all countries.
            </p>
          </div>
          {/* Search + Filter mirror the reference. The input is
              read-only and links to /cases when clicked, where the
              real search lives. The filter button is a static
              affordance (links to the same place). */}
          <div className="flex items-center gap-2">
            <Link
              href="/cases"
              className="flex h-9 w-56 items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <SearchIcon className="h-3.5 w-3.5" />
              <span className="flex-1">Search cases</span>
            </Link>
            <Link
              href="/cases"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-3 text-sm font-medium text-body transition-colors hover:bg-surface hover:text-foreground"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filter</span>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentCases.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No cases yet. Create your first case from Refund Cases.
            </p>
          ) : (
            <div className="-mx-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    <th className="px-6 py-3 text-start">Case</th>
                    <th className="px-6 py-3 text-start">Customer</th>
                    <th className="px-6 py-3 text-start">Brand</th>
                    <th className="px-6 py-3 text-start">Country</th>
                    <th className="px-6 py-3 text-end">Refund</th>
                    <th className="px-6 py-3 text-end">Updated</th>
                    <th className="px-6 py-3 text-end">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border/40 last:border-b-0 transition-colors hover:bg-surface-subtle/50"
                    >
                      <td className="px-6 py-3 align-middle">
                        <Link
                          href={`/cases/${c.id}`}
                          className="font-medium tracking-tight text-foreground hover:underline"
                        >
                          {c.externalCaseNumber || c.caseNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-3 align-middle">
                        <div className="font-medium text-foreground">
                          {c.customerName || '—'}
                        </div>
                        {c.customerEmail ? (
                          <div className="text-xs text-muted-foreground">
                            {c.customerEmail}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-3 align-middle text-muted-foreground">
                        {c.brand?.name ?? '—'}
                      </td>
                      <td className="px-6 py-3 align-middle text-muted-foreground">
                        {c.country?.registry?.flag ? `${c.country.registry.flag} ` : ''}{c.country?.registry?.nameEn ?? c.country?.registryCode ?? '—'}
                      </td>

                      <td className="px-6 py-3 text-end font-mono tabular">
                        {c.totalRefundAmount.toFixed(2)} {c.orderCurrency}
                      </td>
                      <td className="px-6 py-3 text-end text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(c.updatedAt)}
                      </td>
                      <td className="px-6 py-3 text-end">
                        <Badge
                          variant={statusTone[c.status] ?? 'default'}
                          className="font-mono text-[10px] uppercase tracking-wide"
                        >
                          {c.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingTask({
  icon: Icon,
  label,
  description,
  count,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  count: number;
  href: string;
  tone: 'primary' | 'amber' | 'rose';
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-600'
      : tone === 'rose'
        ? 'bg-rose-50 text-rose-600'
        : 'bg-primary/8 text-primary';
  return (
    <li>
      <Link
        href={href}
        className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-surface px-4 py-3 transition-all duration-200 hover:border-primary/30 hover:shadow-xs"
      >
        <span className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-medium leading-tight text-foreground">
              {label}
            </span>
            <span className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              {description}
            </span>
          </span>
        </span>
        <span className="font-mono text-base font-semibold tabular text-foreground">
          {count}
        </span>
      </Link>
    </li>
  );
}
