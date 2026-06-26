// apps/api — composition root. Reads PORT/HOST + the DB connection string (the only place env is
// read) and starts the server. The Postgres connection string is supplied here and passed to the
// driver adapter in @quad/db; placement routes are wired only when a database is configured.
import { buildApp } from './app.js';
import { createPrismaClient, createPlacementRepository } from '@quad/db';
import { InMemoryRealtimeBus, RedisRealtimeBus, type RealtimeBus } from '@quad/realtime';
import { Redis } from 'ioredis';
import { cooldown } from '@quad/core';
import type { PlacementDeps } from './services/placement.js';
import { InMemorySessionStore, RedisSessionStore, type SessionStore } from './auth/session-store.js';

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '127.0.0.1';
const DATABASE_URL = process.env['DATABASE_URL'];
const REDIS_URL = process.env['REDIS_URL'];
// Fail-closed: an unset/empty/non-numeric/negative override falls back to the default cooldown
// (never to 0 by accident). An explicit non-negative number is honoured.
const DEFAULT_COOLDOWN_MS = cooldown.COOLDOWN_MIN_MINUTES * 60_000;
const rawCooldown = process.env['QUAD_COOLDOWN_MS'];
const parsedCooldown = rawCooldown !== undefined && rawCooldown.trim() !== '' ? Number(rawCooldown) : Number.NaN;
const COOLDOWN_MS = Number.isFinite(parsedCooldown) && parsedCooldown >= 0 ? parsedCooldown : DEFAULT_COOLDOWN_MS;

async function main(): Promise<void> {
  let placement: PlacementDeps | undefined;
  let bus: RealtimeBus | undefined;
  let sessionStore: SessionStore | undefined;
  let sessionRedis: Redis | undefined;
  if (DATABASE_URL) {
    const prisma = createPrismaClient({ connectionString: DATABASE_URL });
    // Redis-backed fan-out (cross-node) when REDIS_URL is set; otherwise in-memory (single node).
    // Both implement the same RealtimeBus interface, so nothing else changes.
    bus = REDIS_URL ? new RedisRealtimeBus(REDIS_URL) : new InMemoryRealtimeBus();
    await bus.ready();
    placement = {
      repo: createPlacementRepository(prisma),
      cooldownMs: COOLDOWN_MS,
      now: () => new Date(),
      bus,
    };
    // Server-side sessions (Redis where available). The verification front-door that issues
    // sessions is a follow-on; until then this validates sessions only (none exist yet → 401).
    if (REDIS_URL) {
      sessionRedis = new Redis(REDIS_URL);
      sessionStore = new RedisSessionStore(sessionRedis);
    } else {
      sessionStore = new InMemorySessionStore();
    }
  }

  const app = await buildApp({
    logger: true,
    ...(placement ? { placement } : {}),
    ...(sessionStore ? { auth: { sessionStore } } : {}),
  });
  if (!placement) {
    app.log.warn('DATABASE_URL is not set — placement routes are disabled (health only).');
  }

  const shutdown = async (): Promise<void> => {
    await app.close();
    if (bus) await bus.close();
    if (sessionRedis) await sessionRedis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

void main();
