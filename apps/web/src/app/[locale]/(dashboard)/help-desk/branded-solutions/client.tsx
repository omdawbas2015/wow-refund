'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search as SearchIcon, ChevronRight, Copy as CopyIcon, Check, Mail, MessageSquare, CheckCircle2, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusKey =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_SUPERVISOR'
  | 'WAITING_FOR_CUSTOMER'
  | 'CLOSED'
  | 'CANCELLED';

interface Row {
  id: string;
  ticketRef: string;
  countryName: string;
  cityName: string | null;
  customerName: string;
  storeName: string;
  location: string | null;
  submitterName: string;
  contactNumber: string;
  email: string;
  machineModel: string;
  issueType: string;
  status: StatusKey;
  mrNumber: string | null;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  closedAt: string | null;
  assignmentReason: string | null;
  assignedTo: { id: string; name: string; email: string; isAvailable: boolean } | null;
  closedBy: { id: string; name: string } | null;
}

interface Supervisor {
  id: string;
  countryName: string;
  name: string;
  email: string;
}

interface CurrentUser {
  id: string;
  name: string;
  isAvailable: boolean;
  availableSince: string | null;
}

interface OnlineAgent {
  id: string;
  name: string;
  email: string;
  availableSince: string | null;
}

interface Props {
  initialRows: Row[];
  supervisors: Supervisor[];
  currentUser: CurrentUser;
}

const STATUS_STYLE: Record<StatusKey, { label: string; tone: string; dot: string }> = {
  PENDING: { label: 'Pending', tone: 'bg-amber-50 text-amber-900 border-amber-200', dot: 'bg-amber-500' },
  IN_PROGRESS: { label: 'In progress', tone: 'bg-blue-50 text-blue-900 border-blue-200', dot: 'bg-blue-500' },
  WAITING_FOR_SUPERVISOR: { label: 'Waiting · Supervisor', tone: 'bg-purple-50 text-purple-900 border-purple-200', dot: 'bg-purple-500' },
  WAITING_FOR_CUSTOMER: { label: 'Waiting · Customer', tone: 'bg-orange-50 text-orange-900 border-orange-200', dot: 'bg-orange-500' },
  CLOSED: { label: 'Closed', tone: 'bg-emerald-50 text-emerald-900 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-zinc-50 text-zinc-700 border-zinc-200', dot: 'bg-zinc-400' },
};

const QUICK_FILTERS: { key: 'OPEN' | 'MINE' | StatusKey | 'ALL'; label: string }[] = [
  { key: 'OPEN', label: 'Open' },
  { key: 'MINE', label: 'Mine' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'WAITING_FOR_SUPERVISOR', label: 'Waiting · Sup' },
  { key: 'WAITING_FOR_CUSTOMER', label: 'Waiting · Cust' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'ALL', label: 'All' },
];

