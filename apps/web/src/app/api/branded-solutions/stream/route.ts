import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { subscribeBroadcast, type EventPayload } from '@/lib/events/bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events stream for the Branded Solutions pool. Clients
 * connect via `new EventSource('/api/branded-solutions/stream')` and
 * receive `data:` lines whenever a maintenance request is created /
 * updated / closed. The frontend uses these events to insert / patch /
 * remove rows in place — no manual refresh needed.
 *
 * Same plumbing as `/api/notifications/stream` but listening on the
 * shared broadcast channel so every viewer sees identical events.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response('UNAUTHENTICATED', { status: 401 });
  }

  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (payload: EventPayload) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${payload.type}\ndata: ${JSON.stringify(payload.data)}\n\n`,
            ),
          );
        } catch {
          closed = true;
        }
      };
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          closed = true;
        }
      }, 25_000);
      const unsubscribe = subscribeBroadcast(send);
      send({ type: 'ready', data: { userId: session.user.id } });
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
