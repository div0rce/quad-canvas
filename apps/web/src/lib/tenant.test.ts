import { describe, expect, it } from 'vitest';
import { TENANTS } from '@quad/config';
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
