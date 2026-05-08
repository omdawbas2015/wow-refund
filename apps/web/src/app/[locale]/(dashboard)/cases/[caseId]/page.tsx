import { notFound } from 'next/navigation';
import { Mail, Phone, ShoppingBag } from 'lucide-react';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { formatDateTime, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
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
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6 lg:px-10">
      {/* Hero — case identity + customer summary, one visual block.
          The case number is the strongest typographic anchor on the
          page; metadata (country/brand/created) sits as a quiet strip
          above it, and the customer panel below is its own well-spaced
          unit so contact info reads cleanly. */}
      <header className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle/60 px-2 py-0.5">
                <span aria-hidden>{refundCase.country.registry.flag ?? '🌐'}</span>
                <span>{refundCase.country.registry.nameEn}</span>
              </span>
              <span aria-hidden>·</span>
              <span className="rounded-full border border-border bg-surface-subtle/60 px-2 py-0.5">
                {refundCase.brand.name}
              </span>
              <span aria-hidden>·</span>
              <span title={formatDateTime(refundCase.createdAt)}>
                Created {relativeTime(refundCase.createdAt)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
                <span className="break-all">{heading}</span>
                <CopyButton value={heading} size="sm" label="Copy case number" />
              </h1>
              <CaseStatusBadge
                status={refundCase.status}
                className="text-sm px-3 py-1"
              />
              {refundCase.isPartial && (
                <span className="inline-flex items-center rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-400">
                  Partial refund
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Customer panel — embedded into the hero so identity stays
            visually grouped with the case header. Avatar grounds the
            customer name; contact chips are scannable + copyable. */}
        <div className="border-t border-border bg-surface-subtle/30 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-3">
              <UserAvatar name={refundCase.customerName} size="md" className="h-12 w-12 text-sm" />
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Customer
                </div>
                <div className="text-base font-semibold text-heading truncate">
                  {refundCase.customerName}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ContactChip
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Email"
                value={refundCase.customerEmail}
                mono
                truncate
              />
              <ContactChip
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Phone"
                value={refundCase.customerPhone}
                mono
                ltr
              />
              <ContactChip
                icon={<ShoppingBag className="h-3.5 w-3.5" />}
                label="Order #"
                value={refundCase.orderNumber}
                mono
              />
            </dl>
          </div>
        </div>
      </header>

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
 * Compact chip-style contact pill used in the customer panel of the
 * case hero. Icon + label sit above the value, value is monospace +
 * copyable on hover/focus. Empty values show as a muted em-dash so
 * the layout never collapses.
 */
function ContactChip({
  icon,
  label,
  value,
  mono,
  ltr,
  truncate,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  mono?: boolean;
  ltr?: boolean;
  truncate?: boolean;
}) {
  const hasValue = !!value && value.length > 0;
  return (
    <div className="group flex min-w-0 items-start gap-2.5 rounded-lg border border-border bg-surface px-3 py-2">
      <span className="mt-0.5 flex-none text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <span
            className={cn(
              'min-w-0 text-sm text-foreground',
              mono && 'font-mono',
              truncate && 'truncate',
            )}
            dir={ltr ? 'ltr' : undefined}
          >
            {hasValue ? value : <span className="text-muted-foreground">—</span>}
          </span>
          {hasValue && (
            <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <CopyButton value={value!} size="xs" label={`Copy ${label.toLowerCase()}`} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
