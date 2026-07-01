// apps/api — listener root. Runtime dependency assembly lives in runtime.ts so the same app can be
// exported to Vercel as a server without calling listen().
import { createGracefulShutdown } from './shutdown.js';
import { createRuntimeApp } from './runtime.js';

// `??` only falls back on null/undefined, so a blank env var (e.g. `HOST=` in an env file) would slip
// through: HOST="" binds ALL interfaces and PORT="" → Number("")===0 binds a random port. Treat blank
// as unset, and fall back on a non-numeric/out-of-range port.
const HOST = process.env['HOST']?.trim() || '127.0.0.1';
const rawPort = process.env['PORT']?.trim();
const parsedPort = rawPort ? Number(rawPort) : 3000;
const PORT = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535 ? parsedPort : 3000;

async function main(): Promise<void> {
  const { app, cleanups } = await createRuntimeApp({ logger: true });

  // Drain in-flight requests (app.close) before closing the DB/Redis/bus; a watchdog forces exit if
  // anything hangs. Idempotent across repeated signals.
  const shutdown = createGracefulShutdown({
    close: () => app.close(),
    cleanups,
    log: { info: (obj, msg) => app.log.info(obj, msg), error: (obj, msg) => app.log.error(obj, msg) },
    exit: (code) => process.exit(code),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer as NodeJS.Timeout),
  });
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
