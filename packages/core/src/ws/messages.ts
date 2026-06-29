// @quad/core — WebSocket message catalog (T4 skeleton). WS broadcasts live updates ONLY;
// no authoritative writes over WS. Payloads typed; DC2 only (never DC3). Names are canonical
// (namespaced under `ws` in the barrel, so ws.PixelPlaced ≠ events.PixelPlaced — no collision).
import type { Coordinate, ColorIndex, CanvasId, PerCanvasSequence } from '../domain/ids.js';
import type { PublicIdentity } from '../domain/identity.js';

// --- Server → client ---
export interface CanvasSnapshotAvailable {
  readonly type: 'CanvasSnapshotAvailable';
}
export interface CanvasSnapshot {
  readonly type: 'CanvasSnapshot';
}
/** Confirms the server has authorized and installed the requested canvas subscription. */
export interface CanvasSubscribed {
  readonly type: 'CanvasSubscribed';
  readonly canvasId: CanvasId;
}
export interface PixelPlaced {
  readonly type: 'PixelPlaced';
  readonly at: Coordinate;
  readonly color: ColorIndex;
  /** Per-canvas order of this placement — clients apply deltas with `seq` beyond the snapshot. */
  readonly seq: PerCanvasSequence;
  readonly by?: PublicIdentity;
}
export interface PixelRolledBack {
  readonly type: 'PixelRolledBack';
  readonly at: Coordinate;
  /** The color the cell reverted to; omitted when the cell is now empty. */
  readonly color?: ColorIndex;
  /** Per-canvas order of the compensating event (clients dedupe by seq, like PixelPlaced). */
  readonly seq: PerCanvasSequence;
}
export interface RegionRolledBack {
  readonly type: 'RegionRolledBack';
  /** The reverted rectangle (inclusive). Clients resync the snapshot for the region. */
  readonly region: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };
}
export interface ArtworkRemoved {
  readonly type: 'ArtworkRemoved';
}
export interface CooldownUpdated {
  readonly type: 'CooldownUpdated';
  readonly globalMs: number;
  readonly remainingMs?: number;
}
export interface CanvasLifecycleChanged {
  readonly type: 'CanvasLifecycleChanged';
  readonly status: string;
  readonly seq: PerCanvasSequence;
}
export interface ReportStatusUpdated {
  readonly type: 'ReportStatusUpdated';
}
export interface ModerationActionApplied {
  readonly type: 'ModerationActionApplied';
}
export interface PresenceUpdated {
  readonly type: 'PresenceUpdated';
  readonly approximateActive: number;
}
export interface Heartbeat {
  readonly type: 'Heartbeat';
}
export interface ReconnectRequired {
  readonly type: 'ReconnectRequired';
  readonly reason?: string;
}
export interface ErrorMessage {
  readonly type: 'Error';
  readonly code: string;
  readonly message: string;
}

export type ServerToClientMessage =
  | CanvasSnapshotAvailable
  | CanvasSnapshot
  | CanvasSubscribed
  | PixelPlaced
  | PixelRolledBack
  | RegionRolledBack
  | ArtworkRemoved
  | CooldownUpdated
  | CanvasLifecycleChanged
  | ReportStatusUpdated
  | ModerationActionApplied
  | PresenceUpdated
  | Heartbeat
  | ReconnectRequired
  | ErrorMessage;

// --- Client → server ---
export interface SubscribeCanvas {
  readonly type: 'SubscribeCanvas';
  readonly canvasId: CanvasId;
}
export interface UnsubscribeCanvas {
  readonly type: 'UnsubscribeCanvas';
  readonly canvasId: CanvasId;
}
export interface Pong {
  readonly type: 'Pong';
}
export interface PresencePing {
  readonly type: 'PresencePing';
}

export type ClientToServerMessage = SubscribeCanvas | UnsubscribeCanvas | Pong | PresencePing;
