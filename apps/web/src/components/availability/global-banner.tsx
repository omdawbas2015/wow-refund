'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  initial: { isAvailable: boolean; availableSince: string | null };
}

/**
 * App-wide availability banner. Lives at the very top of the
 * dashboard layout so the user always sees their On/Off state and
 * has one click to flip it. The banner is **also** what enforces the
 * "close the tab → go Away" rule:
 *
 *   - Every 25 s it pings POST /api/me/heartbeat to extend the
 *     session.
 *   - On `pagehide` / `beforeunload` it fires
 *     navigator.sendBeacon to /api/me/availability with isAvailable=false
 *     so the moment the user closes the site they go Offline.
 *
 * Server-side, /auth signs the user in with isAvailable=false by
 * default (set in auth.config.ts events.signIn) so a brand-new
 * session always starts Away.
 */
export function GlobalAvailabilityBanner({ initial }: Props) {
  const [isAvailable, setIsAvailable] = useState(initial.isAvailable);
  const [availableSince, setAvailableSince] = useState<string | null>(initial.availableSince);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissedRef = useRef(false);

  // 1-second tick for the timer.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Heartbeat — every 25 s while the page is alive.
  useEffect(() => {
    const t = setInterval(() => {
      void fetch('/api/me/heartbeat', { method: 'POST', cache: 'no-store' }).catch(() => {});
    }, 25_000);
    return () => clearInterval(t);
  }, []);

  // Auto-Away on tab close. Use sendBeacon so it survives the tab
  // teardown — fetch() in beforeunload is not guaranteed to ship.
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
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b px-4 py-1.5 text-[12px]',
        isAvailable
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
      role="status"
    >
      <div className="flex items-center gap-2">
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full', isAvailable ? 'bg-emerald-500' : 'bg-amber-500')} />
        {isAvailable ? (
          <>
            <strong className="font-semibold">You are Available</strong>
            <span className="tabular-nums opacity-80">· active for {timer}</span>
          </>
        ) : (
          <>
            <strong className="font-semibold">You are Offline</strong>
            <span className="opacity-80">— go Available to receive new work and use Promo / Refund / Maintenance.</span>
          </>
        )}
        {error && <span className="ms-2 text-red-700">· {error}</span>}
      </div>
      <Button
        size="sm"
        variant={isAvailable ? 'outline' : 'default'}
        disabled={busy || dismissedRef.current}
        onClick={() => flip(!isAvailable)}
        className="h-6 px-2 text-[11px]"
      >
        {isAvailable ? 'Go Offline' : 'Go Available'}
      </Button>
    </div>
  );
}
