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
  | { readonly kind: 'cooldown'; readonly retryAfterMs: number }
  | { readonly kind: 'inactive' };

export interface ApplyMemberModerationInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly actionType: string;
  readonly status: string;
  readonly reason: string;
}

export type ApplyMemberModerationResult =
  | { readonly updated: true; readonly auditId: string; readonly createdAt: Date }
  | { readonly updated: false };

export interface AssignRoleInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly role: string;
}

export interface CreateReportInput {
  readonly tenantId: string;
  readonly canvasId: string | null;
  readonly reporterUserId: string;
  readonly targetRef: string;
  readonly reason: string;
}

export interface ReportRow {
  readonly id: string;
  readonly targetRef: string;
  readonly reason: string;
  readonly status: string;
  readonly createdAt: Date;
}

export interface ListReportsQuery {
  readonly status?: string;
  readonly cursor?: string;
  readonly limit: number;
}

export interface ReportPage {
  readonly items: readonly ReportRow[];
  readonly nextCursor: string | null;
}

export interface ResolveReportInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly reportId: string;
  readonly status: string;
  readonly actionType: string;
}

export interface RosterRow {
  readonly userId: string;
  readonly handle: string | null;
  readonly displayName: string | null;
  readonly role: string;
  readonly status: string;
}

export interface RosterPage {
  readonly items: readonly RosterRow[];
  readonly nextCursor: string | null;
}

export interface CanvasLifecycleInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly canvasId: string;
  readonly status: string;
}

export interface RollbackPixelInput {
  readonly tenantId: string;
  readonly canvasId: string;
  readonly actorUserId: string;
  readonly x: number;
  readonly y: number;
  readonly reason: string;
}

export type RollbackResult =
  | {
      readonly kind: 'rolledBack';
      readonly x: number;
      readonly y: number;
      /** The color the cell reverted to, or null if it is now empty. */
      readonly color: number | null;
      readonly seq: number;
      readonly auditId: string;
      readonly createdAt: Date;
    }
  | { readonly kind: 'absent' }
  | { readonly kind: 'archived' };

export interface RollbackRegionInput {
  readonly tenantId: string;
  readonly canvasId: string;
  readonly actorUserId: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly reason: string;
}

export type RegionRollbackResult =
  | {
      readonly kind: 'rolledBack';
      /** Cells that were reverted (each to its prior color, or null if emptied). */
      readonly cells: ReadonlyArray<{ readonly x: number; readonly y: number; readonly color: number | null }>;
      /** Highest per-canvas seq assigned across the region's compensating events. */
      readonly seq: number;
      readonly auditId: string;
      readonly createdAt: Date;
    }
  | { readonly kind: 'archived' };

export interface ArchiveRow {
  readonly id: string;
  readonly term: string;
  readonly status: string;
  readonly width: number;
  readonly height: number;
  readonly createdAt: Date;
}

export interface ArchivePage {
  readonly items: readonly ArchiveRow[];
  readonly nextCursor: string | null;
}

export interface ProfileRow {
  readonly handle: string;
  readonly displayName: string | null;
  readonly role: string;
  readonly joinedAt: Date;
  readonly pixelsPlaced: number;
}

export interface LeaderboardRow {
  readonly handle: string;
  readonly displayName: string | null;
  readonly pixelsPlaced: number;
}

