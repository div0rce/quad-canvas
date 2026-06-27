// apps/api — placement-rate counter (the dynamic cooldown's load input). A fast path so the cooldown
// doesn't run a DB count on every placement: a fixed-window counter per canvas approximates the
// per-minute rate. `recent()` reads the current window; `record()` counts a placement. The DB count
// (countRecentPlacements) remains the fallback when no counter is wired.
import type { Redis } from 'ioredis';

export interface RateCounter {
  /** Approximate placements in the current window for a canvas (the per-minute rate input). */
  recent(canvasId: string): Promise<number>;
  /** Count one placement toward the current window. */
  record(canvasId: string): Promise<void>;
}

/** Single-node fixed-window counter. Clock injected for deterministic tests. */
export class InMemoryRateCounter implements RateCounter {
  readonly #windows = new Map<string, { count: number; resetAt: number }>();
  readonly #windowMs: number;
  readonly #now: () => number;

  constructor(windowSec = 60, now: () => number = () => Date.now()) {
    this.#windowMs = windowSec * 1000;
    this.#now = now;
  }

  #current(key: string): { count: number; resetAt: number } {
    const now = this.#now();
    let window = this.#windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + this.#windowMs };
      this.#windows.set(key, window);
    }
    return window;
  }

  async recent(canvasId: string): Promise<number> {
    return this.#current(canvasId).count;
  }

  async record(canvasId: string): Promise<void> {
    this.#current(canvasId).count += 1;
  }
}

/** Cross-node fixed-window counter backed by Redis (GET to read; INCR + EXPIRE to record). */
export class RedisRateCounter implements RateCounter {
  readonly #redis: Redis;
  readonly #windowSec: number;

  constructor(redis: Redis, windowSec = 60) {
    this.#redis = redis;
    this.#windowSec = windowSec;
  }

  #key(canvasId: string): string {
    return `cooldown:rate:${canvasId}`;
  }

  async recent(canvasId: string): Promise<number> {
    const value = await this.#redis.get(this.#key(canvasId));
    return value ? Number(value) : 0;
  }

  async record(canvasId: string): Promise<void> {
    const key = this.#key(canvasId);
    const count = await this.#redis.incr(key);
    if (count === 1) await this.#redis.expire(key, this.#windowSec); // start the window TTL on first hit
  }
}
