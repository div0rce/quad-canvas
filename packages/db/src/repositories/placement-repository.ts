// @quad/db — placement repository (Prisma-backed). The ONLY path that writes the pixel event
// log + projection. A single transaction (serialized per-canvas via a Postgres advisory lock)
// performs: idempotency replay → cooldown enforcement → per-canvas sequence allocation →
// append PixelPlaced → upsert the projection. So duplicate-safety, cooldown fairness, and
// ordering are all atomic with the append (docs/EVENT_SOURCING.md §9, DB-INV-4, COOL-DP-*).
import type { PrismaClient } from '../client.js';

/** The tenant's current (active) canvas. */
export interface CurrentCanvasRow {
  readonly id: string;
  readonly tenantId: string;
  readonly status: string;
  readonly width: number;
  readonly height: number;
}

/** A projected cell. `ownerHandle` is DC2 (public) — the owner's email (DC3) is never read here. */
export interface PixelRow {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly ownerHandle: string | null;
  readonly placedAt: Date;
  readonly seq: number;
}

/** The authoritative placed-cell facts (from the event), returned for placed + replayed results. */
export interface PlacedRow {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly seq: number;
  readonly placedAt: Date;
}

export interface AppendPlacementInput {
  readonly tenantId: string;
  readonly canvasId: string;
  readonly actorUserId: string;
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly idempotencyKey: string;
  /** Server-authoritative cooldown window (ms); enforced inside the transaction. */
  readonly cooldownMs: number;
  /** Caller's clock at request time (ms since epoch). */
  readonly nowMs: number;
}

export type AppendResult =
  | { readonly kind: 'placed'; readonly row: PlacedRow }
  | { readonly kind: 'duplicate'; readonly row: PlacedRow }
  | { readonly kind: 'cooldown'; readonly retryAfterMs: number };

export interface PlacementRepository {
  /** The tenant's current ACTIVE canvas (open for placement), or null. */
  findCurrentCanvas(tenantId: string): Promise<CurrentCanvasRow | null>;
  /** Current projected state of one cell, or null if never placed. */
  getPixel(canvasId: string, x: number, y: number): Promise<PixelRow | null>;
  /** The persisted result for an idempotency key (tenant-scoped), or null — for replay. */
  findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<PlacedRow | null>;
  /** Atomically enforce idempotency + cooldown, then append the event + update the projection. */
  appendPlacement(input: AppendPlacementInput): Promise<AppendResult>;
}

export function createPlacementRepository(prisma: PrismaClient): PlacementRepository {
  return {
    async findCurrentCanvas(tenantId) {
      const c = await prisma.canvas.findFirst({
        where: { tenantId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, tenantId: true, status: true, width: true, height: true },
      });
      return c ?? null;
    },

    async getPixel(canvasId, x, y) {
      const p = await prisma.pixel.findUnique({
        where: { canvasId_x_y: { canvasId, x, y } },
        select: { x: true, y: true, color: true, placedAt: true, seq: true, owner: { select: { publicHandle: true } } },
      });
      if (!p) return null;
      return { x: p.x, y: p.y, color: p.color, ownerHandle: p.owner.publicHandle, placedAt: p.placedAt, seq: p.seq };
    },

    async findByIdempotencyKey(tenantId, idempotencyKey) {
      const e = await prisma.pixelEvent.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        select: { x: true, y: true, newColor: true, seq: true, createdAt: true },
      });
      return e ? { x: e.x, y: e.y, color: e.newColor, seq: e.seq, placedAt: e.createdAt } : null;
    },

    async appendPlacement(input) {
      const { tenantId, canvasId, actorUserId, x, y, color, idempotencyKey, cooldownMs, nowMs } = input;
      return prisma.$transaction(async (tx): Promise<AppendResult> => {
        // Serialize all placements on this canvas → idempotency, cooldown, and seq are atomic.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${canvasId})::bigint)`;

        const existing = await tx.pixelEvent.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
          select: { x: true, y: true, newColor: true, seq: true, createdAt: true },
        });
        if (existing) {
          return { kind: 'duplicate', row: { x: existing.x, y: existing.y, color: existing.newColor, seq: existing.seq, placedAt: existing.createdAt } };
        }

        const lastByActor = await tx.pixelEvent.findFirst({
          where: { canvasId, actorUserId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        if (lastByActor) {
          const elapsed = nowMs - lastByActor.createdAt.getTime();
          if (elapsed < cooldownMs) {
            return { kind: 'cooldown', retryAfterMs: cooldownMs - elapsed };
          }
        }

        const last = await tx.pixelEvent.findFirst({ where: { canvasId }, orderBy: { seq: 'desc' }, select: { seq: true } });
        const seq = (last?.seq ?? 0) + 1;
        const prev = await tx.pixel.findUnique({ where: { canvasId_x_y: { canvasId, x, y } }, select: { color: true } });
        const event = await tx.pixelEvent.create({
          data: {
            tenantId,
            canvasId,
            actorUserId,
            type: 'PixelPlaced',
            seq,
            x,
            y,
            prevColor: prev?.color ?? null,
            newColor: color,
            idempotencyKey,
            schemaVersion: 1,
          },
          select: { id: true, createdAt: true },
        });
        await tx.pixel.upsert({
          where: { canvasId_x_y: { canvasId, x, y } },
          create: { tenantId, canvasId, x, y, color, ownerUserId: actorUserId, lastEventId: event.id, seq, placedAt: event.createdAt },
          update: { tenantId, color, ownerUserId: actorUserId, lastEventId: event.id, seq, placedAt: event.createdAt },
        });
        return { kind: 'placed', row: { x, y, color, seq, placedAt: event.createdAt } };
      });
    },
  };
}
