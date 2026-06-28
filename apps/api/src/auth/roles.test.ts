import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { domain } from '@quad/core';
import { hasMinRole, requireRole, toRole } from './roles.js';

describe('hasMinRole', () => {
  it('respects the role hierarchy', () => {
    expect(hasMinRole('moderator', 'participant')).toBe(true);
    expect(hasMinRole('participant', 'moderator')).toBe(false);
    expect(hasMinRole('admin', 'moderator')).toBe(true);
    expect(hasMinRole('operator', 'admin')).toBe(true);
    expect(hasMinRole('moderator', 'moderator')).toBe(true);
  });
});

describe('toRole', () => {
  it('accepts known roles and rejects everything else (fail closed)', () => {
    expect(toRole('participant')).toBe('participant');
    expect(toRole('operator')).toBe('operator');
    expect(toRole('superuser')).toBeNull();
    expect(toRole('')).toBeNull();
    expect(toRole('Moderator')).toBeNull(); // case-sensitive: unknown value → denied
  });
});

function principal(role: domain.Role): domain.Principal {
  return { userId: 'u' as domain.UserId, tenantId: 't' as domain.TenantId, role };
}

async function appWithPrincipal(value: domain.Principal | null): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorateRequest('principal', null);
  app.addHook('onRequest', (request) => {
    (request as { principal: domain.Principal | null }).principal = value;
    return Promise.resolve();
  });
  app.post('/mod', { preHandler: requireRole('moderator') }, () => ({ ok: true }));
  return app;
}

describe('requireRole preHandler', () => {
  it('rejects an unauthenticated request (401)', async () => {
    const app = await appWithPrincipal(null);
    try {
      const res = await app.inject({ method: 'POST', url: '/mod' });
      expect(res.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('rejects an insufficient role (403)', async () => {
    const app = await appWithPrincipal(principal('participant'));
    try {
      const res = await app.inject({ method: 'POST', url: '/mod' });
      expect(res.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('passes through when the role suffices', async () => {
    const app = await appWithPrincipal(principal('moderator'));
    try {
      const res = await app.inject({ method: 'POST', url: '/mod' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  });
});