export interface PlacementRepository {
  /** The tenant's current ACTIVE canvas (open for placement), or null. */
  findCurrentCanvas(tenantId: string): Promise<CurrentCanvasRow | null>;
  /** Cursor-paginated past-term archives (status archived), newest first. */
  listArchives(tenantId: string, query: { cursor?: string; limit: number }): Promise<ArchivePage>;
  /** A single archived canvas by term label, or null if none/not archived. */
  findArchiveByTerm(tenantId: string, term: string): Promise<ArchiveRow | null>;
  /** A member's public profile (DC2 + placement count) by handle, scoped to the tenant. */
  getProfileByHandle(tenantId: string, handle: string): Promise<ProfileRow | null>;
  /** A member's profile by user id (for the caller's own `/me`), scoped to the tenant. */
  getProfileByUserId(tenantId: string, userId: string): Promise<ProfileRow | null>;
  /** Top placers in the tenant (active members, DC2), ordered by placement count desc. */
  getLeaderboard(tenantId: string, limit: number): Promise<readonly LeaderboardRow[]>;
  /** The tenant's latest canvas regardless of status (for read/view endpoints), or null. */
  findViewableCanvas(tenantId: string): Promise<CurrentCanvasRow | null>;
  /** The user's ACTIVE membership role in the tenant, or null (suspended/banned/none) — for auth. */
  findActiveMembership(tenantId: string, userId: string): Promise<{ role: string } | null>;
  /** Find or create a user by email (DC3); a placeholder public handle is generated for new users. */
  findOrCreateUserByEmail(email: string): Promise<{ id: string }>;
  /** Ensure a membership exists (active for new users); NEVER re-activates a suspended/banned one. */
  ensureActiveMembership(tenantId: string, userId: string, role: string): Promise<void>;
  /** A user's public identity (DC2 handle/displayName) for session reflection, or null. */
  getPublicIdentity(userId: string): Promise<{ handle: string; displayName?: string } | null>;
  /** A member's role regardless of status (active/suspended/banned), or null if not a member. */
  getMembershipRole(tenantId: string, userId: string): Promise<string | null>;
  /** Atomically set a member's status + write the DC4 audit record. `updated:false` if not a member. */
  applyMemberModeration(input: ApplyMemberModerationInput): Promise<ApplyMemberModerationResult>;
  /** Atomically set a member's role + write the DC4 audit record. `updated:false` if not a member. */
  assignMembershipRole(input: AssignRoleInput): Promise<ApplyMemberModerationResult>;
  /** File a user report (DC4); returns its id + initial status. */
  createReport(input: CreateReportInput): Promise<{ id: string; status: string }>;
  /** Cursor-paginated report queue for a tenant (oldest→newest), optionally filtered by status. */
  listReports(tenantId: string, query: ListReportsQuery): Promise<ReportPage>;
  /** Atomically set a report's status + write the DC4 audit record. `updated:false` if not found. */
  resolveReport(input: ResolveReportInput): Promise<ApplyMemberModerationResult>;
  /** Cursor-paginated tenant roster (members with DC2 identity, role, status). */
  listRoster(tenantId: string, query: { cursor?: string; limit: number }): Promise<RosterPage>;
  /** Atomically set a canvas's lifecycle status + write the DC4 audit record. */
  setCanvasLifecycle(input: CanvasLifecycleInput): Promise<ApplyMemberModerationResult>;
  /** Roll a cell back to its prior placement (or empty): compensating event + projection + audit. */
  rollbackPixel(input: RollbackPixelInput): Promise<RollbackResult>;
  /** Roll back every placed cell in a rectangle (one DC4 audit for the region). */
  rollbackRegion(input: RollbackRegionInput): Promise<RegionRollbackResult>;
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

