/**
 * Per-user event bus with optional Upstash Redis bridge.
 *
 * Shape:
 *   - An in-process `EventEmitter` fans events to every SSE subscriber
 *     on THIS replica. Always on.
 *   - When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set,
 *     `publish()` additionally forwards the payload to Upstash's
 *     `PUBLISH notifications:<userId>` channel. A per-process subscriber
 *     (lazily started on first `subscribe()` call) streams messages back
 *     from Upstash's `/subscribe/<channel>` SSE endpoint and re-emits
 *     them locally.
 *
 * This gives proper multi-replica fanout on long-running deployments
 * (K8s / docker-compose / Fly / Render) without an always-on background
 * worker. On Vercel serverless the subscriber lives for the duration of
 * each SSE function instance — cross-replica fanout works for the window
 * during which an SSE client is connected, which is the only window
 * anyone's listening anyway.
 *
 * Everything is fail-open: if Upstash is unreachable, single-replica
 * fanout still works; we just log a warning.
 *
 * Channel format: `notifications:<userId>`. Payload is opaque JSON.
 */
import { EventEmitter } from 'node:events';
import { Redis } from '@upstash/redis';

export type EventPayload = {
  type: string;
  data: Record<string, unknown>;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

function channel(userId: string) {
  return `notifications:${userId}`;
}

let cachedRedis: Redis | null | undefined;
function upstashClient(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

export function upstashBridgeConfigured(): boolean {
  return upstashClient() !== null;
}

/**
 * Publish an event to all subscribers for a user. Always fires the
 * in-process EventEmitter synchronously so same-replica SSE clients see
 * the event without delay. When Upstash is configured, additionally
 * forwards to the cross-replica channel as fire-and-forget — a slow or
 * failing network round-trip never blocks the caller.
 */
export function publish(userId: string, payload: EventPayload): void {
  emitter.emit(channel(userId), payload);

  const redis = upstashClient();
  if (!redis) return;
  void redis.publish(channel(userId), JSON.stringify(payload)).catch((err) => {
    console.warn(
      '[events/bus] Upstash publish failed, falling back to single-replica fanout:',
      err instanceof Error ? err.message : String(err),
    );
  });
}

// Per-user subscriber ref counts so we only open one Upstash SSE stream
// per channel for as long as at least one local caller wants events.
const refCounts = new Map<string, number>();
const abortControllers = new Map<string, AbortController>();

async function startUpstashSubscriber(ch: string): Promise<void> {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return;
  const controller = new AbortController();
  abortControllers.set(ch, controller);

  const endpoint = `${url.replace(/\/$/, '')}/subscribe/${encodeURIComponent(ch)}`;
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      console.warn(`[events/bus] Upstash subscribe failed for ${ch}: ${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!controller.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const dataStr = line.slice('data:'.length).trim();
        // Upstash streams a JSON array per message: [kind, channel, payload]
        try {
          const parsed = JSON.parse(dataStr);
          const raw = Array.isArray(parsed) ? parsed[2] : parsed;
          const payload: EventPayload = typeof raw === 'string' ? JSON.parse(raw) : raw;
          emitter.emit(ch, payload);
        } catch {
          // Keep the subscriber alive even if one message is malformed.
        }
      }
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.warn(
        `[events/bus] Upstash subscriber for ${ch} died:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  } finally {
    abortControllers.delete(ch);
  }
}

/**
 * Subscribe to a user's notifications. Returns an unsubscribe function.
 * The handler is called for every published EventPayload until
 * unsubscribe() is invoked.
 */
export function subscribe(
  userId: string,
  handler: (p: EventPayload) => void,
): () => void {
  const ch = channel(userId);
  emitter.on(ch, handler);

  const prior = refCounts.get(ch) ?? 0;
  refCounts.set(ch, prior + 1);
  if (prior === 0 && upstashBridgeConfigured()) {
    // Fire-and-forget: start the Upstash subscriber in the background.
    void startUpstashSubscriber(ch);
  }

  return () => {
    emitter.off(ch, handler);
    const n = (refCounts.get(ch) ?? 1) - 1;
    if (n <= 0) {
      refCounts.delete(ch);
      abortControllers.get(ch)?.abort();
    } else {
      refCounts.set(ch, n);
    }
  };
}

/** Test-only: clear module state between tests. Not exported from index. */
export function __resetForTests(): void {
  emitter.removeAllListeners();
  refCounts.clear();
  for (const ctl of abortControllers.values()) ctl.abort();
  abortControllers.clear();
  cachedRedis = undefined;
}
