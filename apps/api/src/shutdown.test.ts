import { describe, it, expect, vi } from 'vitest';
import { createGracefulShutdown, type ShutdownDeps } from './shutdown.js';

function harness(over: Partial<ShutdownDeps> = {}) {
  const exits: number[] = [];
  const cleared: unknown[] = [];
  const deps: ShutdownDeps = {
    close: over.close ?? (async () => {}),
    cleanups: over.cleanups ?? [],
    log: { info: () => {}, error: () => {} },
    exit: (code) => exits.push(code),
    setTimer: over.setTimer ?? (() => ({ unref: () => {} })),
    clearTimer: (t) => cleared.push(t),
    ...(over.timeoutMs !== undefined ? { timeoutMs: over.timeoutMs } : {}),
  };
  return { shutdown: createGracefulShutdown(deps), exits, cleared };
}

describe('createGracefulShutdown', () => {
  it('drains, runs all cleanups, then exits 0', async () => {
    const order: string[] = [];
    const { shutdown, exits, cleared } = harness({
      close: async () => void order.push('close'),
      cleanups: [async () => void order.push('a'), async () => void order.push('b')],
    });
    await shutdown('SIGTERM');
    expect(order).toEqual(['close', 'a', 'b']);
    expect(exits).toEqual([0]);
    expect(cleared).toHaveLength(1); // watchdog cancelled
  });

  it('exits 1 if a cleanup fails but still runs the rest', async () => {
    const ran: string[] = [];
    const { shutdown, exits } = harness({
      cleanups: [
        async () => {
          throw new Error('redis down');
        },
        async () => void ran.push('still-ran'),
      ],
    });
    await shutdown('SIGTERM');
    expect(ran).toEqual(['still-ran']);
    expect(exits).toEqual([1]);
  });

  it('closes dependencies even if draining fails (exit 1)', async () => {
    const ran: string[] = [];
    const { shutdown, exits } = harness({
      close: async () => {
        throw new Error('close failed');
      },
      cleanups: [async () => void ran.push('cleanup')],
    });
    await shutdown('SIGTERM');
    expect(ran).toEqual(['cleanup']); // dependency still closed
    expect(exits).toEqual([1]);
  });

  it('is idempotent — a repeated signal does not run cleanup twice', async () => {
    const close = vi.fn(async () => {});
    const { shutdown, exits } = harness({ close });
    await shutdown('SIGTERM');
    await shutdown('SIGINT');
    expect(close).toHaveBeenCalledTimes(1);
    expect(exits).toEqual([0]);
  });

  it('forces exit 1 when shutdown hangs past the watchdog', async () => {
    let fire: (() => void) | undefined;
    const { shutdown, exits } = harness({
      close: () => new Promise<void>(() => {}), // never resolves
      setTimer: (fn) => {
        fire = fn;
        return { unref: () => {} };
      },
    });
    void shutdown('SIGTERM'); // hangs on close
    fire?.(); // watchdog fires
    expect(exits).toEqual([1]);
  });
});
