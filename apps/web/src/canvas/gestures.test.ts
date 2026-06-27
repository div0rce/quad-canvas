import { describe, it, expect } from 'vitest';
import { clampPan, pinchScale } from './gestures';

describe('pinchScale', () => {
  it('scales by the finger-distance ratio, clamped', () => {
    expect(pinchScale(2, 80, 40, 1, 8)).toBe(4); // fingers spread 2× → zoom in 2×
    expect(pinchScale(2, 20, 40, 1, 8)).toBe(1); // fingers together → zoom out, clamped to min
    expect(pinchScale(6, 160, 40, 1, 8)).toBe(8); // 4× → clamped to max
  });

  it('holds scale when the previous distance is unknown', () => {
    expect(pinchScale(3, 100, 0, 1, 8)).toBe(3);
  });
});

describe('clampPan', () => {
  it('pins the offset to 0 at scale 1 (the canvas exactly fills the container)', () => {
    expect(clampPan(1, 50, -30, 100, 100)).toEqual({ offsetX: 0, offsetY: 0 });
  });

  it('keeps the scaled canvas covering the container when zoomed in', () => {
    // At scale 2 the canvas is twice the container; offset ranges [-width, 0].
    expect(clampPan(2, 50, 0, 100, 100)).toEqual({ offsetX: 0, offsetY: 0 }); // positive → 0
    expect(clampPan(2, -50, -50, 100, 100)).toEqual({ offsetX: -50, offsetY: -50 }); // in range
    expect(clampPan(2, -150, -150, 100, 100)).toEqual({ offsetX: -100, offsetY: -100 }); // clamped to min
  });
});
