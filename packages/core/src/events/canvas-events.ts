// @quad/core — domain event catalog (T4 skeleton). Append-only facts; never mutated/deleted.
// Compensating events (PixelRolledBack/RegionRolledBack/ArtworkRemoved) reverse VISIBLE state
// without erasing history. Payloads are stubs; concrete fields land with each event's spec.
import type { CanvasId, Coordinate, ColorIndex, UserId } from '../domain/ids.js';

/** Canonical event type names (past-tense facts). Stable; never repurpose. */
export type CanvasEventType =
  | 'PixelPlaced'
  | 'PixelRolledBack'
  | 'RegionRolledBack'
  | 'ArtworkRemoved'
  | 'CanvasCreated'
  | 'CanvasActivated'
  | 'CanvasFrozen'
  | 'CanvasArchived'
  | 'ReportSubmitted'
  | 'ReportResolved'
  | 'UserSuspended'
  | 'UserBanned'
  | 'ModerationActionRecorded';

// --- Placement ---
export interface PixelPlaced {
  readonly type: 'PixelPlaced';
  readonly at: Coordinate;
  readonly color: ColorIndex;
  readonly previousColor?: ColorIndex;
}

// --- Compensating (moderation; no hard delete) ---
export interface PixelRolledBack {
  readonly type: 'PixelRolledBack';
  readonly at: Coordinate;
  readonly restoredColor?: ColorIndex;
  readonly reasonRef?: string;
}
export interface RegionRolledBack {
  readonly type: 'RegionRolledBack';
  readonly reasonRef?: string;
}
export interface ArtworkRemoved {
  readonly type: 'ArtworkRemoved';
  readonly reasonRef?: string;
}

// --- Canvas lifecycle ---
export interface CanvasCreated {
  readonly type: 'CanvasCreated';
  readonly canvasId: CanvasId;
}
export interface CanvasActivated {
  readonly type: 'CanvasActivated';
}
export interface CanvasFrozen {
  readonly type: 'CanvasFrozen';
}
export interface CanvasArchived {
  readonly type: 'CanvasArchived';
}

// --- Reports ---
export interface ReportSubmitted {
  readonly type: 'ReportSubmitted';
  readonly reporterId: UserId;
}
export interface ReportResolved {
  readonly type: 'ReportResolved';
  readonly resolution?: string;
}

// --- Moderation / audit ---
export interface UserSuspended {
  readonly type: 'UserSuspended';
  readonly userId: UserId;
  readonly reasonRef?: string;
}
export interface UserBanned {
  readonly type: 'UserBanned';
  readonly userId: UserId;
  readonly reasonRef?: string;
}
export interface ModerationActionRecorded {
  readonly type: 'ModerationActionRecorded';
  readonly actorId: UserId;
  readonly actionRef?: string;
}

/** Discriminated union of all canvas-domain event payloads. */
export type CanvasEventPayload =
  | PixelPlaced
  | PixelRolledBack
  | RegionRolledBack
  | ArtworkRemoved
  | CanvasCreated
  | CanvasActivated
  | CanvasFrozen
  | CanvasArchived
  | ReportSubmitted
  | ReportResolved
  | UserSuspended
  | UserBanned
  | ModerationActionRecorded;
