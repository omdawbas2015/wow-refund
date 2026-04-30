import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApprovalBatchesPanel } from './approval-batches-panel';
import { KnetBatchesPanel } from './knet-batches-panel';
import { AuraBatchesPanel } from './aura-batches-panel';
import { RefundPoolPanel, type PoolCase } from './refund-pool-panel';

function formatRelative(d: Date | null | undefined): string | null {
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// REFUND_AGENT is the seeded role key for refund execution; OPERATIONS
// stays accepted as a legacy alias.
const OPS_ROLES = new Set(['ADMIN', 'MANAGER', 'REFUND_AGENT', 'OPERATIONS']);

export const dynamic = 'force-dynamic';

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!OPS_ROLES.has(session.user.role ?? '')) redirect('/');

  const sp = await searchParams;
  const tabParam = typeof sp['tab'] === 'string' ? sp['tab'] : 'pool';
  const activeTab =
    tabParam === 'approvals' || tabParam === 'knet' || tabParam === 'aura' ? tabParam : 'pool';
  const isPoolTab = activeTab === 'pool';

  // Resolve KNET payment method id once so the "pending KNET components"
  // query can use the same criteria as createKnetBatchAction.
  const knetMethod = await prisma.paymentMethod.findFirst({
    where: { key: 'KNET', isActive: true },
    select: { id: true },
  });

  const [
    countries,
    pendingByCountry,
    liveApprovalBatches,
    pendingKnetComponents,
    liveKnetBatches,
    pendingAuraCases,
    liveAuraBatches,
  ] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      include: { registry: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.refundCase.groupBy({
      by: ['countryId'],
      where: {
        status: 'PENDING_APPROVAL',
        deletedAt: null,
        OR: [
          { approvalBatchId: null },
          {
            approvalBatch: {
              status: { notIn: ['DRAFT', 'SENT', 'AWAITING_RESPONSE', 'PARTIALLY_DECIDED'] },
            },
          },
        ],
      },
      _count: { _all: true },
      _sum: { totalRefundAmount: true },
    }),
    prisma.approvalBatch.findMany({
      where: {
        status: { in: ['SENT', 'AWAITING_RESPONSE', 'PARTIALLY_DECIDED'] },
      },
      include: {
        country: { include: { registry: true } },
        cases: {
          select: {
            id: true,
            caseNumber: true,
            customerName: true,
            status: true,
            totalRefundAmount: true,
            orderCurrency: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: 25,
    }),
    // Components ready to be sent in a NEW KNET batch. Mirrors the criteria
    // in createKnetBatchAction (batches.ts) so the count + click are coherent.
    prisma.refundComponent.findMany({
      where: knetMethod
        ? {
            paymentMethodId: knetMethod.id,
            status: { in: ['PENDING', 'AWAITING_BATCH'] },
            arn: null,
            batchId: null,
            case: {
              deletedAt: null,
              status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] },
            },
          }
        : { id: '__none__' },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            customerName: true,
          },
        },
        paymentMethod: { select: { label: true, key: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.knetBatch.findMany({
      where: { status: { in: ['SENT', 'AWAITING_ARNS', 'ARNS_RECEIVED'] } },
      include: {
        components: {
          select: {
            id: true,
            arn: true,
            status: true,
            amount: true,
            currency: true,
            authCode: true,
            case: { select: { id: true, caseNumber: true, customerName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: 25,
    }),
    // Mirrors createAuraBatchAction's filter so the count + click stay in sync.
    prisma.refundCase.findMany({
      where: {
        auraStatus: 'PENDING',
        auraBatchId: null,
        auraPoints: { gt: 0 },
        deletedAt: null,
        status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
      },
      select: {
        id: true,
        caseNumber: true,
        customerName: true,
        customerEmail: true,
        orderNumber: true,
        auraPoints: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.auraBatch.findMany({
      where: { status: { in: ['SENT', 'AWAITING'] } },
      orderBy: { sentAt: 'desc' },
      take: 25,
    }),
  ]);

  const byCountry = new Map(
    pendingByCountry.map((p) => [
      p.countryId,
      { count: p._count._all, total: p._sum.totalRefundAmount ?? 0 },
    ]),
  );
  const countryRows = countries.map((c) => {
    const stats = byCountry.get(c.id) ?? { count: 0, total: 0 };
    return {
      id: c.id,
      code: c.registry.code,
      name: c.registry.nameEn,
      flag: c.registry.flag,
      managerEmail: c.managerEmail,
      pendingCount: stats.count,
      pendingTotal: stats.total,
      currency: c.registry.currencyCode,
    };
  });

  const totalPendingApprovals = countryRows.reduce((s, r) => s + r.pendingCount, 0);
  const totalKnetReady = pendingKnetComponents.length;
  const totalPendingAura = pendingAuraCases.length;

  // Fetch the pool: every case that still has an operator action to
  // take — the three active statuses plus REFUNDED cases whose customer
  // call is still PENDING (surface CALL_CUSTOMER cases). REFUNDED cases
  // whose call is already resolved (ANSWERED / NO_ANSWER / NOT_NEEDED /
  // NOT_APPLICABLE) are DONE and would otherwise accumulate unboundedly,
  // eventually starving the take: 80 limit of active work.
  const poolCases = await prisma.refundCase.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] } },
        { status: 'REFUNDED', customerCallStatus: 'PENDING' },
      ],
    },
    include: {
      country: { include: { registry: true } },
      brand: true,
      branch: { select: { name: true, code: true } },
      approvedBy: { select: { name: true, email: true } },
      approvalBatch: {
        select: { batchNumber: true, recipientEmails: true, responseRawBody: true },
      },
      components: {
        include: {
          paymentMethod: { select: { key: true, label: true } },
          batch: { select: { id: true, batchNumber: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 12,
      },
      notes: {
        where: { deletedAt: null },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
    // Oldest approved first — SLA-driven queue for the refund operator.
    orderBy: [{ approvedAt: 'asc' }, { createdAt: 'asc' }],
    take: 80,
  });

  // Refund agents + admins can execute ARN entry / complete refund /
  // call follow-up. Mirrors EXECUTE_ROLES on the server (cases.ts).
  const role = session.user.role ?? '';
  const canExecute = role === 'ADMIN' || role === 'OPERATIONS' || role === 'REFUND_AGENT';

  const poolData: PoolCase[] = poolCases.map((c) => {
    const contactLogs = c.activityLogs.filter((a) => a.kind === 'case.contact_attempt');
    const approvedAtMs = c.approvedAt ? c.approvedAt.getTime() : c.createdAt.getTime();
    const ageHours = Math.max(0, Math.round((Date.now() - approvedAtMs) / 3_600_000));
    const components = c.components;
    const allArnsIn = components.length > 0 && components.every((cmp) => !!cmp.arn);
    const pendingArns = components.filter((cmp) => !cmp.arn).length;
    const awaitingBatch = components.some(
      (cmp) => !cmp.arn && !!cmp.batch && cmp.status !== 'REFUNDED',
    );
    // "What the operator should do next" — single highest-priority action.
    const nextAction: PoolCase['nextAction'] =
      c.status === 'REFUNDED' && c.customerCallStatus === 'PENDING'
        ? 'CALL_CUSTOMER'
        : c.status === 'REFUNDED'
          ? 'DONE'
          : allArnsIn
            ? 'COMPLETE'
            : awaitingBatch
              ? 'AWAIT_BATCH'
              : 'ENTER_ARN';
    return {
      id: c.id,
      caseNumber: c.caseNumber,
      externalCaseNumber: c.externalCaseNumber,
      status: c.status,
      countryCode: c.country.registry.code,
      countryFlag: c.country.registry.flag ?? '',
      countryName: c.country.registry.nameEn,
      brandName: c.brand.name,
      brandSlug: c.brand.slug,
      customerName: c.customerName,
      customerEmail: c.customerEmail,
      customerPhone: c.customerPhone,
      branchName: c.branch?.name ?? null,
      branchCode: c.branch?.code ?? null,
      orderNumber: c.orderNumber,
      orderAmount: c.orderAmount,
      refundAmount: c.totalRefundAmount,
      // Use the DB's persisted `isPartial` flag so this matches the case
      // detail view exactly. It's computed by createCaseAction with a
      // 0.001 tolerance that is correct for KWD (3-decimal fils) as well
      // as the 2-decimal currencies used in the other countries.
      isPartialRefund: c.isPartial,
      currency: c.orderCurrency,
      approvedAt: c.approvedAt ? formatRelative(c.approvedAt) : null,
      approvedAtIso: c.approvedAt ? c.approvedAt.toISOString() : null,
      ageHours,
      approvedByLabel: c.approvedBy?.name ?? c.approvedBy?.email ?? null,
      approvalBatchNumber: c.approvalBatch?.batchNumber ?? null,
      approvalBatchManagerEmails: c.approvalBatch?.recipientEmails ?? null,
      approvalReply: c.approvalBatch?.responseRawBody ?? null,
      rootCauseSummary: c.rootCauseNotes ?? c.customerNotes ?? null,
      auraPoints: c.auraPoints,
      auraStatus: c.auraStatus,
      customerCallStatus: c.customerCallStatus,
      customerCallUpdatedAt: c.customerCallUpdatedAt
        ? c.customerCallUpdatedAt.toISOString()
        : null,
      pendingArns,
      allArnsIn,
      nextAction,
      components: components.map((cmp) => ({
        id: cmp.id,
        paymentLabel: cmp.paymentMethod.label,
        paymentKey: cmp.paymentMethod.key,
        amount: cmp.amount,
        currency: cmp.currency,
        status: cmp.status,
        arn: cmp.arn,
        authCode: cmp.authCode,
        last4: cmp.last4,
        batchId: cmp.batch?.id ?? null,
        batchNumber: cmp.batch?.batchNumber ?? null,
      })),
      contactLog: contactLogs.map((l) => {
        let channel = 'Phone';
        let outcome = l.message;
        try {
          const meta = l.metadata
            ? (JSON.parse(l.metadata) as { channel?: string; outcome?: string })
            : null;
          if (meta?.channel) channel = meta.channel;
          if (meta?.outcome) outcome = meta.outcome;
        } catch {
          // metadata may be missing on legacy rows; fall back to the message.
        }
        return {
          id: l.id,
          channel,
          outcome,
          whenLabel: formatRelative(l.createdAt) ?? '',
          agent: l.actorLabel,
        };
      }),
      notes: c.notes.map((n) => ({
        id: n.id,
        body: n.body,
        authorName: n.author?.name ?? 'Unknown',
        whenLabel: formatRelative(n.createdAt) ?? '',
      })),
      timeline: c.activityLogs.map((l) => ({
        id: l.id,
        kind: l.kind,
        message: l.message,
        whenLabel: formatRelative(l.createdAt) ?? '',
        actor: l.actorLabel,
      })),
    };
  });

  return (
    <div className={isPoolTab ? 'px-4 py-4' : 'mx-auto max-w-7xl px-6 py-8'}>
      <div className={isPoolTab ? 'mb-3' : 'mb-6'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1
              className={
                isPoolTab
                  ? 'text-xl font-semibold tracking-tight text-heading'
                  : 'text-display-md font-normal tracking-tight text-heading'
              }
            >
              Refund Pool
            </h1>
            {isPoolTab ? (
              <Badge variant="outline" className="text-xs">
                {poolData.length} tickets
              </Badge>
            ) : (
              <p className="text-body">Batch work for approvals, KNET and Aura refunds.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/operations"
              className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                activeTab === 'pool'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-heading hover:bg-surface-subtle'
              }`}
            >
              Tickets
            </Link>
            <Link
              href="?tab=approvals"
              scroll={false}
              className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                activeTab === 'approvals'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-heading hover:bg-surface-subtle'
              }`}
            >
              Approvals {totalPendingApprovals}
            </Link>
            <Link
              href="?tab=knet"
              scroll={false}
              className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                activeTab === 'knet'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-heading hover:bg-surface-subtle'
              }`}
            >
              KNET {totalKnetReady}
            </Link>
            <Link
              href="?tab=aura"
              scroll={false}
              className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                activeTab === 'aura'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-heading hover:bg-surface-subtle'
              }`}
            >
              Aura {totalPendingAura}
            </Link>
            <Link
              href="/operations/bulk-cases"
              className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-heading transition-colors hover:bg-surface-subtle"
            >
              Bulk
            </Link>
          </div>
        </div>
      </div>

      {activeTab === 'pool' ? (
        <RefundPoolPanel cases={poolData} canExecute={canExecute} />
      ) : null}

      {activeTab === 'approvals' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cases sitting at <span className="font-medium text-foreground">Pending approval</span>.
            Pick a country, send the manager an approval email, and watch the live batch as the
            manager replies. Approved cases automatically move to the KNET / Aura lanes below.
          </p>
          <ApprovalBatchesPanel
            countries={countryRows}
            liveBatches={liveApprovalBatches.map((b) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              countryName: b.country.registry.nameEn,
              countryFlag: b.country.registry.flag,
              status: b.status,
              sentAt: b.sentAt?.toISOString() ?? null,
              recipientEmails: b.recipientEmails,
              totalCases: b.totalCases,
              approvedCases: b.approvedCases,
              rejectedCases: b.rejectedCases,
              cases: b.cases.map((c) => ({
                id: c.id,
                caseNumber: c.caseNumber,
                customerName: c.customerName,
                status: c.status,
                amount: c.totalRefundAmount,
                currency: c.orderCurrency,
              })),
            }))}
          />
        </div>
      ) : null}

      {activeTab === 'knet' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Approved cases with KNET components ready to be added to the next file. Build a batch,
            send it, then enter the ARNs received back from the bank to mark the components{' '}
            <span className="font-medium text-foreground">Refunded</span>.
          </p>
          <KnetBatchesPanel
            pendingComponents={pendingKnetComponents.map((c) => ({
              id: c.id,
              caseId: c.case.id,
              caseNumber: c.case.caseNumber,
              customerName: c.case.customerName,
              authCode: c.authCode,
              amount: c.amount,
              currency: c.currency,
              status: c.status,
              suggestedArn: c.arn,
            }))}
            liveBatches={liveKnetBatches.map((b) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              status: b.status,
              sentAt: b.sentAt?.toISOString() ?? null,
              totalComponents: b.totalComponents,
              arnsReceived: b.arnsReceived,
              verifiedComponents: b.verifiedComponents,
              components: b.components.map((c) => ({
                id: c.id,
                caseNumber: c.case.caseNumber,
                customerName: c.case.customerName,
                authCode: c.authCode,
                amount: c.amount,
                currency: c.currency,
                status: c.status,
                suggestedArn: c.arn,
              })),
            }))}
          />
        </div>
      ) : null}

      {activeTab === 'aura' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Approved cases that owe Aura points back to the customer. Group them into a batch, hand
            it off to the Aura team, and confirm once the points have been credited.
          </p>
          <AuraBatchesPanel
            pendingCases={pendingAuraCases.map((c) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              customerName: c.customerName,
              customerEmail: c.customerEmail,
              orderNumber: c.orderNumber,
              points: c.auraPoints ?? 0,
            }))}
            liveBatches={liveAuraBatches.map((b) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              status: b.status,
              sentAt: b.sentAt?.toISOString() ?? null,
              totalCases: b.totalCases,
              completedCases: b.completedCases,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-body">{label}</CardTitle>
        <CardDescription className="text-xs">{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="tabular text-display-sm font-light text-heading">{value}</div>
      </CardContent>
    </Card>
  );
}
