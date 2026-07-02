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

export interface RecentPlacementRow {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly seq: number;
  readonly ownerHandle: string | null;
  readonly ownerDisplayName: string | null;
  readonly placedAt: Date;
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
  readonly actorUserId: string;
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
}

export type AppendResult =
  | { readonly kind: 'placed'; readonly row: PlacedRow }
  | { readonly kind: 'duplicate'; readonly row: PlacedRow }
  | { readonly kind: 'idempotency_conflict' }
  | { readonly kind: 'cooldown'; readonly retryAfterMs: number }
  | { readonly kind: 'inactive' };

export interface ApplyMemberModerationInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly actionType: string;
  readonly status: string;
  readonly reason: string;
  readonly idempotencyKey: string;
}

export type ApplyMemberModerationResult =
  | { readonly kind: 'applied' | 'replayed'; readonly auditId: string; readonly createdAt: Date; readonly seq?: number }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'idempotency_conflict' };

export interface AssignRoleInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly role: string;
  readonly idempotencyKey: string;
}

export interface CreateReportInput {
  readonly tenantId: string;
  readonly canvasId: string | null;
  readonly reporterUserId: string;
  readonly targetRef: string;
  readonly reason: string;
  /** Required idempotency key (from the request header) — a retry returns the original report. */
  readonly idempotencyKey: string;
}

export type CreateReportResult =
  | { readonly kind: 'created' | 'replayed'; readonly id: string; readonly status: string }
  | { readonly kind: 'idempotency_conflict' };

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
  /** The moderator's required explanation — preserved verbatim in the audit record. */
  readonly reason: string;
  readonly idempotencyKey: string;
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
  readonly idempotencyKey: string;
}

export interface CreateCanvasInput {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly term: string;
  readonly width: number;
  readonly height: number;
  readonly idempotencyKey: string;
}

export type CreateCanvasResult =
  | {
      readonly kind: 'created';
      readonly canvas: CurrentCanvasRow;
      /** The previous active canvas that was archived by this rollover (for a WS notification), or null. */
      readonly archivedCanvasId: string | null;
      readonly auditId: string;
      readonly createdAt: Date;
      readonly replayed?: boolean;
      /** Sequence of CanvasCreated/CanvasActivated on the new canvas. */
      readonly canvasSeq: number;
      /** Sequence of CanvasArchived on the superseded canvas, when present. */
      readonly archivedCanvasSeq: number | null;
    }
  | { readonly kind: 'duplicate_term' }
  | { readonly kind: 'idempotency_conflict' };

export interface RollbackPixelInput {
  readonly tenantId: string;
  readonly canvasId: string;
  readonly actorUserId: string;
  readonly x: number;
  readonly y: number;
  readonly reason: string;
  /** Required idempotency key — a retry returns the original action without re-applying the rollback. */
  readonly idempotencyKey: string;
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
      /** True when this is an idempotent replay of an earlier rollback (no new state change / broadcast). */
      readonly replayed?: boolean;
    }
  | { readonly kind: 'absent' }
  | { readonly kind: 'archived' }
  | { readonly kind: 'idempotency_conflict' };

export interface RollbackRegionInput {
  readonly tenantId: string;
  readonly canvasId: string;
  readonly actorUserId: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly reason: string;
  /** Required idempotency key — a retry returns the original action without re-applying the rollback. */
  readonly idempotencyKey: string;
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
      /** True when this is an idempotent replay of an earlier rollback (no new state change / broadcast). */
      readonly replayed?: boolean;
    }
  | { readonly kind: 'archived' }
  | { readonly kind: 'idempotency_conflict' };

export interface ActionReplayExpectation {
  readonly actorUserId: string;
  readonly actionType: string;
  readonly targetRef?: string;
  readonly reason: string;
}

export type ActionReplayResult =
  | { readonly kind: 'missing' }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'replayed'; readonly id: string; readonly targetRef: string; readonly createdAt: Date };

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

export interface ReplayMetaRow {
  readonly eventCount: number;
  readonly fromSeq: number;
  readonly toSeq: number;
}

export interface ArchiveStatsRow {
  readonly totalPlacements: number;
  readonly participants: number;
  readonly topPlacers: ReadonlyArray<{ readonly handle: string; readonly displayName: string | null; readonly pixelsPlaced: number }>;
}

export interface ProfileRow {
  readonly handle: string;
  readonly displayName: string | null;
  readonly role: string;
  readonly joinedAt: Date;
  readonly pixelsPlaced: number;
  readonly currentTermPixelsPlaced: number;
  readonly contributions: ReadonlyArray<{ readonly date: string; readonly count: number }>;
  readonly lifetimeStats: ProfileStatsRow;
  readonly currentTermStats: ProfileStatsRow;
  readonly recentPlacements: readonly ProfileRecentPlacementRow[];
}

export interface ProfileStatsRow {
  readonly pixelsPlaced: number;
  readonly survivingPixels: number;
  readonly streakDays: number;
  readonly longestStreakDays: number;
  readonly canvasesParticipated: number;
  readonly favoriteColor: number | null;
}

export interface ProfileRecentPlacementRow {
  readonly id: string;
  readonly term: string;
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly placedAt: Date;
  readonly surviving: boolean;
}

export interface LeaderboardRow {
  readonly handle: string;
  readonly displayName: string | null;
  readonly score: number;
  readonly pixelsPlaced: number;
  readonly survivingPixels: number;
}

export interface LeaderboardQuery {
  readonly category: 'placements' | 'surviving';
  readonly window: 'all' | 'today';
  readonly limit: number;
}

// ---- Friends: request-based, tenant-scoped graph (DC2 only — never exposes an email). ----

export interface FriendMemberRow {
  readonly handle: string;
  readonly displayName: string | null;
  readonly role: string;
}
export interface FriendsView {
  readonly friends: readonly FriendMemberRow[];
  readonly incoming: readonly FriendMemberRow[];
  readonly outgoing: readonly FriendMemberRow[];
}
export type FriendRelationshipKind = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends';
export interface FriendSearchRow extends FriendMemberRow {
  readonly relationship: FriendRelationshipKind;
}
export interface SendFriendRequestInput {
  readonly tenantId: string;
  readonly requesterUserId: string;
  readonly targetHandle: string;
  readonly idempotencyKey: string;
}
export type SendFriendRequestResult =
  | { readonly kind: 'requested' }
  | { readonly kind: 'accepted' }
  | { readonly kind: 'exists'; readonly relationship: FriendRelationshipKind }
  | { readonly kind: 'self' }
  | { readonly kind: 'not_found' };
export type FriendMutationResult = { readonly kind: 'ok' | 'not_found' };

