// apps/web — SERVER-side tenant resolution (T8 shell). Resolves the request host to a tenant
// via @quad/config and maps it to a DC2-safe PublicTenant. NEVER defaults to Rutgers; unknown
// host → null. Only PublicTenant (no DC3) is ever passed to client components.
import { headers } from 'next/headers';
import { resolveTenantByHost } from '@quad/config';
import type { tenant } from '@quad/core';

/** DC2-safe public view of a tenant — the ONLY tenant data handed to client components. */
export interface PublicTenant {
  readonly slug: string;
  readonly title: string;
  readonly themePrimary: string;
  readonly palette: string;
}

/** Neutral theme color used when no tenant resolves. */
export const FALLBACK_PRIMARY = '#3b3f46';

export function toPublicTenant(config: tenant.TenantConfig): PublicTenant {
  return {
    slug: config.slug,
    title: config.publicTitle,
    themePrimary: config.theme.primary ?? FALLBACK_PRIMARY,
    palette: config.palette,
  };
}

/**
 * Resolve the current request's tenant (server-only — uses next/headers).
 * Unknown host → null. There is NO default-tenant fallback (TENANT-INV-1).
 */
export async function resolveCurrentTenant(): Promise<PublicTenant | null> {
  const headerList = await headers();
  // Strip port, e.g. "rutgers.localhost:3002" → "rutgers.localhost".
  const host = (headerList.get('host') ?? '').split(':')[0] ?? '';
  if (!host) return null;
  const config = resolveTenantByHost(host);
  return config ? toPublicTenant(config) : null;
}
