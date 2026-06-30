// apps/api — pixel placement domain service. The authoritative decision point for a placement
// (BE-INV-1): validates tenant/canvas/bounds/palette, then delegates to @quad/db where idempotency,
// cooldown (server-authoritative, fail-closed), per-canvas ordering, append, and projection commit
// ATOMICALLY in one transaction.
//
// Identity is INJECTED as a verified Principal (BE-INV-6 / PRIN-NO-ANON) — the service never trusts
// client claims and never reads a session. The HTTP→Principal step (session validation) is owned by
// AUTHENTICATION.md / ADR-0006 and lands with the auth milestone; until then no production identity
// source exists and the route rejects writes (401).
import type { domain, dto, ws } from '@quad/core';
import { getPaletteByKey, isAllowedColorValue } from '@quad/config';
import type { PlacementRepository, PlacedRow } from '@quad/db';
import type { RealtimeBus } from '@quad/realtime';
import { dynamicCooldownMs, type CooldownConfig } from './cooldown.js';
import type { RateCounter } from './rate-counter.js';

/** Window over which the recent placement rate (per minute) is measured for the dynamic cooldown. */
const LOAD_WINDOW_MS = 60_000;

export interface PlacementDeps {
  readonly repo: PlacementRepository;
  /** Fixed cooldown floor (ms). Used as-is unless `dynamicCooldown` is set, in which case it is
   *  the floor and the value grows with canvas load (docs/COOLDOWN.md). Server-authoritative. */
  readonly cooldownMs: number;
  /** When set, the cooldown is computed from the recent placement rate (load-based, bounded). */
  readonly dynamicCooldown?: CooldownConfig;
  /** Fast-path load source for the dynamic cooldown (Redis window counter); else the DB count. */
  readonly rateCounter?: RateCounter;
  /** Injectable clock (tests). */
  readonly now: () => Date;
  /** Fan-out bus — a new placement is published so WS subscribers (any node) receive it. */
  readonly bus: RealtimeBus;
}

/** Resolved tenant context the service needs (DC2 config only). */
export interface PlacementTenant {
  readonly id: string;
  readonly palette: string;
}

export interface PlacementInput {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly idempotencyKey: string;
}

