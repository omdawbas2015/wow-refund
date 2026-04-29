import { notFound } from 'next/navigation';
import { Mail, Phone, User as UserIcon } from 'lucide-react';
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
  const canExecute = role === 'ADMIN' || role === 'OPERATIONS';
  const isDeleted = !!refundCase.deletedAt;

  // For @mention picker: list active users
  const mentionableUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, id: { not: session?.user?.id } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 100,
  });

  // Primary heading is the externalCaseNumber the agent typed when
  // creating the case. The auto-generated REF-XX-YYYY-NNNNN sits as a
  // muted sub-id underneath. Cases imported before externalCaseNumber
  // was required fall back to the auto number as the heading.
  const headingRef = refundCase.externalCaseNumber ?? refundCase.caseNumber;
  const showInternalSubId =
    refundCase.externalCaseNumber !== null &&
    refundCase.externalCaseNumber !== refundCase.caseNumber;
  const customerInitial = (refundCase.customerName || '?').charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-1 text-display-sm font-semibold tracking-tight text-heading">
              {headingRef}
              <CopyButton
                value={headingRef}
                size="sm"
                label="Copy case reference"
                className="ms-1"
              />
            </h1>
            <CaseStatusBadge status={refundCase.status} />
            {refundCase.isPartial && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                Partial
              </span>
            )}
          </div>
          {showInternalSubId && (
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <span>{refundCase.caseNumber}</span>
              <CopyButton
                value={refundCase.caseNumber}
                size="sm"
                label="Copy internal case number"
              />
            </p>
          )}
        </div>
        <div className="text-end text-sm text-muted-foreground">
          <div>
            {refundCase.country.registry.flag ?? '🌐'} {refundCase.country.registry.nameEn} ·{' '}
            {refundCase.brand.name}
          </div>
          <div>Created {formatDateTime(refundCase.createdAt)}</div>
        </div>
      </div>

      {/* Customer panel — bordered card with avatar + name + contact rows.
          Replaces the inline "Name · email" line so customer info reads
          as its own information block. */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-base font-semibold text-primary">
            {customerInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{refundCase.customerName}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{refundCase.customerEmail}</span>
              </span>
              {refundCase.customerPhone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  <span dir="ltr">{refundCase.customerPhone}</span>
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4 text-end">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Order
              </div>
              <div className="font-mono text-sm font-medium text-foreground">
                {refundCase.orderNumber}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Refund
              </div>
              <div className="text-sm font-semibold tabular text-foreground">
                {formatMoney(refundCase.totalRefundAmount, refundCase.orderCurrency)}
              </div>
            </div>
          </div>
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
