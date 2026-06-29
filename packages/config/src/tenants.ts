// @quad/config — tenant registry (T5 skeleton). The ONLY place tenant data lives.
// Platform code stays tenant-neutral; Rutgers appears here as tenant #1 CONFIG DATA only.
// resolveTenantByHost returns undefined for unknown hosts — there is NO default tenant.
import type { domain, tenant } from '@quad/core';

type EnvShape = Record<string, string | undefined>;

const TENANT_HOSTS_ENV_KEY = 'QUAD_TENANT_HOSTS';

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

function processEnv(): EnvShape {
  return (globalThis as { process?: { env?: EnvShape } }).process?.env ?? {};
}

function normalizeHost(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withoutProtocol = value.includes('://') ? value.split('://', 2)[1] : value;
  const withoutPath = withoutProtocol?.split('/', 1)[0] ?? '';
  const withoutTrailingDot = withoutPath.endsWith('.') ? withoutPath.slice(0, -1) : withoutPath;
  const host = withoutTrailingDot.split(':')[0]?.toLowerCase() ?? '';
  return host.length > 0 ? host : null;
}

function uniqueHosts(hosts: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const host of hosts) {
    const normalized = normalizeHost(host);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/**
 * Parse deployment host aliases from `slug=host[,host];slug2=host` entries.
 * Invalid entries are ignored fail-closed: they do not resolve a tenant.
 */
export function parseTenantHostAliases(raw: string | undefined): ReadonlyMap<string, readonly string[]> {
  const aliases = new Map<string, readonly string[]>();
  if (!raw) return aliases;
  for (const entry of raw.split(';')) {
    const [slugPart, hostsPart, ...extra] = entry.split('=');
    const slug = slugPart?.trim().toLowerCase();
    if (!slug || !hostsPart || extra.length > 0) continue;
    const hosts = uniqueHosts(hostsPart.split(','));
    if (hosts.length > 0) aliases.set(slug, hosts);
  }
  return aliases;
}

function configuredTenants(env: EnvShape = processEnv()): readonly tenant.TenantConfig[] {
  const aliases = parseTenantHostAliases(env[TENANT_HOSTS_ENV_KEY]);
  if (aliases.size === 0) return TENANTS;
  return TENANTS.map((t) => {
    const extraHosts = aliases.get(t.slug.toLowerCase());
    if (!extraHosts) return t;
    return { ...t, hosts: uniqueHosts([...t.hosts, ...extraHosts]) };
  });
}

/** All configured tenants. */
export function listTenants(): readonly tenant.TenantConfig[] {
  return configuredTenants();
}

/** Look up a tenant by its stable id; `undefined` if not found. */
export function getTenantById(id: domain.TenantId): tenant.TenantConfig | undefined {
  return configuredTenants().find((t) => t.id === id);
}

/** Look up a tenant by slug; `undefined` if not found. */
export function getTenantBySlug(slug: string): tenant.TenantConfig | undefined {
  return configuredTenants().find((t) => t.slug === slug);
}

/**
 * Resolve the active tenant from the request host.
 * Returns `undefined` for unknown hosts — NO default-tenant fallback (TENANT-INV-1):
 * an unknown host must never silently resolve to Rutgers (or any tenant).
 */
export function resolveTenantByHost(host: string): tenant.TenantConfig | undefined {
  // Host names are case-insensitive (RFC 4343): a mixed-case `Host` header must still resolve. Lowercase
  // both sides so a valid host is never missed; an unknown host still returns undefined (no default).
  const h = normalizeHost(host);
  if (!h) return undefined;
  return configuredTenants().find((t) => t.hosts.some((x) => normalizeHost(x) === h));
}
