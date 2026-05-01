import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@wow/db';
import type { CaseStatus } from '@wow/db';
import { auth } from '@/auth';
import { buildSingleSheetXlsx, attachmentDisposition, XLSX_MIME } from '@/lib/exports/xlsx';
import { buildSlaConditions, parseSlaParam } from '@/lib/cases/sla';
import { STATUS_BUCKETS } from '@/app/[locale]/(dashboard)/cases/case-status-buckets';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_EXECUTION',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'REJECTED',
  'CANCELLED',
]);

/**
 * Refund-cases export. Accepts the same filters as the cases list page:
 * `status`, `countryId`, `brandId`, `q` (case number / order number /
 * customer email substring). Capped at 10 000 rows.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD' && role !== 'FINANCE_LEAD' && role !== 'COUNTRY_MANAGER') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status') ?? '';
  const countryId = sp.get('countryId') ?? '';
  const brandId = sp.get('brandId') ?? '';
  const q = (sp.get('q') ?? '').trim();
  // The cases list page also accepts an `sla` filter; honor it here so the
  // exported file matches the filtered on-screen view.
  const bucket = sp.get('bucket') ?? '';
  const assignedToId = sp.get('assignedToId') ?? '';
  const fromDate = sp.get('fromDate') ?? '';
  const toDate = sp.get('toDate') ?? '';
  const sla = parseSlaParam(sp.get('sla') ?? undefined);
  const slaConditions = buildSlaConditions(sla);
  const mine = sp.get('mine') === '1' && !!session.user.id;

  const andConditions: Prisma.RefundCaseWhereInput[] = [...slaConditions];
  if (mine && session.user.id) {
    andConditions.push({
      OR: [
        { assignedToId: session.user.id },
        { createdById: session.user.id },
      ],
    });
  }
  if (q) {
    andConditions.push({
      OR: [
        { caseNumber: { contains: q } },
        { orderNumber: { contains: q } },
        { customerEmail: { contains: q } },
        { customerName: { contains: q } },
      ],
    });
  }

  if (assignedToId) {
    andConditions.push({ assignedToId });
  }
  if (fromDate || toDate) {
    const createdAt: Record<string, Date> = {};
    if (fromDate) createdAt['gte'] = new Date(fromDate);
    if (toDate) createdAt['lte'] = new Date(toDate);
    andConditions.push({ createdAt });
  }

  // Resolve status: explicit status wins, otherwise use bucket mapping
  let statusFilter: Prisma.RefundCaseWhereInput = {};
  if (status && VALID_STATUSES.has(status)) {
    statusFilter = { status: status as CaseStatus };
  } else if (bucket && bucket in STATUS_BUCKETS) {
    statusFilter = { status: { in: [...STATUS_BUCKETS[bucket as keyof typeof STATUS_BUCKETS]] as CaseStatus[] } };
  }

  const where: Prisma.RefundCaseWhereInput = {
    deletedAt: null,
    ...statusFilter,
    ...(countryId ? { countryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
  };
  const cases = await prisma.refundCase.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10_000,
    include: {
      country: { select: { registryCode: true } },
      brand: { select: { name: true } },
      branch: { select: { name: true } },
      rootCause: { select: { label: true } },
      createdBy: { select: { name: true, email: true } },
      assignedTo: { select: { name: true, email: true } },
      components: {
        select: {
          amount: true,
          authCode: true,
          paymentMethod: { select: { key: true, label: true } },
        },
      },
    },
  });

  interface Row {
    createdAt: Date;
    caseNumber: string;
    externalCaseNumber: string;
    status: string;
    countryCode: string;
    brand: string;
    branch: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    orderNumber: string;
    orderDate: Date;
    orderAmount: number;
    totalAmount: number;
    refundType: string;
    currency: string;
    paymentMethods: string;
    authCodes: string;
    rootCause: string;
    rootCauseNotes: string;
    customerNotes: string;
    createdBy: string;
    assignedTo: string;
    auraPoints: number;
    auraStatus: string;
  }

  const rows: Row[] = cases.map((c) => ({
    createdAt: c.createdAt,
    caseNumber: c.caseNumber,
    externalCaseNumber: c.externalCaseNumber ?? '',
    status: c.status,
    countryCode: c.country.registryCode,
    brand: c.brand.name,
    branch: c.branch?.name ?? '',
    customerName: c.customerName,
    customerEmail: c.customerEmail,
    customerPhone: c.customerPhone ?? '',
    orderNumber: c.orderNumber,
    orderDate: c.orderDate,
    orderAmount: c.orderAmount,
    totalAmount: c.totalRefundAmount,
    refundType: c.isPartial ? 'Partial' : 'Full',
    currency: c.orderCurrency,
    paymentMethods: c.components.map((cc) => cc.paymentMethod.label).join(', '),
    authCodes: c.components
      .map((cc) => cc.authCode ?? '')
      .filter(Boolean)
      .join(', '),
    rootCause: c.rootCause?.label ?? '',
    rootCauseNotes: c.rootCauseNotes ?? '',
    customerNotes: c.customerNotes ?? '',
    createdBy: c.createdBy?.name ?? c.createdBy?.email ?? '',
    assignedTo: c.assignedTo?.name ?? c.assignedTo?.email ?? '',
    auraPoints: c.auraPoints ?? 0,
    auraStatus: c.auraStatus,
  }));

  const xlsx = await buildSingleSheetXlsx<Row>({
    name: 'Cases',
    columns: [
      { header: 'Created', key: 'createdAt', width: 18, numFmt: 'yyyy-mm-dd hh:mm' },
      { header: 'Agent case #', key: 'externalCaseNumber', width: 20 },
      { header: 'System ref', key: 'caseNumber', width: 22 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Country', key: 'countryCode', width: 8 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Branch', key: 'branch', width: 16 },
      { header: 'Customer', key: 'customerName', width: 24 },
      { header: 'Email', key: 'customerEmail', width: 28 },
      { header: 'Phone', key: 'customerPhone', width: 18 },
      { header: 'Order', key: 'orderNumber', width: 18 },
      { header: 'Order date', key: 'orderDate', width: 14, numFmt: 'yyyy-mm-dd' },
      { header: 'Order amount', key: 'orderAmount', width: 14, numFmt: '#,##0.000' },
      { header: 'Refund amount', key: 'totalAmount', width: 14, numFmt: '#,##0.000' },
      { header: 'Refund type', key: 'refundType', width: 10 },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'Payment methods', key: 'paymentMethods', width: 24 },
      { header: 'Auth codes', key: 'authCodes', width: 20 },
      { header: 'Root cause', key: 'rootCause', width: 20 },
      { header: 'Root cause notes', key: 'rootCauseNotes', width: 30 },
      { header: 'Customer notes', key: 'customerNotes', width: 30 },
      { header: 'Created by', key: 'createdBy', width: 18 },
      { header: 'Assigned to', key: 'assignedTo', width: 18 },
      { header: 'Aura points', key: 'auraPoints', width: 12 },
      { header: 'Aura status', key: 'auraStatus', width: 12 },
    ],
    rows,
  });

  const filename = `cases-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(xlsx, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': attachmentDisposition(filename),
      'Cache-Control': 'no-store',
    },
  });
}
