-- Additive: a nullable idempotency key on moderation_actions so retried pixel/region rollbacks are
-- idempotent (a non-idempotent rollback over-reverts on retry). Nullable + a unique index where NULLs
-- are distinct, so existing keyless actions are unaffected. No DROP/RENAME, no data rewrite.
-- AlterTable
ALTER TABLE "moderation_actions" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "moderation_actions_tenant_id_idempotency_key_key" ON "moderation_actions"("tenant_id", "idempotency_key");
