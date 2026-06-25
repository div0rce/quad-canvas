// @quad/db — Prisma client factory (T6 skeleton). The ONLY place a PrismaClient is created
// (no direct DB access outside @quad/db). Prisma 7 uses a driver adapter (PrismaPg). There are
// NO env reads here and NO production connection string — the caller passes an explicit
// connection string, wired from validated config/env at the composition root (e.g. apps/api).
// Instantiation does not open a connection.
import { PrismaClient } from './generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

export interface CreatePrismaClientOptions {
  /** Postgres connection string, supplied by the caller (never read from process.env here). */
  readonly connectionString: string;
}

/** Create a PrismaClient backed by the Postgres driver adapter. */
export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  const adapter = new PrismaPg({ connectionString: options.connectionString });
  return new PrismaClient({ adapter });
}

export { PrismaClient };
export type { Tenant, User, Membership, Canvas } from './generated/prisma/client.js';
