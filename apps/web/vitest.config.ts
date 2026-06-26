import { defineConfig } from 'vitest/config';

// Unit tests for framework-agnostic logic (e.g. the canvas controller). Runs in `pnpm check`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'dist'],
  },
});
