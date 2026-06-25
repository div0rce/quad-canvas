import { describe, it } from 'vitest';
import { waitForPostgres, waitForRedis } from '../index.js';

// Requires the local Docker Compose datastores to be running. Run via Turbo so workspace deps
// (@quad/config, @quad/core) are built first:
//   docker compose up -d postgres redis
//   pnpm test:integration            # root: turbo run test:integration (builds deps, then runs)
//
// These checks are PROTOCOL-level (Postgres `SELECT 1`, Redis `PING` -> +PONG), not just an open
// TCP port — so a port opened before the datastore is ready (or another process on the port)
// cannot produce a false-green. No product behavior is exercised.
describe('local docker services', () => {
  it('postgres accepts connections and answers a query', async () => {
    await waitForPostgres({ timeoutMs: 30_000 });
  });

  it('redis answers PING with PONG', async () => {
    await waitForRedis('127.0.0.1', 6379, { timeoutMs: 30_000 });
  });
});
