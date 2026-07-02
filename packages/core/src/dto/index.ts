// @quad/core — REST DTO contracts (T4 skeleton). The single source of shared shapes
// (no duplicate DTOs elsewhere). Public/participant responses expose DC2 only — never DC3.
import type { Coordinate, ColorIndex, PerCanvasSequence, CanvasId } from '../domain/ids.js';
import type { PublicIdentity, Role } from '../domain/identity.js';

/**
 * Canonical REST error codes. `COOLDOWN_ACTIVE` (the fairness throttle) is DISTINCT from
 * `RATE_LIMITED` (abuse protection) — both surface as HTTP 429 but never conflated.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'COOLDOWN_ACTIVE'
  | 'RATE_LIMITED'
  | 'TENANT_MISMATCH'
  | 'INTERNAL';

export interface ErrorResponse {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly requestId: string;
    readonly details?: Record<string, unknown>;
  };
}

/** Cursor-paginated collection envelope. */
export interface Paginated<T> {
  readonly data: readonly T[];
  readonly page: {
    readonly nextCursor: string | null;
    readonly limit: number;
  };
}

/** Place-a-pixel command. The Idempotency-Key travels as a header, not in the body. */
export interface PlacePixelCommand {
  readonly at: Coordinate;
  readonly color: ColorIndex;
}

/**
 * Result of a successful placement (DC2-safe — no owner identity, no DC3). `seq` is the
 * authoritative per-canvas order of the appended `PixelPlaced` event; `cooldownMs` is how long
 * the caller must now wait before the next placement (server-authoritative).
 */
export interface PlacePixelResultResponse {
  readonly at: Coordinate;
  readonly color: ColorIndex;
  readonly seq: PerCanvasSequence;
  /** Display-only ISO-8601 timestamp. */
  readonly placedAt: string;
  readonly cooldownMs: number;
}

/** Current state of a single cell (DC2 attribution only). */
export interface PixelResponse {
  readonly at: Coordinate;
  readonly color: ColorIndex;
  readonly owner?: PublicIdentity;
  /** Display-only ISO-8601 timestamp. */
  readonly placedAt?: string;
}

/** Live canvas metadata for the initial client load (no attribution; DC2-safe). */
export interface CanvasMetaResponse {
  /** Canvas resource id — the client uses it to subscribe over WebSocket. */
  readonly id: CanvasId;
  readonly term: string;
  readonly status: string;
  readonly width: number;
  readonly height: number;
  /** The tenant's active palette key (colors resolved client-side from @quad/config). */
  readonly palette: string;
}

/** A single placed cell in a snapshot (compact; attribution is fetched per-cell, not here). */
export interface SnapshotCell {
  readonly x: number;
  readonly y: number;
  readonly color: ColorIndex;
}

/**
 * Current-canvas projection for initial paint — the client fetches this once, then receives live
 * deltas over WebSockets (no polling). A compact/binary encoding is a documented future option;
 * this JSON form lists only placed cells.
 */
export interface CanvasSnapshotResponse {
  readonly width: number;
  readonly height: number;
  /** Per-canvas sequence high-water at snapshot time — the resume point for live WS deltas. */
  readonly seq: PerCanvasSequence;
  readonly cells: readonly SnapshotCell[];
}

/** One entry in a cell's placement history (DC2 attribution only). */
export interface PixelHistoryEntry {
  readonly color: ColorIndex;
  readonly seq: PerCanvasSequence;
  readonly owner?: PublicIdentity;
  /** Display-only ISO-8601 timestamp. */
  readonly placedAt: string;
}

/** Cursor-paginated per-cell placement history (oldest→newest). */
export type PixelHistoryListResponse = Paginated<PixelHistoryEntry>;

/** One recent placement on the current canvas (newest-first list, DC2 attribution only). */
export interface CanvasRecentPlacement {
  readonly at: Coordinate;
  readonly color: ColorIndex;
  readonly seq: PerCanvasSequence;
  readonly owner?: PublicIdentity;
  /** Display-only ISO-8601 timestamp. */
  readonly placedAt: string;
}

export interface CanvasRecentPlacementsResponse {
  readonly data: readonly CanvasRecentPlacement[];
}

