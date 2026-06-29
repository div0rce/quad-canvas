// apps/api — pending email-verification tokens. A token is single-use and time-limited: `consume`
// atomically reads-and-deletes it, so a link works exactly once. State is server-side (Redis in
// production; in-memory for dev/tests) — like sessions, losing it just forces re-verification.
import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';

/** What a verification token grants once confirmed: this email, for this tenant. */
export interface PendingVerification {
  readonly email: string;
  readonly tenantId: string;
}

export interface VerificationStore {
  create(pending: PendingVerification, token: string, ttlSeconds: number): Promise<void>;
  /** Read-and-delete the token (single-use); null if absent/expired/already used. */
  consume(token: string): Promise<PendingVerification | null>;
}

/** 256 bits of entropy — the token travels in the magic link and must be unguessable. */
export function newVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

function assertValidTtl(ttlSeconds: number): void {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('ttlSeconds must be a positive integer');
  }
}

export class InMemoryVerificationStore implements VerificationStore {
  readonly #tokens = new Map<string, { pending: PendingVerification; expiresAt: number }>();
  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  create(pending: PendingVerification, token: string, ttlSeconds: number): Promise<void> {
    assertValidTtl(ttlSeconds);
    this.#tokens.set(token, { pending, expiresAt: this.#now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }

  consume(token: string): Promise<PendingVerification | null> {
    const entry = this.#tokens.get(token);
    if (!entry) return Promise.resolve(null);
    this.#tokens.delete(token); // single-use
    if (entry.expiresAt <= this.#now()) return Promise.resolve(null);
    return Promise.resolve(entry.pending);
  }
}

const KEY_PREFIX = 'quad:verify:';

function parsePendingVerification(raw: string): PendingVerification | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const pending = value as Record<string, unknown>;
    if (typeof pending['email'] !== 'string' || pending['email'].length === 0) return null;
    if (typeof pending['tenantId'] !== 'string' || pending['tenantId'].length === 0) return null;
    return { email: pending['email'], tenantId: pending['tenantId'] };
  } catch {
    return null;
  }
}

export class RedisVerificationStore implements VerificationStore {
  readonly #redis: Redis;

  constructor(redis: Redis) {
    this.#redis = redis;
  }

  async create(pending: PendingVerification, token: string, ttlSeconds: number): Promise<void> {
    assertValidTtl(ttlSeconds);
    await this.#redis.set(KEY_PREFIX + token, JSON.stringify(pending), 'EX', ttlSeconds);
  }

  async consume(token: string): Promise<PendingVerification | null> {
    // GETDEL is atomic single-use (Redis 6.2+; Compose runs Redis 8).
    const raw = await this.#redis.getdel(KEY_PREFIX + token);
    return raw === null ? null : parsePendingVerification(raw);
  }
}
