import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  FileCheck2,
  FileText,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { type SparkPoint } from './kpi-sparkline';
import { RefundVolumeChart } from './refund-volume-chart';

const RECENT_LIMIT = 8;

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

  const trendCreated = bucketByDay(
    casesCreatedRecent.map((r) => ({ date: r.createdAt })),
    days,
  );

  const now = new Date();
  const start = new Date(since);
  const dateRangeFmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const dateRange = `${dateRangeFmt.format(start)} \u2014 ${dateRangeFmt.format(now)}`;

  const stats = [
    {
      label: 'Total Cases',
      value: totalCases,
      delta: deltaPct(casesCreatedRecent.length, casesCreatedPrev),
      icon: FileText,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Pending Approval',
      value: pendingCases,
      delta: deltaPct(casesPendingTrans.length, casesPendingTransPrev),
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Completed',
      value: completedCases,
      delta: deltaPct(casesRefundedTrans.length, casesRefundedTransPrev),
      icon: FileCheck2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Awaiting Payment',
      value: awaitingPaymentCases,
      delta: 0,
      icon: TrendingUp,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  const greeting = `${greetingFor(now)}, ${session?.user.name ?? ''}`.trim();

  return (
    <div className="relative px-6 py-7">
      {/* Hero header */}
      <div className="relative mb-7 overflow-hidden rounded-2xl border border-border/70 bg-surface p-6 shadow-card animate-fade-in-up">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-brand-aurora opacity-80"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand-gradient opacity-[0.10] blur-3xl"
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-ring" />
              Live overview
            </span>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-heading">
              {greeting}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              Here&apos;s what&apos;s happening with your refund operations.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="rounded-full border border-border bg-surface/70 px-3 py-1 font-medium backdrop-blur-sm">
              {dateRange}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, idx) => {
          const positive = stat.delta >= 0;
          const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-surface p-5 shadow-card transition-all duration-300 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong/80 hover:shadow-card-hover animate-fade-in-up"
              style={{ animationDelay: `${idx * 70}ms`, animationFillMode: 'both' }}
            >
              {/* hover wash */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {stat.label}
                </span>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40 ${stat.bg} transition-transform duration-300 group-hover:scale-110`}
                >
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-3 text-[32px] font-semibold tabular tracking-tight text-heading animate-count-up">
                {stat.value.toLocaleString()}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px]">
                <span
                  className={
                    positive
                      ? 'inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700'
                      : 'inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700'
                  }
                >
                  <DeltaIcon className="h-3 w-3" />
                  {Math.abs(stat.delta)}%
                </span>
                <span className="text-muted-foreground">{dateRange}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + Pending */}
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {/* Refund Volume Chart */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-surface p-6 shadow-card transition-all duration-300 hover:border-border-strong/80 hover:shadow-card-hover lg:col-span-3 animate-fade-in-up" style={{ animationDelay: '320ms', animationFillMode: 'both' }}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-heading">Refund Volume</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Daily cases over the last {SPARK_DAYS} days
              </p>
            </div>
            <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {dateRange}
            </span>
          </div>
          <div className="mt-5 h-56 w-full">
            <RefundVolumeChart data={trendCreated} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface p-6 shadow-card transition-all duration-300 hover:border-border-strong/80 hover:shadow-card-hover lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '380ms', animationFillMode: 'both' }}>
          <h2 className="text-[15px] font-semibold tracking-tight text-heading">Pending Tasks</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Items needing your attention</p>
          <div className="mt-5 space-y-2.5">
            <PendingTask
              icon={FileCheck2}
              label="Cases pending approval"
              count={pendingCases}
              href="/cases?status=PENDING_APPROVAL"
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <PendingTask
              icon={UserPlus}
              label="User access requests"
              count={pendingApprovals}
              href="/admin/pending-approvals"
              color="text-rose-600"
              bg="bg-rose-50"
            />
            <PendingTask
              icon={Clock}
              label="Awaiting payment"
              count={awaitingPaymentCases}
              href="/operations"
              color="text-indigo-600"
              bg="bg-indigo-50"
            />
          </div>
        </div>
      </div>

      {/* Recent Cases */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-card animate-fade-in-up" style={{ animationDelay: '440ms', animationFillMode: 'both' }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-heading">Recent Cases</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Latest refund activity</p>
          </div>
          <Link
            href="/cases"
            className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium text-foreground shadow-xs transition-all duration-200 hover:border-primary/40 hover:bg-surface hover:shadow-sm"
          >
            <span>View all</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </div>
        {recentCases.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted-foreground">
            No cases yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-border/40 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2.5 text-left">Case</th>
                  <th className="px-5 py-2.5 text-left">Customer</th>
                  <th className="px-5 py-2.5 text-left">Brand</th>
                  <th className="px-5 py-2.5 text-left">Country</th>
                  <th className="px-5 py-2.5 text-right">Amount</th>
                  <th className="px-5 py-2.5 text-right">Updated</th>
                  <th className="px-5 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-border/30 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        {c.externalCaseNumber || c.caseNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">
                        {c.customerName || '\u2014'}
                      </div>
                      {c.customerEmail ? (
                        <div className="text-xs text-muted-foreground">
                          {c.customerEmail}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {c.brand?.name ?? '\u2014'}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {c.country?.registry?.flag ? `${c.country.registry.flag} ` : ''}{c.country?.registry?.nameEn ?? c.country?.registryCode ?? '\u2014'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular text-foreground">
                      {c.totalRefundAmount.toFixed(2)} {c.orderCurrency}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(c.updatedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Badge
                        variant={statusTone[c.status] ?? 'default'}
                        className="text-[10px] uppercase tracking-wide"
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
      </div>
    </div>
  );
}

function PendingTask({
  icon: Icon,
  label,
  count,
  href,
  color,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  href: string;
  color: string;
  bg: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border/60 bg-surface-subtle/40 p-3 transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:bg-surface hover:shadow-sm"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40 ${bg} transition-transform duration-200 group-hover:scale-110`}
      >
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <span className="flex-1 text-[13px] font-medium text-foreground">
        {label}
      </span>
      <span className="font-mono text-[18px] font-semibold tabular text-heading">
        {count}
      </span>
    </Link>
  );
}
