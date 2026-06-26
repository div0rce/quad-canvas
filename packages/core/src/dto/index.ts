// @quad/core — REST DTO contracts (T4 skeleton). The single source of shared shapes
// (no duplicate DTOs elsewhere). Public/participant responses expose DC2 only — never DC3.
import type { Coordinate, ColorIndex, PerCanvasSequence } from '../domain/ids.js';
import type { PublicIdentity } from '../domain/identity.js';

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