/** Current auth state for the resolved tenant — DC2 only. `authenticated:false` for anonymous. */
export interface SessionResponse {
  readonly authenticated: boolean;
  readonly user?: PublicIdentity;
  readonly role?: Role;
}

/** Moderation/admin action command (moderator+). `targetRef` identifies the target (e.g. a user id). */
export interface ModerationActionCommand {
  readonly actionType: string;
  readonly targetRef: string;
  readonly reason?: string;
}

/** Result of a recorded (audited, append-only) moderation action. */
export interface ModerationActionResponse {
  readonly id: string;
  readonly actionType: string;
  /** Display-only ISO-8601 timestamp. */
  readonly createdAt: string;
}

/** Assign a tenant-scoped role to a member (admin). `operator` is platform-level, not assignable here. */
export interface AssignRoleCommand {
  readonly targetRef: string;
  readonly role: Role;
}

/** Result of a role assignment (audited; the target's sessions are rotated on a privilege change). */
export interface RoleAssignmentResponse {
  readonly targetRef: string;
  readonly role: Role;
}

/** A participant report (feeds the moderation queue). `targetRef` identifies what is reported. */
export interface SubmitReportCommand {
  readonly targetRef: string;
  readonly reason: string;
}

/** Acknowledgement of a filed report. */
export interface ReportResponse {
  readonly id: string;
  readonly status: string;
}

/** One report in the moderation queue (DC2 — no reporter identity exposed at this level). */
export interface ReportItem {
  readonly id: string;
  readonly targetRef: string;
  readonly reason: string;
  readonly status: string;
  /** Display-only ISO-8601 timestamp. */
  readonly createdAt: string;
}

/** Cursor-paginated moderation report queue (oldest→newest). */
export type ReportQueueResponse = Paginated<ReportItem>;

/** One member in the admin roster (DC2 only — public handle/display, never email). */
export interface RosterEntry {
  readonly userId: string;
  readonly handle?: string;
  readonly displayName?: string;
  readonly role: Role;
  readonly status: string;
}

/** Cursor-paginated tenant roster (admin). */
export type RosterResponse = Paginated<RosterEntry>;

/** Admin canvas lifecycle transition (activate/freeze/archive); destructive deletion is never offered. */
export interface CanvasLifecycleCommand {
  readonly status: string;
}

/** Admin: create a new term canvas. Becomes the active canvas (any current active one is frozen). */
export interface CreateCanvasCommand {
  readonly term: string;
  readonly width: number;
  readonly height: number;
}

/** One ranked entry in a leaderboard (DC2 only). */
export interface LeaderboardEntry {
  readonly rank: number;
  readonly handle: string;
  readonly displayName?: string;
  /** The value this response is ranked by (category + window). */
  readonly score: number;
  /** Placement count for the selected window. */
  readonly pixelsPlaced: number;
  /** Current surviving-pixel count for the selected window. */
  readonly survivingPixels: number;
}

/** A ranked leaderboard for a (category, window). DC2; eventually consistent. */
export interface LeaderboardResponse {
  readonly category: string;
  readonly window: string;
  readonly entries: readonly LeaderboardEntry[];
}

/** A user's public profile within a tenant (DC2 only — handle/display/role/stats, never email). */
export interface ProfileResponse {
  readonly handle: string;
  readonly displayName?: string;
  readonly role: Role;
  /** ISO-8601 timestamp the user joined this tenant. */
  readonly joinedAt: string;
  /** Count of the user's placements in this tenant (lifetime, across all terms). */
  readonly pixelsPlaced: number;
  /** Count of the user's placements in the current term (latest canvas), or 0 if none. */
  readonly currentTermPixelsPlaced: number;
  /** Per-day placement counts (recent window, oldest→newest) for the contribution heatmap. */
  readonly contributions: ContributionDay[];
  readonly lifetimeStats: ProfileStats;
  readonly currentTermStats: ProfileStats;
  /** Latest visible public placement facts for the member, newest first. */
  readonly recentPlacements: readonly ProfileRecentPlacement[];
}

/** One day's placement count for the contribution heatmap. `date` is `YYYY-MM-DD`. */
export interface ContributionDay {
  readonly date: string;
  readonly count: number;
}

export interface ProfileStats {
  readonly pixelsPlaced: number;
  readonly survivingPixels: number;
  readonly streakDays: number;
  readonly longestStreakDays: number;
  readonly canvasesParticipated: number;
  readonly favoriteColor?: number;
}

