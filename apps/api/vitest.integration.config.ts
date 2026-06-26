import { defineConfig } from 'vitest/config';

// Integration tests — require the local Docker Compose Postgres (migrated). Run via:
//   docker compose up -d --wait postgres redis
//   pnpm --filter @quad/db db:migrate:deploy   # apply migrations to the test DB
//   pnpm --filter api test:integration
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
