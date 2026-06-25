import { describe, it, expect } from 'vitest';
import { makeTenantFixture, tenantFixtures } from '../fixtures/index.js';
import { localTestDatabaseUrl, localTestUrl, tenantHost, tenantHostHeader, waitForPort } from '../index.js';

describe('tenant fixtures', () => {
  it('builds a tenant-neutral fixture and applies overrides', () => {
    const t = makeTenantFixture({ slug: 'acme', publicTitle: 'Acme University' });
    expect(t.slug).toBe('acme');
    expect(t.publicTitle).toBe('Acme University');
    expect(t.status).toBe('active');
    // DC2-safe shape only — no private identity fields.
    expect(Object.keys(t)).not.toContain('email');
  });

  it('exposes configured tenants from @quad/config', () => {
    const tenants = tenantFixtures();
    expect(Array.isArray(tenants)).toBe(true);
  });
});

describe('url + host helpers', () => {
  it('builds a tenant host and header', () => {
    expect(tenantHost('acme')).toBe('acme.localhost');
    expect(tenantHostHeader('acme')).toEqual({ Host: 'acme.localhost' });
  });

  it('builds a local test url', () => {
    expect(localTestUrl({ port: 3001, path: '/healthz' })).toBe('http://127.0.0.1:3001/healthz');
  });

  it('builds a local test database url', () => {
    expect(localTestDatabaseUrl()).toBe('postgresql://quad:quad@127.0.0.1:5432/quad');
  });
});

describe('waitForPort', () => {
  it('rejects for a closed port within the timeout', async () => {
    await expect(waitForPort('127.0.0.1', 1, { timeoutMs: 800, intervalMs: 150 })).rejects.toThrow();
  });
});
