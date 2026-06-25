// @quad/testing — tenant fixtures. Tenant-neutral; configured tenants come from @quad/config
// (never hardcoded here). DC2-safe public shape only — no private identity data.
import { listTenants } from '@quad/config';
import type { domain, tenant } from '@quad/core';

/** Configured tenants (tenant #1 etc.), sourced from @quad/config. */
export function tenantFixtures(): readonly tenant.TenantConfig[] {
  return listTenants();
}

/**
 * Build a tenant-neutral fixture for tests. Defaults describe a generic local test tenant;
 * `overrides` win. There is no default-tenant fallback in platform code — this is test data only.
 */
export function makeTenantFixture(overrides: Partial<tenant.TenantConfig> = {}): tenant.TenantConfig {
  const base: tenant.TenantConfig = {
    id: 'ten_testu' as domain.TenantId,
    slug: 'testu',
    publicTitle: 'Test University',
    hosts: ['testu.localhost'],
    domains: ['testu.edu'],
    authProvider: { type: 'email-verification' },
    theme: { primary: '#2d6cdf' },
    palette: 'default',
    featureFlags: {},
    termCadence: 'semester',
    status: 'active',
  };
  return { ...base, ...overrides };
}
