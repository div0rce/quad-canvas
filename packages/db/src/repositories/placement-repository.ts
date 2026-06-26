// @quad/db — placement repository (Prisma-backed). The ONLY path that writes the pixel event
// log + projection. A single transaction (serialized per-canvas via a Postgres advisory lock)
// performs: idempotency replay → cooldown enforcement → per-canvas sequence allocation →
// append PixelPlaced → upsert the projection. So duplicate-safety, cooldown fairness, and
// ordering are all atomic with the append (docs/EVENT_SOURCING.md §9, DB-INV-4, COOL-DP-*).
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '../client.js';

/** The tenant's current (active) canvas. */
export interface CurrentCanvasRow {
  readonly id: string;
  readonly tenantId: string;
  readonly termLabel: string;
  readonly status: string;
  readonly width: number;
  readonly height: number;
}

/** A placed cell in a snapshot. */
export interface SnapshotCellRow {
  readonly x: number;
  readonly y: number;
  readonly color: number;
}

/** A canvas snapshot: placed cells + the per-canvas sequence high-water (WS resume point). */
export interface Snapshot {
  readonly cells: readonly SnapshotCellRow[];
  readonly seq: number;
}

/** One per-cell history entry (DC2: `ownerHandle`, never the email). */
export interface HistoryEntryRow {
  readonly color: number;
  readonly seq: number;
  readonly ownerHandle: string | null;
  readonly placedAt: Date;
}

export interface HistoryPage {
  readonly entries: readonly HistoryEntryRow[];
  readonly nextCursor: number | null;
}

export interface HistoryQuery {
  readonly cursor?: number;
  readonly limit: number;
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
  /** The tenant's latest canvas regardless of status (for read/view endpoints), or null. */
  findViewableCanvas(tenantId: string): Promise<CurrentCanvasRow | null>;
  /** The user's ACTIVE membership role in the tenant, or null (suspended/banned/none) — for auth. */
  findActiveMembership(tenantId: string, userId: string): Promise<{ role: string } | null>;
  /** Find or create a user by email (DC3); a placeholder public handle is generated for new users. */
  findOrCreateUserByEmail(email: string): Promise<{ id: string }>;
  /** Ensure a membership exists (active for new users); NEVER re-activates a suspended/banned one. */
  ensureActiveMembership(tenantId: string, userId: string, role: string): Promise<void>;
  /** Current projected state of one cell, or null if never placed. */
  getPixel(canvasId: string, x: number, y: number): Promise<PixelRow | null>;
  /** All placed cells for the canvas plus the sequence high-water (the projection snapshot). */
  getSnapshot(canvasId: string): Promise<Snapshot>;
  /** Cursor-paginated placement history for one cell (oldest→newest), DC2 attribution. */
  getPixelHistory(canvasId: string, x: number, y: number, query: HistoryQuery): Promise<HistoryPage>;
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
        select: { id: true, tenantId: true, termLabel: true, status: true, width: true, height: true },
      });
      return c ?? null;
    },

    async findViewableCanvas(tenantId) {
      const c = await prisma.canvas.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, tenantId: true, termLabel: true, status: true, width: true, height: true },
      });
      return c ?? null;
    },

    async findActiveMembership(tenantId, userId) {
      const m = await prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        select: { role: true, status: true },
      });
      if (!m || m.status !== 'active') return null;
      return { role: m.role };
    },

    async findOrCreateUserByEmail(email) {
      // Canonicalize so case/whitespace variants map to one account; upsert is race-safe on the
      // unique email and the generated handle is only used on first insert.
      const normalized = email.trim().toLowerCase();
      const user = await prisma.user.upsert({
        where: { email: normalized },
        create: { email: normalized, publicHandle: `user_${randomBytes(5).toString('hex')}`, status: 'active' },
        update: {},
        select: { id: true },
      });
      return { id: user.id };
    },

    async ensureActiveMembership(tenantId, userId, role) {
      // New members are created active; an existing membership is left untouched — re-verifying must
      // never reinstate a suspended/banned user (status stays as-is).
      await prisma.membership.upsert({
        where: { tenantId_userId: { tenantId, userId } },
        create: { tenantId, userId, role, status: 'active' },
        update: {},
      });
    },

    async getSnapshot(canvasId) {
      const cells = await prisma.pixel.findMany({
        where: { canvasId },
        select: { x: true, y: true, color: true },
        orderBy: [{ y: 'asc' }, { x: 'asc' }],
      });
      const last = await prisma.pixelEvent.findFirst({ where: { canvasId }, orderBy: { seq: 'desc' }, select: { seq: true } });
      return { cells, seq: last?.seq ?? 0 };
    },

    async getPixelHistory(canvasId, x, y, query) {
      const take = query.limit + 1;
      const rows = await prisma.pixelEvent.findMany({
        // Only placements — exclude future moderation/compensating events from public history.
        where: { canvasId, x, y, type: 'PixelPlaced', ...(query.cursor !== undefined ? { seq: { gt: query.cursor } } : {}) },
        orderBy: { seq: 'asc' },
        take,
        select: { newColor: true, seq: true, createdAt: true, actor: { select: { publicHandle: true } } },
      });
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const nextCursor = hasMore ? (page[page.length - 1]?.seq ?? null) : null;
      return {
        entries: page.map((r) => ({ color: r.newColor, seq: r.seq, ownerHandle: r.actor.publicHandle, placedAt: r.createdAt })),
        nextCursor,
      };
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
          // Cooldown is gated on the actor's last PLACEMENT, not moderation/compensating events.
          where: { canvasId, actorUserId, type: 'PixelPlaced' },
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
