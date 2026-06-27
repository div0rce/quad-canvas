import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Standalone output for a slim, self-contained runtime image. In this pnpm monorepo the trace root is
// the repo root (two levels up) so the @quad/* workspace deps are traced into .next/standalone.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
};

export default nextConfig;
