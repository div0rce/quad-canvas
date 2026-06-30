// apps/web — resolve browser API origins. Authenticated REST is always same-origin so the httpOnly
// session cookie stays first-party through the web/edge proxy. WebSocket may use a public API origin
// because Vercel/Next rewrites are HTTP-oriented and not a reliable WS proxy.
const LOCAL_EDGE_API_ORIGIN = 'http://rutgers.localhost:8088';

function configuredRealtimeBase(): string {
  return (process.env['NEXT_PUBLIC_API_BASE'] ?? '').replace(/\/+$/, '');
}

export function apiBase(): string {
  return '';
}

export function websocketApiBase(): string {
  const configured = configuredRealtimeBase();
  if (configured) return configured;
  if (
    typeof window !== 'undefined' &&
    window.location.hostname === 'rutgers.localhost' &&
    window.location.port === '3002'
  ) {
    return LOCAL_EDGE_API_ORIGIN;
  }
  return '';
}

export function apiPath(path: string): string {
  return `${apiBase()}${path}`;
}
