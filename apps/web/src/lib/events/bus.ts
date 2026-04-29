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
import { randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';

export type EventPayload = {
  type: string;
  data: Record<string, unknown>;
};

// Wire format we put on Upstash. The nonce lets the publishing replica
// recognize its own message bouncing back over the bridge so we can
// drop it without re-emitting (otherwise local handlers see it twice).
type WirePayload = EventPayload & { __nonce?: string };

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

// Bounded LRU-ish set of nonces this process published recently. We
// only need it long enough for the Upstash round-trip to complete
// (typically <100ms), so 256 entries with FIFO eviction is plenty.
const recentNonces: string[] = [];
const recentNonceSet = new Set<string>();
const NONCE_CAP = 256;
function rememberNonce(n: string): void {
  if (recentNonceSet.has(n)) return;
  recentNonceSet.add(n);
  recentNonces.push(n);
  if (recentNonces.length > NONCE_CAP) {
    const evicted = recentNonces.shift()!;
    recentNonceSet.delete(evicted);
  }
}
function sawNonce(n: string | undefined): boolean {
  return !!n && recentNonceSet.has(n);
}

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
  // Tag the wire payload with a nonce so when the Upstash subscriber
  // delivers this same message back to us we can identify it and skip
  // re-emitting (we already fired locally above).
  const nonce = randomUUID();
  rememberNonce(nonce);
  const wire: WirePayload = { ...payload, __nonce: nonce };
  void redis.publish(channel(userId), JSON.stringify(wire)).catch((err) => {
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

/** Run a single Upstash subscriber connection until it ends or aborts. */
async function runUpstashSubscriberOnce(
  ch: string,
  controller: AbortController,
): Promise<{ aborted: boolean; healthy: boolean }> {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return { aborted: true, healthy: false };
  const endpoint = `${url.replace(/\/$/, '')}/subscribe/${encodeURIComponent(ch)}`;
  let healthy = false;
  try {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      console.warn(`[events/bus] Upstash subscribe failed for ${ch}: ${res.status}`);
      return { aborted: controller.signal.aborted, healthy: false };
    }
    healthy = true;
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
          const wire: WirePayload =
            typeof raw === 'string' ? JSON.parse(raw) : raw;
          // Skip messages this process just published. Otherwise local
          // SSE handlers would see the event twice (once from publish()'s
          // synchronous emit, once from this Upstash bounce-back).
          if (sawNonce(wire.__nonce)) continue;
          const { __nonce: _n, ...payload } = wire;
          emitter.emit(ch, payload);
        } catch {
          // Keep the subscriber alive even if one message is malformed.
        }
      }
    }
    return { aborted: controller.signal.aborted, healthy };
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.warn(
        `[events/bus] Upstash subscriber for ${ch} died:`,
        err instanceof Error ? err.message : String(err),
      );
    }
    return { aborted: controller.signal.aborted, healthy };
  }
}

async function startUpstashSubscriber(ch: string): Promise<void> {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];
  if (!url || !token) return;
  const controller = new AbortController();
  abortControllers.set(ch, controller);
  // Reconnect loop with exponential backoff. Reset on every healthy run
  // so a connection that lasted long enough to receive at least one
  // headers response starts the next backoff at the floor.
  const baseDelay = 500;
  const maxDelay = 30_000;
  let delay = baseDelay;
  try {
    while (!controller.signal.aborted) {
      const { aborted, healthy } = await runUpstashSubscriberOnce(ch, controller);
      if (aborted) break;
      if (healthy) delay = baseDelay;
      // Sleep before reconnecting, but bail early if aborted mid-sleep.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delay);
        controller.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
      delay = Math.min(delay * 2, maxDelay);
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
  recentNonces.length = 0;
  recentNonceSet.clear();
}
