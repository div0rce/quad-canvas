import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBase, apiPath, websocketApiBase } from './api-base';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('apiBase', () => {
  it('keeps authenticated REST same-origin even when a public realtime API base is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE', 'https://api.example.test/');

    expect(apiBase()).toBe('');
    expect(apiPath('/api/v1/session')).toBe('/api/v1/session');
    expect(websocketApiBase()).toBe('https://api.example.test');
  });

  it('keeps REST same-origin on the local direct web dev port', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE', '');
    vi.stubGlobal('window', { location: { hostname: 'rutgers.localhost', port: '3002' } });

    expect(apiBase()).toBe('');
    expect(apiPath('/api/v1/session')).toBe('/api/v1/session');
  });

  it('routes local direct web dev WebSocket traffic through the tenant edge', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE', '');
    vi.stubGlobal('window', { location: { hostname: 'rutgers.localhost', port: '3002' } });

    expect(websocketApiBase()).toBe('http://rutgers.localhost:8088');
  });

  it('keeps the production default same-origin', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE', '');
    vi.stubGlobal('window', { location: { hostname: 'rutgers.localhost', port: '8088' } });

    expect(apiBase()).toBe('');
    expect(apiPath('/api/v1/session')).toBe('/api/v1/session');
  });
});