function timeAgo(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function BrandedSolutionsClient({ initialRows, supervisors, currentUser }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'MINE' | StatusKey>('OPEN');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialRows[0]?.id ?? null);
  const [now, setNow] = useState(Date.now());
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);

  // ── Live updates via SSE ────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/branded-solutions/stream');
    es.addEventListener('maintenance.created', () => refreshList().catch(() => {}));
    es.addEventListener('maintenance.updated', () => refreshList().catch(() => {}));
    es.addEventListener('agent.presence', () => loadOnline().catch(() => {}));
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void loadOnline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshList() {
    const res = await fetch('/api/branded-solutions?limit=200', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { rows: Row[] };
    setRows(json.rows);
  }

  async function loadOnline() {
    const res = await fetch('/api/branded-solutions/online-agents', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { agents: OnlineAgent[] };
    setOnlineAgents(json.agents);
  }

  // Filtering — server-side is unindexed for simplicity, so we filter
  // in-memory across the 200-row cap. Counters drive the chip badges.
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      OPEN: 0, MINE: 0, PENDING: 0, IN_PROGRESS: 0,
      WAITING_FOR_SUPERVISOR: 0, WAITING_FOR_CUSTOMER: 0, CLOSED: 0, ALL: rows.length,
    };
    for (const r of rows) {
      if (r.status !== 'CLOSED' && r.status !== 'CANCELLED') c['OPEN']! += 1;
      if (r.assignedTo?.id === currentUser.id) c['MINE']! += 1;
      c[r.status] = (c[r.status] ?? 0) + 1;
    }
    return c;
  }, [rows, currentUser.id]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === 'OPEN') list = list.filter((r) => r.status !== 'CLOSED' && r.status !== 'CANCELLED');
    else if (filter === 'MINE') list = list.filter((r) => r.assignedTo?.id === currentUser.id);
    else if (filter !== 'ALL') list = list.filter((r) => r.status === filter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((r) =>
        [r.ticketRef, r.customerName, r.storeName, r.email, r.contactNumber, r.machineModel, r.countryName, r.mrNumber ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }
    return list;
  }, [rows, filter, q, currentUser.id]);

  // Auto-fix stale selection when filter excludes the selected ticket.
  useEffect(() => {
    if (!filtered.find((r) => r.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="px-4 py-3">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-display-md font-semibold tracking-tight text-heading">Branded Solutions</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Maintenance requests received from customers via the Microsoft Form. Live pool — round-robin assigns
            new tickets to Available agents.
          </p>
        </div>
        <OnlineAgentsRow agents={onlineAgents} currentUserId={currentUser.id} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm flex-1 min-w-[220px]">
              <SearchIcon className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ticket, customer, store, MR #…"
                className="h-9 min-w-0 ps-8"
              />
            </div>
            <div className="ms-auto text-[11px] text-muted-foreground tabular-nums">
              {filtered.length} / {rows.length}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {QUICK_FILTERS.map((f) => (
              <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
                <span
                  className={cn(
                    'ms-1.5 inline-block rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                    filter === f.key ? 'bg-white/25' : 'bg-surface-subtle',
                  )}
                >
                  {counts[f.key] ?? 0}
                </span>
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="grid min-h-[640px] md:grid-cols-[minmax(320px,380px)_1fr]">
          <div className="border-b border-border md:border-b-0 md:border-e">
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No tickets match your filters.</p>
              ) : (
                filtered.map((r) => (
                  <QueueRow key={r.id} r={r} active={selected?.id === r.id} onClick={() => setSelectedId(r.id)} now={now} />
                ))
              )}
            </div>
          </div>
          <div>
            {selected ? (
              <Workbench
                key={selected.id}
                row={selected}
                supervisors={supervisors}
                currentUser={currentUser}
                onChanged={() => refreshList()}
              />
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">Select a ticket to work on it.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Online agents row — small avatars + green dot for everyone Available
// ───────────────────────────────────────────────────────────────────

function OnlineAgentsRow({ agents, currentUserId }: { agents: OnlineAgent[]; currentUserId: string }) {
  if (agents.length === 0) {
    return (
      <span className="rounded-pill border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-muted-foreground">
        No agents online
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Online</span>
      <div className="flex -space-x-1.5">
        {agents.slice(0, 6).map((a) => {
          const initial = (a.name || a.email).charAt(0).toUpperCase();
          const isMe = a.id === currentUserId;
          return (
            <span
              key={a.id}
              title={`${a.name}${isMe ? ' (you)' : ''} — Available`}
              className={cn(
                'relative inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold',
                isMe ? 'border-emerald-500 bg-emerald-100 text-emerald-900' : 'border-white bg-zinc-100 text-zinc-700',
              )}
            >
              {initial}
              <span className="absolute -bottom-0 -right-0 h-2 w-2 rounded-full border border-white bg-emerald-500" />
            </span>
          );
        })}
      </div>
      {agents.length > 6 && (
        <span className="text-[11px] text-muted-foreground">+{agents.length - 6}</span>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Queue row — same shape as the Refund pool
// ───────────────────────────────────────────────────────────────────

function QueueRow({ r, active, onClick, now }: { r: Row; active: boolean; onClick: () => void; now: number }) {
  const status = STATUS_STYLE[r.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full border-b border-border px-3 py-2.5 text-start transition-colors',
        active ? 'bg-primary/5' : 'hover:bg-surface-muted',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11.5px] font-semibold text-heading">{r.ticketRef}</span>
        <span className={cn('inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.5 text-[10px] font-semibold', status.tone)}>
          <span className={cn('h-1 w-1 rounded-full', status.dot)} />
          {status.label}
        </span>
      </div>
      <div className="mt-1 truncate text-[12.5px] font-medium text-foreground">{r.customerName}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {r.storeName} · {r.countryName}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] text-muted-foreground">
          {r.assignedTo ? (
            <>
              <span className={cn('me-1 inline-block h-1.5 w-1.5 rounded-full', r.assignedTo.isAvailable ? 'bg-emerald-500' : 'bg-zinc-300')} />
              {r.assignedTo.name}
            </>
          ) : (
            'Unassigned'
          )}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">{timeAgo(r.createdAt, now)}</span>
      </div>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────
// Workbench — selected ticket detail + 4 actions
// ───────────────────────────────────────────────────────────────────

function Workbench({
  row,
  supervisors,
  currentUser,
  onChanged,
}: {
  row: Row;
  supervisors: Supervisor[];
  currentUser: CurrentUser;
  onChanged: () => void | Promise<void>;
}) {
  const status = STATUS_STYLE[row.status];
  const canAct = currentUser.isAvailable;
  const isMine = row.assignedTo?.id === currentUser.id;
  const isClosed = row.status === 'CLOSED' || row.status === 'CANCELLED';

  const [busy, setBusy] = useState<null | 'mr' | 'sup' | 'cust' | 'claim'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [mrNumber, setMrNumber] = useState('');
  const [supEmails, setSupEmails] = useState<string[]>(() => {
    const country = row.countryName.trim().toLowerCase();
    return supervisors
      .filter((s) => s.countryName.trim().toLowerCase() === country)
      .map((s) => s.email);
  });
  const [supEmailDraft, setSupEmailDraft] = useState('');
  const [supNote, setSupNote] = useState('');
  const [clarifyText, setClarifyText] = useState(
    'Kindly please advise for the right location on Archibus to be able to raise the maintenance request.',
  );
  const [copied, setCopied] = useState(false);

  async function call(path: string, body: Record<string, unknown>, label: typeof busy) {
    setBusy(label);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/branded-solutions/${row.id}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error((j['message'] as string) ?? (j['error'] as string) ?? `HTTP ${res.status}`);
      setInfo(label === 'mr' ? 'Closed and emailed customer.'
        : label === 'sup' ? 'Sent to supervisor.'
        : label === 'cust' ? 'Asked customer for clarification.'
        : 'Claimed from pool.');
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  function copyTicket() {
    const text =
      `Issue Description: ${row.issueType}\n` +
      `Machine Model: ${row.machineModel}\n` +
      `Contact Number: ${row.contactNumber}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function addSupEmail() {
    const e = supEmailDraft.trim().toLowerCase();
    if (!e || supEmails.includes(e)) return;
    setSupEmails([...supEmails, e]);
    setSupEmailDraft('');
  }
  function removeSupEmail(e: string) {
    setSupEmails(supEmails.filter((x) => x !== e));
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold text-heading">{row.ticketRef}</span>
            <span className={cn('inline-flex items-center gap-1 rounded-pill border px-1.5 py-0.5 text-[10.5px] font-semibold', status.tone)}>
              <span className={cn('h-1 w-1 rounded-full', status.dot)} />
              {status.label}
            </span>
            {row.mrNumber && (
              <Badge variant="outline" className="font-mono text-[10.5px]">MR #{row.mrNumber}</Badge>
            )}
          </div>
          <div className="mt-1 truncate text-[13px] font-medium text-foreground">{row.customerName}</div>
          <div className="text-[11.5px] text-muted-foreground">
            {row.storeName} · {row.cityName ? `${row.cityName} · ` : ''}{row.countryName}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={copyTicket} className="shrink-0 gap-1">
          {copied ? <Check className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy for Archibus'}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-900">{error}</div>}
        {info && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">{info}</div>}

        {/* Form data — clean 2-column grid */}
        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Request details</CardTitle>
          </CardHeader>
          <div className="grid gap-x-6 gap-y-2 px-6 pb-4 text-[12.5px] sm:grid-cols-2">
            <Field label="Submitter" value={row.submitterName} />
            <Field label="Contact" value={row.contactNumber} mono />
            <Field label="Email" value={row.email} mono />
            <Field label="Machine model" value={row.machineModel} />
            <Field label="Issue" value={row.issueType} wide />
            <Field label="Location" value={row.location ?? '—'} wide link />
          </div>
        </Card>

        {/* Assignment */}
        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">Assignment</CardTitle>
          </CardHeader>
          <div className="grid gap-x-6 gap-y-2 px-6 pb-4 text-[12.5px] sm:grid-cols-2">
            <Field label="Assigned to" value={row.assignedTo?.name ?? 'Unassigned'} />
            <Field label="Reason" value={row.assignmentReason ?? '—'} wide />
            <Field label="Created" value={new Date(row.createdAt).toLocaleString()} />
            {row.closedAt && <Field label="Closed" value={new Date(row.closedAt).toLocaleString()} />}
          </div>
        </Card>

        {/* Actions — only visible while open. Disabled when Away. */}
        {!isClosed && (
          <>
            {!canAct && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                You are Offline. Use the banner above to go Available before sending or closing.
              </div>
            )}

            {row.status === 'PENDING' && !isMine && (
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-[13px]">
                    <Hand className="h-3.5 w-3.5" /> Claim from pool
                  </CardTitle>
                </CardHeader>
                <div className="space-y-2 px-6 pb-4 text-[12.5px]">
                  <p className="text-muted-foreground">No agent is on this ticket yet — claim it to start working.</p>
                  <Button size="sm" onClick={() => call('claim', {}, 'claim')} disabled={!canAct || busy !== null}>
                    {busy === 'claim' ? 'Claiming…' : 'Claim'}
                  </Button>
                </div>
              </Card>
            )}

            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Submit Archibus MR # &amp; close
                </CardTitle>
              </CardHeader>
              <div className="space-y-2 px-6 pb-4 text-[12.5px]">
                <p className="text-muted-foreground">
                  Paste the MR # generated by Archibus. The ticket will close and a confirmation email will be
                  sent to the customer at <span className="font-mono">{row.email}</span>.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={mrNumber}
                    onChange={(e) => setMrNumber(e.target.value)}
                    placeholder="e.g. 2014475035"
                    className="h-8 max-w-xs text-[12.5px]"
                  />
                  <Button
                    size="sm"
                    onClick={() => call('close', { mrNumber: mrNumber.trim() }, 'mr')}
                    disabled={!canAct || !mrNumber.trim() || busy !== null}
                  >
                    {busy === 'mr' ? 'Closing…' : 'Submit & close'}
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <Mail className="h-3.5 w-3.5" /> Send to country supervisor
                </CardTitle>
              </CardHeader>
              <div className="space-y-2 px-6 pb-4 text-[12.5px]">
                <p className="text-muted-foreground">
                  Forwards the full request details to the maintenance supervisor for the country to confirm the right
                  location on Archibus. You can address multiple supervisors — they will all be CC&apos;d.
                </p>
                {supEmails.length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11.5px] text-amber-900">
                    No supervisor configured for {row.countryName} — add one or type an email below.
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {supEmails.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]">
                      {e}
                      <button onClick={() => removeSupEmail(e)} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${e}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={supEmailDraft}
                    onChange={(e) => setSupEmailDraft(e.target.value)}
                    placeholder="Add another supervisor email"
                    className="h-8 max-w-xs text-[12.5px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSupEmail();
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={addSupEmail} disabled={!supEmailDraft.trim()}>Add</Button>
                </div>
                <Textarea
                  value={supNote}
                  onChange={(e) => setSupNote(e.target.value)}
                  placeholder="Optional note to the supervisor (e.g. customer mentioned mall name but not store no.)"
                  className="text-[12.5px]"
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={() => call('send-to-supervisor', { supervisorEmails: supEmails, note: supNote.trim() || null }, 'sup')}
                  disabled={!canAct || supEmails.length === 0 || busy !== null}
                >
                  {busy === 'sup' ? 'Sending…' : 'Send to supervisor'}
                </Button>
              </div>
            </Card>

            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <MessageSquare className="h-3.5 w-3.5" /> Ask customer for clarification
                </CardTitle>
              </CardHeader>
              <div className="space-y-2 px-6 pb-4 text-[12.5px]">
                <p className="text-muted-foreground">
                  Sends a polite email to the customer at <span className="font-mono">{row.email}</span> asking for more
                  details on the location/store name. Status moves to <em>Waiting · Customer</em>.
                </p>
                <Textarea
                  value={clarifyText}
                  onChange={(e) => setClarifyText(e.target.value)}
                  className="text-[12.5px]"
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={() => call('clarify-customer', { question: clarifyText.trim() }, 'cust')}
                  disabled={!canAct || !clarifyText.trim() || busy !== null}
                >
                  {busy === 'cust' ? 'Sending…' : 'Send clarification'}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center rounded-pill border px-3 text-[11.5px] font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-surface text-foreground hover:bg-surface-muted',
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, value, mono, wide, link }: { label: string; value: string; mono?: boolean; wide?: boolean; link?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-2')}>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 break-words text-foreground', mono && 'font-mono')}>
        {link && value !== '—' && /^https?:\/\//i.test(value) ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-blue-700 underline hover:text-blue-900">
            {value}
          </a>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

// Suppress unused-but-future-needed `ChevronRight` import (kept for tree-shake parity).
void ChevronRight;
