// @quad/core — event envelope + union (T4 skeleton). The event log is the source of truth.
import type {
  TenantId,
  CanvasId,
  UserId,
  EventId,
  PerCanvasSequence,
  IdempotencyKey,
} from '../domain/ids.js';
import type { CanvasEventPayload, CanvasEventType } from './canvas-events.js';

export * from './canvas-events.js';

/** Event schema version for additive evolution + read-time upcasting (old events never rewritten). */
export type SchemaVersion = number;

/** Non-authoritative context (request/correlation ids, source). Never contains DC3. */
export interface EventMetadata {
  readonly requestId?: string;
  readonly source?: string;
}

/**
 * Append-only event envelope. `seq` (per-canvas) is the authoritative order; `ts` is display-only.
 * `actorId` resolves to a DC2 handle for display — never the email.
 */
export interface EventEnvelope<P extends CanvasEventPayload = CanvasEventPayload> {
  readonly id: EventId;
  readonly tenantId: TenantId;
  readonly canvasId: CanvasId;
  readonly actorId: UserId;
  readonly type: CanvasEventType;
  readonly payload: P;
  readonly metadata?: EventMetadata;
  /** Display-only wall-clock time (ISO-8601). Not the ordering authority. */
  readonly ts: string;
  readonly seq: PerCanvasSequence;
  readonly idempotencyKey: IdempotencyKey;
  readonly schemaVersion: SchemaVersion;
}

/** A fully-enveloped domain event. */
export type DomainEvent = EventEnvelope;
