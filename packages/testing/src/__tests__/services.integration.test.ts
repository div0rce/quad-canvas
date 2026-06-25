import { describe, it } from 'vitest';
import { LOCAL_TEST_DATABASE, waitForPort } from '../index.js';

// Requires local Docker Compose services to be running:
//   docker compose up -d postgres redis
//   pnpm --filter @quad/testing test:integration
// Proves harness wiring against real local services — no product behavior is exercised.
describe('local docker services', () => {
  it('postgres port is reachable', async () => {
    await waitForPort(LOCAL_TEST_DATABASE.host, LOCAL_TEST_DATABASE.port, { timeoutMs: 30_000 });
  });

  it('redis port is reachable', async () => {
    await waitForPort('127.0.0.1', 6379, { timeoutMs: 30_000 });
  });
});
