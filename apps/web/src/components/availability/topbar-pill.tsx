'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Tiny topbar widget showing the user's Available state. Polls
 * /api/me/availability every 30s so flipping it from another tab
 * (Profile or Branded Solutions) reflects here. Click jumps to
 * the Profile page where the full toggle lives.
 */
export function TopBarAvailabilityPill() {
  const [state, setState] = useState<{ isAvailable: boolean; availableSince: string | null } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const r = await fetch('/api/me/availability', { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as { isAvailable: boolean; availableSince: string | null };
        if (!stop) setState(j);
      } catch {
        // ignore — pill stays at last known state
      }
    }
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!state) return null;

  let timer = '';
  if (state.isAvailable && state.availableSince) {
    const ms = Math.max(0, now - new Date(state.availableSince).getTime());
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    timer = h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}m`;
  }

  return (
    <Link
      href="/profile"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2 py-1 text-[10.5px] font-medium transition-colors',
        state.isAvailable
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
          : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100',
      )}
      title={state.isAvailable ? 'You are Available — click to manage' : 'You are Away — click to go Available'}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', state.isAvailable ? 'bg-emerald-500' : 'bg-zinc-400')} />
      {state.isAvailable ? `Available · ${timer}` : 'Away'}
    </Link>
  );
}
