'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Power, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { upsertCountrySettingsAction } from '@/app/actions/admin-extras';

export type BrandOption = {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  isActive: boolean;
};

export type CountryRow = {
  registryCode: string;
  name: string;
  nameAr: string;
  flag: string;
  currencyCode: string;
  currencySymbol: string;
  isActive: boolean;
  managerEmail: string | null;
  cutoffTime: string;
  sortOrder: number;
  caseCount: number;
  activeBrandIds: string[];
};

type FormState = {
  registryCode: string;
  name: string;
  flag: string;
  currencyCode: string;
  isActive: boolean;
  managerEmail: string;
  cutoffTime: string;
  sortOrder: number;
  brandIds: Set<string>;
};

function rowToForm(row: CountryRow): FormState {
  return {
    registryCode: row.registryCode,
    name: row.name,
    flag: row.flag,
    currencyCode: row.currencyCode,
    isActive: row.isActive,
    managerEmail: row.managerEmail ?? '',
    cutoffTime: row.cutoffTime || '17:00',
    sortOrder: row.sortOrder ?? 0,
    brandIds: new Set(row.activeBrandIds),
  };
}

export function CountriesEditor({
  rows,
  brands,
}: {
  rows: CountryRow[];
  brands: BrandOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<FormState | null>(null);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'active' && !r.isActive) return false;
      if (filter === 'inactive' && r.isActive) return false;
      if (!q) return true;
      return (
        r.registryCode.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.nameAr.toLowerCase().includes(q) ||
        r.currencyCode.toLowerCase().includes(q)
      );
    });
  }, [rows, query, filter]);

  const activeBrands = useMemo(
    () => brands.filter((b) => b.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [brands],
  );

  const submit = (form: FormState, opts: { override?: Partial<FormState> } = {}) => {
    const merged = { ...form, ...opts.override };
    start(async () => {
      const result = await upsertCountrySettingsAction({
        registryCode: merged.registryCode,
        isActive: merged.isActive,
        managerEmail: merged.managerEmail.trim(),
        cutoffTime: merged.cutoffTime,
        sortOrder: Number(merged.sortOrder) || 0,
        brandIds: Array.from(merged.brandIds),
      });
      if (result.ok) {
        toast.success(merged.isActive ? 'Country settings saved' : 'Country deactivated');
        setEditing(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const quickToggle = (row: CountryRow) => {
    submit(rowToForm(row), { override: { isActive: !row.isActive } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, name, currency…"
            className="ps-8"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
          {(['all', 'active', 'inactive'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setFilter(opt)}
              className={`rounded px-2.5 py-1 capitalize ${
                filter === opt
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-surface-subtle'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        <span className="ms-auto text-xs text-muted-foreground">
          {filteredRows.filter((r) => r.isActive).length} active · {filteredRows.length} shown
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Code</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Currency</th>
              <th className="px-3 py-2.5">Manager email</th>
              <th className="px-3 py-2.5">Cutoff</th>
              <th className="px-3 py-2.5">Brands</th>
              <th className="px-3 py-2.5">Cases</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.map((r) => (
              <tr key={r.registryCode}>
                <td className="px-3 py-2.5 font-mono text-xs">
                  <span className="me-1.5">{r.flag}</span>
                  {r.registryCode}
                </td>
                <td className="px-3 py-2.5 font-medium">
                  {r.name}
                  {r.nameAr ? (
                    <span className="ms-2 text-xs text-muted-foreground">{r.nameAr}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs">{r.currencyCode}</span>
                  <span className="ms-1.5 text-muted-foreground">{r.currencySymbol}</span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.managerEmail ?? '—'}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.cutoffTime || '—'}</td>
                <td className="px-3 py-2.5">
                  {r.activeBrandIds.length > 0 ? (
                    <Badge variant="secondary">{r.activeBrandIds.length}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">none</span>
                  )}
                </td>
                <td className="px-3 py-2.5">{r.caseCount}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={r.isActive ? 'success' : 'secondary'}>
                    {r.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(rowToForm(r))}
                      disabled={pending}
                    >
                      <Pencil className="size-3.5 me-1" />
                      {r.isActive ? 'Edit' : 'Activate'}
                    </Button>
                    {r.isActive ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => quickToggle(r)}
                        disabled={pending}
                        title="Deactivate"
                      >
                        <Power className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          {editing ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  <span className="me-1.5">{editing.flag}</span>
                  {editing.name}
                  <span className="ms-2 font-mono text-sm text-muted-foreground">
                    ({editing.registryCode} · {editing.currencyCode})
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Activate this country and configure who approves refunds, the local cutoff, and
                  which brands operate here. Saving creates the country if it doesn&apos;t already
                  exist and reconciles brand links in one transaction.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-center gap-3 rounded-md border border-border bg-surface-subtle/40 p-3">
                  <input
                    id="country-active"
                    type="checkbox"
                    checked={editing.isActive}
                    onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                  />
                  <Label htmlFor="country-active" className="m-0">
                    Active in workspace
                  </Label>
                  <span className="ms-auto text-xs text-muted-foreground">
                    Inactive countries are hidden from case creation, promo, and reports.
                  </span>
                </div>

                <div>
                  <Label htmlFor="manager-email">Country manager email</Label>
                  <Input
                    id="manager-email"
                    type="email"
                    value={editing.managerEmail}
                    onChange={(e) => setEditing({ ...editing, managerEmail: e.target.value })}
                    placeholder="manager@company.com"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Receives approval batch emails for this country.
                  </p>
                </div>

                <div>
                  <Label htmlFor="cutoff-time">Daily cutoff (local time)</Label>
                  <Input
                    id="cutoff-time"
                    type="time"
                    value={editing.cutoffTime}
                    onChange={(e) => setEditing({ ...editing, cutoffTime: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cases approved after this time roll into the next day&apos;s batch.
                  </p>
                </div>

                <div>
                  <Label htmlFor="sort-order">Sort order</Label>
                  <Input
                    id="sort-order"
                    type="number"
                    min={0}
                    value={editing.sortOrder}
                    onChange={(e) =>
                      setEditing({ ...editing, sortOrder: Number(e.target.value) || 0 })
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="mb-2 flex items-center justify-between">
                    <Label>Active brands in this country</Label>
                    <span className="text-xs text-muted-foreground">
                      {editing.brandIds.size} of {activeBrands.length} selected
                    </span>
                  </div>
                  {activeBrands.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      No brands yet. Add brands from /admin/brands first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {activeBrands.map((b) => {
                        const checked = editing.brandIds.has(b.id);
                        return (
                          <label
                            key={b.id}
                            className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm cursor-pointer ${
                              checked
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-border hover:bg-surface-subtle'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(editing.brandIds);
                                if (e.target.checked) next.add(b.id);
                                else next.delete(b.id);
                                setEditing({ ...editing, brandIds: next });
                              }}
                            />
                            <span className="font-medium">{b.name}</span>
                            {b.nameAr ? (
                              <span className="text-xs text-muted-foreground">{b.nameAr}</span>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          brandIds: new Set(activeBrands.map((b) => b.id)),
                        })
                      }
                    >
                      Select all
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setEditing({ ...editing, brandIds: new Set() })}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => submit(editing)} disabled={pending}>
                  {pending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
