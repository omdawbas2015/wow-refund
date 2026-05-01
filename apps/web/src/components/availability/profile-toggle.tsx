'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  initial: { isAvailable: boolean; availableSince: string | null };
}

/**
 * Card-friendly Available toggle — same data model as the page-level
 * toggle on Branded Solutions but shown in the user's Profile so they
 * can flip state from anywhere. The topbar pill mirrors the same
 * value via /api/me/availability.
 */
export function AvailabilityToggle({ initial }: Props) {
  const [isAvailable, setIsAvailable] = useState(initial.isAvailable);
  const [availableSince, setAvailableSince] = useState<string | null>(initial.availableSince);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function flip(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/me/availability', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isAvailable: next }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(j.message || j.error || `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { isAvailable: boolean; availableSince: string | null };
      setIsAvailable(j.isAvailable);
      setAvailableSince(j.availableSince);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  let timer = '0:00:00';
  if (isAvailable && availableSince) {
    const ms = Math.max(0, now - new Date(availableSince).getTime());
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    timer = `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium',
            isAvailable
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-zinc-200 bg-zinc-50 text-zinc-700',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', isAvailable ? 'bg-emerald-500' : 'bg-zinc-400')} />
          {isAvailable ? `Available · ${timer}` : 'Away'}
        </span>
        <Button size="sm" variant={isAvailable ? 'outline' : 'default'} disabled={busy} onClick={() => flip(!isAvailable)}>
          {isAvailable ? 'Go Away' : 'Go Available'}
        </Button>
      </div>
      <p className="text-[12px] text-muted-foreground">
        While Available you receive new maintenance requests in round-robin and can send Promo / Refund / Maintenance
        emails. Going Away pauses outbound actions until you flip back.
      </p>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-900">{error}</div>
      )}
    </div>
  );
}
