// apps/api — Fastify type augmentation.
import type { domain, tenant } from '@quad/core';

/** Tenant resolved for the current request (DC2 config), or null when the host is unknown. */
export type TenantContext = tenant.TenantConfig;

declare module 'fastify' {
  interface FastifyRequest {
    /** Resolved tenant, or null when the host does not map to a known tenant (NO default). */
    tenant: TenantContext | null;
    /** Verified actor, or null when there is no authenticated session. NO anonymous writes. */
    principal: domain.Principal | null;
  }
}
