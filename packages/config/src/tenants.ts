// @quad/config — tenant registry (T5 skeleton). The ONLY place tenant data lives.
// Platform code stays tenant-neutral; Rutgers appears here as tenant #1 CONFIG DATA only.
// resolveTenantByHost returns undefined for unknown hosts — there is NO default tenant.
import type { domain, tenant } from '@quad/core';

/**
 * Registry of configured tenants. Values below are LOCAL-DEV-SAFE placeholders/examples
 * (hosts use `*.localhost`; production hosts/providers are configured per deployment — see
 * docs/MULTI_TENANCY.md, ADR-0007). Adding a tenant is config + data, never platform code.
 */
export const TENANTS: readonly tenant.TenantConfig[] = [
  // --- Tenant #1: Rutgers Quad (example/config data only) ---
  {
    id: 'ten_rutgers' as domain.TenantId,
    slug: 'rutgers',
    publicTitle: 'Rutgers Quad',
    hosts: ['rutgers.localhost'], // local-dev-safe; real host(s) set per deployment
    domains: ['rutgers.edu', 'scarletmail.rutgers.edu'],
    authProvider: { type: 'email-verification' },
    theme: { primary: '#CC0033', logo: 'rutgers' },
    palette: 'default',
    featureFlags: { readOnlyViewing: true, archiveVisibility: 'public' },
    termCadence: 'semester',
    status: 'active',
  },
];

/** All configured tenants. */
export function listTenants(): readonly tenant.TenantConfig[] {
  return TENANTS;
}

/** Look up a tenant by its stable id; `undefined` if not found. */
export function getTenantById(id: domain.TenantId): tenant.TenantConfig | undefined {
  return TENANTS.find((t) => t.id === id);
}

/** Look up a tenant by slug; `undefined` if not found. */
export function getTenantBySlug(slug: string): tenant.TenantConfig | undefined {
  return TENANTS.find((t) => t.slug === slug);
}

/**
 * Resolve the active tenant from the request host.
 * Returns `undefined` for unknown hosts — NO default-tenant fallback (TENANT-INV-1):
 * an unknown host must never silently resolve to Rutgers (or any tenant).
 */
export function resolveTenantByHost(host: string): tenant.TenantConfig | undefined {
  return TENANTS.find((t) => t.hosts.includes(host));
}
