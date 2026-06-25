// @quad/testing — local test database helpers (SHAPE ONLY; no production DB logic).
// Connection values match the local Docker Compose datastore — example/local creds, never secrets.
import { waitForPort } from './docker.js';
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

/** Wait until the local test database port is reachable (does not open a DB connection). */
export async function waitForDatabase(opts: LocalDatabaseOptions & WaitOptions = {}): Promise<void> {
  await waitForPort(opts.host ?? LOCAL_TEST_DATABASE.host, opts.port ?? LOCAL_TEST_DATABASE.port, opts);
}
