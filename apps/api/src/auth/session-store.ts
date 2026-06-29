// apps/api — server-authoritative session store. Per AUTHENTICATION.md, sessions are OPAQUE,
// high-entropy tokens whose state lives server-side (Redis for fast validation; durable account +
// membership state stays in Postgres). Server-side state is what makes **immediate revocation**
// possible (AUTH-INV-8) — signout deletes one session; a ban/suspension deletes ALL of the user's
// sessions at once via a per-user index. This module is the session lifecycle only; the verification
// front-door and the request→principal plugin build on it.
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
  /** Destroy a single session (signout / revocation). Idempotent. */
  revoke(sessionId: string): Promise<void>;
  /** Destroy ALL of a user's sessions at once (ban/suspension — AUTH-INV-8). Idempotent. */
  revokeAllForUser(userId: string): Promise<void>;
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
  readonly #byUser = new Map<string, Set<string>>();
  readonly #now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.#now = now;
  }

  create(session: Session, ttlSeconds: number): Promise<string> {
    assertValidTtl(ttlSeconds);
    const id = newSessionId();
    this.#sessions.set(id, { session, expiresAt: this.#now() + ttlSeconds * 1000 });
    let set = this.#byUser.get(session.userId);
    if (!set) {
      set = new Set();
      this.#byUser.set(session.userId, set);
    }
    set.add(id);
    return Promise.resolve(id);
  }

  get(sessionId: string): Promise<Session | null> {
    const entry = this.#sessions.get(sessionId);
    if (!entry) return Promise.resolve(null);
    if (entry.expiresAt <= this.#now()) {
      this.#sessions.delete(sessionId);
      const set = this.#byUser.get(entry.session.userId);
      set?.delete(sessionId);
      if (set && set.size === 0) this.#byUser.delete(entry.session.userId);
      return Promise.resolve(null);
    }
    return Promise.resolve(entry.session);
  }

  revoke(sessionId: string): Promise<void> {
    const entry = this.#sessions.get(sessionId);
    this.#sessions.delete(sessionId);
    if (entry) {
      const set = this.#byUser.get(entry.session.userId);
      set?.delete(sessionId);
      if (set && set.size === 0) this.#byUser.delete(entry.session.userId);
    }
    return Promise.resolve();
  }

  revokeAllForUser(userId: string): Promise<void> {
    const set = this.#byUser.get(userId);
    if (set) {
      for (const id of set) this.#sessions.delete(id);
      this.#byUser.delete(userId);
    }
    return Promise.resolve();
  }
}

const KEY_PREFIX = 'quad:session:';
const USER_PREFIX = 'quad:user-sessions:';

function parseSession(raw: string): Session | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const session = value as Record<string, unknown>;
    if (typeof session['userId'] !== 'string' || session['userId'].length === 0) return null;
    if (typeof session['tenantId'] !== 'string' || session['tenantId'].length === 0) return null;
    return { userId: session['userId'], tenantId: session['tenantId'] };
  } catch {
    return null;
  }
}

/** Redis-backed store: opaque id → session JSON with a TTL; deletion is immediate revocation. */
export class RedisSessionStore implements SessionStore {
  readonly #redis: Redis;

  constructor(redis: Redis) {
    this.#redis = redis;
  }

  async create(session: Session, ttlSeconds: number): Promise<string> {
    assertValidTtl(ttlSeconds);
    const id = newSessionId();
    const userKey = USER_PREFIX + session.userId;
    // Session + the user→sessions index, atomically. The index TTL only ever EXTENDS (NX sets it on
    // first use; GT grows it for a longer-lived session) — it must never shrink below a still-valid
    // session, or revokeAllForUser could miss one and break the revocation guarantee (AUTH-INV-8).
    await this.#redis
      .multi()
      .set(KEY_PREFIX + id, JSON.stringify(session), 'EX', ttlSeconds)
      .sadd(userKey, id)
      .expire(userKey, ttlSeconds, 'NX')
      .expire(userKey, ttlSeconds, 'GT')
      .exec();
    return id;
  }

  async get(sessionId: string): Promise<Session | null> {
    const raw = await this.#redis.get(KEY_PREFIX + sessionId);
    return raw === null ? null : parseSession(raw);
  }

  async revoke(sessionId: string): Promise<void> {
    const raw = await this.#redis.get(KEY_PREFIX + sessionId);
    await this.#redis.del(KEY_PREFIX + sessionId);
    if (raw !== null) {
      const session = parseSession(raw);
      if (session) {
        await this.#redis.srem(USER_PREFIX + session.userId, sessionId);
      }
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const userKey = USER_PREFIX + userId;
    const ids = await this.#redis.smembers(userKey);
    if (ids.length > 0) {
      await this.#redis.del(...ids.map((id) => KEY_PREFIX + id));
    }
    await this.#redis.del(userKey);
  }
}