export interface ProfileRecentPlacement {
  readonly id: string;
  readonly term: string;
  readonly at: Coordinate;
  readonly color: number;
  readonly placedAt: string;
  readonly surviving: boolean;
}

/** The caller's own profile. Currently the same DC2 shape (private fields are a follow-on). */
export type MyProfileResponse = ProfileResponse;

/** A past-term canvas archive (immutable; public metadata only). */
export interface ArchiveSummary {
  readonly id: string;
  readonly term: string;
  readonly status: string;
  readonly width: number;
  readonly height: number;
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;
}

/** Cursor-paginated list of a tenant's archives (newest term first). */
export type ArchiveListResponse = Paginated<ArchiveSummary>;

/** A single archive's metadata (artifact/replay pointers are a follow-on). */
export type ArchiveResponse = ArchiveSummary;

/**
 * Replay derivation metadata for an archived term. The seq range is what a replay would cover;
 * `available` is false until rendered assets are generated into object storage (a follow-on).
 */
export interface ReplayMetaResponse {
  readonly term: string;
  readonly eventCount: number;
  readonly fromSeq: number;
  readonly toSeq: number;
  /** Whether pre-rendered replay assets exist (object storage); false until generated. */
  readonly available: boolean;
}

/** A top placer in a term's statistics (DC2 only — no email). */
export interface ArchiveTopPlacer {
  readonly handle: string;
  readonly displayName?: string;
  readonly pixelsPlaced: number;
}

/** Term statistics for an archived term: totals + top placers. */
export interface ArchiveStatsResponse {
  readonly term: string;
  readonly totalPlacements: number;
  readonly participants: number;
  readonly topPlacers: ArchiveTopPlacer[];
}

/** Tenant configuration as seen by a tenant admin (DC2/config only — no secrets, no DC3). */
export interface TenantConfigResponse {
  readonly id: string;
  readonly slug: string;
  readonly publicTitle: string;
  readonly status: string;
  readonly palette: string;
  readonly termCadence: string;
  readonly domains: readonly string[];
}

/** A DC2 member reference for the friends graph — public handle + optional display name, never email. */
export interface FriendMember {
  readonly handle: string;
  readonly displayName?: string;
  readonly role: Role;
}

/** The signed-in member's friends view: confirmed friends + pending requests in both directions. */
export interface FriendsResponse {
  readonly friends: readonly FriendMember[];
  /** Requests others sent to the caller, awaiting the caller's confirmation. */
  readonly incoming: readonly FriendMember[];
  /** Requests the caller sent, awaiting the other member's confirmation. */
  readonly outgoing: readonly FriendMember[];
  readonly counts: {
    readonly friends: number;
    readonly incoming: number;
    readonly outgoing: number;
  };
}

/** The caller's relationship to a member surfaced in friend search. */
export type FriendRelationship = 'self' | 'none' | 'outgoing' | 'incoming' | 'friends';

/** A member found by public-handle search, with the caller's relationship to them (DC2 only). */
export interface FriendSearchResult {
  readonly handle: string;
  readonly displayName?: string;
  readonly role: Role;
  readonly relationship: FriendRelationship;
}

export interface FriendSearchResponse {
  readonly results: readonly FriendSearchResult[];
}

/** Add-a-friend command: the target's public handle (never an email). The Idempotency-Key is a header. */
export interface SendFriendRequestCommand {
  readonly handle: string;
}

/** A guild in the directory (DC2 identity only). `joined`/`active` reflect the caller's relationship. */
export interface GuildSummary {
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly memberCount: number;
  readonly joined: boolean;
  readonly active: boolean;
}

export interface GuildsResponse {
  readonly guilds: readonly GuildSummary[];
}

/** A member of a guild (DC2 only — handle, never email). */
export interface GuildMemberSummary {
  readonly handle: string;
  readonly displayName?: string;
  readonly role: Role;
}

/** A single guild's profile: its details + the caller's relationship + its members. */
export interface GuildDetailResponse extends GuildSummary {
  readonly members: readonly GuildMemberSummary[];
}

/** Create-a-guild command. The slug is derived server-side from the name. */
export interface CreateGuildCommand {
  readonly name: string;
  readonly description?: string;
}