    async listArchives(tenantId, query) {
      // Compound keyset cursor `"<iso>|<id>"` — ordering by (createdAt, id) is stable even when several
      // archives share a createdAt (e.g. a bulk import), so no row is skipped or repeated across pages.
      let cursorDate: Date | undefined;
      let cursorId: string | undefined;
      if (query.cursor !== undefined) {
        const sep = query.cursor.lastIndexOf('|');
        if (sep > 0) {
          cursorDate = new Date(query.cursor.slice(0, sep));
          cursorId = query.cursor.slice(sep + 1);
        }
      }
      const rows = await prisma.canvas.findMany({
        where: {
          tenantId,
          status: 'archived',
          ...(cursorDate && cursorId
            ? { OR: [{ createdAt: { lt: cursorDate } }, { AND: [{ createdAt: cursorDate }, { id: { lt: cursorId } }] }] }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: { id: true, termLabel: true, status: true, width: true, height: true, createdAt: true },
      });
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null;
      return {
        items: page.map((c) => ({ id: c.id, term: c.termLabel, status: c.status, width: c.width, height: c.height, createdAt: c.createdAt })),
        nextCursor,
      };
    },

    async findArchiveByTerm(tenantId, term) {
      const c = await prisma.canvas.findUnique({
        where: { tenantId_termLabel: { tenantId, termLabel: term } },
        select: { id: true, termLabel: true, status: true, width: true, height: true, createdAt: true },
      });
      if (!c || c.status !== 'archived') return null; // only archived canvases are public archives
      return { id: c.id, term: c.termLabel, status: c.status, width: c.width, height: c.height, createdAt: c.createdAt };
    },

    async getProfileByHandle(tenantId, handle) {
      // Tenant-scoped: an ACTIVE member of this tenant whose user carries this public handle.
      // Handles are not yet tenant-unique (schema note), so pick deterministically by join order.
      const m = await prisma.membership.findFirst({
        where: { tenantId, status: 'active', user: { publicHandle: handle } },
        orderBy: { createdAt: 'asc' },
        select: { role: true, createdAt: true, userId: true, user: { select: { publicHandle: true, displayName: true } } },
      });
      if (!m || m.user.publicHandle === null) return null;
      const pixelsPlaced = await prisma.pixelEvent.count({ where: { tenantId, actorUserId: m.userId, type: 'PixelPlaced' } });
      return { handle: m.user.publicHandle, displayName: m.user.displayName, role: m.role, joinedAt: m.createdAt, pixelsPlaced };
    },

    async getProfileByUserId(tenantId, userId) {
      const m = await prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        select: { role: true, status: true, createdAt: true, user: { select: { publicHandle: true, displayName: true } } },
      });
      if (!m || m.status !== 'active' || m.user.publicHandle === null) return null;
      const pixelsPlaced = await prisma.pixelEvent.count({ where: { tenantId, actorUserId: userId, type: 'PixelPlaced' } });
      return { handle: m.user.publicHandle, displayName: m.user.displayName, role: m.role, joinedAt: m.createdAt, pixelsPlaced };
    },

