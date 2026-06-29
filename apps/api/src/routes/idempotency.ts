import type { FastifyRequest } from 'fastify';

const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

export type IdempotencyKeyResult =
  | { readonly ok: true; readonly key: string }
  | { readonly ok: false; readonly message: string };

/** Read the command idempotency key without coercion. Keys are opaque, non-empty, and bounded. */
export function readIdempotencyKey(request: FastifyRequest): IdempotencyKeyResult {
  const raw = request.headers['idempotency-key'];
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, message: 'Idempotency-Key is required.' };
  }
  if (raw.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return { ok: false, message: `Idempotency-Key must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.` };
  }
  return { ok: true, key: raw };
}
