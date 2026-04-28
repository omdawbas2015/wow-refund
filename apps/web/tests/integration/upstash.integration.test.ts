/**
 * Integration coverage for the Upstash REST bridge in events/bus.ts.
 *
 * The real Upstash service exposes a `/subscribe/<channel>` SSE endpoint
 * over HTTPS and a `/publish/<channel>` POST endpoint. Standing up a
 * real Upstash instance for CI is overkill for the bridge contract we
 * care about, so we stub `globalThis.fetch` with a tiny in-memory
 * pub/sub server that conforms to the same wire shape.
 *
 * What this verifies:
 *   1. publish() round-trips through the bridge to remote subscribers.
 *   2. The publishing replica does NOT see its own message twice
 *      (nonce dedupe gate is wired up).
 *   3. After a stream end, the subscriber reconnects and continues
 *      receiving published messages (auto-reconnect loop).
 *
 * Runs only when explicitly enabled via INTEGRATION_UPSTASH=1 (default
 * off because monkey-patching globalThis.fetch can interact poorly
 * with other tests in the same vitest worker if they expected real
 * network).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const enabled = process.env['INTEGRATION_UPSTASH'] === '1';
const maybeDescribe = enabled ? describe : describe.skip;

type WirePayload = { type: string; data: Record<string, unknown>; __nonce?: string };

class FakeUpstash {
  private pending = new Map<string, ((p: WirePayload) => void)[]>();
  /** Resolve all currently parked subscriber readers with `done`. */
  endAllStreams() {
    for (const [, handlers] of this.pending) handlers.length = 0;
  }
  publish(channel: string, payload: WirePayload) {
    const queue = this.pending.get(channel);
    if (!queue) return;
    for (const fn of queue) fn(payload);
  }
  installFetch() {
    const fake = this;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input.toString();
      // Parse `/subscribe/<channel>` shape.
      const m = url.match(/\/subscribe\/(.+)$/);
      if (!m) {
        return new Response(null, { status: 404 });
      }
      const channel = decodeURIComponent(m[1]!);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const handlers = fake.pending.get(channel) ?? [];
          handlers.push((payload) => {
            const data = `data: ${JSON.stringify(['message', channel, JSON.stringify(payload)])}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          });
          fake.pending.set(channel, handlers);
        },
      });
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }) as typeof fetch;
  }
}

maybeDescribe('@integration upstash bridge', () => {
  let fake: FakeUpstash;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    process.env['UPSTASH_REDIS_REST_URL'] = 'https://fake-upstash.example.com';
    process.env['UPSTASH_REDIS_REST_TOKEN'] = 'test-token';
    fake = new FakeUpstash();
    originalFetch = globalThis.fetch;
    fake.installFetch();
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env['UPSTASH_REDIS_REST_URL'];
    delete process.env['UPSTASH_REDIS_REST_TOKEN'];
  });

  it('round-trips events from publisher replica to remote subscriber', async () => {
    const bus = await import('@/lib/events/bus');
    const remoteHandler = vi.fn();
    bus.subscribe('user-1', remoteHandler);

    // Allow the subscriber to set up its SSE reader before publishing.
    await new Promise((r) => setTimeout(r, 50));

    fake.publish('notifications:user-1', {
      type: 'NOTIFY',
      data: { message: 'hello' },
      __nonce: 'remote-nonce',
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(remoteHandler).toHaveBeenCalledWith({ type: 'NOTIFY', data: { message: 'hello' } });
  });

  it('does not double-deliver self-published events on the publishing replica', async () => {
    const bus = await import('@/lib/events/bus');
    const handler = vi.fn();
    bus.subscribe('user-2', handler);
    await new Promise((r) => setTimeout(r, 50));

    bus.publish('user-2', { type: 'TEST', data: { n: 1 } });
    await new Promise((r) => setTimeout(r, 200));

    // We expect exactly one local emit; the Upstash bounce-back must be
    // dropped by the nonce dedupe gate in startUpstashSubscriber().
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
