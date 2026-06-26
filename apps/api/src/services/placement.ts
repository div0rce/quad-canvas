// apps/api — pixel placement domain service. The authoritative decision point for a placement
// (BE-INV-1): validates tenant/canvas/bounds/palette, then delegates to @quad/db where idempotency,
// cooldown (server-authoritative, fail-closed), per-canvas ordering, append, and projection commit
// ATOMICALLY in one transaction.
//
// Identity is INJECTED as a verified Principal (BE-INV-6 / PRIN-NO-ANON) — the service never trusts
// client claims and never reads a session. The HTTP→Principal step (session validation) is owned by
// AUTHENTICATION.md / ADR-0006 and lands with the auth milestone; until then no production identity
// source exists and the route rejects writes (401).
import type { domain, dto } from '@quad/core';
import { getPaletteByKey } from '@quad/config';
import type { PlacementRepository, PlacedRow } from '@quad/db';

export interface PlacementDeps {
  readonly repo: PlacementRepository;
  /** Minimal fixed cooldown for this slice (ms). The dynamic load-based algorithm + Redis
   *  fast-path are deferred (docs/COOLDOWN.md); this is the server-authoritative boundary. */
  readonly cooldownMs: number;
  /** Injectable clock (tests). */
  readonly now: () => Date;
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
    return fail('VALIDATION_ERROR', 'Color must be an integer palette index.');
  }

  // Idempotency replay first: a retried key returns the original persisted result, regardless of
  // new params or cooldown (placement commands are safe to repeat).
  const replay = await deps.repo.findByIdempotencyKey(principal.tenantId, input.idempotencyKey);
  if (replay) return success(replay, deps.cooldownMs);

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
  if (!palette.colors.some((c) => c.index === input.color)) {
    return fail('VALIDATION_ERROR', 'Color is not in the tenant palette.');
  }

  const outcome = await deps.repo.appendPlacement({
    tenantId: principal.tenantId,
    canvasId: canvas.id,
    actorUserId: principal.userId,
    x: input.x,
    y: input.y,
    color: input.color,
    idempotencyKey: input.idempotencyKey,
    cooldownMs: deps.cooldownMs,
    nowMs: deps.now().getTime(),
  });

  if (outcome.kind === 'cooldown') {
    return fail('COOLDOWN_ACTIVE', 'Placement is on cooldown.', { retryAfterMs: outcome.retryAfterMs });
  }
  return success(outcome.row, deps.cooldownMs);
}
