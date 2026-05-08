import { notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import { formatDateTime, formatMoney, relativeTime } from '@/lib/format';
import { CaseTabs } from './case-tabs';

export const dynamic = 'force-dynamic';

export default async function CaseDetailsPage({
  params,
}: {
  params: Promise<{ locale: string; caseId: string }>;
}) {
  const { locale, caseId } = await params;
  const session = await auth();

  const refundCase = await prisma.refundCase.findUnique({
    where: { id: caseId },
    include: {
      country: { include: { registry: true } },
      brand: true,
      branch: true,
      rootCause: true,
      createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
      approvedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
      components: {
        include: { paymentMethod: true },
        orderBy: { createdAt: 'asc' },
      },
      notes: {
        where: { deletedAt: null },
        include: {
          author: { select: { id: true, name: true } },
          mentions: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!refundCase) {
    notFound();
  }

  const role = session?.user?.role ?? null;
  const canApprove = role === 'ADMIN' || role === 'MANAGER';
  const canExecute = role === 'ADMIN' || role === 'REFUND_AGENT' || role === 'OPERATIONS';
  const isDeleted = !!refundCase.deletedAt;

  const mentionableUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, id: { not: session?.user?.id } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 100,
  });

  const heading =
    refundCase.externalCaseNumber && refundCase.externalCaseNumber.length > 0
      ? refundCase.externalCaseNumber
      : refundCase.caseNumber;

  const pct =
    refundCase.orderAmount > 0
      ? ((refundCase.totalRefundAmount / refundCase.orderAmount) * 100).toFixed(1)
      : '0';
  const isTerminal =
    refundCase.status === 'REFUNDED' || refundCase.status === 'PARTIALLY_REFUNDED';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ── Hero ──
          Single quiet header: case number is the anchor, status pill
          right next to it, metadata strip below in muted micro-text. */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="flex items-center gap-2 text-[28px] font-semibold tracking-tight text-heading sm:text-[32px]">
          {heading}
          <CopyButton value={heading} size="sm" label="Copy case number" />
        </h1>
        <CaseStatusBadge status={refundCase.status} className="text-sm" />
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden>{refundCase.country.registry.flag ?? '🌐'}</span>
          {refundCase.country.registry.nameEn}
        </span>
        <Dot />
        <span>{refundCase.brand.name}</span>
        {refundCase.branch?.name && (
          <>
            <Dot />
            <span>{refundCase.branch.name}</span>
          </>
        )}
        <Dot />
        <span title={formatDateTime(refundCase.createdAt)}>
          Created {relativeTime(refundCase.createdAt)}
        </span>
      </div>

      {/* ── Money strip ──
          Three figures in one bordered card with vertical dividers.
          Refund amount gets a subtle emerald accent when the case
          finished refunding. */}
      <div className="mb-6 grid grid-cols-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          label="Refund amount"
          value={formatMoney(refundCase.totalRefundAmount, refundCase.orderCurrency)}
          accent={isTerminal ? 'emerald' : refundCase.totalRefundAmount > 0 ? 'primary' : undefined}
        />
        <Stat
          label="Order amount"
          value={formatMoney(refundCase.orderAmount, refundCase.orderCurrency)}
          muted
        />
        <Stat
          label="% of order"
          value={`${pct}%`}
          sub={
            Number(pct) >= 100
              ? 'Full refund'
              : Number(pct) > 0
                ? 'Partial'
                : 'No amount yet'
          }
        />
      </div>

      {/* ── Two-column layout ──
          Main column (left, 2fr): tabs (Overview/Notes/Activity).
          Sidebar (right, 1fr): all metadata grouped into clean cards.
          Sidebar sticks on large screens so info stays visible while
          the operator scrolls through notes/activity. */}
      <CaseTabs
        locale={locale}
        caseData={{
          id: refundCase.id,
          caseNumber: refundCase.caseNumber,
          status: refundCase.status,
          customerName: refundCase.customerName,
          customerEmail: refundCase.customerEmail,
          customerPhone: refundCase.customerPhone,
          customerNotes: refundCase.customerNotes,
          orderNumber: refundCase.orderNumber,
          orderDate: refundCase.orderDate.toISOString(),
          orderAmount: refundCase.orderAmount,
          orderCurrency: refundCase.orderCurrency,
          totalRefundAmount: refundCase.totalRefundAmount,
          isPartial: refundCase.isPartial,
          auraPoints: refundCase.auraPoints,
          auraStatus: refundCase.auraStatus,
          rootCause: refundCase.rootCause?.label ?? null,
          rootCauseNotes: refundCase.rootCauseNotes,
          brandName: refundCase.brand.name,
          countryName: refundCase.country.registry.nameEn,
          countryFlag: refundCase.country.registry.flag ?? '',
          branchName: refundCase.branch?.name ?? null,
          createdBy: refundCase.createdBy
            ? {
                id: refundCase.createdBy.id,
                name: refundCase.createdBy.name,
                avatarUrl: refundCase.createdBy.avatarUrl,
              }
            : null,
          assignedTo: refundCase.assignedTo
            ? {
                id: refundCase.assignedTo.id,
                name: refundCase.assignedTo.name,
                avatarUrl: refundCase.assignedTo.avatarUrl,
              }
            : null,
          approvedBy: refundCase.approvedBy
            ? {
                id: refundCase.approvedBy.id,
                name: refundCase.approvedBy.name,
                avatarUrl: refundCase.approvedBy.avatarUrl,
              }
            : null,
          approvedAt: refundCase.approvedAt?.toISOString() ?? null,
          cancelledReason: refundCase.cancelledReason,
          customerCallStatus: refundCase.customerCallStatus,
          customerCallUpdatedAt:
            refundCase.customerCallUpdatedAt?.toISOString() ?? null,
        }}
        components={refundCase.components.map((c) => ({
          id: c.id,
          paymentMethodKey: c.paymentMethod.key,
          paymentMethodLabel: c.paymentMethod.label,
          amount: c.amount,
          currency: c.currency,
          authCode: c.authCode,
          arn: c.arn,
          status: c.status,
        }))}
        notes={refundCase.notes.map((n) => ({
          id: n.id,
          body: n.body,
          authorName: n.author.name,
          authorId: n.author.id,
          createdAt: n.createdAt.toISOString(),
          mentionNames: n.mentions.map((m) => m.user.name),
        }))}
        activity={refundCase.activityLogs.map((a) => ({
          id: a.id,
          kind: a.kind,
          message: a.message,
          actorLabel: a.actorLabel,
          createdAt: a.createdAt.toISOString(),
        }))}
        mentionableUsers={mentionableUsers}
        currentUserId={session?.user?.id ?? ''}
        canApprove={canApprove}
        canExecute={canExecute}
        isDeleted={isDeleted}
      />
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-border">
      ·
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  muted,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'primary';
  muted?: boolean;
}) {
  return (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          'mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-[28px] ' +
          (accent === 'emerald'
            ? 'text-emerald-700 dark:text-emerald-300'
            : accent === 'primary'
              ? 'text-primary'
              : muted
                ? 'text-muted-foreground/80'
                : 'text-heading')
        }
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
