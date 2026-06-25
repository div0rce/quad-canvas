// @quad/testing — protocol-level Redis readiness (RESP PING -> +PONG). Node built-ins only.
import { connect } from 'node:net';
import { sleep } from './docker.js';
import type { WaitOptions } from '../types.js';

function pingOnce(host: string, port: number, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port });
    let buffer = '';
    let settled = false;
    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      action();
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => socket.write('PING\r\n'));
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('+PONG')) settle(resolve);
    });
    socket.once('timeout', () => settle(() => reject(new Error('redis ping timed out'))));
    socket.once('error', (err: Error) => settle(() => reject(err)));
    socket.once('end', () => settle(() => reject(new Error('connection ended before PONG'))));
    socket.once('close', () => settle(() => reject(new Error('connection closed before PONG'))));
  });
}

/** Wait until Redis answers PING with +PONG (proves the server is up, not just the port). */
export async function waitForRedis(host = '127.0.0.1', port = 6379, opts: WaitOptions = {}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const intervalMs = opts.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      await pingOnce(host, port, Math.min(intervalMs * 2, 2_000));
      return;
    } catch (err) {
      lastError = err;
      await sleep(intervalMs);
    }
  }
  throw new Error(
    `Redis not ready at ${host}:${port} after ${timeoutMs}ms` +
      (lastError ? ` (last error: ${String(lastError)})` : ''),
  );
}
