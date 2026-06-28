-- Additive: a nullable idempotency key on reports so retried POST /reports is duplicate-safe
-- (API-INV-6). Nullable + a unique index where NULLs are distinct, so existing keyless rows are
-- unaffected. No DROP/RENAME, no data rewrite — rollback-safe.
-- AlterTable
ALTER TABLE "reports" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reports_tenant_id_idempotency_key_key" ON "reports"("tenant_id", "idempotency_key");
