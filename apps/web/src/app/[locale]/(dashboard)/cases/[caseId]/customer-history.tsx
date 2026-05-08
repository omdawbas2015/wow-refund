'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMoney } from '@/lib/format';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { History, Ticket, Mail } from 'lucide-react';

type HistoryPriorCase = {
  id: string;
  caseNumber: string;
  externalCaseNumber: string | null;
  status: string;
  createdAt: string;
  totalRefundAmount: number;
  orderCurrency: string;
};

type HistoryPromo = {
  id: string;
  code: string | null;
  type: string;
  amount: number | null;
  currency: string | null;
  createdAt: string;
};

/**
 * Sidecar widget on the case detail page — shows prior refund cases and
 * promo codes already allocated to this customer so the agent has
 * context before they action the new case. Data is loaded client-side
 * from /api/customer-history (auth-gated by the same session).
 */
export function CustomerHistory({
  locale,
  customerEmail,
  excludeCaseId,
}: {
  locale: string;
  customerEmail: string;
  excludeCaseId: string;
}) {
  const [data, setData] = useState<{
    priorCases: HistoryPriorCase[];
    promos: HistoryPromo[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/customer-history?email=${encodeURIComponent(customerEmail)}&excludeCaseId=${excludeCaseId}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load history');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerEmail, excludeCaseId]);

  const priorCount = data?.priorCases.length ?? 0;
  const promoCount = data?.promos.length ?? 0;

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle/50 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Customer history
        </span>
        {!loading && !error && (priorCount > 0 || promoCount > 0) && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {priorCount} {priorCount === 1 ? 'case' : 'cases'} · {promoCount}{' '}
            {promoCount === 1 ? 'promo' : 'promos'}
          </span>
        )}
      </div>

      {loading ? (
        <CustomerHistorySkeleton />
      ) : error ? (
        <div className="p-4 text-xs text-destructive">
          Couldn&apos;t load history: {error}
        </div>
      ) : (
        <div className="grid gap-px bg-border md:grid-cols-2">
          {/* Prior refund cases column */}
          <div className="bg-surface">
            <SectionHeader
              icon={<Ticket className="h-3.5 w-3.5" />}
              title="Prior refund cases"
              count={priorCount}
            />
            {priorCount === 0 ? (
              <div className="px-4 py-3">
                <EmptyHint>First-time customer — no prior cases on file.</EmptyHint>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data!.priorCases.slice(0, 5).map((pc) => (
                  <li
                    key={pc.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2"
                  >
                    <Link
                      href={`/${locale}/cases/${pc.id}`}
                      className="truncate font-mono text-[12.5px] font-medium text-primary hover:underline"
                    >
                      {pc.externalCaseNumber || pc.caseNumber}
                    </Link>
                    <CaseStatusBadge status={pc.status} />
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {formatDate(pc.createdAt)}
                    </span>
                    <span className="text-end font-mono text-[11px] text-muted-foreground tabular-nums">
                      {formatMoney(pc.totalRefundAmount, pc.orderCurrency)}
                    </span>
                  </li>
                ))}
                {priorCount > 5 && (
                  <li className="px-4 py-2 text-[11px] text-muted-foreground">
                    +{priorCount - 5} more in case list
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Promos sent column */}
          <div className="bg-surface">
            <SectionHeader
              icon={<Mail className="h-3.5 w-3.5" />}
              title="Promos sent"
              count={promoCount}
            />
            {promoCount === 0 ? (
              <div className="px-4 py-3">
                <EmptyHint>No promo codes have been sent to this customer.</EmptyHint>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data!.promos.slice(0, 5).map((p) => (
                  <li
                    key={p.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2"
                  >
                    {p.code ? (
                      <span className="truncate font-mono text-[12px] font-medium text-foreground">
                        {p.code}
                      </span>
                    ) : (
                      <span className="text-[12px] italic text-muted-foreground">
                        No code
                      </span>
                    )}
                    {p.amount !== null ? (
                      <span className="text-end font-mono text-[12px] tabular-nums text-foreground">
                        {p.currency ? formatMoney(p.amount, p.currency) : p.amount}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="truncate text-[11px] text-muted-foreground">
                      {formatPromoType(p.type)}
                    </span>
                    <span className="text-end text-[11px] text-muted-foreground tabular-nums">
                      {formatDate(p.createdAt)}
                    </span>
                  </li>
                ))}
                {promoCount > 5 && (
                  <li className="px-4 py-2 text-[11px] text-muted-foreground">
                    +{promoCount - 5} more in promo log
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Convert SCREAMING_SNAKE_CASE promo type to a human label. */
function formatPromoType(type: string) {
  return type
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-surface-subtle/40 px-4 py-2">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </span>
      <Badge variant="outline" className="text-[10px] tabular-nums">
        {count}
      </Badge>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
      {children}
    </div>
  );
}

function CustomerHistorySkeleton() {
  return (
    <div className="space-y-4 p-3">
      {[0, 1].map((g) => (
        <div key={g} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="h-3 w-24 animate-pulse rounded bg-muted" />
            <span className="h-3 w-6 animate-pulse rounded bg-muted" />
          </div>
          {[0, 1, 2].map((row) => (
            <div key={row} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="h-3 w-20 animate-pulse rounded bg-muted" />
                <span className="h-3 w-12 animate-pulse rounded bg-muted" />
              </div>
              <span className="block h-2.5 w-32 animate-pulse rounded bg-muted/70" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
