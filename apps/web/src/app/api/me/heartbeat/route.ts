import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/me/heartbeat
 *
 * Pinged every ~25 s by the global availability banner while the
 * user has the app open. Currently a no-op other than verifying the
 * session is still valid — the real "user closed the tab → go Away"
 * behaviour is implemented client-side via `navigator.sendBeacon`
 * to /api/me/availability with `{ isAvailable: false }`.
 *
 * The endpoint exists so we have a single place to add a
 * server-side `lastSeenAt` reaper later (e.g. flip everyone whose
 * heartbeat is older than 90 s to Away via a cron) without changing
 * the client.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
