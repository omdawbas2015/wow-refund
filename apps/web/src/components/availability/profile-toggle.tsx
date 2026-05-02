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
    <div
      className={cn(
        'space-y-3 rounded-2xl border p-4 transition-colors',
        isAvailable
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-amber-200 bg-amber-50/40',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-semibold',
            isAvailable
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-amber-300 bg-amber-50 text-amber-900',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500',
            )}
          />
          {isAvailable ? `Available · ${timer}` : 'Offline'}
        </span>
        <Button
          size="sm"
          variant={isAvailable ? 'outline' : 'default'}
          disabled={busy}
          onClick={() => flip(!isAvailable)}
        >
          {busy ? 'Saving…' : isAvailable ? 'Go Offline' : 'Go Available'}
        </Button>
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        {isAvailable
          ? 'You’re receiving new maintenance requests round-robin and can send Promo / Refund / Maintenance emails.'
          : 'You’re paused. Tickets will queue in the pool, and outbound Promo / Refund / Maintenance actions are blocked.'}
      </p>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-900">{error}</div>
      )}
    </div>
  );
}
