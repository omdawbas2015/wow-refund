import { NextResponse } from 'next/server';
import { prisma } from '@wow/db';
import { upstashBridgeConfigured } from '@/lib/events/bus';

export const dynamic = 'force-dynamic';

const startedAt = new Date();
const APP_VERSION = process.env['NEXT_PUBLIC_APP_VERSION'] ?? 'unknown';

interface ComponentStatus {
  status: 'ok' | 'down' | 'disabled';
  latencyMs?: number;
  error?: string;
}

/**
 * Liveness + readiness probe. Returns:
 *   - `status`: "ok" if every enabled dependency is healthy, "degraded" otherwise.
 *   - `db`: SELECT 1 round-trip against the configured Prisma client.
 *   - `upstash`: PING against Upstash REST if configured, else disabled.
 *   - `powerAutomate`: "disabled" (no webhook) or "configured" (webhook set).
 *   - `uptimeSeconds`, `version`, `now`.
 *
 * Always returns HTTP 200 — the JSON body carries the real signal so a
 * single curl is parseable by any monitoring agent without HTTP-status
 * gymnastics. Suitable for uptime-kuma / pingdom / Datadog HTTP checks.
 *
 * Intentionally unauthenticated: no PII, no business data, no secrets.
 */
export async function GET() {
  const [db, upstash] = await Promise.all([checkDb(), checkUpstash()]);
  const powerAutomate: ComponentStatus = process.env['POWER_AUTOMATE_WEBHOOK_URL']
    ? { status: 'ok' } // configured; actually reaching PA would require sending a fake email, skip
    : { status: 'disabled' };

  const overall: 'ok' | 'degraded' =
    db.status === 'ok' && (upstash.status === 'ok' || upstash.status === 'disabled') ? 'ok' : 'degraded';

  return NextResponse.json({
    status: overall,
    db,
    upstash,
    powerAutomate,
    uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    version: APP_VERSION,
    now: new Date().toISOString(),
  });
}

async function checkDb(): Promise<ComponentStatus> {
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err) {
    return { status: 'down', error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkUpstash(): Promise<ComponentStatus> {
  if (!upstashBridgeConfigured()) return { status: 'disabled' };
  const url = process.env['UPSTASH_REDIS_REST_URL']!;
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']!;
  try {
    const t0 = Date.now();
    // Use AbortSignal.timeout so a hung Upstash doesn't freeze health checks.
    const res = await fetch(`${url.replace(/\/$/, '')}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { status: 'down', error: `HTTP ${res.status}` };
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err) {
    return { status: 'down', error: err instanceof Error ? err.message : String(err) };
  }
}
