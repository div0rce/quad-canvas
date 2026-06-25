// @quad/core — cooldown contracts (T4 skeleton). TYPES ONLY — the algorithm (inputs/weights/
// smoothing) lives in apps/api (see docs/COOLDOWN.md / ADR-0008). Global per tenant/canvas;
// bounded 5–20 min; server-authoritative; fail-closed. Clients DISPLAY the value, never enforce.
import type { Brand } from '../domain/ids.js';

export const COOLDOWN_MIN_MINUTES = 5 as const;
export const COOLDOWN_MAX_MINUTES = 20 as const;

export interface CooldownBounds {
  readonly minMinutes: number;
  readonly maxMinutes: number;
}

/** Normalized system-load score in [0, 1] driving the cooldown value. */
export type LoadScore = Brand<number, 'LoadScore'>;

/** Current global cooldown for a tenant/canvas. Display-only on clients; enforced server-side. */
export interface CooldownState {
  readonly valueMs: number;
  readonly loadScore: LoadScore;
  /** Display-only ISO-8601 timestamp. */
  readonly computedAt: string;
}

/** Inputs feeding the load score (weights/smoothing owned by apps/api / COOLDOWN.md). */
export interface CooldownInputs {
  readonly concurrentUsers?: number;
  readonly placementRatePerMin?: number;
  readonly hotPathLatencyMs?: number;
  readonly wsFanoutPressure?: number;
  readonly infraLatencyMs?: number;
  readonly errorRate?: number;
}
