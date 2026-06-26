// @quad/db — Prisma CLI config (Prisma 7). The schema datasource has no `url`; the connection
// string for migrations/CLI is resolved here. `generate`/`validate` do not touch a database, so
// a connection string must still load even with no env (Prisma errors if it can't resolve one).
//
// The fallback is the LOCAL Docker Compose dev database (example creds only — never a real secret;
// mirrors docker-compose.yml / .env.example). It is **localhost-only**, so an unset `DATABASE_URL`
// can never reach a remote/production database — migrations there always require `DATABASE_URL` to
// be set explicitly. Runtime connections come from the driver adapter in src/client.ts, not here.
import { defineConfig } from 'prisma/config';

const LOCAL_DEV_URL = 'postgresql://quad:quad@127.0.0.1:5432/quad';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? LOCAL_DEV_URL },
});
