'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
  Search as SearchIcon,
  Wallet,
  CreditCard,
  Coins,
  CheckCircle2,
  Clock,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PoolCaseComponent {
  id: string;
  paymentLabel: string;
  paymentKey: string;
  amount: number;
  currency: string;
  status: string;
  arn: string | null;
  authCode: string | null;
  last4: string | null;
  batchId: string | null;
  batchNumber: string | null;
}

export interface PoolCase {
  id: string;
  caseNumber: string;
  externalCaseNumber: string | null;
  status: string;
  countryCode: string;
  countryFlag: string;
  countryName: string;
  brandName: string;
  brandSlug: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  orderNumber: string;
  orderAmount: number;
  refundAmount: number;
  currency: string;
  approvedAt: string | null;
  approvedByLabel: string | null;
  approvalBatchNumber: string | null;
  approvalBatchManagerEmails: string | null;
  approvalReply: string | null;
  rootCauseSummary: string | null;
  auraPoints: number | null;
  auraStatus: string;
  components: PoolCaseComponent[];
  contactLog: {
    id: string;
    channel: string;
    outcome: string;
    whenLabel: string;
    agent: string | null;
  }[];
  timeline: {
    id: string;
    kind: string;
    message: string;
    whenLabel: string;
    actor: string | null;
  }[];
}

export interface RefundPoolPanelProps {
  cases: PoolCase[];
}

const PAYMENT_ICON: Record<string, typeof Wallet> = {
  KNET: Wallet,
  APPLE_PAY: CreditCard,
  VISA: CreditCard,
  MASTERCARD: CreditCard,
};

function paymentIcon(key: string) {
  return PAYMENT_ICON[key] ?? CreditCard;
}

function statusTone(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'IN_EXECUTION':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'PARTIALLY_REFUNDED':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'REFUNDED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'PENDING_APPROVAL':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    default:
      return 'bg-muted text-foreground border-border';
  }
}

