import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';

describe('security headers', () => {
  it('sets defensive headers on every response', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz', headers: { host: 'rutgers.localhost' } });
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['strict-transport-security']).toContain('max-age=');
    } finally {
      await app.close();
    }
  });

  it('sets headers even on a 404 (hook runs in onRequest)', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/no/such/route', headers: { host: 'rutgers.localhost' } });
      expect(res.statusCode).toBe(404);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    } finally {
      await app.close();
    }
  });
});
