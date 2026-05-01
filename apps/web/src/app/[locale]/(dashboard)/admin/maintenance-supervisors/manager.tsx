'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Row {
  id: string;
  countryName: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
}

interface Props {
  initialRows: Row[];
}

const EMPTY: Omit<Row, 'id'> = {
  countryName: '',
  name: '',
  email: '',
  phone: null,
  notes: null,
  isActive: true,
};

export function SupervisorsManager({ initialRows }: Props) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [draft, setDraft] = useState<Omit<Row, 'id'>>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const r = await fetch('/api/admin/maintenance-supervisors', { cache: 'no-store' });
    if (!r.ok) return;
    const j = (await r.json()) as { rows: Row[] };
    setRows(j.rows);
  }

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/maintenance-supervisors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${r.status}`);
      }
      setDraft(EMPTY);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string, patch: Partial<Row>) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/maintenance-supervisors/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${r.status}`);
      }
      setEditingId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this supervisor mapping?')) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/maintenance-supervisors/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${r.status}`);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-900">{error}</div>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-[12.5px]">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Country</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                  No supervisors configured. Add the first one below.
                </td>
              </tr>
            )}
            {rows.map((r) =>
              editingId === r.id ? (
                <EditRow key={r.id} row={r} busy={busy} onCancel={() => setEditingId(null)} onSave={save} onDelete={remove} />
              ) : (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.countryName}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">
                    <a href={`mailto:${r.email}`} className="text-blue-700 underline">
                      {r.email}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.phone ?? '—'}</td>
                  <td className="px-3 py-2">
                    {r.isActive ? <Badge>Active</Badge> : <Badge variant="outline">Disabled</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(r.id)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)} disabled={busy}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-dashed border-border p-3">
        <h3 className="mb-2 text-[13px] font-semibold">Add supervisor</h3>
        <div className="grid gap-2 md:grid-cols-5">
          <Input
            placeholder="Country (e.g. KSA)"
            value={draft.countryName}
            onChange={(e) => setDraft({ ...draft, countryName: e.target.value })}
            className="h-8 text-[12.5px]"
          />
          <Input
            placeholder="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-8 text-[12.5px]"
          />
          <Input
            placeholder="Email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            className="h-8 text-[12.5px]"
          />
          <Input
            placeholder="Phone (optional)"
            value={draft.phone ?? ''}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value || null })}
            className="h-8 text-[12.5px]"
          />
          <Button
            size="sm"
            disabled={busy || !draft.countryName.trim() || !draft.name.trim() || !draft.email.trim()}
            onClick={add}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditRow({
  row,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  row: Row;
  busy: boolean;
  onSave: (id: string, patch: Partial<Row>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Row>(row);
  return (
    <tr className="border-t border-border bg-muted/20">
      <td className="px-3 py-2">
        <Input value={draft.countryName} onChange={(e) => setDraft({ ...draft, countryName: e.target.value })} className="h-7 text-[12px]" />
      </td>
      <td className="px-3 py-2">
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-7 text-[12px]" />
      </td>
      <td className="px-3 py-2">
        <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="h-7 text-[12px]" />
      </td>
      <td className="px-3 py-2">
        <Input
          value={draft.phone ?? ''}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value || null })}
          className="h-7 text-[12px]"
        />
      </td>
      <td className="px-3 py-2">
        <label className="flex items-center gap-1.5 text-[11px]">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
          />
          Active
        </label>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onSave(row.id, draft)}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(row.id)} disabled={busy}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
