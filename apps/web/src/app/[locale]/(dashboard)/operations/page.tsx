import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

  // Fetch the pool: every case that is APPROVED / IN_EXECUTION /
  // PARTIALLY_REFUNDED so the refund agent has a single canvas to work
  // through. Includes components, the approval batch that signed it off,
  // contact-attempt activity logs, and recent timeline events.
  const poolCases = await prisma.refundCase.findMany({
    where: {
      deletedAt: null,
      status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] },
    },
    include: {
      country: { include: { registry: true } },
      brand: true,
      approvedBy: { select: { name: true, email: true } },
      approvalBatch: { select: { batchNumber: true, recipientEmails: true, responseRawBody: true } },
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
    },
    orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  });

  const poolData: PoolCase[] = poolCases.map((c) => {
    const contactLogs = c.activityLogs.filter((a) => a.kind === 'case.contact_attempt');
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
      orderNumber: c.orderNumber,
      orderAmount: c.orderAmount,
      refundAmount: c.totalRefundAmount,
      currency: c.orderCurrency,
      approvedAt: c.approvedAt ? formatRelative(c.approvedAt) : null,
      approvedByLabel: c.approvedBy?.name ?? c.approvedBy?.email ?? null,
      approvalBatchNumber: c.approvalBatch?.batchNumber ?? null,
      approvalBatchManagerEmails: c.approvalBatch?.recipientEmails ?? null,
      approvalReply: c.approvalBatch?.responseRawBody ?? null,
      rootCauseSummary: c.rootCauseNotes ?? c.customerNotes ?? null,
      auraPoints: c.auraPoints,
      auraStatus: c.auraStatus,
      components: c.components.map((cmp) => ({
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
          const meta = l.metadata ? JSON.parse(l.metadata) as { channel?: string; outcome?: string } : null;
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
      timeline: c.activityLogs.map((l) => ({
        id: l.id,
        kind: l.kind,
        message: l.message,
        whenLabel: formatRelative(l.createdAt) ?? '',
        actor: l.actorLabel,
      })),
    };
  });

  // Sidebar feeds for the pool view: live KNET batches with ARN progress,
  // live Aura batches, and a global recent-activity strip.
  const poolLiveKnet = liveKnetBatches.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    status: b.status,
    sentAtLabel: formatRelative(b.sentAt),
    totalComponents: b.totalComponents,
    arnsReceived: b.arnsReceived,
  }));
  const poolLiveAura = liveAuraBatches.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    status: b.status,
    sentAtLabel: formatRelative(b.sentAt),
  }));
  const recentActivityRows = await prisma.activityLog.findMany({
    where: { kind: { in: ['component.refunded', 'batch.completed', 'batch.replied', 'aura.confirmed'] } },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });
  const poolRecentActivity = recentActivityRows.map((a) => ({
    id: a.id,
    message: a.message,
    whenLabel: formatRelative(a.createdAt) ?? '',
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-display-md font-normal tracking-tight text-heading">
              Refund Pool
            </h1>
            <p className="mt-1 text-body">
              Every refund-related queue in one place: cases waiting on manager approval, KNET components ready for the next batch, and Aura point returns awaiting confirmation. Pick the lane that needs your attention.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/operations/bulk-cases"
              className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-heading transition-colors hover:bg-surface-subtle"
            >
              Bulk operations
            </Link>
            <Badge variant="outline" className="text-xs">
              Phase 3 · live batches
            </Badge>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Pending approvals"
          value={totalPendingApprovals}
          hint={`${countryRows.filter((c) => c.pendingCount > 0).length} countr${
            countryRows.filter((c) => c.pendingCount > 0).length === 1 ? 'y' : 'ies'
          } with cases`}
        />
        <SummaryCard
          label="KNET components ready"
          value={totalKnetReady}
          hint={`${liveKnetBatches.length} live KNET batch${liveKnetBatches.length === 1 ? '' : 'es'}`}
        />
        <SummaryCard
          label="Aura cases pending"
          value={totalPendingAura}
          hint={`${liveAuraBatches.length} live Aura batch${liveAuraBatches.length === 1 ? '' : 'es'}`}
        />
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="pool" asChild>
            <Link href="?tab=pool" scroll={false}>
              Pool ({poolData.length})
            </Link>
          </TabsTrigger>
          <TabsTrigger value="approvals" asChild>
            <Link href="?tab=approvals" scroll={false}>
              Approvals
            </Link>
          </TabsTrigger>
          <TabsTrigger value="knet" asChild>
            <Link href="?tab=knet" scroll={false}>
              KNET
            </Link>
          </TabsTrigger>
          <TabsTrigger value="aura" asChild>
            <Link href="?tab=aura" scroll={false}>
              Aura
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pool" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Single canvas for every approved case waiting on a refund. Pick a case from the list to see the customer
            details, refund components (with ARN status), the customer contact log, the manager approval reply, and the
            full activity timeline. Use the right column to monitor live KNET / Aura batches.
          </p>
          <RefundPoolPanel
            cases={poolData}
            liveKnetBatches={poolLiveKnet}
            liveAuraBatches={poolLiveAura}
            recentActivity={poolRecentActivity}
          />
        </TabsContent>

        <TabsContent value="approvals" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cases sitting at <span className="font-medium text-foreground">Pending approval</span>. Pick a country, send the manager an approval email, and watch the live batch as the manager replies. Approved cases automatically move to the KNET / Aura lanes below.
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
        </TabsContent>

        <TabsContent value="knet" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Approved cases with KNET components ready to be added to the next file. Build a batch, send it, then enter the ARNs received back from the bank to mark the components <span className="font-medium text-foreground">Refunded</span>.
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
        </TabsContent>

        <TabsContent value="aura" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Approved cases that owe Aura points back to the customer. Group them into a batch, hand it off to the Aura team, and confirm once the points have been credited.
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-body">{label}</CardTitle>
        <CardDescription className="text-xs">{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-display-sm font-light tabular text-heading">{value}</div>
      </CardContent>
    </Card>
  );
}
