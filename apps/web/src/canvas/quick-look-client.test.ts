import { afterEach, describe, it, expect, vi } from 'vitest';
import { fetchCurrentPixel, quickLookLabel } from './quick-look-client';

afterEach(() => vi.unstubAllGlobals());

describe('quickLookLabel', () => {
  it('shows the owner handle and time for a placed cell', () => {
    const label = quickLookLabel(
      {
        kind: 'pixel',
        pixel: { at: { x: 1, y: 1 }, color: 2, owner: { handle: 'alice' }, placedAt: '2026-01-02T03:04:05.000Z' } as never,
      },
      'Red',
    );
    expect(label.startsWith('Red · alice · ')).toBe(true);
  });

  it('falls back to the handle alone when there is no timestamp', () => {
    expect(quickLookLabel({ kind: 'pixel', pixel: { at: { x: 0, y: 0 }, color: 0, owner: { handle: 'bob' } } as never }, 'White')).toBe(
      'White · bob',
    );
  });

  it('distinguishes an empty cell from an unavailable lookup', () => {
    expect(quickLookLabel({ kind: 'empty' })).toBe('Empty');
    expect(quickLookLabel({ kind: 'unavailable' })).toBe('Unavailable');
  });

  it('uses "unknown" for a placed cell whose placer has no public handle', () => {
    expect(quickLookLabel({ kind: 'pixel', pixel: { at: { x: 0, y: 0 }, color: 0 } as never })).toBe('Color 0 · unknown');
    expect(
      quickLookLabel({
        kind: 'pixel',
        pixel: { at: { x: 0, y: 0 }, color: 0, placedAt: '2026-01-02T03:04:05.000Z' } as never,
      }).startsWith('Color 0 · unknown · '),
    ).toBe(true);
  });
});

describe('fetchCurrentPixel', () => {
  it('maps a 404 to empty without treating server failures as empty', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }));
    await expect(fetchCurrentPixel(1, 2)).resolves.toEqual({ kind: 'empty' });
    vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }));
    await expect(fetchCurrentPixel(1, 2)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('maps transport failures to unavailable', async () => {
    vi.stubGlobal('fetch', async () => Promise.reject(new Error('offline')));
    await expect(fetchCurrentPixel(1, 2)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('maps a malformed successful response to unavailable', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ color: 2 }));
    await expect(fetchCurrentPixel(1, 2)).resolves.toEqual({ kind: 'unavailable' });
  });
});
