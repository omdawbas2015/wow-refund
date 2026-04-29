'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  addCaseNoteAction,
  completeRefundAction,
  markCustomerCallAction,
  setComponentArnAction,
} from '@/app/actions/cases';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ComponentStatusBadge } from '@/components/ui/case-status-badge';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { PaymentMethodIcons } from '@/components/ui/payment-method-icons';
import { Textarea } from '@/components/ui/textarea';
import { AuraLogo } from '@/components/ui/aura-logo';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Hash,
  PhoneCall,
  PhoneOff,
  Search as SearchIcon,
  Send,
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

export type NextAction =
  | 'ENTER_ARN'
  | 'AWAIT_BATCH'
  | 'COMPLETE'
  | 'CALL_CUSTOMER'
  | 'DONE';

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
  approvedAtIso: string | null;
  ageHours: number;
  approvedByLabel: string | null;
  approvalBatchNumber: string | null;
  approvalBatchManagerEmails: string | null;
  approvalReply: string | null;
  rootCauseSummary: string | null;
  auraPoints: number | null;
  auraStatus: string;
  customerCallStatus: 'NOT_APPLICABLE' | 'PENDING' | 'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED';
  customerCallUpdatedAt: string | null;
  pendingArns: number;
  allArnsIn: boolean;
  nextAction: NextAction;
  components: PoolCaseComponent[];
  contactLog: {
    id: string;
    channel: string;
    outcome: string;
    whenLabel: string;
    agent: string | null;
  }[];
  notes: {
    id: string;
    body: string;
    authorName: string;
    whenLabel: string;
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
  canExecute: boolean;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function money(amount: number, currency: string) {
  return `${amount.toFixed(2)} ${currency}`;
}

function nextActionMeta(a: NextAction): { label: string; tone: string } {
  switch (a) {
    case 'ENTER_ARN':
      return { label: 'Enter ARN', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'AWAIT_BATCH':
      return { label: 'Awaiting batch', tone: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'COMPLETE':
      return {
        label: 'Ready to complete',
        tone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    case 'CALL_CUSTOMER':
      return { label: 'Call customer', tone: 'bg-violet-50 text-violet-700 border-violet-200' };
    case 'DONE':
      return { label: 'Done', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
}

function ageBadge(hours: number) {
  if (hours < 1) return { label: 'just now', tone: 'text-muted-foreground' };
  if (hours < 24) return { label: `${hours}h`, tone: 'text-muted-foreground' };
  const days = Math.round(hours / 24);
  if (days >= 3) {
    return { label: `${days}d`, tone: 'text-rose-600 font-semibold' };
  }
  return { label: `${days}d`, tone: 'text-muted-foreground' };
}

type QuickFilter = 'all' | 'ENTER_ARN' | 'CALL_CUSTOMER' | 'COMPLETE' | 'AWAIT_BATCH' | 'DONE';

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ENTER_ARN', label: 'Awaiting ARN' },
  { key: 'COMPLETE', label: 'Ready to complete' },
  { key: 'CALL_CUSTOMER', label: 'Awaiting call' },
  { key: 'AWAIT_BATCH', label: 'In batch' },
  { key: 'DONE', label: 'Done' },
];

// ---------------------------------------------------------------------------
// Panel — split view: prioritized queue + operator workbench
// ---------------------------------------------------------------------------

export function RefundPoolPanel({ cases, canExecute }: RefundPoolPanelProps) {
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<QuickFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);

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

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (quick !== 'all' && c.nextAction !== quick) return false;
      if (paymentFilter !== 'all') {
        const has = c.components.some((cmp) => cmp.paymentKey === paymentFilter);
        if (!has) return false;
      }
      if (countryFilter !== 'all' && c.countryCode !== countryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const paymentText = c.components
          .flatMap((cmp) => [cmp.paymentLabel, cmp.paymentKey, cmp.authCode ?? '', cmp.arn ?? ''])
          .join(' ');
        const hay = [
          c.caseNumber,
          c.externalCaseNumber ?? '',
          c.customerName,
          c.customerEmail,
          c.orderNumber,
          c.customerPhone ?? '',
          paymentText,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cases, quick, paymentFilter, countryFilter, search]);

  // Keep selection within the filtered set so the inspector always reflects
  // what's visible in the list.
  useEffect(() => {
    if (!filtered.find((c) => c.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  // Counters on the quick-filter chips so the operator immediately sees
  // how many tickets each action has.
  const counts = useMemo(() => {
    const c = { ENTER_ARN: 0, AWAIT_BATCH: 0, COMPLETE: 0, CALL_CUSTOMER: 0, DONE: 0 };
    cases.forEach((x) => {
      c[x.nextAction] += 1;
    });
    return c;
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
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      {/* Toolbar — search + smart filters row 1, rail + country chips row 2 */}
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <SearchIcon className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ticket, customer, ARN…"
              className="h-9 min-w-0 ps-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_FILTERS.map((f) => (
              <FilterChip
                key={f.key}
                active={quick === f.key}
                onClick={() => setQuick(f.key)}
              >
                {f.label}
                {f.key !== 'all' && (
                  <span
                    className={cn(
                      'ms-1.5 inline-block rounded-full px-1.5 text-[10px] font-semibold',
                      quick === f.key ? 'bg-white/25' : 'bg-surface-subtle',
                    )}
                  >
                    {counts[f.key as keyof typeof counts]}
                  </span>
                )}
              </FilterChip>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
            <span>{filtered.length}</span> / <span>{cases.length}</span>
          </div>
        </div>
        {(paymentOptions.length > 1 || countryOptions.length > 1) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={paymentFilter === 'all'} onClick={() => setPaymentFilter('all')}>
              Any rail
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
            <span className="mx-1 h-4 w-px bg-border" />
            <FilterChip active={countryFilter === 'all'} onClick={() => setCountryFilter('all')}>
              Any country
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
        )}
      </div>

      {/* Split: queue | workbench */}
      <div className="grid min-h-[680px] lg:grid-cols-[minmax(420px,460px)_1fr]">
        <div className="border-b border-border lg:border-b-0 lg:border-e">
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No cases match your filters.
              </p>
            ) : (
              filtered.map((c) => (
                <QueueRow
                  key={c.id}
                  c={c}
                  active={selected?.id === c.id}
                  onClick={() => setSelectedId(c.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="bg-surface-subtle/40">
          {selected ? (
            <TicketWorkbench key={selected.id} c={selected} canExecute={canExecute} />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Select a ticket to work on it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue row — dense, SLA-aware, scan-friendly
// ---------------------------------------------------------------------------

function QueueRow({
  c,
  active,
  onClick,
}: {
  c: PoolCase;
  active: boolean;
  onClick: () => void;
}) {
  const next = nextActionMeta(c.nextAction);
  const age = ageBadge(c.ageHours);
  const isAged = c.ageHours >= 72;
  const methods = c.components.map((cmp) => ({
    key: cmp.paymentKey,
    label: cmp.paymentLabel,
  }));
  const uniqMethods = methods.filter(
    (m, i, arr) => arr.findIndex((x) => x.key === m.key) === i,
  );

  return (
    <button
      onClick={onClick}
      className={cn(
        'block w-full border-b border-border px-4 py-3 text-start transition-colors last:border-b-0',
        active ? 'bg-primary/5' : 'bg-card hover:bg-surface-subtle',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{c.countryFlag}</span>
            <span className="truncate font-mono text-sm font-semibold text-heading">
              {c.externalCaseNumber || c.caseNumber}
            </span>
            {isAged && (
              <AlertTriangle className="h-3.5 w-3.5 flex-none text-rose-500" aria-hidden />
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {c.customerName} · {c.brandName}
          </div>
        </div>
        <div className="text-end">
          <div className="text-sm font-semibold tabular-nums text-heading">
            {money(c.refundAmount, c.currency)}
          </div>
          <div className={cn('mt-0.5 flex items-center justify-end gap-1 text-[11px]', age.tone)}>
            <Clock className="h-3 w-3" />
            {age.label}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <PaymentMethodIcons methods={uniqMethods} size="sm" showLabel={false} />
        </div>
        <span
          className={cn(
            'whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium',
            next.tone,
          )}
        >
          {next.label}
          {c.nextAction === 'ENTER_ARN' && c.pendingArns > 1 ? ` (${c.pendingArns})` : ''}
          <ChevronRight className="ms-0.5 inline-block h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Workbench — every case-detail action, inline
// ---------------------------------------------------------------------------

function TicketWorkbench({ c, canExecute }: { c: PoolCase; canExecute: boolean }) {
  const next = nextActionMeta(c.nextAction);
  const age = ageBadge(c.ageHours);
  const inExecutionStage =
    c.status === 'APPROVED' || c.status === 'IN_EXECUTION' || c.status === 'PARTIALLY_REFUNDED';

  return (
    <aside className="sticky top-0 max-h-[calc(100vh-210px)] overflow-y-auto p-4">
      {/* Header strip */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{c.countryFlag}</span>
            <span className="truncate">{c.countryName}</span>
            <span>·</span>
            <span className="truncate">{c.brandName}</span>
            <span>·</span>
            <span className="truncate">Order {c.orderNumber}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-lg font-semibold text-heading">
              {c.externalCaseNumber || c.caseNumber}
            </h2>
            <CopyButton
              value={c.externalCaseNumber || c.caseNumber}
              size="sm"
              label="Copy case number"
            />
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                next.tone,
              )}
            >
              {next.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Refund</span>
            <span className="font-mono font-semibold text-heading">
              {money(c.refundAmount, c.currency)}
            </span>
            <span>·</span>
            <span className={cn('inline-flex items-center gap-1', age.tone)}>
              <Clock className="h-3 w-3" />
              approved {c.approvedAt ?? '—'}
            </span>
            {c.approvedByLabel && (
              <>
                <span>·</span>
                <span>by {c.approvedByLabel}</span>
              </>
            )}
          </div>
        </div>
        <Link
          href={`/cases/${c.id}`}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium hover:bg-surface-subtle"
        >
          <ExternalLink className="h-3 w-3" /> Open full case
        </Link>
      </div>

      {/* Customer strip — Call is the only action surfaced here; the
          refund email is sent automatically by completeRefundAction, so
          there's no need for an email shortcut. */}
      <section className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card p-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Customer
          </div>
          <div className="truncate text-sm font-medium text-heading">{c.customerName}</div>
          <div className="truncate text-xs text-muted-foreground">{c.customerEmail}</div>
        </div>
        {c.customerPhone && (
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Phone
            </div>
            <div className="flex items-center gap-1.5 font-mono text-sm font-medium text-heading">
              {c.customerPhone}
              <CopyButton value={c.customerPhone} size="xs" label="Copy phone" />
            </div>
          </div>
        )}
        <div className="ms-auto flex items-center gap-2">
          {c.customerPhone ? (
            <a
              href={`tel:${c.customerPhone}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <PhoneCall className="h-3.5 w-3.5" /> Call customer
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">No phone on file</span>
          )}
        </div>
      </section>

      {/* Refund rails — the main work area */}
      <section className="mb-4 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Refund rails
          </div>
          <div className="text-xs text-muted-foreground">
            {c.components.length - c.pendingArns} / {c.components.length} with ARN
          </div>
        </div>
        <div className="divide-y divide-border">
          {c.components.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No payment components.</p>
          ) : (
            c.components.map((cmp) => (
              <RailRow
                key={cmp.id}
                caseId={c.id}
                component={cmp}
                canExecute={canExecute && inExecutionStage}
              />
            ))
          )}
          {c.auraPoints ? (
            <div className="flex flex-wrap items-center gap-3 px-3 py-3">
              <AuraLogo size={20} />
              <div className="font-mono text-sm font-medium">
                {c.auraPoints.toLocaleString()}{' '}
                <span className="text-xs font-normal text-muted-foreground">points</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {c.auraStatus.replace(/_/g, ' ')}
              </Badge>
            </div>
          ) : null}
        </div>
        {canExecute && c.status !== 'REFUNDED' && (
          <div className="border-t border-border px-3 py-2.5">
            <CompleteRefundButton
              caseId={c.id}
              allArnsIn={c.allArnsIn}
              pendingArns={c.pendingArns}
            />
          </div>
        )}
      </section>

      {/* Customer call follow-up — persists after the refund email was sent */}
      {(c.status === 'REFUNDED' || c.status === 'PARTIALLY_REFUNDED') &&
        c.customerCallStatus !== 'NOT_APPLICABLE' && (
          <section className="mb-4">
            <CallFollowUp
              caseId={c.id}
              status={c.customerCallStatus}
              updatedAt={c.customerCallUpdatedAt}
              canExecute={canExecute}
            />
          </section>
        )}

      {/* Notes */}
      <section className="mb-4 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </div>
          <Link
            href={`/cases/${c.id}?tab=notes`}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-border">
          {c.notes.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">No notes yet.</p>
          ) : (
            c.notes.map((n) => (
              <div key={n.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{n.authorName}</span>
                  <span>{n.whenLabel}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border p-2.5">
          <AddNoteForm caseId={c.id} />
        </div>
      </section>

      {/* Context: approval + root cause + last activity */}
      <section className="mb-4 rounded-xl border border-border bg-card p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Context
        </div>
        <dl className="grid gap-y-1.5 text-xs sm:grid-cols-2 sm:gap-x-4">
          {c.approvalBatchNumber && (
            <Fact label="Approval batch" value={c.approvalBatchNumber} mono />
          )}
          {c.rootCauseSummary && <Fact label="Root cause" value={c.rootCauseSummary} />}
          {c.timeline[0] && (
            <Fact
              label="Last activity"
              value={`${c.timeline[0].message} · ${c.timeline[0].whenLabel}`}
            />
          )}
          {c.contactLog[0] && (
            <Fact
              label="Last contact"
              value={`${c.contactLog[0].channel}: ${c.contactLog[0].outcome} · ${c.contactLog[0].whenLabel}`}
            />
          )}
        </dl>
      </section>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Rail row — inline ARN entry, matches /cases/{id} PaymentComponentRow
// ---------------------------------------------------------------------------

function RailRow({
  caseId,
  component,
  canExecute,
}: {
  caseId: string;
  component: PoolCaseComponent;
  canExecute: boolean;
}) {
  const router = useRouter();
  const [arnDraft, setArnDraft] = useState(component.arn ?? '');
  const [editing, setEditing] = useState(!component.arn);
  const [isPending, startTransition] = useTransition();

  // Reset the draft whenever the underlying component changes (e.g. the
  // operator picked a different ticket in the list).
  useEffect(() => {
    setArnDraft(component.arn ?? '');
    setEditing(!component.arn);
  }, [component.id, component.arn]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const arn = arnDraft.trim();
    if (arn.length < 3) {
      toast.error('Please enter a valid ARN.');
      return;
    }
    startTransition(async () => {
      const result = await setComponentArnAction({
        caseId,
        componentId: component.id,
        arn,
      });
      if (result.ok) {
        toast.success('ARN saved');
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Could not save ARN');
      }
    });
  }

  return (
    <div className="px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PaymentMethodIcons
          methods={[{ key: component.paymentKey, label: component.paymentLabel }]}
          size="sm"
        />
        <div className="font-mono text-sm font-medium tabular-nums">
          {money(component.amount, component.currency)}
        </div>
        {component.authCode && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Auth</span>
            <span className="font-mono text-foreground">{component.authCode}</span>
            <CopyButton value={component.authCode} size="xs" label="Copy auth" />
          </div>
        )}
        {component.last4 && (
          <div className="text-xs text-muted-foreground">•••• {component.last4}</div>
        )}
        {component.batchNumber && (
          <Link
            href={`/operations/knet/${component.batchId}`}
            className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 font-mono text-[11px] text-sky-700 hover:bg-sky-100"
          >
            <Hash className="h-3 w-3" />
            {component.batchNumber}
          </Link>
        )}
        <div className="ms-auto">
          <ComponentStatusBadge status={component.status} />
        </div>
      </div>

      {component.arn && !editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-emerald-700">ARN</span>
          <span className="font-mono font-medium text-foreground">{component.arn}</span>
          <CopyButton value={component.arn} size="xs" label="Copy ARN" />
          {canExecute && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ms-1 h-6 px-1.5 text-[11px]"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>
      ) : canExecute ? (
        <form
          onSubmit={save}
          className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-subtle/40 p-2"
        >
          <label
            htmlFor={`pool-arn-${component.id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            ARN
          </label>
          <input
            id={`pool-arn-${component.id}`}
            value={arnDraft}
            onChange={(e) => setArnDraft(e.target.value)}
            placeholder={
              component.batchNumber
                ? `Enter ARN received from ${component.paymentLabel} batch`
                : `Enter ${component.paymentLabel} ARN`
            }
            className="min-w-[14rem] flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="off"
          />
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save ARN'}
          </Button>
          {component.arn && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setArnDraft(component.arn ?? '');
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          )}
        </form>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">
          No ARN yet. {component.batchNumber ? 'Waiting on batch response.' : ''}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Complete refund — becomes the primary CTA once every ARN is entered
// ---------------------------------------------------------------------------

function CompleteRefundButton({
  caseId,
  allArnsIn,
  pendingArns,
}: {
  caseId: string;
  allArnsIn: boolean;
  pendingArns: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await completeRefundAction({ caseId });
      if (result.ok) {
        toast.success('Refund completed and customer notified');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Could not complete the refund');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-xs text-muted-foreground">
        {allArnsIn
          ? 'All ARNs recorded — notify the customer and mark the case refunded.'
          : `${pendingArns} rail(s) still need an ARN before the refund can be completed.`}
      </div>
      <Button
        size="sm"
        variant={allArnsIn ? 'default' : 'outline'}
        disabled={!allArnsIn || isPending}
        onClick={run}
        className="gap-1.5"
      >
        <CheckCircle2 className="h-4 w-4" />
        {isPending ? 'Completing…' : 'Complete refund'}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer call follow-up — identical widget to /cases/{id}
// ---------------------------------------------------------------------------

function CallFollowUp({
  caseId,
  status,
  updatedAt,
  canExecute,
}: {
  caseId: string;
  status: 'NOT_APPLICABLE' | 'PENDING' | 'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED';
  updatedAt: string | null;
  canExecute: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const showButtons = canExecute && (status === 'PENDING' || editing);

  function record(outcome: 'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED') {
    startTransition(async () => {
      const result = await markCustomerCallAction({ caseId, outcome });
      if (result.ok) {
        toast.success('Call outcome recorded');
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Could not record the outcome');
      }
    });
  }

  if (showButtons) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 dark:border-amber-500/20 dark:bg-amber-500/5">
        <PhoneCall className="h-4 w-4 flex-none text-amber-600 dark:text-amber-400" />
        <div className="flex-1 min-w-0 text-sm text-foreground">
          Confirm the refund with the customer by phone.
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="success" disabled={isPending} onClick={() => record('ANSWERED')}>
            <PhoneCall className="h-4 w-4" /> Answered
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => record('NO_ANSWER')}
          >
            <PhoneOff className="h-4 w-4" /> No answer
          </Button>
          {editing && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  const meta: Record<
    'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED',
    { tone: string; Icon: typeof PhoneCall; title: string; detail: string }
  > = {
    ANSWERED: {
      tone: 'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-300',
      Icon: CheckCircle2,
      title: 'Customer answered',
      detail: 'Refund confirmed by phone.',
    },
    NO_ANSWER: {
      tone: 'border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300',
      Icon: PhoneOff,
      title: 'No answer',
      detail: 'Confirmation email sent to the customer.',
    },
    NOT_NEEDED: {
      tone: 'border-muted bg-surface-subtle text-muted-foreground',
      Icon: PhoneCall,
      title: 'Follow-up skipped',
      detail: 'No call was needed.',
    },
  };
  const m = meta[status as 'ANSWERED' | 'NO_ANSWER' | 'NOT_NEEDED'] ?? meta.NOT_NEEDED;

  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3', m.tone)}>
      <m.Icon className="h-4 w-4 flex-none" />
      <div className="flex-1 min-w-0 text-sm">
        <div className="font-medium text-foreground">{m.title}</div>
        <div className="text-xs text-muted-foreground">
          {m.detail}
          {updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : ''}
        </div>
      </div>
      {canExecute && (
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => setEditing(true)}
          className="text-xs"
        >
          Change
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline note composer — calls addCaseNoteAction without mentions so the
// pool stays a keyboard-friendly quick log.
// ---------------------------------------------------------------------------

function AddNoteForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length === 0) return;
    startTransition(async () => {
      const result = await addCaseNoteAction({
        caseId,
        body: trimmed,
        mentionedUserIds: [],
      });
      if (result.ok) {
        toast.success('Note added');
        setBody('');
        router.refresh();
      } else {
        toast.error(result.error ?? 'Could not add the note');
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex items-start gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Log a quick note (call outcome, escalation…)"
        className="min-h-[52px] flex-1 resize-y text-sm"
      />
      <Button
        type="submit"
        size="sm"
        disabled={isPending || body.trim().length === 0}
        className="mt-0.5 gap-1.5"
      >
        <Send className="h-3.5 w-3.5" />
        {isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

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
        'whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-surface-subtle',
      )}
    >
      {children}
    </button>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn('truncate text-sm text-foreground', mono ? 'font-mono' : '')}>{value}</div>
    </div>
  );
}

