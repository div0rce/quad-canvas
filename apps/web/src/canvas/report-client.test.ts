import { afterEach, describe, it, expect, vi } from 'vitest';
import { reportStatusMessage, submitReport } from './report-client';

afterEach(() => vi.unstubAllGlobals());

describe('reportStatusMessage', () => {
  it('maps each report status', () => {
    expect(reportStatusMessage(201)).toMatch(/thank you/i);
    expect(reportStatusMessage(401)).toMatch(/sign in/i);
    expect(reportStatusMessage(422)).toMatch(/reason/i);
    expect(reportStatusMessage(429)).toMatch(/too many/i);
    expect(reportStatusMessage(500)).toMatch(/could not submit/i);
  });
});

describe('submitReport', () => {
  it('reuses the same idempotency key after an ambiguous transport failure', async () => {
    const keys: string[] = [];
    let attempt = 0;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get('idempotency-key') ?? '');
      attempt += 1;
      if (attempt === 1) throw new Error('connection reset after commit');
      return new Response(null, { status: 201 });
    });

    await expect(submitReport('pixel:1,1', 'spam')).rejects.toThrow();
    await expect(submitReport('pixel:1,1', 'spam')).resolves.toBe(201);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
