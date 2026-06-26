// apps/api — composition root. Reads PORT/HOST + the DB connection string (the only place env is
// read) and starts the server. The Postgres connection string is supplied here and passed to the
// driver adapter in @quad/db; placement routes are wired only when a database is configured.
import { buildApp } from './app.js';
import { createPrismaClient, createPlacementRepository } from '@quad/db';
import { InMemoryRealtimeBus } from '@quad/realtime';
import { cooldown } from '@quad/core';
import type { PlacementDeps } from './services/placement.js';

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '127.0.0.1';
const DATABASE_URL = process.env['DATABASE_URL'];
// Fail-closed: an unset/empty/non-numeric/negative override falls back to the default cooldown
// (never to 0 by accident). An explicit non-negative number is honoured.
const DEFAULT_COOLDOWN_MS = cooldown.COOLDOWN_MIN_MINUTES * 60_000;
const rawCooldown = process.env['QUAD_COOLDOWN_MS'];
const parsedCooldown = rawCooldown !== undefined && rawCooldown.trim() !== '' ? Number(rawCooldown) : Number.NaN;
const COOLDOWN_MS = Number.isFinite(parsedCooldown) && parsedCooldown >= 0 ? parsedCooldown : DEFAULT_COOLDOWN_MS;

async function main(): Promise<void> {
  let placement: PlacementDeps | undefined;
  if (DATABASE_URL) {
    const prisma = createPrismaClient({ connectionString: DATABASE_URL });
    // In-memory fan-out (single node). A Redis-backed bus (cross-node) plugs into the same
    // RealtimeBus interface when horizontal scale is configured.
    placement = {
      repo: createPlacementRepository(prisma),
      cooldownMs: COOLDOWN_MS,
      now: () => new Date(),
      bus: new InMemoryRealtimeBus(),
    };
  }

  const app = await buildApp({ logger: true, ...(placement ? { placement } : {}) });
  if (!placement) {
    app.log.warn('DATABASE_URL is not set — placement routes are disabled (health only).');
  }
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
