// apps/api — WebSocket route. Live distribution only (never authoritative writes — WS-INV-1).
// Lifecycle: connect → resolve tenant (reject unknown) → client `SubscribeCanvas` (tenant-scoped,
// acked) → periodic server heartbeat → close. Cross-node fan-out of `PixelPlaced` is layered on
// next (Redis pub/sub); here a placement is not yet broadcast. The session→principal auth crossing
// is owned by AUTHENTICATION.md / ADR-0006 (auth milestone); subscriptions are reads, so this
// milestone scopes by tenant only.
import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { ws as wsmsg } from '@quad/core';
import type { SubscriptionRegistry, RealtimeConnection } from '@quad/realtime';
import type { PlacementRepository } from '@quad/db';

const HEARTBEAT_MS = 30_000;

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
      const heartbeat = setInterval(() => send({ type: 'Heartbeat' }), HEARTBEAT_MS);

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
          registry.subscribe(conn.id, message.canvasId);
          subscribedCanvasId = message.canvasId;
          send({ type: 'Heartbeat' }); // subscription acknowledgement
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
      socket.on('message', (raw) => {
        let message: wsmsg.ClientToServerMessage;
        try {
          message = JSON.parse(raw.toString()) as wsmsg.ClientToServerMessage;
        } catch {
          send({ type: 'Error', code: 'WS_PROTOCOL_ERROR', message: 'Invalid JSON.' });
          return;
        }
        chain = chain.then(() => handle(message)).catch((err: unknown) => {
          app.log.error({ err }, 'ws message handler failed');
          send({ type: 'Error', code: 'WS_PROTOCOL_ERROR', message: 'Could not process message.' });
        });
      });

      const cleanup = (): void => {
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
