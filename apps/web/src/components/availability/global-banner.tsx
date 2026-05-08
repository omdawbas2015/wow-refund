'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  initial: { isAvailable: boolean; availableSince: string | null };
}

/**
 * App-wide availability strip. Lives at the very top of the dashboard
 * layout so the user always sees their On/Off state and has one click
 * to flip it. Refined visual: a slim 28-px strip with a single status
 * pill + an inline toggle button. Never blocks content.
 *
 * Persistence rules:
 *   - Heartbeat every 25 s extends the session presence row.
 *   - On `pagehide`/`beforeunload`, navigator.sendBeacon flips the
 *     user to Offline so closed tabs never hold work.
 */
export function GlobalAvailabilityBanner({ initial }: Props) {
  const [isAvailable, setIsAvailable] = useState(initial.isAvailable);
  const [availableSince, setAvailableSince] = useState<string | null>(initial.availableSince);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      void fetch('/api/me/heartbeat', { method: 'POST', cache: 'no-store' }).catch(() => {});
    }, 25_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function flipAwayBeacon() {
      try {
        const data = new Blob([JSON.stringify({ isAvailable: false })], { type: 'application/json' });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/me/availability', data);
        }
      } catch {
        // best-effort
      }
    }
    window.addEventListener('pagehide', flipAwayBeacon);
    return () => window.removeEventListener('pagehide', flipAwayBeacon);
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

  let timer = '';
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
      role="status"
      className={cn(
        'flex h-7 w-full items-center justify-between gap-3 border-b px-4 text-[11.5px] transition-colors',
        isAvailable
          ? 'border-emerald-100 bg-emerald-50/60 text-emerald-900'
          : 'border-amber-100 bg-amber-50/60 text-amber-900',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[10.5px] font-semibold leading-none',
            isAvailable
              ? 'bg-emerald-500/15 text-emerald-900'
              : 'bg-amber-500/15 text-amber-900',
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500',
            )}
          />
          {isAvailable ? 'Available' : 'Offline'}
        </span>
        {isAvailable ? (
          <span className="tabular-nums opacity-80">active for {timer}</span>
        ) : (
          <span className="hidden truncate opacity-80 sm:inline">
            go Available to receive new work and use Promo / Refund / Maintenance
          </span>
        )}
        {error && <span className="ms-2 truncate text-red-700">· {error}</span>}
      </div>
      <button
        type="button"
        onClick={() => flip(!isAvailable)}
        disabled={busy || dismissedRef.current}
        className={cn(
          'inline-flex h-5 shrink-0 items-center rounded-pill px-2 text-[10.5px] font-semibold leading-none transition-colors',
          'disabled:opacity-50',
          isAvailable
            ? 'border border-emerald-300/70 bg-white/60 text-emerald-900 hover:bg-white'
            : 'bg-amber-600 text-white hover:bg-amber-700',
        )}
      >
        {isAvailable ? 'Go Offline' : 'Go Available'}
      </button>
    </div>
  );
}
