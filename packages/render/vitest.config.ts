import { defineConfig } from 'vitest/config';

// Unit tests (pure model, no browser/canvas). Runs in `pnpm check`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
