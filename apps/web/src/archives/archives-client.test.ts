import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchArchiveAt, fetchArchiveSnapshot, fetchArchives, fetchReplayMeta } from './archives-client';

afterEach(() => vi.unstubAllGlobals());

describe('fetchArchives', () => {
  it('follows cursors instead of silently truncating old terms', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const second = url.includes('cursor=older');
      return Response.json({
        data: [
          {
            id: second ? 'canvas-old' : 'canvas-new',
            term: second ? 'F24' : 'S25',
            status: 'archived',
            width: 10,
            height: 10,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        page: { nextCursor: second ? null : 'older', limit: 200 },
      });
    });

    const result = await fetchArchives();
    expect(result?.data.map((archive) => archive.term)).toEqual(['S25', 'F24']);
  });
});

describe('archive response validation', () => {
  it('turns malformed successful snapshot and replay responses into retryable errors', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ width: 10, height: 10 }));
    await expect(fetchArchiveSnapshot('F26')).resolves.toEqual({ status: 'error' });
    await expect(fetchArchiveAt('F26', 1)).resolves.toBeNull();
    await expect(fetchReplayMeta('F26')).resolves.toEqual({ status: 'error' });
  });
});
