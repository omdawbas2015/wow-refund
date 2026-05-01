'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface Props {
  initialRows: Row[];
  supervisors: Supervisor[];
  currentUser: CurrentUser;
}

// Visual style per status. Kept terse — same palette as the cases-table.
const STATUS_STYLE: Record<StatusKey, { label: string; tone: string }> = {
  PENDING: { label: 'Pending', tone: 'bg-amber-100 text-amber-900 border-amber-200' },
  IN_PROGRESS: { label: 'In progress', tone: 'bg-blue-100 text-blue-900 border-blue-200' },
  WAITING_FOR_SUPERVISOR: { label: 'Waiting · Supervisor', tone: 'bg-purple-100 text-purple-900 border-purple-200' },
  WAITING_FOR_CUSTOMER: { label: 'Waiting · Customer', tone: 'bg-orange-100 text-orange-900 border-orange-200' },
  CLOSED: { label: 'Closed', tone: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
};

export function BrandedSolutionsClient({ initialRows, supervisors, currentUser }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'MINE' | StatusKey>('OPEN');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<CurrentUser>(currentUser);
  const [now, setNow] = useState<number>(() => Date.now());

  // Drawer-local state (collapsed when the drawer closes).
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mrInput, setMrInput] = useState('');
  const [supervisorEmailOverride, setSupervisorEmailOverride] = useState('');
  const [supervisorNote, setSupervisorNote] = useState('');
  const [clarifyText, setClarifyText] = useState('');

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  // ── Live updates via SSE ────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/branded-solutions/stream');
    const onCreated = () => refreshList().catch(() => {});
    const onUpdated = () => refreshList().catch(() => {});
    es.addEventListener('maintenance.created', onCreated);
    es.addEventListener('maintenance.updated', onUpdated);
    es.addEventListener('agent.presence', () => {
      // Patch the open agent's availability badge in row.assignedTo
      // without re-fetching the whole list.
      // No-op for now — refreshList covers this in milliseconds.
    });
    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 1-second tick for the "Available since" timer ───────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function refreshList() {
    const res = await fetch('/api/branded-solutions?limit=200', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { rows: Row[] };
    setRows(json.rows);
  }

  async function refreshSelected() {
    if (!selectedId) return;
    const res = await fetch(`/api/branded-solutions/${selectedId}`, { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as Row;
    setRows((prev) => prev.map((r) => (r.id === json.id ? { ...r, ...json } : r)));
  }

  async function toggleAvailability(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/me/availability', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isAvailable: next }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string; error?: string };
        throw new Error(j.message || j.error || 'Failed to toggle');
      }
      const j = (await res.json()) as { isAvailable: boolean; availableSince: string | null };
      setMe((m) => ({ ...m, isAvailable: j.isAvailable, availableSince: j.availableSince }));
      await refreshList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function postAction(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }
      await Promise.all([refreshSelected(), refreshList()]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      return false;
    } finally {
      setBusy(false);
    }
  }

  // ── Filter + counts ────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      WAITING_FOR_SUPERVISOR: 0,
      WAITING_FOR_CUSTOMER: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };
    rows.forEach((r) => {
      c[r.status] += 1;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const lcq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'OPEN') {
        if (r.status === 'CLOSED' || r.status === 'CANCELLED') return false;
      } else if (filter === 'MINE') {
        if (r.assignedTo?.id !== currentUser.id) return false;
      } else if (filter !== 'ALL') {
        if (r.status !== filter) return false;
      }
      if (lcq.length > 0) {
        const hay = `${r.ticketRef} ${r.customerName} ${r.storeName} ${r.email} ${r.contactNumber} ${r.machineModel} ${r.countryName} ${r.cityName ?? ''} ${r.mrNumber ?? ''}`.toLowerCase();
        if (!hay.includes(lcq)) return false;
      }
      return true;
    });
  }, [rows, filter, q, currentUser.id]);

  // ── Available timer ────────────────────────────────────────────────
  const availableTimer = useMemo(() => {
    if (!me.isAvailable || !me.availableSince) return null;
    const ms = now - new Date(me.availableSince).getTime();
    if (ms < 0) return '0:00:00';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, [me, now]);

  return (
    <div className="px-4 py-3">
      {/* Header bar — title + availability toggle + new-request CTA */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-heading">Branded Solutions</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            External maintenance pool · live from Microsoft Forms via Power Automate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium',
              me.isAvailable
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', me.isAvailable ? 'bg-emerald-500' : 'bg-zinc-400')} />
            {me.isAvailable ? `Available · ${availableTimer}` : 'Away'}
          </span>
          <Button
            size="sm"
            variant={me.isAvailable ? 'outline' : 'default'}
            disabled={busy}
            onClick={() => toggleAvailability(!me.isAvailable)}
          >
            {me.isAvailable ? 'Go Away' : 'Go Available'}
          </Button>
        </div>
      </div>

      {!me.isAvailable && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          You are <strong>Away</strong>. New requests won&apos;t be auto-assigned to you and outbound actions are
          blocked. Click <strong>Go Available</strong> when you&apos;re ready to work.
        </div>
      )}

      {/* Filter chips */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {([
          { k: 'OPEN', label: `Open · ${counts.PENDING + counts.IN_PROGRESS + counts.WAITING_FOR_SUPERVISOR + counts.WAITING_FOR_CUSTOMER}` },
          { k: 'MINE', label: 'Mine' },
          { k: 'PENDING', label: `Pending · ${counts.PENDING}` },
          { k: 'IN_PROGRESS', label: `In progress · ${counts.IN_PROGRESS}` },
          { k: 'WAITING_FOR_SUPERVISOR', label: `Supervisor · ${counts.WAITING_FOR_SUPERVISOR}` },
          { k: 'WAITING_FOR_CUSTOMER', label: `Customer · ${counts.WAITING_FOR_CUSTOMER}` },
          { k: 'CLOSED', label: `Closed · ${counts.CLOSED}` },
          { k: 'ALL', label: 'All' },
        ] as { k: typeof filter; label: string }[]).map((f) => (
          <button
            key={f.k}
            type="button"
            onClick={() => setFilter(f.k)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
              filter === f.k
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent',
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto w-64">
          <Input
            placeholder="Search ticket, customer, store, MR…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-7 text-[12px]"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Ticket</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Country</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Store · Location</th>
                  <th className="px-3 py-2 font-medium">Machine</th>
                  <th className="px-3 py-2 font-medium">Assigned to</th>
                  <th className="px-3 py-2 font-medium">MR #</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                      No tickets match this view.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'cursor-pointer border-b border-border last:border-b-0 align-top hover:bg-accent/40',
                      selectedId === r.id && 'bg-accent/40',
                    )}
                    onClick={() => {
                      setSelectedId(r.id);
                      setMrInput(r.mrNumber ?? '');
                      setError(null);
                    }}
                  >
                    <td className="px-3 py-2 font-mono text-[11.5px]">{r.ticketRef}</td>
                    <td className="px-3 py-2">
                      <Badge className={cn('border', STATUS_STYLE[r.status].tone)}>
                        {STATUS_STYLE[r.status].label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{r.countryName}{r.cityName ? <span className="text-muted-foreground"> · {r.cityName}</span> : null}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.customerName}</div>
                      <div className="text-[11px] text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{r.storeName}</div>
                      {r.location && <div className="text-[11px] text-muted-foreground line-clamp-1">{r.location}</div>}
                    </td>
                    <td className="px-3 py-2">{r.machineModel}</td>
                    <td className="px-3 py-2">
                      {r.assignedTo ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              r.assignedTo.isAvailable ? 'bg-emerald-500' : 'bg-zinc-400',
                            )}
                          />
                          {r.assignedTo.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11.5px]">{r.mrNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-30 flex items-stretch justify-end bg-black/30" onClick={() => setSelectedId(null)}>
          <div
            className="ml-auto h-full w-full max-w-[560px] overflow-y-auto bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="rounded-none border-0 shadow-none">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-mono text-[14px]">{selected.ticketRef}</CardTitle>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge className={cn('border', STATUS_STYLE[selected.status].tone)}>
                        {STATUS_STYLE[selected.status].label}
                      </Badge>
                      {selected.assignmentReason && (
                        <span className="text-[11px] text-muted-foreground">{selected.assignmentReason}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                {/* Customer / form fields */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
                  <Field label="Country">{selected.countryName}{selected.cityName ? ` · ${selected.cityName}` : ''}</Field>
                  <Field label="Customer">{selected.customerName}</Field>
                  <Field label="Store">{selected.storeName}</Field>
                  <Field label="Machine">{selected.machineModel}</Field>
                  <Field label="Submitted by">{selected.submitterName}</Field>
                  <Field label="Contact">{selected.contactNumber}</Field>
                  <Field label="Email" className="col-span-2">{selected.email}</Field>
                  <Field label="Location" className="col-span-2">
                    {selected.location ? (
                      selected.location.startsWith('http') ? (
                        <a href={selected.location} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                          {selected.location}
                        </a>
                      ) : (
                        selected.location
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Field>
                  <Field label="Issue" className="col-span-2">{selected.issueType}</Field>
                  <Field label="Assigned to">{selected.assignedTo?.name ?? '—'}</Field>
                  <Field label="MR # (Archibus)">{selected.mrNumber ?? '—'}</Field>
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-900">
                    {error}
                  </div>
                )}

                {/* Action 1: Submit MR # → CLOSE */}
                {selected.status !== 'CLOSED' && selected.status !== 'CANCELLED' && (
                  <div className="rounded-md border border-border p-3">
                    <h3 className="mb-2 text-[13px] font-semibold">Close ticket — submit Archibus MR #</h3>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. 2014475035"
                        value={mrInput}
                        onChange={(e) => setMrInput(e.target.value)}
                        className="h-8 text-[12.5px]"
                      />
                      <Button
                        size="sm"
                        disabled={busy || mrInput.trim().length === 0 || !me.isAvailable}
                        onClick={async () => {
                          const ok = await postAction(`/api/branded-solutions/${selected.id}/close`, {
                            mrNumber: mrInput.trim(),
                          });
                          if (ok) setMrInput('');
                        }}
                      >
                        Close & email customer
                      </Button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Customer receives the &quot;Facilities Work Request Confirmation&quot; email automatically.
                    </p>
                  </div>
                )}

                {/* Action 2: Send to supervisor */}
                {selected.status !== 'CLOSED' && selected.status !== 'CANCELLED' && (
                  <div className="rounded-md border border-border p-3">
                    <h3 className="mb-2 text-[13px] font-semibold">Send to country supervisor</h3>
                    {(() => {
                      const matchSupervisors = supervisors.filter(
                        (s) => s.countryName.toLowerCase() === selected.countryName.toLowerCase(),
                      );
                      const defaultSup = matchSupervisors[0];
                      return (
                        <>
                          <p className="mb-2 text-[12px] text-muted-foreground">
                            Default for <strong>{selected.countryName}</strong>:{' '}
                            {defaultSup ? (
                              <span>
                                {defaultSup.name} &lt;{defaultSup.email}&gt;
                              </span>
                            ) : (
                              <span className="text-amber-700">none configured — set one in Admin → Branded Solutions</span>
                            )}
                          </p>
                          <Input
                            placeholder="Override supervisor email (optional)"
                            value={supervisorEmailOverride}
                            onChange={(e) => setSupervisorEmailOverride(e.target.value)}
                            className="mb-2 h-8 text-[12.5px]"
                          />
                          <Input
                            placeholder="Note to supervisor (optional)"
                            value={supervisorNote}
                            onChange={(e) => setSupervisorNote(e.target.value)}
                            className="mb-2 h-8 text-[12.5px]"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || !me.isAvailable}
                            onClick={async () => {
                              const ok = await postAction(`/api/branded-solutions/${selected.id}/send-to-supervisor`, {
                                supervisorEmail: supervisorEmailOverride.trim() || undefined,
                                note: supervisorNote.trim() || undefined,
                              });
                              if (ok) {
                                setSupervisorEmailOverride('');
                                setSupervisorNote('');
                              }
                            }}
                          >
                            Email supervisor & set Waiting · Supervisor
                          </Button>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Action 3: Ask customer to clarify */}
                {selected.status !== 'CLOSED' && selected.status !== 'CANCELLED' && (
                  <div className="rounded-md border border-border p-3">
                    <h3 className="mb-2 text-[13px] font-semibold">Ask customer for clarification</h3>
                    <textarea
                      placeholder={'• Could you confirm the exact branch?\n• Which floor / unit number?\n• Any error code on the screen?'}
                      value={clarifyText}
                      onChange={(e) => setClarifyText(e.target.value)}
                      className="mb-2 min-h-[80px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-[12.5px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || clarifyText.trim().length === 0 || !me.isAvailable}
                      onClick={async () => {
                        const ok = await postAction(`/api/branded-solutions/${selected.id}/clarify-customer`, {
                          questions: clarifyText.trim(),
                        });
                        if (ok) setClarifyText('');
                      }}
                    >
                      Email customer & set Waiting · Customer
                    </Button>
                  </div>
                )}

                {/* Action 4: Claim from pool */}
                {selected.status === 'PENDING' && (
                  <div className="rounded-md border border-dashed border-emerald-300 bg-emerald-50/40 p-3">
                    <h3 className="mb-2 text-[13px] font-semibold">Claim this ticket</h3>
                    <p className="mb-2 text-[11.5px] text-muted-foreground">
                      Round-robin couldn&apos;t find an available agent at intake — grab it now.
                    </p>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={busy || !me.isAvailable}
                      onClick={() => postAction(`/api/branded-solutions/${selected.id}/claim`, {})}
                    >
                      Claim &amp; start working
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words">{children}</div>
    </div>
  );
}
