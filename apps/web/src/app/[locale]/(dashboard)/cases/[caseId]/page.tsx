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

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">
      {/* ── Title row ──
          Linear/Stripe style: case# + status badge + minor metadata
          all on one compact line. No oversized typography. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-mono text-[18px] font-semibold tracking-tight text-heading">
          {heading}
        </h1>
        <CopyButton value={heading} size="xs" label="Copy case number" />
        <CaseStatusBadge status={refundCase.status} />
        <div className="ml-auto inline-flex items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
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
            {relativeTime(refundCase.createdAt)}
          </span>
        </div>
      </div>

      {/* ── Metric strip ──
          Inline metric ribbon: bordered band with three figures
          divided by vertical rules. Compact (no extra card chrome). */}
      <div className="mb-5 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-lg border border-border bg-surface text-[13px]">
        <Metric
          label="Refund amount"
          value={formatMoney(refundCase.totalRefundAmount, refundCase.orderCurrency)}
          accent={
            refundCase.status === 'REFUNDED' || refundCase.status === 'PARTIALLY_REFUNDED'
              ? 'emerald'
              : refundCase.totalRefundAmount > 0
                ? 'primary'
                : undefined
          }
        />
        <Metric
          label="Order amount"
          value={formatMoney(refundCase.orderAmount, refundCase.orderCurrency)}
          muted
        />
        <Metric
          label="% of order"
          value={`${pct}%`}
          hint={
            Number(pct) >= 100
              ? 'Full refund'
              : Number(pct) > 0
                ? 'Partial'
                : 'No amount'
          }
        />
      </div>

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

function Metric({
  label,
  value,
  hint,
  accent,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'emerald' | 'primary';
  muted?: boolean;
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={
          'mt-0.5 font-mono text-[18px] font-semibold tabular-nums tracking-tight ' +
          (accent === 'emerald'
            ? 'text-emerald-700 dark:text-emerald-300'
            : accent === 'primary'
              ? 'text-primary'
              : muted
                ? 'text-muted-foreground/70'
                : 'text-heading')
        }
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
