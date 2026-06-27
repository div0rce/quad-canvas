// apps/api — placement-rate counter (the dynamic cooldown's load input). A SLIDING-window counter so
// the load — and therefore the cooldown — changes GRADUALLY (P-AC-4: no rapid oscillation). A plain
// fixed window resets the count to 0 at each boundary, which would step the cooldown down abruptly.
// Instead the estimate blends the current window with a decaying tail of the previous one:
//   recent ≈ previous * (1 - fractionElapsed) + current
// `record()` counts a placement into the current window; the DB count remains the fallback when no
// counter is wired. The clock is injectable for deterministic tests.
import type { Redis } from 'ioredis';

export interface RateCounter {
  /** Smoothed estimate of placements/window for a canvas (the per-minute rate input). */
  recent(canvasId: string): Promise<number>;
  /** Count one placement toward the current window. */
  record(canvasId: string): Promise<void>;
}

/** Single-node sliding-window counter (two buckets: current + previous). */
export class InMemoryRateCounter implements RateCounter {
  readonly #windows = new Map<string, { index: number; current: number; previous: number }>();
  readonly #windowMs: number;
  readonly #now: () => number;

  constructor(windowSec = 60, now: () => number = () => Date.now()) {
    this.#windowMs = windowSec * 1000;
    this.#now = now;
  }

  // Advance the canvas's buckets to the window index for `now`, rotating current→previous across one
  // boundary (and clearing both across a gap of more than one window). The caller passes a single
  // timestamp so the bucket roll and the fraction can't straddle a boundary (no overcount).
  #roll(key: string, now: number): { index: number; current: number; previous: number } {
    const index = Math.floor(now / this.#windowMs);
    let window = this.#windows.get(key);
    if (!window) {
      window = { index, current: 0, previous: 0 };
      this.#windows.set(key, window);
      return window;
    }
    if (index === window.index) return window;
    if (index === window.index + 1) {
      window.previous = window.current;
      window.current = 0;
    } else {
      window.previous = 0;
      window.current = 0;
    }
    window.index = index;
    return window;
  }

  async recent(canvasId: string): Promise<number> {
    const now = this.#now(); // one timestamp for both the roll and the fraction
    const window = this.#roll(canvasId, now);
    const fraction = (now % this.#windowMs) / this.#windowMs;
    return window.previous * (1 - fraction) + window.current;
  }

  async record(canvasId: string): Promise<void> {
    this.#roll(canvasId, this.#now()).current += 1;
  }
}

/** Cross-node sliding-window counter backed by Redis (one INCR key per window index). */
export class RedisRateCounter implements RateCounter {
  readonly #redis: Redis;
  readonly #windowSec: number;
  readonly #windowMs: number;
  readonly #now: () => number;

  constructor(redis: Redis, windowSec = 60, now: () => number = () => Date.now()) {
    this.#redis = redis;
    this.#windowSec = windowSec;
    this.#windowMs = windowSec * 1000;
    this.#now = now;
  }

  #key(canvasId: string, index: number): string {
    return `cooldown:rate:${canvasId}:${index}`;
  }

  async recent(canvasId: string): Promise<number> {
    const now = this.#now();
    const index = Math.floor(now / this.#windowMs);
    const [current, previous] = await Promise.all([
      this.#redis.get(this.#key(canvasId, index)),
      this.#redis.get(this.#key(canvasId, index - 1)),
    ]);
    const fraction = (now % this.#windowMs) / this.#windowMs;
    return (previous ? Number(previous) : 0) * (1 - fraction) + (current ? Number(current) : 0);
  }

  async record(canvasId: string): Promise<void> {
    const index = Math.floor(this.#now() / this.#windowMs);
    const key = this.#key(canvasId, index);
    // INCR + EXPIRE in one atomic round-trip: a crash between the two can't leave a TTL-less key that
    // leaks forever. The TTL is (re)set on every write, so the bucket lives two windows from its last
    // write — long enough to serve as the decaying "previous" in the next window.
    await this.#redis.eval(
      "redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], ARGV[1]); return 1",
      1,
      key,
      String(this.#windowSec * 2),
    );
  }
}
