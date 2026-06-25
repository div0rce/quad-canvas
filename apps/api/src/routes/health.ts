// apps/api — health & readiness routes (T7 shell). The ONLY routes in the shell.
import type { FastifyPluginAsync } from 'fastify';

const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness: the process is up and serving. `tenant` (DC2 slug) reflects host resolution.
  app.get('/healthz', async (request) => {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      tenant: request.tenant ? request.tenant.slug : null,
    };
  });

  // Readiness: T7 is a SHELL. The database is NOT wired or checked here, so this endpoint
  // does NOT imply production readiness — `ready` stays false until real dependency checks exist.
  app.get('/readyz', async (request) => {
    return {
      status: 'ok',
      ready: false,
      note: 'API shell (T7): database not wired; readiness is not a production guarantee.',
      tenant: request.tenant ? request.tenant.slug : null,
      checks: {
        server: { status: 'ok' },
        database: { status: 'not_checked', reason: 'DB not wired in T7 shell' },
      },
    };
  });
};

export default healthRoutes;
