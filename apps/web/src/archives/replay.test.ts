import { describe, it, expect } from 'vitest';
import { replayStep, nextReplaySeq } from './replay';

describe('replayStep', () => {
  it('divides the term into ~frames steps, at least 1', () => {
    expect(replayStep(600, 60)).toBe(10);
    expect(replayStep(30, 60)).toBe(1); // fewer events than frames → 1 per frame
    expect(replayStep(0)).toBe(1);
    expect(replayStep(125, 60)).toBe(3); // ceil(125/60)
  });
});

describe('nextReplaySeq', () => {
  it('advances by the step, clamped to the max', () => {
    expect(nextReplaySeq(0, 100, 10)).toBe(10);
    expect(nextReplaySeq(95, 100, 10)).toBe(100);
    expect(nextReplaySeq(100, 100, 10)).toBe(100); // already at the end
  });

  it('advances by at least 1', () => {
    expect(nextReplaySeq(5, 100, 0)).toBe(6);
  });
});
