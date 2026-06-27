import { describe, it, expect } from 'vitest';
import { archiveImageFilename } from './paint-snapshot';

describe('archiveImageFilename', () => {
  it('builds a safe png filename from the term', () => {
    expect(archiveImageFilename('F26')).toBe('quad-canvas-F26.png');
    expect(archiveImageFilename('Fall 2026')).toBe('quad-canvas-Fall_2026.png');
  });

  it('sanitizes unsafe characters and never produces an empty name', () => {
    expect(archiveImageFilename('../../etc')).toBe('quad-canvas-etc.png');
    expect(archiveImageFilename('')).toBe('quad-canvas-term.png');
    expect(archiveImageFilename('///')).toBe('quad-canvas-term.png');
  });
});
