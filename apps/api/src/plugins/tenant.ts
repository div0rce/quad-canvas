// apps/api — tenant resolver (T7 shell). Resolves the request host to a tenant via @quad/config.
// Unknown host → request.tenant = null. NEVER falls back to a default / Rutgers tenant
// (TENANT-INV-1). Logs only the resolved slug (DC2); never host PII or DC3.
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { resolveTenantByHost } from '@quad/config';
import type { TenantContext } from '../types.js';

function hostnameFrom(request: FastifyRequest): string {
  const raw = request.headers.host ?? '';
  // Strip port, e.g. "rutgers.localhost:3001" → "rutgers.localhost".
  return raw.split(':')[0] ?? '';
}

const tenantPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('tenant', null);

  app.addHook('onRequest', async (request) => {
    const host = hostnameFrom(request);
    const resolved: TenantContext | undefined = host ? resolveTenantByHost(host) : undefined;
    request.tenant = resolved ?? null;
    if (resolved) {
      request.log.debug({ tenant: resolved.slug }, 'tenant resolved');
    }
  });
};

export default fp(tenantPlugin, { name: 'tenant' });
