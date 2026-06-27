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
