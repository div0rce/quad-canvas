import { defineConfig } from 'vitest/config';

// Unit smoke tests only — no Docker / external services. Runs in `pnpm check`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'node_modules', 'dist'],
  },
});
