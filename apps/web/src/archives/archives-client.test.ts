import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchArchives } from './archives-client';

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
