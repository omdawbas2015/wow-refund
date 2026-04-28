/**
 * Integration coverage for the Upstash REST bridge in events/bus.ts.
 *
 * Standing up a real Upstash instance for CI is overkill for the bridge
 * contract we care about, so we stub `globalThis.fetch` with a tiny
 * in-memory pub/sub server that conforms to the same wire shape:
 *
 *   - POST  <baseUrl>/                       body=["publish", channel, msg]
 *     → fans `msg` out to every active subscriber controller for `channel`
 *       and returns `{ result: <subscriber count> }`.
 *   - GET   <baseUrl>/subscribe/<channel>    Authorization: Bearer <token>
 *     → opens an SSE stream emitting `data: ["message", channel, msg]\n\n`
 *       lines for every subsequent publish on `channel`.
 *
 * What this verifies:
 *   1. publish() round-trips through the bridge to remote subscribers.
 *   2. The publishing replica does NOT see its own message twice
 *      (nonce dedupe gate is wired up).
 *   3. After a stream end, the subscriber reconnects and continues
 *      receiving published messages (auto-reconnect loop with backoff).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const enabled = process.env['INTEGRATION_UPSTASH'] === '1';
const maybeDescribe = enabled ? describe : describe.skip;

type Subscriber = {
  channel: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
};

class FakeUpstash {
  private subscribers = new Set<Subscriber>();
  /** End every active SSE stream (used to test reconnect). */
  endAllStreams() {
    for (const s of this.subscribers) {
      try {
        s.controller.close();
      } catch {
        /* ignore double-close */
      }
    }
    this.subscribers.clear();
  }
  publishLocal(channel: string, message: string): number {
    let count = 0;
    for (const s of this.subscribers) {
      if (s.channel !== channel) continue;
      const data = `data: ${JSON.stringify(['message', channel, message])}\n\n`;
      try {
        s.controller.enqueue(s.encoder.encode(data));
        count++;
      } catch {
        // controller closed underneath us; will be cleaned up on next end.
      }
    }
    return count;
  }
  installFetch() {
    const fake = this;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      // 1) Subscribe path: GET <base>/subscribe/<channel>
      const subMatch = url.match(/\/subscribe\/([^/?#]+)/);
      if (subMatch) {
        const channel = decodeURIComponent(subMatch[1]!);
        let sub: Subscriber | null = null;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            sub = { channel, controller, encoder: new TextEncoder() };
            fake.subscribers.add(sub);
          },
          cancel() {
            if (sub) fake.subscribers.delete(sub);
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }
      // 2) Publish: @upstash/redis auto-pipelines, so publish() ends
      // up as POST <base>/pipeline with body [["publish", channel, msg]].
      // Single-command POSTs (body=["publish",...]) are also handled
      // in case auto-pipelining gets disabled in the future.
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST') {
        let body: unknown = null;
        if (typeof init?.body === 'string') {
          try {
            body = JSON.parse(init.body);
          } catch {
            /* malformed body */
          }
        }
        const isPipeline = url.endsWith('/pipeline');
        const commands: unknown[] = isPipeline
          ? Array.isArray(body)
            ? (body as unknown[])
            : []
          : Array.isArray(body)
            ? [body]
            : [];
        const results = commands.map((cmd) => {
          if (
            Array.isArray(cmd) &&
            cmd[0] === 'publish' &&
            typeof cmd[1] === 'string' &&
            typeof cmd[2] === 'string'
          ) {
            const count = fake.publishLocal(cmd[1], cmd[2]);
            return { result: count };
          }
          // Any other Redis command — null result so callers don't
          // see unexpected errors. (This stub only models publish.)
          return { result: null };
        });
        const responseBody = isPipeline ? results : results[0] ?? { result: null };
        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(null, { status: 404 });
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
    fake.endAllStreams();
    globalThis.fetch = originalFetch;
    delete process.env['UPSTASH_REDIS_REST_URL'];
    delete process.env['UPSTASH_REDIS_REST_TOKEN'];
  });

  it('round-trips events from one replica to another via the bridge', async () => {
    const remoteBus = await import('@/lib/events/bus');
    const handler = vi.fn();
    remoteBus.subscribe('user-1', handler);
    // Allow the SSE reader to register before publishing.
    await new Promise((r) => setTimeout(r, 50));

    // Simulate a different replica posting via the publish endpoint.
    fake.publishLocal('notifications:user-1', JSON.stringify({
      type: 'NOTIFY',
      data: { message: 'cross-replica' },
      __nonce: 'remote-nonce',
    }));

    await new Promise((r) => setTimeout(r, 100));
    expect(handler).toHaveBeenCalledWith({
      type: 'NOTIFY',
      data: { message: 'cross-replica' },
    });
  });

  it('does not double-deliver self-published events on the publishing replica', async () => {
    const bus = await import('@/lib/events/bus');
    const handler = vi.fn();
    bus.subscribe('user-2', handler);
    await new Promise((r) => setTimeout(r, 50));

    bus.publish('user-2', { type: 'TEST', data: { n: 1 } });

    // Wait long enough for the publish to round-trip through the fake
    // Upstash and bounce back into the subscriber. The dedupe gate
    // in startUpstashSubscriber MUST drop the bounce-back.
    await new Promise((r) => setTimeout(r, 250));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reconnects after the SSE stream ends and resumes receiving messages', async () => {
    const bus = await import('@/lib/events/bus');
    const handler = vi.fn();
    bus.subscribe('user-3', handler);
    await new Promise((r) => setTimeout(r, 50));

    // First message: should arrive normally.
    fake.publishLocal('notifications:user-3', JSON.stringify({
      type: 'BEFORE_RECONNECT',
      data: {},
      __nonce: 'before',
    }));
    await new Promise((r) => setTimeout(r, 100));
    expect(handler).toHaveBeenCalledWith({ type: 'BEFORE_RECONNECT', data: {} });

    // Force-end every stream — the subscriber loop should reconnect
    // after the configured backoff floor (500ms in bus.ts).
    fake.endAllStreams();
    // Wait a bit longer than the backoff floor so the new SSE reader
    // has registered with the fake before we publish again.
    await new Promise((r) => setTimeout(r, 800));

    fake.publishLocal('notifications:user-3', JSON.stringify({
      type: 'AFTER_RECONNECT',
      data: {},
      __nonce: 'after',
    }));
    await new Promise((r) => setTimeout(r, 200));
    expect(handler).toHaveBeenCalledWith({ type: 'AFTER_RECONNECT', data: {} });
  });
});