export interface PlacementRepository {
  /** The tenant's current ACTIVE canvas (open for placement), or null. */
  findCurrentCanvas(tenantId: string): Promise<CurrentCanvasRow | null>;
  /** Cursor-paginated past-term archives (status archived), newest first. */
  listArchives(tenantId: string, query: { cursor?: string; limit: number }): Promise<ArchivePage>;
  /** A single archived canvas by term label, or null if none/not archived. */
  findArchiveByTerm(tenantId: string, term: string): Promise<ArchiveRow | null>;
  /** Replay derivation metadata (event count + seq range) for an archived term, or null. */
  getReplayMeta(tenantId: string, term: string): Promise<ReplayMetaRow | null>;
  /** Term statistics (total placements, distinct participants, top placers) for an archive, or null. */
  getArchiveStats(tenantId: string, term: string): Promise<ArchiveStatsRow | null>;
  /** A member's public profile (DC2 + placement count) by handle, scoped to the tenant. */
  getProfileByHandle(tenantId: string, handle: string): Promise<ProfileRow | null>;
  /** A member's profile by user id (for the caller's own `/me`), scoped to the tenant. */
  getProfileByUserId(tenantId: string, userId: string): Promise<ProfileRow | null>;
  /** Top placers in the tenant (active members, DC2), ordered by placement count desc. */
  getLeaderboard(tenantId: string, query: LeaderboardQuery): Promise<readonly LeaderboardRow[]>;
  /** The tenant's latest canvas regardless of status (for read/view endpoints), or null. */
  findViewableCanvas(tenantId: string): Promise<CurrentCanvasRow | null>;
  /** One canvas by id within a tenant, or null (used to reconstruct idempotent command results). */
  findCanvasById(tenantId: string, canvasId: string): Promise<CurrentCanvasRow | null>;
  /** Count of placements on a canvas since `since` — the load input for the dynamic cooldown. */
  countRecentPlacements(canvasId: string, since: Date): Promise<number>;
  /** Latest placement events on a canvas, newest first (public DC2 attribution only). */
  listRecentCanvasPlacements(canvasId: string, limit: number): Promise<readonly RecentPlacementRow[]>;
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
  createReport(input: CreateReportInput): Promise<CreateReportResult>;
  /** Cursor-paginated report queue for a tenant (oldest→newest), optionally filtered by status. */
  listReports(tenantId: string, query: ListReportsQuery): Promise<ReportPage>;
  /** Atomically set a report's status + write the DC4 audit record. `updated:false` if not found. */
  resolveReport(input: ResolveReportInput): Promise<ApplyMemberModerationResult>;
  /** Cursor-paginated tenant roster (members with DC2 identity, role, status). */
  listRoster(tenantId: string, query: { cursor?: string; limit: number }): Promise<RosterPage>;
  /** Atomically set a canvas's lifecycle status + write the DC4 audit record. */
  setCanvasLifecycle(input: CanvasLifecycleInput): Promise<ApplyMemberModerationResult>;
  /** Create a new term canvas as the active one (freezing any current active); audited. */
  createCanvas(input: CreateCanvasInput): Promise<CreateCanvasResult>;
  /** Look up a moderation/admin command by its tenant-scoped idempotency key and verify that the
   *  actor/action/target/reason fingerprint matches before replaying its result. */
  findActionReplay(tenantId: string, idempotencyKey: string, expected: ActionReplayExpectation): Promise<ActionReplayResult>;
  /** Roll a cell back to its prior placement (or empty): compensating event + projection + audit. */
  rollbackPixel(input: RollbackPixelInput): Promise<RollbackResult>;
  /** Roll back every placed cell in a rectangle (one DC4 audit for the region). */
  rollbackRegion(input: RollbackRegionInput): Promise<RegionRollbackResult>;
  /** Current projected state of one cell, or null if never placed. */
  getPixel(canvasId: string, x: number, y: number): Promise<PixelRow | null>;
  /** All placed cells for the canvas plus the sequence high-water (the projection snapshot). */
  getSnapshot(canvasId: string): Promise<Snapshot>;
  /** Reconstruct the projection as of a per-canvas `seq` by folding the event log (point-in-time replay). */
  reconstructAt(canvasId: string, seq: number): Promise<Snapshot>;
  /** Cursor-paginated placement history for one cell (oldest→newest), DC2 attribution. */
  getPixelHistory(canvasId: string, x: number, y: number, query: HistoryQuery): Promise<HistoryPage>;
  /** The persisted result for an idempotency key (tenant-scoped), or null — for replay. */
  findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<PlacedRow | null>;
  /** Atomically enforce idempotency + cooldown, then append the event + update the projection. */
  appendPlacement(input: AppendPlacementInput): Promise<AppendResult>;

  /** The caller's confirmed friends + pending requests (both directions), DC2 only. */
  listFriends(tenantId: string, userId: string): Promise<FriendsView>;
  /** Active members whose public handle matches `query` (prefix), with the caller's relationship. */
  searchFriendCandidates(tenantId: string, userId: string, query: string, limit: number): Promise<readonly FriendSearchRow[]>;
  /** Send (or auto-accept a reciprocal) friend request by the target's public handle. Idempotent. */
  sendFriendRequest(input: SendFriendRequestInput): Promise<SendFriendRequestResult>;
  /** Accept an incoming request from `requesterHandle`. */
  acceptFriendRequest(tenantId: string, addresseeUserId: string, requesterHandle: string): Promise<FriendMutationResult>;
  /** Cancel an outgoing request to `addresseeHandle`. */
  cancelFriendRequest(tenantId: string, requesterUserId: string, addresseeHandle: string): Promise<FriendMutationResult>;
  /** Remove a confirmed friend by handle (either direction). */
  removeFriend(tenantId: string, userId: string, otherHandle: string): Promise<FriendMutationResult>;
}

/** Parse a compound keyset cursor `"<iso>|<id>"` (createdAt + a tiebreak id). Returns null for an
 *  absent, old-format, or malformed cursor so the caller serves the first page rather than erroring
 *  (a raw `new Date("garbage")` in a query would throw a 500). A `(createdAt, id)` keyset is stable
 *  even when several rows share a millisecond, so no row is skipped or duplicated across pages. */
function parseKeysetCursor(cursor: string | undefined): { date: Date; id: string } | null {
  if (cursor === undefined) return null;
  const sep = cursor.lastIndexOf('|');
  if (sep <= 0) return null;
  const date = new Date(cursor.slice(0, sep));
  if (Number.isNaN(date.getTime())) return null;
  const id = cursor.slice(sep + 1);
  return id ? { date, id } : null;
}

interface StoredActionFingerprint {
  readonly actorUserId: string;
  readonly actionType: string;
  readonly targetRef: string;
  readonly reason: string | null;
}

function actionMatches(action: StoredActionFingerprint, expected: ActionReplayExpectation): boolean {
  return (
    action.actorUserId === expected.actorUserId &&
    action.actionType === expected.actionType &&
    (expected.targetRef === undefined || action.targetRef === expected.targetRef) &&
    action.reason === expected.reason
  );
}

