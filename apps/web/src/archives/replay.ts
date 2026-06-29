// apps/web — pure replay-stepping helpers for the scrubber/player. The player walks the seq from 0
// to the term's max in a bounded number of frames; the scrubber jumps to any seq directly.

/** Per-frame seq increment so the whole term plays in ~`frames` steps (at least 1). */
export function replayStep(maxSeq: number, frames = 60): number {
  if (maxSeq <= 0) return 1;
  return Math.max(1, Math.ceil(maxSeq / frames));
}

/** Next seq when playing, clamped to maxSeq (the caller stops when it reaches maxSeq). */
export function nextReplaySeq(current: number, maxSeq: number, step: number): number {
  return Math.min(maxSeq, current + Math.max(1, step));
}

/** Per-frame delay for a playback speed multiplier, floored so fast speeds stay sane (~60fps max). */
export function frameInterval(baseMs: number, speed: number): number {
  const s = speed > 0 ? speed : 1;
  return Math.max(16, Math.round(baseMs / s));
}

/** A canvas frame may be presented only when it represents the currently requested sequence. */
export function isReplayFrameCurrent(requestedSeq: number, renderedSeq: number | null): boolean {
  return renderedSeq === requestedSeq;
}
