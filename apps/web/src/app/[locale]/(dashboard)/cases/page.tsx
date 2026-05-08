import Link from 'next/link';
import { prisma } from '@wow/db';
import { caseListFiltersSchema } from '@wow/validators';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Download, Inbox } from 'lucide-react';
import { CaseFiltersBar } from './case-filters-bar';
import { STATUS_BUCKETS } from './case-status-buckets';
import { CasesTable, type CaseRow } from './cases-table';
import type { CaseStatus } from '@/components/ui/case-status-stepper';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function CasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const session = await auth();
  const role = session?.user?.role ?? null;
  const canApprove = role === 'ADMIN' || role === 'MANAGER';
  const canExport = role === 'ADMIN' || role === 'OPS_LEAD' || role === 'FINANCE_LEAD' || role === 'COUNTRY_MANAGER';

  const parsedFilters = caseListFiltersSchema.safeParse({
    q: sp['q'],
    countryId: sp['countryId'],
    brandId: sp['brandId'],
    status: sp['status'],
    assignedToId: sp['assignedToId'],
    fromDate: sp['fromDate'],
    toDate: sp['toDate'],
    page: sp['page'] ?? '1',
    pageSize: sp['pageSize'] ?? '25',
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : { page: 1, pageSize: 25 };

  const bucketParam =
    typeof sp['bucket'] === 'string' ? (sp['bucket'] as string) : null;
  const bucket: 'all' | keyof typeof STATUS_BUCKETS =
    bucketParam === 'active' ||
    bucketParam === 'refunded' ||
    bucketParam === 'closed'
      ? bucketParam
      : 'all';

  // Include deleted cases by default — they render with a "Deleted" badge so
  // users keep a full audit view.
  const where: Record<string, unknown> = {};
  if (filters.q) {
    const isPg = (process.env.DATABASE_URL ?? '').startsWith('postgres');
    const ciContains = (value: string) =>
      isPg ? { contains: value, mode: 'insensitive' as const } : { contains: value };
    where['OR'] = [
      { caseNumber: ciContains(filters.q) },
      { externalCaseNumber: ciContains(filters.q) },
      { customerName: ciContains(filters.q) },
      { customerEmail: ciContains(filters.q) },
      { orderNumber: ciContains(filters.q) },
    ];
  }
  if (filters.countryId) where['countryId'] = filters.countryId;
  if (filters.brandId) where['brandId'] = filters.brandId;
  if (filters.status) {
    where['status'] = filters.status;
  } else if (bucket !== 'all') {
    where['status'] = { in: [...STATUS_BUCKETS[bucket]] };
  }
  if (filters.assignedToId) where['assignedToId'] = filters.assignedToId;
  if (filters.fromDate || filters.toDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.fromDate) createdAt['gte'] = filters.fromDate;
    if (filters.toDate) createdAt['lte'] = filters.toDate;
    where['createdAt'] = createdAt;
  }

  // Bucket counts — ignore bucket/status from `where` so tabs reflect the
  // full picture under the other filters (country, date, search).
  const countWhere: Record<string, unknown> = { ...where };
  delete countWhere['status'];

  const [countries, brands, total, cases, bucketGroups] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      include: { registry: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.refundCase.count({ where }),
    prisma.refundCase.findMany({
      where,
      include: {
        country: { include: { registry: true } },
        brand: true,
        branch: { select: { name: true } },
        rootCause: true,
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        components: {
          select: {
            paymentMethod: { select: { key: true, label: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.refundCase.groupBy({
      by: ['status'],
      where: countWhere,
      _count: { _all: true },
    }),
  ]);

  const byStatus = new Map<string, number>(
    bucketGroups.map((g) => [g.status, g._count._all]),
  );
  const sumIn = (list: readonly string[]) =>
    list.reduce((acc, s) => acc + (byStatus.get(s) ?? 0), 0);
  const counts = {
    all: Array.from(byStatus.values()).reduce((a, b) => a + b, 0),
    active: sumIn(STATUS_BUCKETS.active),
    refunded: sumIn(STATUS_BUCKETS.refunded),
    closed: sumIn(STATUS_BUCKETS.closed),
  };

  const rows: CaseRow[] = cases.map((c) => ({
    id: c.id,
    caseNumber: c.caseNumber,
    externalCaseNumber: c.externalCaseNumber ?? null,
    status: c.status as CaseStatus,
    customerName: c.customerName,
    customerEmail: c.customerEmail,
    customerPhone: c.customerPhone,
    brandName: c.brand.name,
    branchName: c.branch?.name ?? null,
    countryName: c.country.registry.nameEn,
    countryFlag: c.country.registry.flag ?? '',
    orderNumber: c.orderNumber,
    orderDate: c.orderDate.toISOString(),
    orderAmount: c.orderAmount,
    orderCurrency: c.orderCurrency,
    totalRefundAmount: c.totalRefundAmount,
    isPartial: c.isPartial,
    createdAt: c.createdAt.toISOString(),
    createdByName: c.createdBy?.name ?? null,
    rootCause: c.rootCause?.label ?? null,
    isDeleted: !!c.deletedAt,
    paymentMethods: c.components.map((cc) => ({
      key: cc.paymentMethod.key,
      label: cc.paymentMethod.label,
    })),
  }));

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  const exportQuery = new URLSearchParams(
    Object.entries({
      q: filters.q ?? '',
      countryId: filters.countryId ?? '',
      brandId: filters.brandId ?? '',
      status: filters.status ?? '',
      bucket: bucket !== 'all' ? bucket : '',
      assignedToId: filters.assignedToId ?? '',
      fromDate: filters.fromDate ? filters.fromDate.toISOString() : '',
      toDate: filters.toDate ? filters.toDate.toISOString() : '',
    }).filter(([, v]) => v !== ''),
  ).toString();

  return (
    <div className="mx-auto max-w-[1480px] space-y-3 px-4 py-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Refund cases
            <span className="inline-flex h-5 items-center rounded-pill bg-[hsl(var(--accent-cream))] px-2 text-[11px] font-semibold tabular-nums text-primary">
              {total.toLocaleString()}
            </span>
          </span>
        }
        actions={
          <>
            {canExport && (
              <Button asChild size="default" variant="outline">
                <a href={`/api/export/cases?${exportQuery}`}>
                  <Download className="h-4 w-4" />
                  Export
                </a>
              </Button>
            )}
            <Button asChild size="default">
              <Link href={`/${locale}/cases/new`}>
                <Plus className="h-4 w-4" />
                New case
              </Link>
            </Button>
          </>
        }
      />

      <CaseFiltersBar
        countries={countries.map((c) => ({
          id: c.id,
          code: c.registry.code,
          name: c.registry.nameEn,
          flag: c.registry.flag ?? '',
        }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
        counts={counts}
      />

      {cases.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Inbox}
              tone="butter"
              title="No cases match"
              className="py-14"
              action={
                <Button asChild>
                  <Link href={`/${locale}/cases/new`}>
                    <Plus className="h-4 w-4" />
                    New case
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <CasesTable locale={locale} cases={rows} />

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                <div className="text-xs text-muted-foreground">
                  Page {filters.page} of {totalPages} · {total} cases
                </div>
                <div className="flex gap-2">
                  {filters.page > 1 && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={{
                          pathname: `/${locale}/cases`,
                          query: { ...sp, page: filters.page - 1 },
                        }}
                      >
                        Previous
                      </Link>
                    </Button>
                  )}
                  {filters.page < totalPages && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={{
                          pathname: `/${locale}/cases`,
                          query: { ...sp, page: filters.page + 1 },
                        }}
                      >
                        Next
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
