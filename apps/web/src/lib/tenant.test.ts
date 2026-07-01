import { describe, expect, it } from 'vitest';
import { parseTenantHostAliases, resolveTenantByHost, TENANTS } from '@quad/config';
import { toPublicTenant } from './tenant';

describe('toPublicTenant', () => {
  it('carries tenant palette and theme into client-safe configuration', () => {
    const configured = TENANTS[0];
    expect(configured).toBeDefined();
    if (!configured) return;
    expect(toPublicTenant(configured)).toMatchObject({
      slug: configured.slug,
      themePrimary: configured.theme.primary,
      palette: configured.palette,
    });
  });
});

describe('deployment tenant host aliases', () => {
  it('parses exact per-tenant hosts without wildcarding unrelated domains', () => {
    const aliases = parseTenantHostAliases('rutgers=https://Quad-Web-Test.vercel.app,quad-api-test.vercel.app;other=ignored.example');

    expect(aliases.get('rutgers')).toEqual(['quad-web-test.vercel.app', 'quad-api-test.vercel.app']);
    expect(resolveTenantByHost('unknown.vercel.app')).toBeUndefined();
  });

  it('resolves deployment hosts from QUAD_TENANT_HOSTS without changing the localhost default', () => {
    const previous = process.env['QUAD_TENANT_HOSTS'];
    process.env['QUAD_TENANT_HOSTS'] = 'rutgers=quad-web-test.vercel.app,quad-api-test.vercel.app';
    try {
      expect(resolveTenantByHost('quad-web-test.vercel.app')?.slug).toBe('rutgers');
      expect(resolveTenantByHost('QUAD-API-TEST.VERCEL.APP')?.slug).toBe('rutgers');
      expect(resolveTenantByHost('rutgers.localhost')?.slug).toBe('rutgers');
      expect(resolveTenantByHost('not-quad.vercel.app')).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env['QUAD_TENANT_HOSTS'];
      } else {
        process.env['QUAD_TENANT_HOSTS'] = previous;
      }
    }
  });
});
