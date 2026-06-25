// apps/api — composition root (T7 shell). Reads PORT/HOST explicitly (no secret reads) and
// starts the server. Domain/auth/WebSocket/DB wiring lands in later milestones.
import { buildApp } from './app.js';

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '127.0.0.1';

async function main(): Promise<void> {
  const app = await buildApp({ logger: true });
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
