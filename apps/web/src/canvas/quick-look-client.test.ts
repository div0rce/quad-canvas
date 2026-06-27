import { describe, it, expect } from 'vitest';
import { quickLookLabel } from './quick-look-client';

describe('quickLookLabel', () => {
  it('shows the owner handle and time for a placed cell', () => {
    const label = quickLookLabel({ at: { x: 1, y: 1 }, color: 2, owner: { handle: 'alice' }, placedAt: '2026-01-02T03:04:05.000Z' } as never);
    expect(label.startsWith('alice · ')).toBe(true);
  });

  it('falls back to the handle alone when there is no timestamp', () => {
    expect(quickLookLabel({ at: { x: 0, y: 0 }, color: 0, owner: { handle: 'bob' } } as never)).toBe('bob');
  });

  it('is "Empty" only for an unplaced/unreachable cell (null)', () => {
    expect(quickLookLabel(null)).toBe('Empty');
  });

  it('uses "unknown" for a placed cell whose placer has no public handle', () => {
    expect(quickLookLabel({ at: { x: 0, y: 0 }, color: 0 } as never)).toBe('unknown');
    expect(quickLookLabel({ at: { x: 0, y: 0 }, color: 0, placedAt: '2026-01-02T03:04:05.000Z' } as never).startsWith('unknown · ')).toBe(true);
  });
});
