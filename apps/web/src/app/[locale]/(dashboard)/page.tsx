import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
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
      label: 'Total cases',
      value: totalCases,
      delta: deltaPct(casesCreatedRecent.length, casesCreatedPrev),
      icon: FileText,
    },
    {
      label: 'Pending approval',
      value: pendingCases,
      delta: deltaPct(casesPendingTrans.length, casesPendingTransPrev),
      icon: Clock,
    },
    {
      label: 'Completed',
      value: completedCases,
      delta: deltaPct(casesRefundedTrans.length, casesRefundedTransPrev),
      icon: FileCheck2,
    },
    {
      label: 'Awaiting payment',
      value: awaitingPaymentCases,
      delta: 0,
      icon: TrendingUp,
    },
  ];

  const greeting = `${greetingFor(now)}, ${session?.user.name ?? ''}`.trim();

  const heroStat = stats[0]!;
  const sideStats = stats.slice(1);
  const heroPositive = heroStat.delta >= 0;
  const HeroDeltaIcon = heroPositive ? ArrowUpRight : ArrowDownRight;

  const taskTones = ['mint', 'lavender', 'peach'] as const;

  return (
    <div className="px-6 py-8">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-display-md text-heading">{greeting}</h1>
          <p className="mt-1 text-[13px] text-body">
            Here&apos;s what&apos;s happening with your refund operations.
          </p>
        </div>
        <div className="text-[12px] text-muted-foreground">
          <span className="text-caption uppercase tracking-wider">Period</span>
          <span className="ml-2 font-medium text-foreground">{dateRange}</span>
        </div>
      </div>

      {/* KPI row — yellow hero card + soft white side cards. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="surface-butter rounded-3xl p-6">
          <div className="flex items-center gap-2.5 text-[13px] font-medium text-primary-foreground/80">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/30">
              <heroStat.icon className="h-5 w-5" />
            </span>
            <span>{heroStat.label}</span>
          </div>
          <div className="mt-5 text-[40px] font-semibold tabular leading-none text-primary-foreground">
            {heroStat.value.toLocaleString()}
          </div>
          {heroStat.delta !== 0 && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-pill bg-white/30 px-2.5 py-1 text-[12px] font-medium text-primary-foreground">
              <HeroDeltaIcon className="h-3.5 w-3.5" />
              {Math.abs(heroStat.delta)}% vs previous {SPARK_DAYS}d
            </div>
          )}
        </div>

        {sideStats.map((stat, idx) => {
          const positive = stat.delta >= 0;
          const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;
          const Icon = stat.icon;
          const tone = (['mint', 'lavender', 'sky'] as const)[idx % 3];
          return (
            <div
              key={stat.label}
              className="rounded-3xl border border-border bg-surface p-6"
            >
              <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl',
                    `chip-${tone}`,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>{stat.label}</span>
              </div>
              <div className="mt-5 text-[36px] font-semibold tabular leading-none text-heading">
                {stat.value.toLocaleString()}
              </div>
              {stat.delta !== 0 && (
                <div className="mt-3 flex items-center gap-1 text-[12px]">
                  <span
                    className={
                      positive
                        ? 'inline-flex items-center gap-0.5 text-emerald-700'
                        : 'inline-flex items-center gap-0.5 text-rose-700'
                    }
                  >
                    <DeltaIcon className="h-3 w-3" />
                    {Math.abs(stat.delta)}%
                  </span>
                  <span className="text-muted-foreground">vs previous {SPARK_DAYS}d</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart + Pending */}
      <div className="mt-6 grid gap-5 lg:grid-cols-5">
        <div className="rounded-3xl border border-border bg-surface lg:col-span-3">
          <div className="flex items-center justify-between px-6 pt-5 pb-2">
            <div>
              <h2 className="text-heading-lg text-heading">Refund volume</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Daily cases over the last {SPARK_DAYS} days
              </p>
            </div>
          </div>
          <div className="h-64 w-full px-4 pb-5">
            <RefundVolumeChart data={trendCreated} />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface lg:col-span-2">
          <div className="px-6 pt-5">
            <h2 className="text-heading-lg text-heading">Pending tasks</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Items needing your attention</p>
          </div>
          <ul className="px-3 py-3 space-y-1">
            <PendingTask
              icon={FileCheck2}
              tone={taskTones[0]}
              label="Cases pending approval"
              count={pendingCases}
              href="/cases?status=PENDING_APPROVAL"
            />
            <PendingTask
              icon={UserPlus}
              tone={taskTones[1]}
              label="User access requests"
              count={pendingApprovals}
              href="/admin/pending-approvals"
            />
            <PendingTask
              icon={Clock}
              tone={taskTones[2]}
              label="Awaiting payment"
              count={awaitingPaymentCases}
              href="/operations"
            />
          </ul>
        </div>
      </div>

      {/* Recent Cases */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-heading-md text-heading">Recent cases</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Latest refund activity</p>
          </div>
          <Link
            href="/cases"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            <span>View all</span>
            <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
          </Link>
        </div>
        {recentCases.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted-foreground">
            No cases yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-surface-subtle">
                <tr className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2 text-left font-medium">Case</th>
                  <th className="px-5 py-2 text-left font-medium">Customer</th>
                  <th className="px-5 py-2 text-left font-medium">Brand</th>
                  <th className="px-5 py-2 text-left font-medium">Country</th>
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                  <th className="px-5 py-2 text-right font-medium">Updated</th>
                  <th className="px-5 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentCases.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-surface-subtle">
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {c.externalCaseNumber || c.caseNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="text-foreground">{c.customerName || '\u2014'}</div>
                      {c.customerEmail ? (
                        <div className="text-[11.5px] text-muted-foreground">
                          {c.customerEmail}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">
                      {c.brand?.name ?? '\u2014'}
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">
                      {c.country?.registry?.flag ? `${c.country.registry.flag} ` : ''}{c.country?.registry?.nameEn ?? c.country?.registryCode ?? '\u2014'}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular text-foreground">
                      {c.totalRefundAmount.toFixed(2)} {c.orderCurrency}
                    </td>
                    <td className="px-5 py-2.5 text-right text-[11.5px] text-muted-foreground">
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(c.updatedAt)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Badge variant={statusTone[c.status] ?? 'default'}>
                        {c.status.replace(/_/g, ' ').toLowerCase()}
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
  tone,
  label,
  count,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'mint' | 'lavender' | 'peach' | 'sky' | 'rose' | 'butter';
  label: string;
  count: number;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-2xl px-3 py-3 text-[14px] transition-colors hover:bg-surface-subtle"
      >
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-2xl',
            `chip-${tone}`,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="flex-1 text-foreground">{label}</span>
        <span className="tabular text-[16px] font-semibold text-heading">{count}</span>
      </Link>
    </li>
  );
}