    async getLeaderboard(tenantId, limit) {
      // Rank by placement count, ties broken deterministically by user id. Page the grouped counts
      // until `limit` ELIGIBLE members (active + public handle, DC2) are collected — so a run of
      // suspended/handle-less top placers can't truncate the board while eligible members remain.
      const rows: LeaderboardRow[] = [];
      const batch = Math.max(limit, 1) * 2;
      let skip = 0;
      for (let guard = 0; guard < 50 && rows.length < limit; guard++) {
        const grouped = await prisma.pixelEvent.groupBy({
          by: ['actorUserId'],
          where: { tenantId, type: 'PixelPlaced' },
          _count: { _all: true },
          orderBy: [{ _count: { actorUserId: 'desc' } }, { actorUserId: 'asc' }],
          take: batch,
          skip,
        });
        if (grouped.length === 0) break;
        const ids = grouped.map((g) => g.actorUserId);
        const memberships = await prisma.membership.findMany({
          where: { tenantId, status: 'active', userId: { in: ids } },
          select: { userId: true, user: { select: { publicHandle: true, displayName: true } } },
        });
        const byUser = new Map(memberships.map((m) => [m.userId, m.user]));
        for (const g of grouped) {
          const u = byUser.get(g.actorUserId);
          if (!u || u.publicHandle === null) continue; // inactive/banned or no handle → omit
          rows.push({ handle: u.publicHandle, displayName: u.displayName, pixelsPlaced: g._count._all });
          if (rows.length >= limit) break;
        }
        if (grouped.length < batch) break; // exhausted all groups
        skip += batch;
      }
      return rows;
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

    async getPublicIdentity(userId) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { publicHandle: true, displayName: true } });
      if (!u || u.publicHandle === null) return null; // no public handle → no public identity
      return u.displayName !== null ? { handle: u.publicHandle, displayName: u.displayName } : { handle: u.publicHandle };
    },

    async getMembershipRole(tenantId, userId) {
      const m = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, select: { role: true } });
      return m?.role ?? null;
    },

    async applyMemberModeration(input) {
      // Status change + audit commit together — there is no action without an audit entry (P-MOD-4).
      return prisma.$transaction(async (tx): Promise<ApplyMemberModerationResult> => {
        const result = await tx.membership.updateMany({
          where: { tenantId: input.tenantId, userId: input.targetUserId },
          data: { status: input.status },
        });
        if (result.count === 0) return { updated: false };
        const action = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: input.actionType,
            targetRef: input.targetUserId,
            reason: input.reason,
          },
          select: { id: true, createdAt: true },
        });
        return { updated: true, auditId: action.id, createdAt: action.createdAt };
      });
    },

    async assignMembershipRole(input) {
      return prisma.$transaction(async (tx): Promise<ApplyMemberModerationResult> => {
        const result = await tx.membership.updateMany({
          where: { tenantId: input.tenantId, userId: input.targetUserId },
          data: { role: input.role },
        });
        if (result.count === 0) return { updated: false };
        const action = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: 'assign_role',
            targetRef: input.targetUserId,
            reason: `role set to ${input.role}`,
          },
          select: { id: true, createdAt: true },
        });
        return { updated: true, auditId: action.id, createdAt: action.createdAt };
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
      // Replay the cell's full event log so rolled-back placements drop out of the PUBLIC history —
      // a moderated placement (popped by a PixelRolledBack) must never be re-exposed here. A cell's
      // event count is small, so reading the whole cell and paginating in-memory is acceptable.
      const events = await prisma.pixelEvent.findMany({
        where: { canvasId, x, y },
        orderBy: { seq: 'asc' },
        select: { type: true, newColor: true, seq: true, createdAt: true, actor: { select: { publicHandle: true } } },
      });
      const stack: Array<{ color: number; seq: number; ownerHandle: string | null; placedAt: Date }> = [];
      for (const e of events) {
        if (e.type === 'PixelPlaced' && e.newColor !== null) {
          stack.push({ color: e.newColor, seq: e.seq, ownerHandle: e.actor.publicHandle, placedAt: e.createdAt });
        } else if (e.type === 'PixelRolledBack') {
          stack.pop();
        }
      }
      // The stack is seq-ascending (pushed in order, only the tail is popped) — paginate by seq cursor.
      const cursor = query.cursor;
      const visible = cursor !== undefined ? stack.filter((s) => s.seq > cursor) : stack;
      const hasMore = visible.length > query.limit;
      const page = hasMore ? visible.slice(0, query.limit) : visible;
      const nextCursor = hasMore ? (page[page.length - 1]?.seq ?? null) : null;
      return {
        entries: page.map((s) => ({ color: s.color, seq: s.seq, ownerHandle: s.ownerHandle, placedAt: s.placedAt })),
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
      if (!e || e.newColor === null) return null; // only a placement (non-null newColor) is replayable
      return { x: e.x, y: e.y, color: e.newColor, seq: e.seq, placedAt: e.createdAt };
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
          return { kind: 'duplicate', row: { x: existing.x, y: existing.y, color: existing.newColor ?? color, seq: existing.seq, placedAt: existing.createdAt } };
        }

        // Re-check the canvas is still active INSIDE the lock — a freeze that committed between the
        // service's canvas lookup and here must reject the placement (lifecycle/append serialize).
        const canvasState = await tx.canvas.findUnique({ where: { id: canvasId }, select: { status: true } });
        if (!canvasState || canvasState.status !== 'active') return { kind: 'inactive' };

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

    async createReport(input) {
      const report = await prisma.report.create({
        data: {
          tenantId: input.tenantId,
          canvasId: input.canvasId,
          reporterUserId: input.reporterUserId,
          targetRef: input.targetRef,
          reason: input.reason,
        },
        select: { id: true, status: true },
      });
      return { id: report.id, status: report.status };
    },

    async listReports(tenantId, query) {
      const rows = await prisma.report.findMany({
        where: {
          tenantId,
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(query.cursor !== undefined ? { createdAt: { gt: new Date(query.cursor) } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: query.limit + 1,
        select: { id: true, targetRef: true, reason: true, status: true, createdAt: true },
      });
      const hasMore = rows.length > query.limit;
      const items = hasMore ? rows.slice(0, query.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
      return { items, nextCursor };
    },

    async resolveReport(input) {
      // Report status change + audit commit together (no action without an audit, P-MOD-4).
      return prisma.$transaction(async (tx): Promise<ApplyMemberModerationResult> => {
        const result = await tx.report.updateMany({
          where: { tenantId: input.tenantId, id: input.reportId },
          data: { status: input.status },
        });
        if (result.count === 0) return { updated: false };
        const action = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: input.actionType,
            targetRef: input.reportId,
            reason: `report ${input.status}`,
          },
          select: { id: true, createdAt: true },
        });
        return { updated: true, auditId: action.id, createdAt: action.createdAt };
      });
    },

    async rollbackPixel(input) {
      const { tenantId, canvasId, actorUserId, x, y, reason } = input;
      return prisma.$transaction(async (tx): Promise<RollbackResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${canvasId})::bigint)`;
        // Re-check status under the lock — a freeze→archive may have committed since the route read it.
        const canvasState = await tx.canvas.findUnique({ where: { id: canvasId }, select: { status: true } });
        if (canvasState?.status === 'archived') return { kind: 'archived' };
        const pixel = await tx.pixel.findUnique({ where: { canvasId_x_y: { canvasId, x, y } }, select: { color: true } });
        if (!pixel) return { kind: 'absent' };
        // Replay the cell's FULL history (placements + prior rollbacks) to find the state to revert
        // to — the placement just below the current visible one. This honors intervening rollbacks so
        // a previously-moderated placement is never re-exposed (the visible "stack" pops on rollback).
        const events = await tx.pixelEvent.findMany({
          where: { canvasId, x, y },
          orderBy: { seq: 'asc' },
          select: { type: true, newColor: true, actorUserId: true },
        });
        const stack: Array<{ color: number; owner: string }> = [];
        for (const e of events) {
          if (e.type === 'PixelPlaced' && e.newColor !== null) stack.push({ color: e.newColor, owner: e.actorUserId });
          else if (e.type === 'PixelRolledBack') stack.pop();
        }
        const revertTo = stack.length >= 2 ? stack[stack.length - 2] : null;
        const revertedColor = revertTo?.color ?? null;
        const last = await tx.pixelEvent.findFirst({ where: { canvasId }, orderBy: { seq: 'desc' }, select: { seq: true } });
        const seq = (last?.seq ?? 0) + 1;
        const event = await tx.pixelEvent.create({
          data: {
            tenantId,
            canvasId,
            actorUserId,
            type: 'PixelRolledBack',
            seq,
            x,
            y,
            prevColor: pixel.color,
            newColor: revertedColor,
            // Server-generated, unguessable key in its own namespace — a client cannot pre-occupy it
            // (client placement keys come from the request header) to block a rollback.
            idempotencyKey: `rollback:${randomBytes(16).toString('hex')}`,
            schemaVersion: 1,
          },
          select: { id: true, createdAt: true },
        });
        if (revertTo) {
          await tx.pixel.update({
            where: { canvasId_x_y: { canvasId, x, y } },
            data: { color: revertTo.color, ownerUserId: revertTo.owner, lastEventId: event.id, seq, placedAt: event.createdAt },
          });
        } else {
          await tx.pixel.delete({ where: { canvasId_x_y: { canvasId, x, y } } });
        }
        const audit = await tx.moderationAction.create({
          data: { tenantId, actorUserId, actionType: 'pixel_rollback', targetRef: `${x},${y}`, reason },
          select: { id: true, createdAt: true },
        });
        return { kind: 'rolledBack', x, y, color: revertedColor, seq, auditId: audit.id, createdAt: audit.createdAt };
      });
    },

    async rollbackRegion(input) {
      const { tenantId, canvasId, actorUserId, x1, y1, x2, y2, reason } = input;
      return prisma.$transaction(async (tx): Promise<RegionRollbackResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${canvasId})::bigint)`;
        // Re-check status under the lock — an archive may have committed since the route read it.
        const canvasState = await tx.canvas.findUnique({ where: { id: canvasId }, select: { status: true } });
        if (canvasState?.status === 'archived') return { kind: 'archived' };
        const last = await tx.pixelEvent.findFirst({ where: { canvasId }, orderBy: { seq: 'desc' }, select: { seq: true } });
        let seq = last?.seq ?? 0;
        const cells: Array<{ x: number; y: number; color: number | null }> = [];
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            const pixel = await tx.pixel.findUnique({ where: { canvasId_x_y: { canvasId, x, y } }, select: { color: true } });
            if (!pixel) continue; // skip empty cells
            // Same replay as the single-cell rollback — honor intervening rollbacks per cell.
            const events = await tx.pixelEvent.findMany({
              where: { canvasId, x, y },
              orderBy: { seq: 'asc' },
              select: { type: true, newColor: true, actorUserId: true },
            });
            const stack: Array<{ color: number; owner: string }> = [];
            for (const e of events) {
              if (e.type === 'PixelPlaced' && e.newColor !== null) stack.push({ color: e.newColor, owner: e.actorUserId });
              else if (e.type === 'PixelRolledBack') stack.pop();
            }
            const revertTo = stack.length >= 2 ? stack[stack.length - 2] : null;
            const revertedColor = revertTo?.color ?? null;
            seq += 1;
            const event = await tx.pixelEvent.create({
              data: {
                tenantId,
                canvasId,
                actorUserId,
                type: 'PixelRolledBack',
                seq,
                x,
                y,
                prevColor: pixel.color,
                newColor: revertedColor,
                idempotencyKey: `rollback:${randomBytes(16).toString('hex')}`,
                schemaVersion: 1,
              },
              select: { id: true, createdAt: true },
            });
            if (revertTo) {
              await tx.pixel.update({
                where: { canvasId_x_y: { canvasId, x, y } },
                data: { color: revertTo.color, ownerUserId: revertTo.owner, lastEventId: event.id, seq, placedAt: event.createdAt },
              });
            } else {
              await tx.pixel.delete({ where: { canvasId_x_y: { canvasId, x, y } } });
            }
            cells.push({ x, y, color: revertedColor });
          }
        }
        const audit = await tx.moderationAction.create({
          data: { tenantId, actorUserId, actionType: 'region_rollback', targetRef: `${x1},${y1},${x2},${y2}`, reason },
          select: { id: true, createdAt: true },
        });
        return { kind: 'rolledBack', cells, seq, auditId: audit.id, createdAt: audit.createdAt };
      });
    },

    async listRoster(tenantId, query) {
      const rows = await prisma.membership.findMany({
        where: { tenantId, ...(query.cursor !== undefined ? { createdAt: { gt: new Date(query.cursor) } } : {}) },
        orderBy: { createdAt: 'asc' },
        take: query.limit + 1,
        select: { userId: true, role: true, status: true, createdAt: true, user: { select: { publicHandle: true, displayName: true } } },
      });
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
      return {
        items: page.map((m) => ({ userId: m.userId, handle: m.user.publicHandle, displayName: m.user.displayName, role: m.role, status: m.status })),
        nextCursor,
      };
    },

    async setCanvasLifecycle(input) {
      return prisma.$transaction(async (tx): Promise<ApplyMemberModerationResult> => {
        // Same per-canvas lock as placement — a freeze and an in-flight append serialize, so no
        // pixel is accepted after the freeze commits (with appendPlacement's in-tx status re-check).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.canvasId})::bigint)`;
        const result = await tx.canvas.updateMany({
          where: { id: input.canvasId, tenantId: input.tenantId },
          data: { status: input.status },
        });
        if (result.count === 0) return { updated: false };
        const action = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: 'canvas_lifecycle',
            targetRef: input.canvasId,
            reason: `status set to ${input.status}`,
          },
          select: { id: true, createdAt: true },
        });
        return { updated: true, auditId: action.id, createdAt: action.createdAt };
      });
    },
  };
}