export function RefundPoolPanel({ cases }: RefundPoolPanelProps) {
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (paymentFilter !== 'all') {
        const has = c.components.some((cmp) => cmp.paymentKey === paymentFilter);
        if (!has) return false;
      }
      if (countryFilter !== 'all' && c.countryCode !== countryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = [
          c.caseNumber,
          c.customerName,
          c.customerEmail,
          c.orderNumber,
          c.customerPhone ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, paymentFilter, countryFilter, search]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const countryOptions = useMemo(() => {
    const set = new Map<string, { code: string; flag: string; name: string }>();
    cases.forEach((c) =>
      set.set(c.countryCode, { code: c.countryCode, flag: c.countryFlag, name: c.countryName }),
    );
    return [...set.values()];
  }, [cases]);

  const paymentOptions = useMemo(() => {
    const set = new Map<string, string>();
    cases.forEach((c) => c.components.forEach((cmp) => set.set(cmp.paymentKey, cmp.paymentLabel)));
    return [...set.entries()].map(([key, label]) => ({ key, label }));
  }, [cases]);

  if (cases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No cases ready for refund</CardTitle>
          <CardDescription>
            Approved cases land here automatically once a country manager confirms the daily
            approval batch. Use the Approvals tab to send today&apos;s batch to managers.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">Refund tickets</CardTitle>
              <CardDescription>
                Work one approved case at a time. Batch creation and follow-up live in the batch
                tabs.
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit">
              {filtered.length} of {cases.length} tickets
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search case, customer, order, phone"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={paymentFilter === 'all'} onClick={() => setPaymentFilter('all')}>
              All payments
            </FilterChip>
            {paymentOptions.map((p) => (
              <FilterChip
                key={p.key}
                active={paymentFilter === p.key}
                onClick={() => setPaymentFilter(p.key)}
              >
                {p.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={countryFilter === 'all'} onClick={() => setCountryFilter('all')}>
              All countries
            </FilterChip>
            {countryOptions.map((c) => (
              <FilterChip
                key={c.code}
                active={countryFilter === c.code}
                onClick={() => setCountryFilter(c.code)}
              >
                {c.flag} {c.code}
              </FilterChip>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm">Ticket queue</CardTitle>
            <CardDescription className="text-xs">
              Pick a case to review its refund rails.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-370px)] space-y-2 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No cases match your filters.
              </p>
            ) : (
              filtered.map((c) => {
                const isActive = selected?.id === c.id;
                const Icon = paymentIcon(c.components[0]?.paymentKey ?? '');
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-surface-subtle',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{c.countryFlag}</span>
                        <span className="font-medium text-foreground">{c.caseNumber}</span>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px]', statusTone(c.status))}>
                        {c.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="mt-1.5 text-sm font-medium leading-tight">{c.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.brandName} · {c.orderNumber}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        <span>{c.components[0]?.paymentLabel ?? '—'}</span>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">
                        {c.refundAmount.toFixed(2)} {c.currency}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {selected ? (
          <CaseDetail c={selected} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Select a case from the list to see details.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-surface-subtle',
      )}
    >
      {children}
    </button>
  );
}

function CaseDetail({ c }: { c: PoolCase }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {c.countryFlag} {c.countryName}
                </span>
                <span>·</span>
                <Building2 className="h-3 w-3" />
                <span>{c.brandName}</span>
              </div>
              <CardTitle className="mt-1 text-xl">{c.caseNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">{c.rootCauseSummary ?? '—'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn('text-xs', statusTone(c.status))}>
                {c.status.replace(/_/g, ' ')}
              </Badge>
              <Link
                href={`/cases/${c.id}`}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium hover:bg-surface-subtle"
              >
                <ExternalLink className="h-3 w-3" /> Open in Cases
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Fact
            label="Refund amount"
            value={`${c.refundAmount.toFixed(2)} ${c.currency}`}
            highlight
          />
          <Fact label="Order amount" value={`${c.orderAmount.toFixed(2)} ${c.currency}`} />
          <Fact label="Order #" value={c.orderNumber} />
          <Fact label="Approved by" value={c.approvedByLabel ?? '—'} />
          <Fact label="Approved at" value={c.approvedAt ?? '—'} />
          <Fact label="Approval batch" value={c.approvalBatchNumber ?? '—'} />
          {c.auraPoints ? (
            <Fact label="Aura points" value={`${c.auraPoints} (${c.auraStatus})`} />
          ) : null}
          {c.externalCaseNumber ? <Fact label="CRM ref" value={c.externalCaseNumber} /> : null}
        </CardContent>
      </Card>

      {/* Customer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{c.customerName}</div>
              <div className="text-xs text-muted-foreground">{c.customerEmail}</div>
            </div>
            <div className="flex items-center gap-2">
              {c.customerPhone ? (
                <>
                  <a
                    href={`tel:${c.customerPhone}`}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-surface-subtle"
                  >
                    <Phone className="h-3 w-3" /> {c.customerPhone}
                  </a>
                  <a
                    href={`https://wa.me/${c.customerPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-surface-subtle"
                  >
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                  </a>
                </>
              ) : null}
              <a
                href={`mailto:${c.customerEmail}`}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs hover:bg-surface-subtle"
              >
                <Mail className="h-3 w-3" /> Email
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Components / ARN */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Refund components</CardTitle>
          <CardDescription className="text-xs">
            Each component is one payment rail. KNET components must be added to a daily KNET batch
            (right column). ARN is filled in once Finance returns the bank&apos;s reference number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {c.components.map((cmp) => {
            const Icon = paymentIcon(cmp.paymentKey);
            return (
              <div
                key={cmp.id}
                className="flex flex-col gap-2 rounded-md border border-border p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      {cmp.paymentLabel}
                      {cmp.last4 ? (
                        <span className="ml-1 text-xs text-muted-foreground">·· {cmp.last4}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {cmp.amount.toFixed(2)} {cmp.currency}
                      {cmp.authCode ? ` · auth ${cmp.authCode}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {cmp.status.replace(/_/g, ' ')}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {cmp.arn ? (
                      <span>
                        ARN <span className="font-mono text-foreground">{cmp.arn}</span>
                      </span>
                    ) : (
                      <span className="text-amber-700">No ARN yet</span>
                    )}
                  </div>
                  {cmp.batchNumber ? (
                    <Link
                      href={`/operations/knet/${cmp.batchId}`}
                      className="text-xs underline-offset-2 hover:underline"
                    >
                      {cmp.batchNumber}
                    </Link>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Not yet batched
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
          {c.auraPoints ? (
            <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Aura points</div>
                  <div className="text-xs text-muted-foreground">{c.auraPoints} points</div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {c.auraStatus}
              </Badge>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="?tab=knet"
              className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-surface-subtle"
            >
              Go to KNET batches
            </Link>
            <Link
              href="?tab=aura"
              className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-surface-subtle"
            >
              Go to Aura batches
            </Link>
            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
              <Link href={`/cases/${c.id}`}>Edit case</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer contact log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Customer contact log</CardTitle>
          <CardDescription className="text-xs">
            Every call, WhatsApp, SMS and email logged against this case.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {c.contactLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">No contact attempts logged yet.</p>
          ) : (
            c.contactLog.map((l) => {
              const channelIcon =
                l.channel === 'Phone' ? Phone : l.channel === 'Email' ? Mail : MessageCircle;
              const Icon = channelIcon;
              return (
                <div
                  key={l.id}
                  className="flex items-start gap-3 rounded-md border border-border p-2"
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-xs">
                      <span className="font-medium">{l.channel}</span>
                      <span className="text-muted-foreground"> · {l.outcome}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {l.whenLabel}
                      {l.agent ? ` · ${l.agent}` : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Approval reply */}
      {c.approvalReply ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Manager approval reply</CardTitle>
            <CardDescription className="text-xs">
              {c.approvalBatchNumber ?? ''} · {c.approvalBatchManagerEmails ?? ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-surface-subtle p-2 text-xs">
              {c.approvalReply}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {c.timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity logged.</p>
          ) : (
            c.timeline.map((e) => {
              const isComplete = e.kind.includes('refund') || e.kind === 'batch.replied';
              const Icon = isComplete ? CheckCircle2 : Clock;
              return (
                <div key={e.id} className="flex items-start gap-2 text-xs">
                  <Icon
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5',
                      isComplete ? 'text-emerald-600' : 'text-muted-foreground',
                    )}
                  />
                  <div>
                    <div className="text-foreground">{e.message}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {e.whenLabel}
                      {e.actor ? ` · ${e.actor}` : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('text-sm', highlight ? 'font-semibold' : '')}>{value}</div>
    </div>
  );
}
