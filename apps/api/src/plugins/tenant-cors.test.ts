import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

const previousTenantHosts = process.env['QUAD_TENANT_HOSTS'];

afterEach(() => {
  if (previousTenantHosts === undefined) {
    delete process.env['QUAD_TENANT_HOSTS'];
  } else {
    process.env['QUAD_TENANT_HOSTS'] = previousTenantHosts;
  }
});

describe('tenant CORS', () => {
  it('allows browser REST from a web host mapped to the same tenant as the API host', async () => {
    process.env['QUAD_TENANT_HOSTS'] = 'rutgers=quad-canvas-api-test.vercel.app,quad-canvas-web-test.vercel.app';
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/healthz',
        headers: {
          host: 'quad-canvas-api-test.vercel.app',
          origin: 'https://quad-canvas-web-test.vercel.app',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://quad-canvas-web-test.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.headers['vary']).toContain('Origin');
    } finally {
      await app.close();
    }
  });

  it('answers preflight only for an allowed tenant origin', async () => {
    process.env['QUAD_TENANT_HOSTS'] = 'rutgers=quad-canvas-api-test.vercel.app,quad-canvas-web-test.vercel.app';
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/canvas/current',
        headers: {
          host: 'quad-canvas-api-test.vercel.app',
          origin: 'https://quad-canvas-web-test.vercel.app',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'content-type',
        },
      });

      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('https://quad-canvas-web-test.vercel.app');
      expect(res.headers['access-control-allow-methods']).toContain('GET');
      expect(res.headers['access-control-allow-headers']).toBe('content-type');
    } finally {
      await app.close();
    }
  });

  it('does not emit CORS headers for an unknown origin', async () => {
    process.env['QUAD_TENANT_HOSTS'] = 'rutgers=quad-canvas-api-test.vercel.app,quad-canvas-web-test.vercel.app';
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/canvas/current',
        headers: {
          host: 'quad-canvas-api-test.vercel.app',
          origin: 'https://evil.example',
          'access-control-request-method': 'GET',
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
