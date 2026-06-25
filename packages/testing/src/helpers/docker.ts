// @quad/testing — Docker / local-service readiness helpers. Node built-ins only (no clients).
import { connect } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { WaitOptions } from '../types.js';

const execFileAsync = promisify(execFile);

/** True when the local Docker daemon is reachable (`docker info` succeeds). */
export async function isDockerRunning(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['info'], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attemptConnection(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port });
    const fail = (err: Error): void => {
      socket.destroy();
      reject(err);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.end();
      resolve();
    });
    socket.once('timeout', () => fail(new Error('connection timed out')));
    socket.once('error', fail);
  });
}

/** Resolve once a TCP port accepts a connection; reject if it stays closed past the timeout. */
export async function waitForPort(host: string, port: number, opts: WaitOptions = {}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const intervalMs = opts.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await attemptConnection(host, port, Math.min(intervalMs * 2, 2_000));
      return;
    } catch (err) {
      lastError = err;
      await sleep(intervalMs);
    }
  }
  throw new Error(
    `Timed out waiting for ${host}:${port} after ${timeoutMs}ms` +
      (lastError ? ` (last error: ${String(lastError)})` : ''),
  );
}
