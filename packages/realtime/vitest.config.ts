import { defineConfig } from 'vitest/config';

// Unit tests only (no transport/IO). Runs in `pnpm check`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src/**/*.integration.test.ts'],
  },
});
