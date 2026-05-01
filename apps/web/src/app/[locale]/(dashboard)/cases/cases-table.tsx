'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import type { CaseStatus } from '@/components/ui/case-status-stepper';
import { PaymentMethodIcons } from '@/components/ui/payment-method-icons';
import { formatDate, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Trash2 } from 'lucide-react';

export type CaseRow = {
  id: string;
  caseNumber: string;
  externalCaseNumber: string | null;
  status: CaseStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  brandName: string;
  branchName: string | null;
  countryName: string;
  countryFlag: string;
  orderNumber: string;
  orderDate: string;
  orderAmount: number;
  orderCurrency: string;
  totalRefundAmount: number;
  isPartial: boolean;
  createdAt: string;
  createdByName: string | null;
  rootCause: string | null;
  isDeleted: boolean;
  paymentMethods: { key: string; label: string }[];
};

/**
 * Cases table redesign — Linear/Stripe-style data density:
 *   - Country and brand split into two cells; flag carries country alone,
 *     brand owns its column with branch as a muted subtitle.
 *   - Amount cell uses a leading muted currency code so the eye lines up
 *     on the digit, not the symbol; partial refunds add a tiny progress
 *     bar instead of a second money line.
 *   - Customer keeps name + email but with a tighter type ramp.
 *   - Headers are sentence case + medium weight; row hover is a faint
 *     primary tint, with a trailing ↗ that fades in on hover.
 */
export function CasesTable({
  locale,
  cases,
}: {
  locale: string;
  cases: CaseRow[];
}) {
  const router = useRouter();

  const openCase = (id: string) => router.push(`/${locale}/cases/${id}`);

  return (
    <>
      {/* Desktop — clean data table. Fits 13''+ laptops without horizontal
          scroll: country is absorbed into the Brand cell as a leading flag,
          and Payment lives as a small icon row under the Refund amount. */}
      <div className="hidden md:block">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60">
              <Th>Case</Th>
              <Th>Customer</Th>
              <Th>Brand</Th>
              <Th align="end">Refund</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Agent</Th>
              <th className="w-6 px-1 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {cases.map((c) => (
              <tr
                key={c.id}
                onClick={() => openCase(c.id)}
                className={cn(
                  'group cursor-pointer transition-colors duration-150 hover:bg-primary-subtle/40',
                  c.isDeleted && 'opacity-50',
                )}
              >
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="inline-flex items-center gap-1">
                    <Link
                      href={`/${locale}/cases/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'font-mono text-[12px] font-semibold tracking-tight',
                        c.isDeleted
                          ? 'text-muted-foreground line-through'
                          : 'text-primary hover:underline',
                      )}
                    >
                      {c.externalCaseNumber || c.caseNumber}
                    </Link>
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">
                      <CopyButton
                        value={c.externalCaseNumber || c.caseNumber}
                        size="xs"
                        label="Copy case number"
                      />
                    </span>
                  </div>
                  <div className="mt-0.5 max-w-[160px] truncate font-mono text-[10.5px] text-muted-foreground">
                    Order · {c.orderNumber}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="max-w-[180px] truncate text-xs font-medium text-heading">
                    {c.customerName}
                  </div>
                  <div className="max-w-[180px] truncate text-[10.5px] text-muted-foreground">
                    {c.customerEmail}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="text-sm leading-none" aria-hidden>
                      {c.countryFlag || '\uD83C\uDF10'}
                    </span>
                    <span className="text-xs font-medium text-heading">
                      {c.brandName}
                    </span>
                  </div>
                  {c.branchName && (
                    <div className="mt-0.5 max-w-[160px] truncate text-[10.5px] text-muted-foreground">
                      {c.branchName}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-end">
                  <div className="font-mono text-xs font-semibold tabular-nums text-heading">
                    {formatMoney(c.totalRefundAmount, c.orderCurrency)}
                  </div>
                  <div className="mt-1 flex justify-end">
                    <PaymentMethodIcons
                      methods={c.paymentMethods}
                      size="sm"
                    />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  {c.isDeleted ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                      <Trash2 className="h-3 w-3" />
                      Deleted
                    </span>
                  ) : (
                    <CaseStatusBadge status={c.status} />
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[10.5px] text-muted-foreground">
                  {formatDate(new Date(c.createdAt))}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="inline-flex max-w-[140px] truncate text-[11px] text-heading">
                    {c.createdByName ?? '—'}
                  </span>
                </td>
                <td className="px-1 py-2.5">
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — card list */}
      <ul className="divide-y divide-border md:hidden">
        {cases.map((c) => (
          <li key={c.id} className={cn(c.isDeleted && 'opacity-50')}>
            <Link
              href={`/${locale}/cases/${c.id}`}
              className="block px-4 py-3.5 transition-colors hover:bg-surface-subtle/50"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      'font-mono text-xs font-semibold',
                      c.isDeleted ? 'text-muted-foreground line-through' : 'text-primary',
                    )}
                  >
                    {c.externalCaseNumber || c.caseNumber}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/80">
                    Order · {c.orderNumber}
                  </span>
                </div>
                {c.isDeleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                    <Trash2 className="h-3 w-3" />
                    Deleted
                  </span>
                ) : (
                  <CaseStatusBadge status={c.status} />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-heading">{c.customerName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <span aria-hidden>{c.countryFlag}</span> {c.countryName} ·{' '}
                  {c.brandName}
                  {c.branchName ? ` · ${c.branchName}` : ''}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <PaymentMethodIcons methods={c.paymentMethods} size="sm" />
                <AmountCell
                  refund={c.totalRefundAmount}
                  currency={c.orderCurrency}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Th({
  children,
  align = 'start',
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
}) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60',
        align === 'end' ? 'text-end' : 'text-start',
      )}
    >
      {children}
    </th>
  );
}

/**
 * Amount cell — single tabular-nums money line so digits align across rows.
 * Partial refunds are signalled by the `Partially refunded` status pill in
 * the next column; we don't need a second visual cue here.
 */
function AmountCell({
  refund,
  currency,
}: {
  refund: number;
  currency: string;
}) {
  return (
    <span className="font-mono text-xs font-semibold tabular-nums text-heading">
      {formatMoney(refund, currency)}
    </span>
  );
}
