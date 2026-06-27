// apps/web — cooldown countdown helpers (pure). The cooldown is server-enforced (COOLDOWN.md:
// clients DISPLAY, never enforce); these only format the remaining time for the UI.

/** Remaining ms until `untilMs`, floored at 0. */
export function remainingMs(untilMs: number, nowMs: number): number {
  return Math.max(0, untilMs - nowMs);
}

/** Human countdown: "" when done, "5s" under a minute, "M:SS" otherwise (rounds up to whole seconds). */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '';
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}
