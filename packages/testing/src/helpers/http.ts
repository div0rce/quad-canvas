// @quad/testing — local HTTP/host helpers for integration tests.

/** Tenant host for local testing, e.g. `acme` → `acme.localhost`. */
export function tenantHost(slug: string): string {
  return `${slug}.localhost`;
}

/** A `Host` header object for driving tenant resolution against a local server. */
export function tenantHostHeader(slug: string): Readonly<Record<'Host', string>> {
  return { Host: tenantHost(slug) };
}

export interface LocalUrlOptions {
  readonly port: number;
  readonly path?: string;
  readonly host?: string;
}

/** Build a local test URL, e.g. `{ port: 3001, path: '/healthz' }` → `http://127.0.0.1:3001/healthz`. */
export function localTestUrl(opts: LocalUrlOptions): string {
  const host = opts.host ?? '127.0.0.1';
  const path = opts.path ?? '/';
  return `http://${host}:${opts.port}${path}`;
}
