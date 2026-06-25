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

/** Redact credentials from a Postgres URL so it is safe to log or include in errors. */
export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return 'invalid-postgres-url';
  }
}

/** Race a promise against a timeout, clearing the timer on settle. */
function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });
  // If the timeout wins, `promise` may settle later — swallow it to avoid unhandled rejections.
  promise.catch(() => undefined);
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Wait until Postgres actually accepts connections and answers a query (protocol-level readiness,
 * not just an open TCP port). Each attempt is bounded, so a port that accepts TCP but never speaks
 * Postgres cannot hang past the requested deadline. Errors never include credentials.
 */
export async function waitForPostgres(opts: LocalDatabaseOptions & WaitOptions = {}): Promise<void> {
  const connectionString = localTestDatabaseUrl(opts);
  const safeTarget = redactDatabaseUrl(connectionString);
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const intervalMs = opts.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const perAttemptMs = Math.min(2_000, Math.max(1, deadline - Date.now()));
    const client = new Client({
      connectionString,
      connectionTimeoutMillis: perAttemptMs,
      query_timeout: perAttemptMs,
    });
    try {
      await withDeadline(
        (async (): Promise<void> => {
          await client.connect();
          await client.query('SELECT 1');
        })(),
        perAttemptMs,
        'postgres readiness attempt timed out',
      );
      return;
    } catch (err) {
      lastError = err;
      await sleep(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
    } finally {
      // Fire-and-forget: a client still mid-connect to a silent peer can make end() hang,
      // and the underlying socket is bounded by connectionTimeoutMillis regardless.
      void client.end().catch(() => undefined);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : lastError ? String(lastError) : '';
  throw new Error(
    `Postgres not ready at ${safeTarget} after ${timeoutMs}ms` + (detail ? ` (last error: ${detail})` : ''),
  );
}
