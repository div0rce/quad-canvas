// apps/api — application factory (T7 shell). buildApp wires plugins + routes but does NOT
// listen, so it is reusable for tests (app.inject) and the composition root (index.ts).
import Fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import errorsPlugin from './plugins/errors.js';
import tenantPlugin from './plugins/tenant.js';
import healthRoutes from './routes/health.js';

export interface BuildAppOptions {
  readonly logger?: FastifyServerOptions['logger'];
}

/** Build a configured (but not-yet-listening) Fastify instance. */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? false,
  });

  await app.register(errorsPlugin);
  await app.register(tenantPlugin);
  await app.register(healthRoutes);

  return app;
}
