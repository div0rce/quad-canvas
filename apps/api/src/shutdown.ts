// apps/api — graceful shutdown. On a signal: stop accepting + drain in-flight requests (app.close),
// then close dependencies (DB, Redis, bus) best-effort, then exit. A watchdog forces exit if cleanup
// hangs so a stuck dependency can't wedge the pod. Idempotent — a repeated signal is a no-op.
export interface Timer {
  unref?: () => void;
}

export interface ShutdownDeps {
  /** Stop accepting connections and resolve once in-flight requests have drained (app.close). */
  readonly close: () => Promise<void>;
  /** Dependency closers (e.g. prisma.$disconnect, redis.quit, bus.close), each best-effort. */
  readonly cleanups: ReadonlyArray<() => Promise<void>>;
  readonly log: { info: (obj: unknown, msg: string) => void; error: (obj: unknown, msg: string) => void };
  readonly exit: (code: number) => void;
  readonly setTimer: (fn: () => void, ms: number) => Timer;
  readonly clearTimer: (timer: Timer) => void;
  /** Force-exit deadline (ms). Default 10s. */
  readonly timeoutMs?: number;
}

export function createGracefulShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
  let shuttingDown = false;
  return async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return; // a second signal must not run cleanup twice
    shuttingDown = true;
    deps.log.info({ signal }, 'graceful shutdown: draining in-flight requests');

    const watchdog = deps.setTimer(() => {
      deps.log.error({}, 'graceful shutdown timed out — forcing exit');
      deps.exit(1);
    }, deps.timeoutMs ?? 10_000);
    watchdog.unref?.(); // don't keep the loop alive just for the watchdog

    let code = 0;
    try {
      await deps.close();
    } catch (err) {
      deps.log.error({ err }, 'graceful shutdown: server close failed');
      code = 1;
    }
    // Always close dependencies, even if draining failed — don't leak DB/Redis handles.
    for (const cleanup of deps.cleanups) {
      try {
        await cleanup();
      } catch (err) {
        deps.log.error({ err }, 'graceful shutdown: dependency cleanup failed');
        code = 1;
      }
    }

    deps.clearTimer(watchdog);
    deps.exit(code);
  };
}
