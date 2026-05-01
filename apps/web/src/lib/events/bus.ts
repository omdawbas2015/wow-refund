/**
 * Per-user event bus.
 *
 * Sprint F #21 scaffold. Today this is an in-process EventEmitter so a
 * single-replica deploy (or local dev) gets real-time fanout for free.
 *
 * For multi-replica production, set UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN and the bus will additionally publish to a
 * Redis channel and subscribe to it on every replica, so a notification
 * created on replica A reaches an SSE client connected to replica B.
 * That bridge is intentionally stubbed (commented TODO) until owner
 * provisions Upstash — the scaffolding shape is fixed so wiring is a
 * one-file change.
 *
 * Channel format: `notifications:<userId>`. Payload is opaque JSON.
 */
import { EventEmitter } from 'node:events';

export type EventPayload = {
  type: string;
  data: Record<string, unknown>;
};

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

function channel(userId: string) {
  return `notifications:${userId}`;
}

/**
 * Topic name for the shared broadcast channel — used by features where
 * every open viewer cares about the same event (e.g. the Branded
 * Solutions pool updating live for the whole team). Kept distinct from
 * the per-user notifications channel so subscribers can opt in
 * independently.
 */
const BROADCAST_CHANNEL = 'broadcast:wow';

/**
 * Publish an event to all subscribers for a user. Currently only fires
 * the in-process EventEmitter; Upstash bridge is the next addition
 * once REST creds land.
 */
export function publish(userId: string, payload: EventPayload): void {
  emitter.emit(channel(userId), payload);
  // TODO: when UPSTASH_REDIS_REST_URL is set, also POST to
  //   /publish/notifications:<userId> on Upstash so other replicas pick
  //   it up via their own subscriber.
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
  return () => {
    emitter.off(ch, handler);
  };
}

/**
 * Broadcast an event to every subscriber listening to the global
 * broadcast channel. Intended for shared queues / pool views where the
 * payload is identical for every viewer (no per-user filtering at
 * dispatch time — the receiver decides what to render).
 */
export function broadcast(payload: EventPayload): void {
  emitter.emit(BROADCAST_CHANNEL, payload);
}

/**
 * Subscribe to the global broadcast channel. Returns an unsubscribe
 * function.
 */
export function subscribeBroadcast(
  handler: (p: EventPayload) => void,
): () => void {
  emitter.on(BROADCAST_CHANNEL, handler);
  return () => {
    emitter.off(BROADCAST_CHANNEL, handler);
  };
}
