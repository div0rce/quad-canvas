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
