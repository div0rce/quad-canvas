import { describe, it, expect } from 'vitest';
import { createServer, type Server, type Socket } from 'node:net';
import { makeTenantFixture, tenantFixtures } from '../fixtures/index.js';
import {
  localTestDatabaseUrl,
  localTestUrl,
  redactDatabaseUrl,
  tenantHost,
  tenantHostHeader,
  waitForPort,
  waitForPostgres,
  waitForRedis,
} from '../index.js';

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
}

function closeServer(server: Server, sockets: Socket[]): Promise<void> {
  for (const socket of sockets) socket.destroy(); // drop lingering client sockets so close() completes
  return new Promise((resolve) => server.close(() => resolve()));
}

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

describe('redactDatabaseUrl', () => {
  it('masks credentials but keeps host/port/database', () => {
    expect(redactDatabaseUrl('postgresql://quad:quad@127.0.0.1:5432/quad')).toBe(
      'postgresql://***:***@127.0.0.1:5432/quad',
    );
  });

  it('returns a safe placeholder for an unparseable url', () => {
    expect(redactDatabaseUrl('not a url')).toBe('invalid-postgres-url');
  });
});

describe('waitForPort', () => {
  it('rejects for a closed port within the timeout', async () => {
    await expect(waitForPort('127.0.0.1', 1, { timeoutMs: 800, intervalMs: 150 })).rejects.toThrow();
  });
});

describe('waitForPostgres', () => {
  it('rejects without leaking the password', async () => {
    const message = await waitForPostgres({ host: '127.0.0.1', port: 1, timeoutMs: 600, intervalMs: 150 }).then(
      () => 'unexpectedly resolved',
      (e: unknown) => (e instanceof Error ? e.message : String(e)),
    );
    expect(message).toMatch(/Postgres not ready/);
    expect(message).not.toContain(':quad@');
    expect(message).not.toContain('quad:quad');
  });

  it('rejects within its deadline against a silent (non-Postgres) TCP server', async () => {
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      sockets.push(socket); // accept the socket but never speak the Postgres protocol
    });
    const port = await listen(server);
    try {
      const start = Date.now();
      await expect(
        waitForPostgres({ host: '127.0.0.1', port, timeoutMs: 1_000, intervalMs: 200 }),
      ).rejects.toThrow(/Postgres not ready/);
      expect(Date.now() - start).toBeLessThan(4_000);
    } finally {
      await closeServer(server, sockets);
    }
  });
});

describe('waitForRedis', () => {
  it('rejects within its deadline when the peer closes before PONG', async () => {
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      sockets.push(socket);
      socket.write('-ERR not redis\r\n');
      socket.end();
    });
    const port = await listen(server);
    try {
      const start = Date.now();
      await expect(waitForRedis('127.0.0.1', port, { timeoutMs: 1_000, intervalMs: 200 })).rejects.toThrow(
        /Redis not ready/,
      );
      expect(Date.now() - start).toBeLessThan(4_000);
    } finally {
      await closeServer(server, sockets);
    }
  });
});
