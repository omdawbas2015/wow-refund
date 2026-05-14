import { notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import { formatDateTime, relativeTime } from '@/lib/format';
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

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6 sm:px-8 sm:py-8">
      {/* Hero header */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-[#0f1629] to-[#1a2744] p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="flex items-center gap-2 font-mono text-2xl font-bold tracking-tight sm:text-3xl">
                {heading}
                <CopyButton
                  value={heading}
                  size="sm"
                  label="Copy case number"
                />
              </h1>
              <CaseStatusBadge status={refundCase.status} />
              {refundCase.isPartial && (
                <span className="rounded-full border border-teal-400/30 bg-teal-400/15 px-2.5 py-0.5 text-[11px] font-medium text-teal-300">
                  Partial
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
              <span className="inline-flex items-center gap-1.5 font-medium text-white/80">
                <span aria-hidden className="text-base leading-none">
                  {refundCase.country.registry.flag ?? '\uD83C\uDF10'}
                </span>
                {refundCase.country.registry.nameEn}
              </span>
              <span aria-hidden className="text-white/20">|</span>
              <span className="font-medium text-white/80">{refundCase.brand.name}</span>
              {refundCase.branch?.name && (
                <>
                  <span aria-hidden className="text-white/20">|</span>
                  <span className="text-white/60">{refundCase.branch.name}</span>
                </>
              )}
              <span aria-hidden className="text-white/20">|</span>
              <span className="tabular-nums text-white/60" title={formatDateTime(refundCase.createdAt)}>
                Created {relativeTime(refundCase.createdAt)}
              </span>
            </div>
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