export interface PlacementError {
  readonly code: dto.ErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export type PlacementResult =
  | { readonly ok: true; readonly result: dto.PlacePixelResultResponse }
  | { readonly ok: false; readonly error: PlacementError };

function fail(code: dto.ErrorCode, message: string, details?: Record<string, unknown>): PlacementResult {
  return { ok: false, error: details ? { code, message, details } : { code, message } };
}

function success(row: PlacedRow, cooldownMs: number): PlacementResult {
  return {
    ok: true,
    result: {
      at: { x: row.x, y: row.y },
      color: row.color as domain.ColorIndex,
      seq: row.seq as domain.PerCanvasSequence,
      placedAt: row.placedAt.toISOString(),
      cooldownMs,
    },
  };
}

/**
 * Execute a placement for a verified principal. Returns a discriminated result (no HTTP/Fastify
 * coupling) so it is unit/integration-testable with an injected principal + repository.
 */
export async function placePixel(
  deps: PlacementDeps,
  principal: domain.Principal,
  tenant: PlacementTenant,
  input: PlacementInput,
): Promise<PlacementResult> {
  if (principal.tenantId !== (tenant.id as domain.TenantId)) {
    return fail('TENANT_MISMATCH', 'Principal does not belong to this tenant.');
  }
  if (input.idempotencyKey.length === 0) {
    return fail('VALIDATION_ERROR', 'Idempotency-Key is required.');
  }
  if (!Number.isInteger(input.x) || !Number.isInteger(input.y)) {
    return fail('VALIDATION_ERROR', 'Coordinates must be integers.');
  }
  if (!Number.isInteger(input.color)) {
    return fail('VALIDATION_ERROR', 'Color must be an integer color value.');
  }

  // Idempotency replay first: a retried key returns the original persisted result, regardless of
  // new params or cooldown (placement commands are safe to repeat).
  const replay = await deps.repo.findByIdempotencyKey(principal.tenantId, input.idempotencyKey);
  if (replay) {
    if (
      replay.actorUserId !== principal.userId ||
      replay.x !== input.x ||
      replay.y !== input.y ||
      replay.color !== input.color
    ) {
      return fail('CONFLICT', 'Idempotency-Key was already used for a different placement.');
    }
    return success(replay, deps.cooldownMs);
  }

  const canvas = await deps.repo.findCurrentCanvas(principal.tenantId);
  if (!canvas) {
    return fail('NOT_FOUND', 'No active canvas is open for placement.');
  }
  if (input.x < 0 || input.y < 0 || input.x >= canvas.width || input.y >= canvas.height) {
    return fail('VALIDATION_ERROR', 'Coordinate is out of canvas bounds.');
  }

  const palette = getPaletteByKey(tenant.palette);
  if (!palette) {
    return fail('INTERNAL', 'Tenant palette is not configured.');
  }
  if (!isAllowedColorValue(tenant.palette, input.color)) {
    return fail('VALIDATION_ERROR', 'Color is not in the tenant palette or a valid custom color.');
  }

  // Cooldown: fixed floor, or load-based when configured — the recent canvas-wide placement rate
  // (count over the last window = per-minute rate) drives the value between the floor and ceiling.
  // The dynamic value is a CURRENT estimate, recomputed each request: the server always enforces the
  // value at the time of the gated request (COOLDOWN.md — clients display, never enforce), so the
  // figure returned here is advisory. The sample is taken before appendPlacement's per-canvas lock,
  // so a concurrent burst may briefly under-count — acceptable for a fairness throttle. (A retried/
  // idempotency-replayed request returns the floor above, since it short-circuits before this.)
  let effectiveCooldownMs = deps.cooldownMs;
  if (deps.dynamicCooldown) {
    // Fast path: the Redis window counter when wired; otherwise the indexed DB count (fallback).
    const recentRatePerMin = deps.rateCounter
      ? await deps.rateCounter.recent(canvas.id)
      : await deps.repo.countRecentPlacements(canvas.id, new Date(deps.now().getTime() - LOAD_WINDOW_MS));
    effectiveCooldownMs = dynamicCooldownMs(recentRatePerMin, deps.dynamicCooldown);
  }

  const outcome = await deps.repo.appendPlacement({
    tenantId: principal.tenantId,
    canvasId: canvas.id,
    actorUserId: principal.userId,
    x: input.x,
    y: input.y,
    color: input.color,
    idempotencyKey: input.idempotencyKey,
    cooldownMs: effectiveCooldownMs,
  });

  if (outcome.kind === 'cooldown') {
    return fail('COOLDOWN_ACTIVE', 'Placement is on cooldown.', { retryAfterMs: outcome.retryAfterMs });
  }
  if (outcome.kind === 'inactive') {
    // The canvas was frozen/archived between resolution and the append (raced a lifecycle change).
    return fail('NOT_FOUND', 'The current canvas is not open for placement.');
  }
  if (outcome.kind === 'idempotency_conflict') {
    return fail('CONFLICT', 'Idempotency-Key was already used for a different placement.');
  }
  // Broadcast only genuinely-new placements (a duplicate replay was already broadcast originally).
  if (outcome.kind === 'placed') {
    // Count this placement toward the rate fast-path (best-effort — load is an estimate, not truth).
    if (deps.rateCounter) {
      try {
        await deps.rateCounter.record(canvas.id);
      } catch {
        // swallow — the counter is advisory; a failure must never fail the (committed) placement
      }
    }
    const broadcast: ws.PixelPlaced = {
      type: 'PixelPlaced',
      at: { x: outcome.row.x, y: outcome.row.y },
      color: outcome.row.color as domain.ColorIndex,
      seq: outcome.row.seq as domain.PerCanvasSequence,
    };
    // Best-effort fan-out: the placement is already durably committed in Postgres, so a transport
    // failure must NOT fail it — clients reconcile from the snapshot (watermark) on next connect.
    try {
      await deps.bus.publish(principal.tenantId, canvas.id, broadcast);
    } catch {
      // swallow — broadcast is best-effort, never authoritative
    }
  }
  return success(outcome.row, effectiveCooldownMs);
}
