// @quad/core — domain identifiers (T4 skeleton). Pure types; no I/O.
// Branded primitives so ids/sequences can't be structurally mixed up.

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type TenantId = Brand<string, 'TenantId'>;
export type UserId = Brand<string, 'UserId'>;
export type CanvasId = Brand<string, 'CanvasId'>;
export type EventId = Brand<string, 'EventId'>;

/** Authoritative per-canvas ordering key for the append-only event log (NOT a timestamp). */
export type PerCanvasSequence = Brand<number, 'PerCanvasSequence'>;

/** Duplicate-safe command key: one intent → one event → one cooldown charge. */
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;

/** Integer cell coordinate on a canvas grid. */
export interface Coordinate {
  readonly x: number;
  readonly y: number;
}

/** Index into a tenant's configured color palette. */
export type ColorIndex = Brand<number, 'ColorIndex'>;
