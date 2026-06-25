// apps/api — Fastify type augmentation (T7 shell).
import type { tenant } from '@quad/core';

/** Tenant resolved for the current request (DC2 config), or null when the host is unknown. */
export type TenantContext = tenant.TenantConfig;

declare module 'fastify' {
  interface FastifyRequest {
    /** Resolved tenant, or null when the host does not map to a known tenant (NO default). */
    tenant: TenantContext | null;
  }
}
