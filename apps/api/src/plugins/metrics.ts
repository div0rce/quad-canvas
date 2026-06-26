// apps/api — metrics exposition. An onResponse hook counts every request by (method, route
// template, status); GET /metrics renders Prometheus text. Counts only — no DC, no per-request
// detail. In production /metrics should be network-restricted to the scraper (it's not gated here).
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { MetricsRegistry } from '../metrics/registry.js';

export function makeMetricsPlugin(registry: MetricsRegistry): FastifyPluginAsync {
  return fp(
    async (app) => {
      app.addHook('onResponse', async (request, reply) => {
        const route = request.routeOptions?.url ?? '(unmatched)';
        registry.increment(request.method, route, reply.statusCode);
      });

      app.get('/metrics', async (_request, reply) => {
        void reply.header('Content-Type', 'text/plain; version=0.0.4');
        return reply.send(registry.render());
      });
    },
    { name: 'metrics' },
  );
}
