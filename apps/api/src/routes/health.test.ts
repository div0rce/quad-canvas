import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';

describe('readiness', () => {
  it('readyz is 503 (not ready) when no dependency checks are configured', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/readyz' });
      expect(res.statusCode).toBe(503);
      expect((res.json() as { ready: boolean }).ready).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('readyz is 200 ready when all checks pass', async () => {
    const app = await buildApp({ readinessChecks: [{ name: 'database', check: async () => {} }] });
    try {
      const res = await app.inject({ method: 'GET', url: '/readyz' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { ready: boolean; checks: Record<string, { status: string }> };
      expect(body.ready).toBe(true);
      expect(body.checks.database?.status).toBe('ok');
    } finally {
      await app.close();
    }
  });

  it('readyz is 503 when a check fails — and leaks no error detail', async () => {
    const app = await buildApp({
      readinessChecks: [
        { name: 'database', check: async () => {} },
        {
          name: 'redis',
          check: async () => {
            throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
          },
        },
      ],
    });
    try {
      const res = await app.inject({ method: 'GET', url: '/readyz' });
      expect(res.statusCode).toBe(503);
      const body = res.json() as { ready: boolean; checks: Record<string, { status: string }> };
      expect(body.ready).toBe(false);
      expect(body.checks.database?.status).toBe('ok');
      expect(body.checks.redis?.status).toBe('fail');
      expect(res.body).not.toContain('ECONNREFUSED'); // internal detail never surfaced
    } finally {
      await app.close();
    }
  });

  it('healthz (liveness) stays 200 regardless of readiness', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { status: string }).status).toBe('ok');
    } finally {
      await app.close();
    }
  });
});
