// apps/api — WebSocket route. Live distribution only (never authoritative writes — WS-INV-1).
// Lifecycle: connect → resolve tenant (reject unknown) → client `SubscribeCanvas` (tenant-scoped,
// acked) → periodic server heartbeat → close. Cross-node fan-out of `PixelPlaced` is layered on
// next (Redis pub/sub); here a placement is not yet broadcast. The session→principal auth crossing
// is owned by AUTHENTICATION.md / ADR-0006 (auth milestone); subscriptions are reads, so this
// milestone scopes by tenant only.
import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { ws as wsmsg } from '@quad/core';
import { resolveTenantByHost } from '@quad/config';
import type { SubscriptionRegistry, RealtimeConnection } from '@quad/realtime';
import type { PlacementRepository } from '@quad/db';

const HEARTBEAT_MS = 30_000;
const MESSAGE_LIMIT = 120;
const MESSAGE_WINDOW_MS = 60_000;
const MAX_CANVAS_ID_LENGTH = 200;

function originMatchesTenant(origin: string | undefined, tenantId: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return resolveTenantByHost(url.hostname)?.id === tenantId;
  } catch {
    return false;
  }
}

function parseClientMessage(raw: string): wsmsg.ClientToServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (value['type'] === 'Pong' || value['type'] === 'PresencePing') return { type: value['type'] };
  if (value['type'] !== 'SubscribeCanvas' && value['type'] !== 'UnsubscribeCanvas') return null;
  const canvasId = value['canvasId'];
  if (typeof canvasId !== 'string' || canvasId.length === 0 || canvasId.length > MAX_CANVAS_ID_LENGTH) return null;
  return { type: value['type'], canvasId: canvasId as wsmsg.SubscribeCanvas['canvasId'] };
}

export function makeWsRoutes(registry: SubscriptionRegistry, repo: PlacementRepository): FastifyPluginAsync {
  return async (app) => {
    app.get('/api/v1/canvas/current/ws', { websocket: true }, (socket, request) => {
      const tenant = request.tenant;
      const send = (message: wsmsg.ServerToClientMessage): void => {
        try {
          socket.send(JSON.stringify(message));
        } catch {
          /* socket already closed */
        }
      };

      if (!tenant) {
        send({ type: 'Error', code: 'WS_TENANT_MISMATCH', message: 'Unknown tenant for this host.' });
        socket.close();
        return;
      }
      if (!originMatchesTenant(request.headers.origin, tenant.id)) {
        send({ type: 'Error', code: 'WS_FORBIDDEN', message: 'WebSocket origin is not allowed for this tenant.' });
        socket.close();
        return;
      }

      // Establish the principal on the connection when the handshake carried a valid session (the
      // identity plugin set request.principal); anonymous connections are still allowed — viewing is
      // public, like the snapshot/read endpoints.
      const conn: RealtimeConnection = {
        id: randomUUID(),
        tenantId: tenant.id,
        ...(request.principal ? { userId: request.principal.userId } : {}),
        send,
      };
      registry.add(conn);
      let subscribedCanvasId: string | null = null;
      // Protocol-level liveness: a half-open/dead peer that never closes (TCP black-hole) would
      // otherwise hold a registry slot + inflate presence until the OS TCP timeout. Each tick: if the
      // previous ping got no pong, terminate (reclaim the slot now); else send a ping + the app
      // Heartbeat. The ws client auto-replies to a ping with a pong, marking it alive again.
      let isAlive = true;
      socket.on('pong', () => {
        isAlive = true;
      });
      const heartbeat = setInterval(() => {
        if (!isAlive) {
          socket.terminate();
          return;
        }
        isAlive = false;
        try {
          socket.ping();
        } catch {
          /* socket already closing */
        }
        send({ type: 'Heartbeat' });
      }, HEARTBEAT_MS);

      // Presence: broadcast the canvas's approximate active (subscribed) count to its subscribers.
      const broadcastPresence = (canvasId: string): void => {
        registry.broadcast(tenant.id, canvasId, { type: 'PresenceUpdated', approximateActive: registry.subscriberCount(canvasId) });
      };

      const handle = async (message: wsmsg.ClientToServerMessage): Promise<void> => {
        if (message.type === 'SubscribeCanvas') {
          const canvas = await repo.findViewableCanvas(tenant.id);
          if (!canvas || canvas.id !== message.canvasId) {
            send({ type: 'Error', code: 'WS_FORBIDDEN', message: 'Canvas is not in this tenant.' });
            return;
          }
          // Release a prior subscription first — this connection tracks a single canvas, so switching
          // canvases must drop the old one (else its subscriber count drifts up and never recovers).
          if (subscribedCanvasId && subscribedCanvasId !== message.canvasId) {
            registry.unsubscribe(conn.id, subscribedCanvasId);
            broadcastPresence(subscribedCanvasId);
          }
          registry.subscribe(conn.id, message.canvasId);
          subscribedCanvasId = message.canvasId;
          // This explicit acknowledgement is the snapshot/subscription ordering barrier: clients
          // fetch their authoritative snapshot only after the server has installed the subscription,
          // so deltas committed during the snapshot request are queued rather than lost in a gap.
          send({ type: 'CanvasSubscribed', canvasId: message.canvasId });
          broadcastPresence(message.canvasId); // everyone on the canvas sees the new active count
        } else if (message.type === 'UnsubscribeCanvas') {
          registry.unsubscribe(conn.id, message.canvasId);
          if (subscribedCanvasId === message.canvasId) subscribedCanvasId = null;
          broadcastPresence(message.canvasId);
        } else if (message.type === 'PresencePing') {
          if (subscribedCanvasId) {
            send({ type: 'PresenceUpdated', approximateActive: registry.subscriberCount(subscribedCanvasId) });
          }
        }
        // 'Pong' — no-op.
      };

      // Process one message at a time per connection (no interleaving), and never let a handler
      // rejection (e.g. a DB error during subscribe lookup) become an unhandled promise rejection.
      let chain: Promise<void> = Promise.resolve();
      let messageCount = 0;
      let messageWindowStartedAt = Date.now();
      socket.on('message', (raw) => {
        const now = Date.now();
        if (now - messageWindowStartedAt >= MESSAGE_WINDOW_MS) {
          messageWindowStartedAt = now;
          messageCount = 0;
        }
        messageCount += 1;
        if (messageCount > MESSAGE_LIMIT) {
          send({ type: 'Error', code: 'WS_RATE_LIMITED', message: 'WebSocket message rate limit exceeded.' });
          socket.close();
          return;
        }

        const message = parseClientMessage(raw.toString());
        if (!message) {
          send({ type: 'Error', code: 'WS_PROTOCOL_ERROR', message: 'Invalid WebSocket message.' });
          return;
        }
        chain = chain.then(() => handle(message)).catch((err: unknown) => {
          app.log.error({ err }, 'ws message handler failed');
          send({ type: 'Error', code: 'WS_PROTOCOL_ERROR', message: 'Could not process message.' });
        });
      });

      // Idempotent: a failed socket emits 'error' AND then 'close', so guard against running twice
      // (which would double-decrement presence and broadcast a duplicate PresenceUpdated).
      let closed = false;
      const cleanup = (): void => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        const wasSubscribed = subscribedCanvasId;
        registry.remove(conn.id);
        if (wasSubscribed) broadcastPresence(wasSubscribed); // remaining subscribers see the lower count
      };
      socket.on('close', cleanup);
      socket.on('error', cleanup);
    });
  };
}
