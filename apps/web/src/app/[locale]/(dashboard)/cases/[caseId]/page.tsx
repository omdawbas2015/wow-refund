import { notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import { formatDate, formatDateTime, formatMoney, relativeTime } from '@/lib/format';
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
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      {/* ── Hero ───────────────────────────────────────────────────
          Minimal: case# as the single visual anchor, status next to
          it, one line of metadata, one line of customer info. No
          card, no border — just clean type on white. */}
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          <span>
            {refundCase.country.registry.flag ?? '🌐'}{' '}
            {refundCase.country.registry.nameEn}
          </span>
          <span aria-hidden className="text-border">·</span>
          <span>{refundCase.brand.name}</span>
          <span aria-hidden className="text-border">·</span>
          <span title={formatDateTime(refundCase.createdAt)}>
            {formatDate(refundCase.createdAt)}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
            {heading}
            <CopyButton value={heading} size="sm" label="Copy case number" />
          </h1>
          <CaseStatusBadge status={refundCase.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground">
          <span className="font-medium">{refundCase.customerName}</span>
          <CopyInline value={refundCase.customerEmail} label="email" />
          {refundCase.customerPhone && (
            <CopyInline value={refundCase.customerPhone} label="phone" mono ltr />
          )}
          <CopyInline value={refundCase.orderNumber} label="order #" mono />
        </div>
      </header>

      {/* ── Numbers ────────────────────────────────────────────────
          Three key figures in a single clean row. No cards, no
          borders — just big numbers with tiny labels underneath. */}
      <div className="mb-8 grid grid-cols-3 gap-6">
        <div>
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-heading font-mono sm:text-[28px]">
            {formatMoney(refundCase.totalRefundAmount, refundCase.orderCurrency)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Refund amount</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-muted-foreground/80 font-mono sm:text-[28px]">
            {formatMoney(refundCase.orderAmount, refundCase.orderCurrency)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Order amount</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-heading sm:text-[28px]">
            {pct}%
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {Number(pct) >= 100 ? 'Full refund' : 'of order'}
          </div>
        </div>
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

function CopyInline({
  value,
  label,
  mono,
  ltr,
}: {
  value: string;
  label: string;
  mono?: boolean;
  ltr?: boolean;
}) {
  return (
    <span className="group inline-flex items-center gap-1 text-muted-foreground">
      <span className={mono ? 'font-mono text-[13px]' : ''} dir={ltr ? 'ltr' : undefined}>
        {value}
      </span>
      <span className="opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton value={value} size="xs" label={`Copy ${label}`} />
      </span>
    </span>
  );
}
