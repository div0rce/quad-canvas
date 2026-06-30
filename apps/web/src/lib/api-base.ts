// apps/web — resolve browser API origins. REST defaults to same-origin so cookies remain first-party
// through the web/edge proxy. The local direct web dev port (3002) can dial the local edge for
// WebSocket traffic because Next rewrites are HTTP-oriented and not a reliable WS proxy.
const LOCAL_EDGE_API_ORIGIN = 'http://rutgers.localhost:8088';

function configuredApiBase(): string {
  return (process.env['NEXT_PUBLIC_API_BASE'] ?? '').replace(/\/+$/, '');
}

export function apiBase(): string {
  return configuredApiBase();
}

export function websocketApiBase(): string {
  const configured = configuredApiBase();
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
