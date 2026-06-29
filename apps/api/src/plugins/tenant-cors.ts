// apps/api — tenant-scoped CORS for browser clients served from a tenant web host while the API
// lives on a separate tenant API host. Unknown/cross-tenant origins stay fail-closed (no CORS
// headers), and WebSocket handshakes still have their own origin check in routes/ws.ts.
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { resolveTenantByHost } from '@quad/config';

const ALLOW_METHODS = 'GET,POST,OPTIONS';
const DEFAULT_ALLOW_HEADERS = 'Content-Type, Idempotency-Key';
const VARY = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';

function allowedOriginForTenant(origin: string | undefined, tenantId: string): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const originTenant = resolveTenantByHost(url.hostname);
    return originTenant?.id === tenantId ? url.origin : null;
  } catch {
    return null;
  }
}

function applyCors(reply: FastifyReply, origin: string, requestedHeaders: string | undefined): void {
  void reply.header('Access-Control-Allow-Origin', origin);
  void reply.header('Access-Control-Allow-Credentials', 'true');
  void reply.header('Access-Control-Allow-Methods', ALLOW_METHODS);
  void reply.header('Access-Control-Allow-Headers', requestedHeaders?.trim() || DEFAULT_ALLOW_HEADERS);
  void reply.header('Access-Control-Max-Age', '600');
  void reply.header('Vary', VARY);
}

const tenantCorsPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    const tenant = request.tenant;
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    const allowedOrigin = tenant ? allowedOriginForTenant(origin, tenant.id) : null;
    if (!allowedOrigin) return;

    const requestedHeaders =
      typeof request.headers['access-control-request-headers'] === 'string'
        ? request.headers['access-control-request-headers']
        : undefined;
    applyCors(reply, allowedOrigin, requestedHeaders);

    if (request.method === 'OPTIONS' && request.url.startsWith('/api/')) {
      return reply.status(204).send();
    }
  });
};

export default fp(tenantCorsPlugin, { name: 'tenant-cors' });
