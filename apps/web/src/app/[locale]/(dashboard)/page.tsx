import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import {
  ArrowDownRight,
  ArrowUpRight,
  ClipboardList,
  Filter,
  Maximize2,
  Search as SearchIcon,
} from 'lucide-react';
import { KpiSparkline, type SparkPoint } from './kpi-sparkline';
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

  const trendCreated = bucketByDay(
    casesCreatedRecent.map((r) => ({ date: r.createdAt })),
    days,
  );
  const trendPending = bucketByDay(
    casesPendingTrans.map((r) => ({ date: r.createdAt })),
    days,
  );
  const trendRefunded = bucketByDay(
    casesRefundedTrans.map((r) => ({ date: r.createdAt })),
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

  const stats: {
    label: string;
    value: number;
    valueDisplay: string;
    delta: number;
    sparkTint: 'primary' | 'warning' | 'success' | 'destructive';
    trend: SparkPoint[];
    surface: string;
  }[] = [
    {
      label: 'Total cases',
      value: totalCases,
      valueDisplay: totalCases.toLocaleString(),
      delta: deltaPct(casesCreatedRecent.length, casesCreatedPrev),
      sparkTint: 'primary',
      trend: trendCreated,
      surface: 'bg-primary/5',
    },
    {
      label: 'Pending approval',
      value: pendingCases,
      valueDisplay: pendingCases.toLocaleString(),
      delta: deltaPct(casesPendingTrans.length, casesPendingTransPrev),
      sparkTint: 'warning',
      trend: trendPending,
      surface: 'bg-amber-500/5',
    },
    {
      label: 'Completed',
      value: completedCases,
      valueDisplay: completedCases.toLocaleString(),
      delta: deltaPct(casesRefundedTrans.length, casesRefundedTransPrev),
      sparkTint: 'success',
      trend: trendRefunded,
      surface: 'bg-emerald-500/5',
    },
  ];

  const greeting = `${greetingFor(now)}, ${session?.user.name ?? ''}`.trim();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{fullDateFmt.format(now)}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const positive = stat.delta >= 0;
          const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;
          return (
            <Card key={stat.label} className={stat.surface}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1">
                <CardTitle className="text-sm font-medium text-body">
                  {stat.label}
                </CardTitle>
                <Maximize2
                  className="h-3.5 w-3.5 text-muted-foreground/60"
                  aria-hidden
                />
              </CardHeader>
              <CardContent className="pt-1">
                <div className="text-display-md font-light tabular leading-tight">
                  {stat.valueDisplay}
                </div>
                <KpiSparkline data={stat.trend} tint={stat.sparkTint} unitLabel="cases" />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{dateRange}</span>
                  <span
                    className={
                      positive
                        ? 'inline-flex items-center gap-0.5 font-medium text-emerald-600 dark:text-emerald-400'
                        : 'inline-flex items-center gap-0.5 font-medium text-rose-600 dark:text-rose-400'
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

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Refund volume</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Daily case volume across all brands and countries.
              </p>
            </div>
            <span className="rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs font-medium text-muted-foreground">
              Last {SPARK_DAYS} days
            </span>
          </CardHeader>
          <CardContent>
            <div className="mt-1 flex items-baseline gap-3">
              <div className="text-2xl font-semibold tabular">
                {casesCreatedRecent.length.toLocaleString()}
              </div>
              <span className="text-xs text-muted-foreground">cases · {dateRange}</span>
            </div>
            <div className="mt-3 h-56 w-full">
              <RefundVolumeChart data={trendCreated} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Pending tasks</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Things waiting on you across the workspace.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <PendingTask
                label="Cases pending approval"
                count={pendingCases}
                href="/cases?status=PENDING_APPROVAL"
                tone="amber"
              />
              <PendingTask
                label="User access requests"
                count={pendingApprovals}
                href="/admin/pending-approvals"
                tone="rose"
              />
              <PendingTask
                label="Cases awaiting payment"
                count={
                  // Render an at-a-glance "0" if we don't have a count yet —
                  // it's still useful to show the row so the operator knows
                  // where to look.
                  0
                }
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              Latest activity across all countries.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/cases"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 text-xs font-medium text-body transition-colors hover:bg-surface hover:text-foreground"
            >
              <SearchIcon className="h-3.5 w-3.5" /> Search
            </Link>
            <Link
              href="/cases"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 text-xs font-medium text-body transition-colors hover:bg-surface hover:text-foreground"
            >
              <Filter className="h-3.5 w-3.5" /> Filter
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
                  <tr className="border-y border-border bg-surface-subtle text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-6 py-2.5 text-start">Case</th>
                    <th className="px-6 py-2.5 text-start">Customer</th>
                    <th className="px-6 py-2.5 text-start">Brand</th>
                    <th className="px-6 py-2.5 text-start">Country</th>
                    <th className="px-6 py-2.5 text-end">Refund</th>
                    <th className="px-6 py-2.5 text-end">Updated</th>
                    <th className="px-6 py-2.5 text-end">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface-subtle/40"
                    >
                      <td className="px-6 py-3 align-middle">
                        <Link
                          href={`/cases/${c.id}`}
                          className="font-medium tracking-tight text-foreground hover:underline"
                        >
                          {c.caseNumber}
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
  label,
  count,
  href,
  tone,
}: {
  label: string;
  count: number;
  href: string;
  tone: 'primary' | 'amber' | 'rose';
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : tone === 'rose'
        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
        : 'bg-primary/10 text-primary';
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-surface-subtle"
      >
        <span className="flex items-center gap-2.5">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-md ${toneClass}`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </span>
        <span className="font-mono text-sm font-semibold tabular text-foreground">
          {count}
        </span>
      </Link>
    </li>
  );
}
