import { notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CaseStatusBadge, ComponentStatusBadge } from '@/components/ui/case-status-badge';
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
  // Refund-Operations workflow (record ARN, complete refund, customer
  // call follow-up). Mirrors EXECUTE_ROLES on the server.
  const canExecute = role === 'ADMIN' || role === 'REFUND_AGENT' || role === 'OPERATIONS';
  const isDeleted = !!refundCase.deletedAt;

  // For @mention picker: list active users
  const mentionableUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, id: { not: session?.user?.id } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 100,
  });

  // We identify cases solely by the agent-typed Case # (the
  // externalCaseNumber field). The auto-generated REF-XX-YYYY-NNNNN
  // is no longer surfaced in the UI — it stays only as an internal id
  // for batch / ARN integrations that still parse it.
  const heading =
    refundCase.externalCaseNumber && refundCase.externalCaseNumber.length > 0
      ? refundCase.externalCaseNumber
      : refundCase.caseNumber;

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      {/* Page header card — case # + status on the left, country / brand
          on the right, customer + order + refund laid out as one
          consistent strip below. Reads as a single information block
          in the same visual language as the rest of the page. */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex items-center gap-1.5 text-display-sm font-semibold tracking-tight text-heading">
                {heading}
                <CopyButton
                  value={heading}
                  size="sm"
                  label="Copy case number"
                />
              </h1>
              <CaseStatusBadge status={refundCase.status} />
              {refundCase.isPartial && (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  Partial
                </span>
              )}
            </div>
            <div className="text-end text-xs text-muted-foreground">
              <div className="text-sm text-body">
                {refundCase.country.registry.flag ?? '🌐'}{' '}
                {refundCase.country.registry.nameEn} · {refundCase.brand.name}
              </div>
              <div className="mt-0.5">
                Created {formatDateTime(refundCase.createdAt)}
              </div>
            </div>
          </div>

          <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <CaseHeaderField label="Customer" value={refundCase.customerName} />
            <CaseHeaderField
              label="Email"
              value={refundCase.customerEmail}
              mono
              truncate
            />
            <CaseHeaderField
              label="Phone"
              value={refundCase.customerPhone ?? null}
              mono
              ltr
            />
            <CaseHeaderField label="Order #" value={refundCase.orderNumber} mono />
          </dl>
        </CardContent>
      </Card>

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

/**
 * Single key/value cell used in the case-header info strip. Renders
 * the label as a small all-caps caption with the value below it, and
 * exposes a copy button on hover/focus so any of the values (email,
 * phone, order number, …) can be copied with one click. Uses the
 * same visual language as the Details / People sections below.
 */
function CaseHeaderField({
  label,
  value,
  mono,
  ltr,
  truncate,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  ltr?: boolean;
  truncate?: boolean;
}) {
  const hasValue = !!value && value.length > 0;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-1.5">
        <span
          className={`min-w-0 text-sm text-foreground${mono ? ' font-mono' : ''}${
            truncate ? ' truncate' : ''
          }`}
          dir={ltr ? 'ltr' : undefined}
        >
          {hasValue ? value : <span className="text-muted-foreground">—</span>}
        </span>
        {hasValue && (
          <CopyButton value={value!} size="sm" label={`Copy ${label.toLowerCase()}`} />
        )}
      </dd>
    </div>
  );
}