function utcDay(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  if (!year || !month || !day) return Number.NaN;
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function streakStats(rawDays: readonly string[]): { streakDays: number; longestStreakDays: number } {
  const days = [...new Set(rawDays)]
    .map(utcDay)
    .filter((day) => Number.isFinite(day))
    .sort((a, b) => a - b);
  if (days.length === 0) return { streakDays: 0, longestStreakDays: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === days[i - 1]! + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  let current = 1;
  for (let i = days.length - 1; i > 0; i -= 1) {
    if (days[i - 1] !== days[i]! - 1) break;
    current += 1;
  }
  return { streakDays: current, longestStreakDays: longest };
}

export function createPlacementRepository(prisma: PrismaClient): PlacementRepository {
  const findLatestCanvas = async (tenantId: string): Promise<{ id: string } | null> => {
    const active = await prisma.canvas.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return active ?? prisma.canvas.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  };

  // Count a user's placements in the tenant's CURRENT term: the active canvas (the placement target),
  // or the latest canvas when none is active (between terms). 0 if the tenant has no canvas.
  const countCurrentTermPlacements = async (tenantId: string, userId: string): Promise<number> => {
    const canvas = await findLatestCanvas(tenantId);
    if (!canvas) return 0;
    return prisma.pixelEvent.count({ where: { tenantId, actorUserId: userId, type: 'PixelPlaced', canvasId: canvas.id } });
  };
  // Per-day placement counts over the last year (oldest→newest) for the contribution heatmap.
  const contributionHistogram = async (
    tenantId: string,
    userId: string,
  ): Promise<Array<{ date: string; count: number }>> => {
    const rows = await prisma.$queryRaw<Array<{ day: string; count: number }>>`
      SELECT to_char(date_trunc('day', "created_at"), 'YYYY-MM-DD') AS day, count(*)::int AS count
      FROM pixel_events
      WHERE tenant_id = ${tenantId} AND user_id = ${userId} AND type = 'PixelPlaced'
        AND "created_at" >= now() - interval '365 days'
      GROUP BY 1
      ORDER BY 1 ASC`;
    return rows.map((r) => ({ date: r.day, count: Number(r.count) }));
  };
  const placementDays = async (tenantId: string, userId: string, canvasId?: string): Promise<string[]> => {
    if (canvasId) {
      const rows = await prisma.$queryRaw<Array<{ day: string }>>`
        SELECT to_char(date_trunc('day', "created_at"), 'YYYY-MM-DD') AS day
        FROM pixel_events
        WHERE tenant_id = ${tenantId} AND user_id = ${userId} AND canvas_id = ${canvasId} AND type = 'PixelPlaced'
        GROUP BY 1
        ORDER BY 1 ASC`;
      return rows.map((r) => r.day);
    }
    const rows = await prisma.$queryRaw<Array<{ day: string }>>`
      SELECT to_char(date_trunc('day', "created_at"), 'YYYY-MM-DD') AS day
      FROM pixel_events
      WHERE tenant_id = ${tenantId} AND user_id = ${userId} AND type = 'PixelPlaced'
      GROUP BY 1
      ORDER BY 1 ASC`;
    return rows.map((r) => r.day);
  };

  const profileStats = async (tenantId: string, userId: string, canvasId?: string): Promise<ProfileStatsRow> => {
    const placementWhere = {
      tenantId,
      actorUserId: userId,
      type: 'PixelPlaced',
      ...(canvasId ? { canvasId } : {}),
    };
    const [pixelsPlaced, survivingPixels, canvasGroups, favoriteGroups, days] = await Promise.all([
      prisma.pixelEvent.count({ where: placementWhere }),
      prisma.pixel.count({ where: { tenantId, ownerUserId: userId, ...(canvasId ? { canvasId } : {}) } }),
      prisma.pixelEvent.groupBy({
        by: ['canvasId'],
        where: placementWhere,
      }),
      prisma.pixelEvent.groupBy({
        by: ['newColor'],
        where: { ...placementWhere, newColor: { not: null } },
        _count: { _all: true },
      }),
      placementDays(tenantId, userId, canvasId),
    ]);
    const streak = streakStats(days);
    const favorite = favoriteGroups
      .filter((group) => typeof group.newColor === 'number')
      .sort((a, b) => b._count._all - a._count._all || (a.newColor ?? 0) - (b.newColor ?? 0))[0]?.newColor;
    return {
      pixelsPlaced,
      survivingPixels,
      streakDays: streak.streakDays,
      longestStreakDays: streak.longestStreakDays,
      canvasesParticipated: canvasGroups.length,
      favoriteColor: typeof favorite === 'number' ? favorite : null,
    };
  };

  const recentPlacements = async (tenantId: string, userId: string): Promise<ProfileRecentPlacementRow[]> => {
    const events = await prisma.pixelEvent.findMany({
      where: { tenantId, actorUserId: userId, type: 'PixelPlaced', x: { not: null }, y: { not: null }, newColor: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        canvasId: true,
        x: true,
        y: true,
        newColor: true,
        createdAt: true,
        canvas: { select: { termLabel: true } },
      },
    });
    if (events.length === 0) return [];
    const pixels = await prisma.pixel.findMany({
      where: {
        OR: events.map((event) => ({
          canvasId: event.canvasId,
          x: event.x ?? -1,
          y: event.y ?? -1,
        })),
      },
      select: { canvasId: true, x: true, y: true, lastEventId: true },
    });
    const projectionByCell = new Map(pixels.map((p) => [`${p.canvasId}:${p.x}:${p.y}`, p.lastEventId]));
    return events.flatMap((event) => {
      if (event.x === null || event.y === null || event.newColor === null) return [];
      return [
        {
          id: event.id,
          term: event.canvas.termLabel,
          x: event.x,
          y: event.y,
          color: event.newColor,
          placedAt: event.createdAt,
          surviving: projectionByCell.get(`${event.canvasId}:${event.x}:${event.y}`) === event.id,
        },
      ];
    });
  };

  const buildProfileRow = async (
    tenantId: string,
    member: {
      readonly role: string;
      readonly createdAt: Date;
      readonly userId: string;
      readonly user: { readonly publicHandle: string | null; readonly displayName: string | null };
    },
  ): Promise<ProfileRow | null> => {
    if (member.user.publicHandle === null) return null;
    const latestCanvas = await findLatestCanvas(tenantId);
    const [pixelsPlaced, currentTermPixelsPlaced, contributions, lifetimeStats, currentTermStats, recent] = await Promise.all([
      prisma.pixelEvent.count({ where: { tenantId, actorUserId: member.userId, type: 'PixelPlaced' } }),
      countCurrentTermPlacements(tenantId, member.userId),
      contributionHistogram(tenantId, member.userId),
      profileStats(tenantId, member.userId),
      latestCanvas
        ? profileStats(tenantId, member.userId, latestCanvas.id)
        : Promise.resolve({
            pixelsPlaced: 0,
            survivingPixels: 0,
            streakDays: 0,
            longestStreakDays: 0,
            canvasesParticipated: 0,
            favoriteColor: null,
          }),
      recentPlacements(tenantId, member.userId),
    ]);
    return {
      handle: member.user.publicHandle,
      displayName: member.user.displayName,
      role: member.role,
      joinedAt: member.createdAt,
      pixelsPlaced,
      currentTermPixelsPlaced,
      contributions,
      lifetimeStats,
      currentTermStats,
      recentPlacements: recent,
    };
  };

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

    async findCanvasById(tenantId, canvasId) {
      const c = await prisma.canvas.findFirst({
        where: { id: canvasId, tenantId },
        select: { id: true, tenantId: true, termLabel: true, status: true, width: true, height: true },
      });
      return c ?? null;
    },

    async countRecentPlacements(canvasId, since) {
      return prisma.pixelEvent.count({ where: { canvasId, type: 'PixelPlaced', createdAt: { gte: since } } });
    },

    async listRecentCanvasPlacements(canvasId, limit) {
      const rows = await prisma.pixelEvent.findMany({
        where: { canvasId, type: 'PixelPlaced', x: { not: null }, y: { not: null }, newColor: { not: null } },
        orderBy: { seq: 'desc' },
        take: limit,
        select: {
          x: true,
          y: true,
          newColor: true,
          seq: true,
          createdAt: true,
          actor: { select: { publicHandle: true, displayName: true } },
        },
      });
      return rows.flatMap((row) =>
        row.x !== null && row.y !== null && row.newColor !== null
          ? [
              {
                x: row.x,
                y: row.y,
                color: row.newColor,
                seq: row.seq,
                ownerHandle: row.actor.publicHandle,
                ownerDisplayName: row.actor.displayName,
                placedAt: row.createdAt,
              },
            ]
          : [],
      );
    },

    async listArchives(tenantId, query) {
      // Compound keyset cursor `"<iso>|<id>"` (see parseKeysetCursor) — ordering by (createdAt, id) is
      // stable even when several archives share a createdAt, so no row is skipped or repeated.
      const cur = parseKeysetCursor(query.cursor);
      const rows = await prisma.canvas.findMany({
        where: {
          tenantId,
          status: 'archived',
          ...(cur
            ? { OR: [{ createdAt: { lt: cur.date } }, { AND: [{ createdAt: cur.date }, { id: { lt: cur.id } }] }] }
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

    async getReplayMeta(tenantId, term) {
      const c = await prisma.canvas.findUnique({
        where: { tenantId_termLabel: { tenantId, termLabel: term } },
        select: { id: true, status: true },
      });
      if (!c || c.status !== 'archived') return null;
      const agg = await prisma.pixelEvent.aggregate({
        where: { canvasId: c.id },
        _count: { _all: true },
        _min: { seq: true },
        _max: { seq: true },
      });
      return { eventCount: agg._count._all, fromSeq: agg._min.seq ?? 0, toSeq: agg._max.seq ?? 0 };
    },

    async getArchiveStats(tenantId, term) {
      const c = await prisma.canvas.findUnique({
        where: { tenantId_termLabel: { tenantId, termLabel: term } },
        select: { id: true, status: true },
      });
      if (!c || c.status !== 'archived') return null;
      // Per-user placement counts for the term.
      const groups = await prisma.pixelEvent.groupBy({
        by: ['actorUserId'],
        where: { canvasId: c.id, type: 'PixelPlaced' },
        _count: { _all: true },
      });
      const totalPlacements = groups.reduce((sum, g) => sum + g._count._all, 0);
      const participants = groups.length;
      // Top placers: busiest first, DC2-eligible (active member + public handle), up to 5. Resolve
      // eligibility for ALL placers in ONE query (no N+1), then pick the top 5 eligible by count.
      const eligible = await prisma.membership.findMany({
        where: { tenantId, userId: { in: groups.map((g) => g.actorUserId) }, status: 'active', user: { publicHandle: { not: null } } },
        select: { userId: true, user: { select: { publicHandle: true, displayName: true } } },
      });
      const byUser = new Map(eligible.map((m) => [m.userId, m.user]));
      const topPlacers = groups
        .filter((g) => byUser.has(g.actorUserId))
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 5)
        .map((g) => {
          const u = byUser.get(g.actorUserId);
          return { handle: u?.publicHandle ?? '', displayName: u?.displayName ?? null, pixelsPlaced: g._count._all };
        });
      return { totalPlacements, participants, topPlacers };
    },

    async getProfileByHandle(tenantId, handle) {
      // Tenant-scoped: an ACTIVE member of this tenant whose user carries this public handle.
      // Handles are not yet tenant-unique (schema note), so pick deterministically by join order.
      const m = await prisma.membership.findFirst({
        where: { tenantId, status: 'active', user: { publicHandle: handle } },
        orderBy: { createdAt: 'asc' },
        select: { role: true, createdAt: true, userId: true, user: { select: { publicHandle: true, displayName: true } } },
      });
      return m ? buildProfileRow(tenantId, m) : null;
    },

    async getProfileByUserId(tenantId, userId) {
      const m = await prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
        select: { role: true, status: true, createdAt: true, user: { select: { publicHandle: true, displayName: true } } },
      });
      if (!m || m.status !== 'active' || m.user.publicHandle === null) return null;
      return buildProfileRow(tenantId, { role: m.role, createdAt: m.createdAt, userId, user: m.user });
    },

    async getLeaderboard(tenantId, query) {
      // Rank by the requested metric, ties broken deterministically by user id. Page grouped counts
      // until `limit` ELIGIBLE members (active + public handle, DC2) are collected — so a run of
      // suspended/handle-less top placers can't truncate the board while eligible members remain.
      const rows: Array<{ userId: string; handle: string; displayName: string | null; score: number }> = [];
      const batch = Math.max(query.limit, 1) * 2;
      const since = query.window === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)) : null;
      let skip = 0;
      for (let guard = 0; guard < 50 && rows.length < query.limit; guard++) {
        const grouped: Array<{ userId: string; count: number }> =
          query.category === 'placements'
            ? (
                await prisma.pixelEvent.groupBy({
                  by: ['actorUserId'],
                  where: {
                    tenantId,
                    type: 'PixelPlaced',
                    ...(since ? { createdAt: { gte: since } } : {}),
                  },
                  _count: { _all: true },
                  orderBy: [{ _count: { actorUserId: 'desc' } }, { actorUserId: 'asc' }],
                  take: batch,
                  skip,
                })
              ).map((g) => ({ userId: g.actorUserId, count: g._count._all }))
            : (
                await prisma.pixel.groupBy({
                  by: ['ownerUserId'],
                  where: {
                    tenantId,
                    ...(since ? { placedAt: { gte: since } } : {}),
                  },
                  _count: { _all: true },
                  orderBy: [{ _count: { ownerUserId: 'desc' } }, { ownerUserId: 'asc' }],
                  take: batch,
                  skip,
                })
              ).map((g) => ({ userId: g.ownerUserId, count: g._count._all }));
        if (grouped.length === 0) break;
        const ids = grouped.map((g) => g.userId);
        const memberships = await prisma.membership.findMany({
          where: { tenantId, status: 'active', userId: { in: ids } },
          select: { userId: true, user: { select: { publicHandle: true, displayName: true } } },
        });
        const byUser = new Map(memberships.map((m) => [m.userId, m.user]));
        for (const g of grouped) {
          const u = byUser.get(g.userId);
          if (!u || u.publicHandle === null) continue; // inactive/banned or no handle → omit
          rows.push({ userId: g.userId, handle: u.publicHandle, displayName: u.displayName, score: g.count });
          if (rows.length >= query.limit) break;
        }
        if (grouped.length < batch) break; // exhausted all groups
        skip += batch;
      }
      const userIds = rows.map((r) => r.userId);
      if (userIds.length === 0) return [];
      const placementGroups = await prisma.pixelEvent.groupBy({
        by: ['actorUserId'],
        where: {
          tenantId,
          type: 'PixelPlaced',
          actorUserId: { in: userIds },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        _count: { _all: true },
      });
      const survivingGroups = await prisma.pixel.groupBy({
        by: ['ownerUserId'],
        where: {
          tenantId,
          ownerUserId: { in: userIds },
          ...(since ? { placedAt: { gte: since } } : {}),
        },
        _count: { _all: true },
      });
      const placementsByUser = new Map(placementGroups.map((g) => [g.actorUserId, g._count._all]));
      const survivingByUser = new Map(survivingGroups.map((g) => [g.ownerUserId, g._count._all]));
      return rows.map((r) => ({
        handle: r.handle,
        displayName: r.displayName,
        score: r.score,
        pixelsPlaced: placementsByUser.get(r.userId) ?? 0,
        survivingPixels: survivingByUser.get(r.userId) ?? 0,
      }));
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
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'command:' + input.tenantId + ':' + input.idempotencyKey})::bigint)`;
        const prior = await tx.moderationAction.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
        });
        if (prior) {
          return actionMatches(prior, {
            actorUserId: input.actorUserId,
            actionType: input.actionType,
            targetRef: input.targetUserId,
            reason: input.reason,
          })
            ? { kind: 'replayed', auditId: prior.id, createdAt: prior.createdAt }
            : { kind: 'idempotency_conflict' };
        }
        const result = await tx.membership.updateMany({
          where: { tenantId: input.tenantId, userId: input.targetUserId },
          data: { status: input.status },
        });
        if (result.count === 0) return { kind: 'not_found' };
        const action = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: input.actionType,
            targetRef: input.targetUserId,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true, createdAt: true },
        });
        return { kind: 'applied', auditId: action.id, createdAt: action.createdAt };
      });
    },

    async assignMembershipRole(input) {
      return prisma.$transaction(async (tx): Promise<ApplyMemberModerationResult> => {
        const reason = `role set to ${input.role}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'command:' + input.tenantId + ':' + input.idempotencyKey})::bigint)`;
        const prior = await tx.moderationAction.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
        });
        if (prior) {
          return actionMatches(prior, {
            actorUserId: input.actorUserId,
            actionType: 'assign_role',
            targetRef: input.targetUserId,
            reason,
          })
            ? { kind: 'replayed', auditId: prior.id, createdAt: prior.createdAt }
            : { kind: 'idempotency_conflict' };
        }
        const result = await tx.membership.updateMany({
          where: { tenantId: input.tenantId, userId: input.targetUserId },
          data: { role: input.role },
        });
        if (result.count === 0) return { kind: 'not_found' };
        const action = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: 'assign_role',
            targetRef: input.targetUserId,
            reason,
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true, createdAt: true },
        });
        return { kind: 'applied', auditId: action.id, createdAt: action.createdAt };
      });
    },

    async getSnapshot(canvasId) {
      // Read the cells and the high-water seq in ONE consistent snapshot (RepeatableRead) so the
      // (cells, seq) pair can never skew under a concurrent placement: a watermark behind the cells
      // would let a re-applied older WS delta regress a cell, and a watermark ahead of the cells would
      // make a resuming client skip a pixel. A single MVCC snapshot rules out both.
      return prisma.$transaction(
        async (tx) => {
          const last = await tx.pixelEvent.findFirst({ where: { canvasId }, orderBy: { seq: 'desc' }, select: { seq: true } });
          const cells = await tx.pixel.findMany({
            where: { canvasId },
            select: { x: true, y: true, color: true },
            orderBy: [{ y: 'asc' }, { x: 'asc' }],
          });
          return { cells, seq: last?.seq ?? 0 };
        },
        { isolationLevel: 'RepeatableRead' },
      );
    },

    async reconstructAt(canvasId, seq) {
      // Point-in-time replay for PUBLIC archives. It must censor moderated content the same way
      // getPixelHistory does: a placement that is ever rolled back must never reappear, even at a seq
      // before its rollback. So fold the cell's FULL event log (a PixelPlaced pushes; a PixelRolledBack
      // pops the most recent survivor), leaving per cell the placements that were never moderated, then
      // show the latest survivor with seq <= the requested seq. Folding only up to `seq` would re-expose
      // a placement that a later rollback removed (a moderation leak); this does not. Loading the full
      // log is O(events) per replay — projection checkpoints/keyframes for very long terms are the
      // documented fold-efficiency follow-up (CHECKPOINTS.md G5).
      const events = await prisma.pixelEvent.findMany({
        where: { canvasId },
        orderBy: { seq: 'asc' },
        select: { x: true, y: true, type: true, newColor: true, seq: true },
      });
      const survivors = new Map<string, Array<{ seq: number; color: number }>>();
      for (const e of events) {
        const key = `${e.x},${e.y}`;
        let stack = survivors.get(key);
        if (!stack) {
          stack = [];
          survivors.set(key, stack);
        }
        if (e.type === 'PixelPlaced' && e.newColor !== null) stack.push({ seq: e.seq, color: e.newColor });
        else if (e.type === 'PixelRolledBack') stack.pop();
      }
      const cells: SnapshotCellRow[] = [];
      for (const [key, stack] of survivors) {
        // stack is seq-ascending (pushed in order; only the tail is ever popped).
        let chosen: { seq: number; color: number } | undefined;
        for (const p of stack) {
          if (p.seq <= seq) chosen = p;
          else break;
        }
        if (chosen) {
          const comma = key.indexOf(',');
          cells.push({ x: Number(key.slice(0, comma)), y: Number(key.slice(comma + 1)), color: chosen.color });
        }
      }
      return { cells, seq };
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
        select: { actorUserId: true, x: true, y: true, newColor: true, seq: true, createdAt: true },
      });
      if (!e || e.x === null || e.y === null || e.newColor === null) return null; // only a coordinate placement is replayable
      return { actorUserId: e.actorUserId, x: e.x, y: e.y, color: e.newColor, seq: e.seq, placedAt: e.createdAt };
    },

    async appendPlacement(input) {
      const { tenantId, canvasId, actorUserId, x, y, color, idempotencyKey, cooldownMs } = input;
      return prisma.$transaction(async (tx): Promise<AppendResult> => {
        // Serialize all placements on this canvas → idempotency, cooldown, and seq are atomic.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${canvasId})::bigint)`;

        const existing = await tx.pixelEvent.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
          select: { actorUserId: true, x: true, y: true, newColor: true, seq: true, createdAt: true },
        });
        if (existing) {
          if (
            existing.actorUserId !== actorUserId ||
            existing.x !== x ||
            existing.y !== y ||
            existing.newColor !== color
          ) {
            return { kind: 'idempotency_conflict' };
          }
          return {
            kind: 'duplicate',
            row: {
              actorUserId: existing.actorUserId,
              x: existing.x,
              y: existing.y,
              color,
              seq: existing.seq,
              placedAt: existing.createdAt,
            },
          };
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
          // Compare timestamps from one clock domain. Postgres assigns the event timestamps;
          // using an API-node clock here allows positive skew to bypass cooldown and negative skew
          // to over-extend it.
          const [databaseClock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
          if (!databaseClock) throw new Error('Database clock query returned no row.');
          const nowMs = databaseClock.now.getTime();
          // Wall clocks can step backwards slightly during host/VM synchronization. Clamp that
          // anomaly to zero: a positive cooldown remains fail-closed, while a configured zero
          // cooldown never invents a delay from a negative wall-clock delta.
          const elapsed = Math.max(0, nowMs - lastByActor.createdAt.getTime());
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
        return { kind: 'placed', row: { actorUserId, x, y, color, seq, placedAt: event.createdAt } };
      });
    },

    async createReport(input) {
      // Idempotency (API-INV-6): a retried key returns the ORIGINAL report instead of filing a duplicate
      // in the moderator queue. Pre-check, then create; the unique index is the race-safe backstop for
      // two concurrent retries (one wins; the loser gets P2002 and reads back the winner's report).
      const findByKey = (key: string) =>
        prisma.report.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: key } },
          select: { id: true, status: true, reporterUserId: true, targetRef: true, reason: true },
        });
      const matchesReport = (existing: {
        id: string;
        status: string;
        reporterUserId: string;
        targetRef: string;
        reason: string;
      }): CreateReportResult =>
        existing.reporterUserId === input.reporterUserId &&
        existing.targetRef === input.targetRef &&
        existing.reason === input.reason
          ? { kind: 'replayed', id: existing.id, status: existing.status }
          : { kind: 'idempotency_conflict' };
      const existing = await findByKey(input.idempotencyKey);
      if (existing) return matchesReport(existing);
      try {
        const report = await prisma.report.create({
          data: {
            tenantId: input.tenantId,
            canvasId: input.canvasId,
            reporterUserId: input.reporterUserId,
            targetRef: input.targetRef,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true, status: true },
        });
        return { kind: 'created', id: report.id, status: report.status };
      } catch (e) {
        if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
          const existing = await findByKey(input.idempotencyKey);
          if (existing) return matchesReport(existing);
        }
        throw e;
      }
    },

    async listReports(tenantId, query) {
      // Compound `(createdAt, id)` keyset (oldest→newest) — a plain createdAt cursor drops reports that
      // share a boundary millisecond, and a malformed cursor would 500 on `new Date(...)`.
      const cur = parseKeysetCursor(query.cursor);
      const rows = await prisma.report.findMany({
        where: {
          tenantId,
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(cur
            ? { OR: [{ createdAt: { gt: cur.date } }, { AND: [{ createdAt: cur.date }, { id: { gt: cur.id } }] }] }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: query.limit + 1,
        select: { id: true, targetRef: true, reason: true, status: true, createdAt: true },
      });
      const hasMore = rows.length > query.limit;
      const items = hasMore ? rows.slice(0, query.limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null;
      return { items, nextCursor };
    },

    async resolveReport(input) {
      // Report status change + audit commit together (no action without an audit, P-MOD-4).
      return prisma.$transaction(async (tx): Promise<ApplyMemberModerationResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'command:' + input.tenantId + ':' + input.idempotencyKey})::bigint)`;
        const prior = await tx.moderationAction.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
        });
        if (prior) {
          return actionMatches(prior, {
            actorUserId: input.actorUserId,
            actionType: input.actionType,
            targetRef: input.reportId,
            reason: input.reason,
          })
            ? { kind: 'replayed', auditId: prior.id, createdAt: prior.createdAt }
            : { kind: 'idempotency_conflict' };
        }
        const result = await tx.report.updateMany({
          where: { tenantId: input.tenantId, id: input.reportId },
          data: { status: input.status },
        });
        if (result.count === 0) return { kind: 'not_found' };
        const action = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: input.actionType,
            targetRef: input.reportId,
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
          },
          select: { id: true, createdAt: true },
        });
        return { kind: 'applied', auditId: action.id, createdAt: action.createdAt };
      });
    },

    async createCanvas(input) {
      return prisma.$transaction(async (tx): Promise<CreateCanvasResult> => {
        const reason = `created canvas ${input.term}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'command:' + input.tenantId + ':' + input.idempotencyKey})::bigint)`;
        const prior = await tx.moderationAction.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
        });
        if (prior) {
          if (!actionMatches(prior, { actorUserId: input.actorUserId, actionType: 'canvas_create', reason })) {
            return { kind: 'idempotency_conflict' };
          }
          const canvas = await tx.canvas.findFirst({
            where: { id: prior.targetRef, tenantId: input.tenantId },
            select: { id: true, tenantId: true, termLabel: true, status: true, width: true, height: true },
          });
          if (!canvas || canvas.termLabel !== input.term || canvas.width !== input.width || canvas.height !== input.height) {
            return { kind: 'idempotency_conflict' };
          }
          const lastEvent = await tx.pixelEvent.findFirst({
            where: { canvasId: canvas.id },
            orderBy: { seq: 'desc' },
            select: { seq: true },
          });
          return {
            kind: 'created',
            canvas,
            archivedCanvasId: null,
            auditId: prior.id,
            createdAt: prior.createdAt,
            replayed: true,
            canvasSeq: lastEvent?.seq ?? 0,
            archivedCanvasSeq: null,
          };
        }
        const eventKeyCollision = await tx.pixelEvent.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true },
        });
        if (eventKeyCollision) return { kind: 'idempotency_conflict' };
        // Serialize creates per tenant so two concurrent rollovers can't both archive-then-create and
        // leave two active canvases.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.tenantId})::bigint)`;
        // Term is unique per tenant — reject a duplicate cleanly (vs a raw constraint error).
        const existing = await tx.canvas.findUnique({
          where: { tenantId_termLabel: { tenantId: input.tenantId, termLabel: input.term } },
          select: { id: true },
        });
        if (existing) return { kind: 'duplicate_term' };
        // A new term supersedes the current one: the old active canvas becomes a past-term ARCHIVE
        // (it shows in /archives; one active canvas at a time).
        const active = await tx.canvas.findFirst({ where: { tenantId: input.tenantId, status: 'active' }, select: { id: true } });
        // Take the OLD canvas's per-canvas lock (the same key appendPlacement uses) before archiving
        // it, so an in-flight placement can't commit on a canvas this rollover is sealing. Deadlock-safe:
        // only createCanvas takes the tenant lock, so the tenant→canvas ordering forms no cycle.
        if (active) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${active.id})::bigint)`;
        let archivedCanvasSeq: number | null = null;
        if (active) {
          const last = await tx.pixelEvent.findFirst({ where: { canvasId: active.id }, orderBy: { seq: 'desc' }, select: { seq: true } });
          archivedCanvasSeq = (last?.seq ?? 0) + 1;
          await tx.pixelEvent.create({
            data: {
              tenantId: input.tenantId,
              canvasId: active.id,
              actorUserId: input.actorUserId,
              type: 'CanvasArchived',
              seq: archivedCanvasSeq,
              payload: { status: 'archived', supersededByTerm: input.term },
              idempotencyKey: `system:archive:${randomBytes(16).toString('hex')}`,
              schemaVersion: 1,
            },
          });
        }
        await tx.canvas.updateMany({
          where: { tenantId: input.tenantId, status: 'active' },
          data: { status: 'archived', archivedAt: new Date() },
        });
        const canvas = await tx.canvas.create({
          data: { tenantId: input.tenantId, termLabel: input.term, status: 'active', width: input.width, height: input.height },
          select: { id: true, tenantId: true, termLabel: true, status: true, width: true, height: true },
        });
        const createdEvent = await tx.pixelEvent.create({
          data: {
            tenantId: input.tenantId,
            canvasId: canvas.id,
            actorUserId: input.actorUserId,
            type: 'CanvasCreated',
            seq: 1,
            payload: { term: input.term, width: input.width, height: input.height },
            idempotencyKey: input.idempotencyKey,
            schemaVersion: 1,
          },
          select: { id: true },
        });
        const canvasSeq = 2;
        await tx.pixelEvent.create({
          data: {
            tenantId: input.tenantId,
            canvasId: canvas.id,
            actorUserId: input.actorUserId,
            type: 'CanvasActivated',
            seq: canvasSeq,
            payload: { status: 'active' },
            idempotencyKey: `system:activate:${randomBytes(16).toString('hex')}`,
            schemaVersion: 1,
          },
        });
        const audit = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: 'canvas_create',
            targetRef: canvas.id,
            reason,
            idempotencyKey: input.idempotencyKey,
            relatedEventId: createdEvent.id,
          },
          select: { id: true, createdAt: true },
        });
        return {
          kind: 'created',
          canvas,
          archivedCanvasId: active?.id ?? null,
          auditId: audit.id,
          createdAt: audit.createdAt,
          canvasSeq,
          archivedCanvasSeq,
        };
      });
    },

    async findActionReplay(tenantId, idempotencyKey, expected) {
      let prior = await prisma.moderationAction.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
        select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
      });
      // Preserve replay compatibility for rollback actions written before raw command keys were
      // stored. New actions always use the raw tenant-scoped key so reuse with a different target
      // conflicts instead of creating a second action.
      if (!prior && expected.targetRef && (expected.actionType === 'pixel_rollback' || expected.actionType === 'region_rollback')) {
        prior = await prisma.moderationAction.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId,
              idempotencyKey: `modrb:${expected.targetRef}:${idempotencyKey}`,
            },
          },
          select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
        });
      }
      if (!prior) return { kind: 'missing' };
      if (!actionMatches(prior, expected)) return { kind: 'conflict' };
      return { kind: 'replayed', id: prior.id, targetRef: prior.targetRef, createdAt: prior.createdAt };
    },

    async rollbackPixel(input) {
      const { tenantId, canvasId, actorUserId, x, y, reason } = input;
      const targetRef = `${x},${y}`;
      return prisma.$transaction(async (tx): Promise<RollbackResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'command:' + tenantId + ':' + input.idempotencyKey})::bigint)`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${canvasId})::bigint)`;
        // Idempotency: a retried rollback must NOT pop another placement. Under the per-canvas lock a
        // prior action with this key is already committed + visible, so a findUnique short-circuit is
        // race-safe (same pattern as appendPlacement). Replay → no state change, no broadcast.
        const prior = await tx.moderationAction.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
        });
        if (prior) {
          if (!actionMatches(prior, { actorUserId, actionType: 'pixel_rollback', targetRef, reason })) {
            return { kind: 'idempotency_conflict' };
          }
          return { kind: 'rolledBack', x, y, color: null, seq: 0, auditId: prior.id, createdAt: prior.createdAt, replayed: true };
        }
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
          data: {
            tenantId,
            actorUserId,
            actionType: 'pixel_rollback',
            targetRef,
            reason,
            idempotencyKey: input.idempotencyKey,
            relatedEventId: event.id,
          },
          select: { id: true, createdAt: true },
        });
        return { kind: 'rolledBack', x, y, color: revertedColor, seq, auditId: audit.id, createdAt: audit.createdAt };
      });
    },

    async rollbackRegion(input) {
      const { tenantId, canvasId, actorUserId, x1, y1, x2, y2, reason } = input;
      const targetRef = `${x1},${y1},${x2},${y2}`;
      return prisma.$transaction(async (tx): Promise<RegionRollbackResult> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'command:' + tenantId + ':' + input.idempotencyKey})::bigint)`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${canvasId})::bigint)`;
        // Idempotency: a retried region rollback must NOT pop another placement from every cell. The
        // per-canvas lock makes a findUnique short-circuit race-safe (a prior action with this key is
        // committed + visible). Replay → no state change, no broadcast.
        const prior = await tx.moderationAction.findUnique({
          where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
        });
        if (prior) {
          if (!actionMatches(prior, { actorUserId, actionType: 'region_rollback', targetRef, reason })) {
            return { kind: 'idempotency_conflict' };
          }
          return { kind: 'rolledBack', cells: [], seq: 0, auditId: prior.id, createdAt: prior.createdAt, replayed: true };
        }
        // Re-check status under the lock — an archive may have committed since the route read it.
        const canvasState = await tx.canvas.findUnique({ where: { id: canvasId }, select: { status: true } });
        if (canvasState?.status === 'archived') return { kind: 'archived' };
        // Batch the READS: the placed cells in the region, and ALL their events, in two queries (not
        // ~2 per cell) so the per-canvas advisory lock is held far more briefly. The per-cell stack
        // replay + the writes are unchanged (the writes stay per-cell because each reverts to a
        // different prior color/owner and links its own compensating event).
        const placed = await tx.pixel.findMany({
          where: { canvasId, x: { gte: x1, lte: x2 }, y: { gte: y1, lte: y2 } },
          orderBy: [{ y: 'asc' }, { x: 'asc' }], // deterministic seq assignment (matches the old scan order)
          select: { x: true, y: true, color: true },
        });
        const regionEvents = await tx.pixelEvent.findMany({
          where: { canvasId, x: { gte: x1, lte: x2 }, y: { gte: y1, lte: y2 } },
          orderBy: { seq: 'asc' },
          select: { x: true, y: true, type: true, newColor: true, actorUserId: true },
        });
        const eventsByCell = new Map<string, Array<{ type: string; newColor: number | null; actorUserId: string }>>();
        for (const e of regionEvents) {
          const key = `${e.x},${e.y}`;
          let group = eventsByCell.get(key);
          if (!group) {
            group = [];
            eventsByCell.set(key, group);
          }
          group.push({ type: e.type, newColor: e.newColor, actorUserId: e.actorUserId });
        }
        const last = await tx.pixelEvent.findFirst({ where: { canvasId }, orderBy: { seq: 'desc' }, select: { seq: true } });
        let seq = last?.seq ?? 0;
        let lastEventId: string | null = null;
        const cells: Array<{ x: number; y: number; color: number | null }> = [];
        for (const p of placed) {
          // Same replay as the single-cell rollback — honor intervening rollbacks per cell (seq order).
          const stack: Array<{ color: number; owner: string }> = [];
          for (const e of eventsByCell.get(`${p.x},${p.y}`) ?? []) {
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
              x: p.x,
              y: p.y,
              prevColor: p.color,
              newColor: revertedColor,
              idempotencyKey: `rollback:${randomBytes(16).toString('hex')}`,
              schemaVersion: 1,
            },
            select: { id: true, createdAt: true },
          });
          lastEventId = event.id;
          if (revertTo) {
            await tx.pixel.update({
              where: { canvasId_x_y: { canvasId, x: p.x, y: p.y } },
              data: { color: revertTo.color, ownerUserId: revertTo.owner, lastEventId: event.id, seq, placedAt: event.createdAt },
            });
          } else {
            await tx.pixel.delete({ where: { canvasId_x_y: { canvasId, x: p.x, y: p.y } } });
          }
          cells.push({ x: p.x, y: p.y, color: revertedColor });
        }
        const audit = await tx.moderationAction.create({
          data: {
            tenantId,
            actorUserId,
            actionType: 'region_rollback',
            targetRef,
            reason,
            idempotencyKey: input.idempotencyKey,
            ...(lastEventId ? { relatedEventId: lastEventId } : {}),
          },
          select: { id: true, createdAt: true },
        });
        return { kind: 'rolledBack', cells, seq, auditId: audit.id, createdAt: audit.createdAt };
      });
    },

    async listRoster(tenantId, query) {
      // Compound `(createdAt, userId)` keyset — stable across members sharing a boundary millisecond,
      // and malformed-cursor-safe (see parseKeysetCursor); userId is the membership's tiebreak key.
      const cur = parseKeysetCursor(query.cursor);
      const rows = await prisma.membership.findMany({
        where: {
          tenantId,
          ...(cur
            ? { OR: [{ createdAt: { gt: cur.date } }, { AND: [{ createdAt: cur.date }, { userId: { gt: cur.id } }] }] }
            : {}),
        },
        orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
        take: query.limit + 1,
        select: { userId: true, role: true, status: true, createdAt: true, user: { select: { publicHandle: true, displayName: true } } },
      });
      const hasMore = rows.length > query.limit;
      const page = hasMore ? rows.slice(0, query.limit) : rows;
      const last = page[page.length - 1];
      const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.userId}` : null;
      return {
        items: page.map((m) => ({ userId: m.userId, handle: m.user.publicHandle, displayName: m.user.displayName, role: m.role, status: m.status })),
        nextCursor,
      };
    },

    async setCanvasLifecycle(input) {
      return prisma.$transaction(async (tx): Promise<ApplyMemberModerationResult> => {
        const reason = `status set to ${input.status}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'command:' + input.tenantId + ':' + input.idempotencyKey})::bigint)`;
        // Same per-canvas lock as placement — a freeze and an in-flight append serialize, so no
        // pixel is accepted after the freeze commits (with appendPlacement's in-tx status re-check).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.canvasId})::bigint)`;
        const prior = await tx.moderationAction.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true, actorUserId: true, actionType: true, targetRef: true, reason: true, createdAt: true },
        });
        if (prior) {
          if (!actionMatches(prior, {
            actorUserId: input.actorUserId,
            actionType: 'canvas_lifecycle',
            targetRef: input.canvasId,
            reason,
          })) return { kind: 'idempotency_conflict' };
          const priorEvent = await tx.pixelEvent.findUnique({
            where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
            select: { seq: true },
          });
          return { kind: 'replayed', auditId: prior.id, createdAt: prior.createdAt, ...(priorEvent ? { seq: priorEvent.seq } : {}) };
        }
        const eventKeyCollision = await tx.pixelEvent.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
          select: { id: true },
        });
        if (eventKeyCollision) return { kind: 'idempotency_conflict' };
        const eventType =
          input.status === 'active' ? 'CanvasActivated' : input.status === 'frozen' ? 'CanvasFrozen' : 'CanvasArchived';
        const last = await tx.pixelEvent.findFirst({ where: { canvasId: input.canvasId }, orderBy: { seq: 'desc' }, select: { seq: true } });
        const seq = (last?.seq ?? 0) + 1;
        const allowedSourceStatuses =
          input.status === 'frozen' ? ['active'] : input.status === 'archived' ? ['active', 'frozen'] : [];
        const result = await tx.canvas.updateMany({
          // Enforce the forward-only state machine under the same canvas lock as placement. Route
          // preflight can race another lifecycle command; without this predicate, a late freeze can
          // regress an archived canvas or append duplicate lifecycle/audit facts.
          where: { id: input.canvasId, tenantId: input.tenantId, status: { in: allowedSourceStatuses } },
          data: {
            status: input.status,
            ...(input.status === 'frozen' ? { frozenAt: new Date() } : {}),
            ...(input.status === 'archived' ? { archivedAt: new Date() } : {}),
          },
        });
        if (result.count === 0) return { kind: 'not_found' };
        const lifecycleEvent = await tx.pixelEvent.create({
          data: {
            tenantId: input.tenantId,
            canvasId: input.canvasId,
            actorUserId: input.actorUserId,
            type: eventType,
            seq,
            payload: { status: input.status },
            idempotencyKey: input.idempotencyKey,
            schemaVersion: 1,
          },
          select: { id: true },
        });
        const action = await tx.moderationAction.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            actionType: 'canvas_lifecycle',
            targetRef: input.canvasId,
            reason,
            idempotencyKey: input.idempotencyKey,
            relatedEventId: lifecycleEvent.id,
          },
          select: { id: true, createdAt: true },
        });
        return { kind: 'applied', auditId: action.id, createdAt: action.createdAt, seq };
      });
    },

    async listFriends(tenantId, userId) {
      const rows = await prisma.friendship.findMany({
        where: { tenantId, OR: [{ requesterUserId: userId }, { addresseeUserId: userId }] },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          requesterUserId: true,
          addresseeUserId: true,
          requester: { select: { publicHandle: true, displayName: true, memberships: { where: { tenantId, status: 'active' }, select: { role: true } } } },
          addressee: { select: { publicHandle: true, displayName: true, memberships: { where: { tenantId, status: 'active' }, select: { role: true } } } },
        },
      });
      const friends: FriendMemberRow[] = [];
      const incoming: FriendMemberRow[] = [];
      const outgoing: FriendMemberRow[] = [];
      for (const r of rows) {
        const iAmRequester = r.requesterUserId === userId;
        const other = iAmRequester ? r.addressee : r.requester;
        const role = other.memberships[0]?.role;
        if (other.publicHandle === null || role === undefined) continue; // the other side is not an active member
        const row: FriendMemberRow = { handle: other.publicHandle, displayName: other.displayName, role };
        if (r.status === 'accepted') friends.push(row);
        else if (iAmRequester) outgoing.push(row);
        else incoming.push(row);
      }
      return { friends, incoming, outgoing };
    },

    async searchFriendCandidates(tenantId, userId, query, limit) {
      const q = query.trim().replace(/^@/, '');
      if (q.length === 0) return [];
      const members = await prisma.membership.findMany({
        where: { tenantId, status: 'active', userId: { not: userId }, user: { publicHandle: { startsWith: q, mode: 'insensitive' } } },
        orderBy: { user: { publicHandle: 'asc' } },
        take: Math.max(1, Math.min(limit, 25)),
        select: { userId: true, role: true, user: { select: { publicHandle: true, displayName: true } } },
      });
      if (members.length === 0) return [];
      const ids = members.map((m) => m.userId);
      const edges = await prisma.friendship.findMany({
        where: {
          tenantId,
          OR: [
            { requesterUserId: userId, addresseeUserId: { in: ids } },
            { addresseeUserId: userId, requesterUserId: { in: ids } },
          ],
        },
        select: { status: true, requesterUserId: true, addresseeUserId: true },
      });
      const relationOf = (otherId: string): FriendRelationshipKind => {
        const e = edges.find((x) => x.requesterUserId === otherId || x.addresseeUserId === otherId);
        if (!e) return 'none';
        if (e.status === 'accepted') return 'friends';
        return e.requesterUserId === userId ? 'outgoing' : 'incoming';
      };
      return members.flatMap((m) =>
        m.user.publicHandle === null
          ? []
          : [{ handle: m.user.publicHandle, displayName: m.user.displayName, role: m.role, relationship: relationOf(m.userId) }],
      );
    },

    async sendFriendRequest(input) {
      const target = await prisma.membership.findFirst({
        where: { tenantId: input.tenantId, status: 'active', user: { publicHandle: input.targetHandle.replace(/^@/, '') } },
        select: { userId: true },
      });
      if (!target) return { kind: 'not_found' };
      if (target.userId === input.requesterUserId) return { kind: 'self' };
      return prisma.$transaction(async (tx) => {
        const byKey = await tx.friendship.findUnique({
          where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
          select: { requesterUserId: true, status: true },
        });
        if (byKey) {
          if (byKey.status === 'accepted') return { kind: 'exists', relationship: 'friends' } as const;
          return { kind: 'exists', relationship: byKey.requesterUserId === input.requesterUserId ? 'outgoing' : 'incoming' } as const;
        }
        const existing = await tx.friendship.findFirst({
          where: {
            tenantId: input.tenantId,
            OR: [
              { requesterUserId: input.requesterUserId, addresseeUserId: target.userId },
              { requesterUserId: target.userId, addresseeUserId: input.requesterUserId },
            ],
          },
          select: { id: true, status: true, requesterUserId: true },
        });
        if (existing) {
          if (existing.status === 'accepted') return { kind: 'exists', relationship: 'friends' } as const;
          if (existing.requesterUserId === input.requesterUserId) return { kind: 'exists', relationship: 'outgoing' } as const;
          await tx.friendship.update({ where: { id: existing.id }, data: { status: 'accepted' } });
          return { kind: 'accepted' } as const; // a reciprocal incoming request confirms both sides
        }
        await tx.friendship.create({
          data: {
            tenantId: input.tenantId,
            requesterUserId: input.requesterUserId,
            addresseeUserId: target.userId,
            status: 'pending',
            idempotencyKey: input.idempotencyKey,
          },
        });
        return { kind: 'requested' } as const;
      });
    },

    async acceptFriendRequest(tenantId, addresseeUserId, requesterHandle) {
      const requester = await prisma.membership.findFirst({
        where: { tenantId, status: 'active', user: { publicHandle: requesterHandle.replace(/^@/, '') } },
        select: { userId: true },
      });
      if (!requester) return { kind: 'not_found' };
      const res = await prisma.friendship.updateMany({
        where: { tenantId, requesterUserId: requester.userId, addresseeUserId, status: 'pending' },
        data: { status: 'accepted' },
      });
      return { kind: res.count > 0 ? 'ok' : 'not_found' };
    },

    async cancelFriendRequest(tenantId, requesterUserId, addresseeHandle) {
      const addressee = await prisma.membership.findFirst({
        where: { tenantId, user: { publicHandle: addresseeHandle.replace(/^@/, '') } },
        select: { userId: true },
      });
      if (!addressee) return { kind: 'not_found' };
      const res = await prisma.friendship.deleteMany({
        where: { tenantId, requesterUserId, addresseeUserId: addressee.userId, status: 'pending' },
      });
      return { kind: res.count > 0 ? 'ok' : 'not_found' };
    },

    async removeFriend(tenantId, userId, otherHandle) {
      const other = await prisma.membership.findFirst({
        where: { tenantId, user: { publicHandle: otherHandle.replace(/^@/, '') } },
        select: { userId: true },
      });
      if (!other) return { kind: 'not_found' };
      const res = await prisma.friendship.deleteMany({
        where: {
          tenantId,
          status: 'accepted',
          OR: [
            { requesterUserId: userId, addresseeUserId: other.userId },
            { requesterUserId: other.userId, addresseeUserId: userId },
          ],
        },
      });
      return { kind: res.count > 0 ? 'ok' : 'not_found' };
    },
  };
}
