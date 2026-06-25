// @quad/core — WS envelope + error codes (T4 skeleton).
import type { TenantId, CanvasId, PerCanvasSequence } from '../domain/ids.js';
import type { SchemaVersion } from '../events/index.js';

export * from './messages.js';

/** Envelope wrapping every WS message. `seq` is present on canvas-changing messages. */
export interface WsEnvelope<P = unknown> {
  readonly msgId: string;
  readonly type: string;
  readonly schemaVersion: SchemaVersion;
  readonly tenantId?: TenantId;
  readonly canvasId?: CanvasId;
  readonly seq?: PerCanvasSequence;
  readonly payload: P;
  /** Display-only timestamp (ISO-8601). */
  readonly ts?: string;
  readonly correlationId?: string;
}

export type WsErrorCode =
  | 'WS_PROTOCOL_ERROR'
  | 'WS_UNAUTHENTICATED'
  | 'WS_FORBIDDEN'
  | 'WS_TENANT_MISMATCH'
  | 'WS_VERSION_MISMATCH'
  | 'WS_RATE_LIMITED';
