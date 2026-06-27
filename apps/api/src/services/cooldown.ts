// apps/api — dynamic cooldown algorithm (COOLDOWN.md / ADR-0008). The cooldown is a GLOBAL per-canvas
// fairness throttle that grows with load: quiet canvas → near the floor, busy canvas → up to the
// ceiling. Pure + deterministic (the load score and the cooldown value are both functions of the
// recent placement rate), so it's fully unit-testable; the service feeds it the measured rate.

export interface CooldownConfig {
  /** Floor (quiet canvas). */
  readonly minMs: number;
  /** Ceiling (saturated canvas). */
  readonly maxMs: number;
  /** Canvas-wide placement rate (per minute) at which the cooldown reaches the ceiling. */
  readonly saturationRatePerMin: number;
}

/** Normalized load in [0, 1] from the recent placement rate (linear up to saturation, then clamped). */
export function loadScore(placementRatePerMin: number, saturationRatePerMin: number): number {
  if (!(saturationRatePerMin > 0) || !(placementRatePerMin > 0)) return 0;
  return Math.min(1, placementRatePerMin / saturationRatePerMin);
}

/** Dynamic cooldown (ms) for a measured placement rate, clamped to [minMs, maxMs]. */
export function dynamicCooldownMs(placementRatePerMin: number, config: CooldownConfig): number {
  const score = loadScore(placementRatePerMin, config.saturationRatePerMin);
  const value = config.minMs + (config.maxMs - config.minMs) * score;
  return Math.round(Math.max(config.minMs, Math.min(config.maxMs, value)));
}
