// @quad/testing — local test database helpers (no production DB logic).
// Connection values match the local Docker Compose datastore — example/local creds, never secrets.
import { Client } from 'pg';
import { sleep, waitForPort } from './docker.js';
import type { WaitOptions } from '../types.js';

/** Local Compose Postgres defaults (local-only; NOT production, NOT a real secret). */
export const LOCAL_TEST_DATABASE = {
  host: '127.0.0.1',
  port: 5432,
  user: 'quad',
  password: 'quad',
  database: 'quad',
} as const;

export interface LocalDatabaseOptions {
  readonly host?: string;
  readonly port?: number;
  readonly user?: string;
  readonly password?: string;
  readonly database?: string;
}

/** Build a Postgres connection string for the LOCAL test datastore only. */
export function localTestDatabaseUrl(opts: LocalDatabaseOptions = {}): string {
  const host = opts.host ?? LOCAL_TEST_DATABASE.host;
  const port = opts.port ?? LOCAL_TEST_DATABASE.port;
  const user = opts.user ?? LOCAL_TEST_DATABASE.user;
  const password = opts.password ?? LOCAL_TEST_DATABASE.password;
  const database = opts.database ?? LOCAL_TEST_DATABASE.database;
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/** Wait until the local test database port is reachable (TCP only; does not prove readiness). */
export async function waitForDatabasePort(opts: LocalDatabaseOptions & WaitOptions = {}): Promise<void> {
  await waitForPort(opts.host ?? LOCAL_TEST_DATABASE.host, opts.port ?? LOCAL_TEST_DATABASE.port, opts);
}

/**
 * Wait until Postgres actually accepts connections and answers a query (protocol-level readiness,
 * not just an open TCP port). Connects to the LOCAL test datastore and runs `SELECT 1`.
 */
export async function waitForPostgres(opts: LocalDatabaseOptions & WaitOptions = {}): Promise<void> {
  const connectionString = localTestDatabaseUrl(opts);
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const intervalMs = opts.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query('SELECT 1');
      return;
    } catch (err) {
      lastError = err;
      await sleep(intervalMs);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  throw new Error(
    `Postgres not ready at ${connectionString} after ${timeoutMs}ms` +
      (lastError ? ` (last error: ${String(lastError)})` : ''),
  );
}
