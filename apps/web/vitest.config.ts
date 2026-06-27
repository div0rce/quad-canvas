import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src');

// Unit tests for framework-agnostic logic (e.g. the canvas controller). Runs in `pnpm check`.
export default defineConfig({
  // Resolve the `@/` path alias like next/tsconfig so modules importing via it are testable.
  resolve: {
    alias: { '@': srcDir },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'dist'],
  },
});
