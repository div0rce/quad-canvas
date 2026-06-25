// @quad/core — WebSocket message catalog (T4 skeleton). WS broadcasts live updates ONLY;
// no authoritative writes over WS. Payloads typed; DC2 only (never DC3). Names are canonical
// (namespaced under `ws` in the barrel, so ws.PixelPlaced ≠ events.PixelPlaced — no collision).
import type { Coordinate, ColorIndex, CanvasId } from '../domain/ids.js';
import type { PublicIdentity } from '../domain/identity.js';

// --- Server → client ---
export interface CanvasSnapshotAvailable {
  readonly type: 'CanvasSnapshotAvailable';
}
export interface CanvasSnapshot {
  readonly type: 'CanvasSnapshot';
}
export interface PixelPlaced {
  readonly type: 'PixelPlaced';
  readonly at: Coordinate;
  readonly color: ColorIndex;
  readonly by?: PublicIdentity;
}
export interface PixelRolledBack {
  readonly type: 'PixelRolledBack';
  readonly at: Coordinate;
}
export interface RegionRolledBack {
  readonly type: 'RegionRolledBack';
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
