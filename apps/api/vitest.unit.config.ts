import { defineConfig } from 'vitest/config';

// Unit tests (no Docker). Runs in `pnpm check`. Integration tests use vitest.integration.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src/**/*.integration.test.ts'],
  },
});
