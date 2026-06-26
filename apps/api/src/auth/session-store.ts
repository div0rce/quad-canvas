// apps/api — server-authoritative session store. Per AUTHENTICATION.md, sessions are OPAQUE,
// high-entropy tokens whose state lives server-side (Redis for fast validation; durable account +
// membership state stays in Postgres). Server-side state is what makes **immediate revocation**
// possible (AUTH-INV-8) — a ban/suspension/signout deletes the session and access is cut at once.
// This module is the session lifecycle only; the verification front-door (domain-allowlisted magic
// link) and the request→principal plugin build on it.
import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';

/** The minimal identity a session carries; account/membership detail is resolved from Postgres. */
export interface Session {
  readonly userId: string;
  readonly tenantId: string;
}

export interface SessionStore {
  /** Create a session, returning its opaque id (the cookie value). */
  create(session: Session, ttlSeconds: number): Promise<string>;
  /** Resolve a session id to its session, or null if absent/expired. */
  get(sessionId: string): Promise<Session | null>;
  /** Destroy a session (signout / revocation). Idempotent. */
  revoke(sessionId: string): Promise<void>;
}

/** 256 bits of entropy, hex-encoded — not guessable, not enumerable. */
export function newSessionId(): string {
  return randomBytes(32).toString('hex');
}

// Redis `SET ... EX` requires a positive integer; enforce the same in-memory so an invalid TTL is a
// consistent error in dev, not a silent never-expire that crashes only against Redis in production.
function assertValidTtl(ttlSeconds: number): void {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('ttlSeconds must be a positive integer');
  }
}

/** In-memory store for single-node dev and unit tests. Production uses Redis (cross-node + restart-safe). */
export class InMemorySessionStore implements SessionStore {
  readonly #sessions = new Map<string, { session: Session; expiresAt: number }>();
  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  create(session: Session, ttlSeconds: number): Promise<string> {
    assertValidTtl(ttlSeconds);
    const id = newSessionId();
    this.#sessions.set(id, { session, expiresAt: this.#now() + ttlSeconds * 1000 });
    return Promise.resolve(id);
  }

  get(sessionId: string): Promise<Session | null> {
    const entry = this.#sessions.get(sessionId);
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt <= this.#now()) {
      this.#sessions.delete(sessionId);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.session);
  }

  revoke(sessionId: string): Promise<void> {
    this.#sessions.delete(sessionId);
    return Promise.resolve();
  }
}

const KEY_PREFIX = 'quad:session:';

/** Redis-backed store: opaque id → session JSON with a TTL; deletion is immediate revocation. */
export class RedisSessionStore implements SessionStore {
  readonly #redis: Redis;

  constructor(redis: Redis) {
    this.#redis = redis;
  }

  async create(session: Session, ttlSeconds: number): Promise<string> {
    assertValidTtl(ttlSeconds);
    const id = newSessionId();
    await this.#redis.set(KEY_PREFIX + id, JSON.stringify(session), 'EX', ttlSeconds);
    return id;
  }

  async get(sessionId: string): Promise<Session | null> {
    const raw = await this.#redis.get(KEY_PREFIX + sessionId);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  async revoke(sessionId: string): Promise<void> {
    await this.#redis.del(KEY_PREFIX + sessionId);
  }
}
