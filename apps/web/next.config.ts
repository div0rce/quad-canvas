import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Standalone output for a slim, self-contained runtime image. In this pnpm monorepo the trace root is
// the repo root (two levels up) so the @quad/* workspace deps are traced into .next/standalone.
// Defensive response headers on every web route (the API sets its own; the edge proxy doesn't add
// them for the web route). frame-ancestors 'none' + X-Frame-Options block clickjacking; nosniff stops
// MIME sniffing; Referrer-Policy/Permissions-Policy minimise leakage; HSTS is honoured over HTTPS.
// (A full script/style CSP needs per-request nonces with Next's inline runtime; frame-ancestors is the
// safe, high-value subset that can't break hydration.)
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const apiProxyOrigin = process.env['API_PROXY_ORIGIN']?.replace(/\/+$/, '');
const localDevApiProxyOrigin = process.env['NODE_ENV'] === 'development' ? 'http://rutgers.localhost:8088' : '';
const resolvedApiProxyOrigin = apiProxyOrigin || localDevApiProxyOrigin;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  headers: () => Promise.resolve([{ source: '/:path*', headers: SECURITY_HEADERS }]),
  rewrites: () =>
    Promise.resolve(
      resolvedApiProxyOrigin
        ? [
            {
              source: '/api/:path*',
              destination: `${resolvedApiProxyOrigin}/api/:path*`,
            },
          ]
        : [],
    ),
};

export default nextConfig;
