// apps/api — application factory (T7 shell). buildApp wires plugins + routes but does NOT
// listen, so it is reusable for tests (app.inject) and the composition root (index.ts).
import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import { SubscriptionRegistry } from '@quad/realtime';
import errorsPlugin from './plugins/errors.js';
import tenantPlugin from './plugins/tenant.js';
import identityPlugin from './plugins/identity.js';
import healthRoutes from './routes/health.js';
import { makePixelRoutes } from './routes/pixels.js';
import { makeWsRoutes } from './routes/ws.js';
import type { PlacementDeps } from './services/placement.js';

export interface BuildAppOptions {
  readonly logger?: FastifyServerOptions['logger'];
  /** Placement dependencies (repository + cooldown policy). When provided, the pixel routes are
   *  registered. Wired from the DB driver adapter at the composition root, or injected in tests. */
  readonly placement?: PlacementDeps;
}

/** Build a configured (but not-yet-listening) Fastify instance. */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
  });

  await app.register(errorsPlugin);
  await app.register(tenantPlugin);
  await app.register(identityPlugin);
  await app.register(healthRoutes);

  if (opts.placement) {
    await app.register(makePixelRoutes(opts.placement));
    const registry = new SubscriptionRegistry();
    await app.register(websocketPlugin, { options: { maxPayload: 1_048_576 } });
    await app.register(makeWsRoutes(registry, opts.placement.repo));
  }

  return app;
}
