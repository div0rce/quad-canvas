import { defineConfig } from 'vitest/config';

// Integration tests — require the local Docker Compose Redis. Run via:
//   docker compose up -d --wait redis
//   pnpm --filter @quad/realtime test:integration
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    fileParallelism: false,
  },
});
