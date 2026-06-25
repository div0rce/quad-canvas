import { defineConfig } from 'vitest/config';

// Integration smoke tests — require local Docker Compose services (postgres, redis).
// Run explicitly: `docker compose up -d postgres redis && pnpm --filter @quad/testing test:integration`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
