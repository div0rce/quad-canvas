-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requester_user_id" TEXT NOT NULL,
    "addressee_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friendships_tenant_id_addressee_user_id_status_idx" ON "friendships"("tenant_id", "addressee_user_id", "status");

-- CreateIndex
CREATE INDEX "friendships_tenant_id_requester_user_id_status_idx" ON "friendships"("tenant_id", "requester_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_tenant_id_requester_user_id_addressee_user_id_key" ON "friendships"("tenant_id", "requester_user_id", "addressee_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_tenant_id_idempotency_key_key" ON "friendships"("tenant_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_user_id_fkey" FOREIGN KEY ("addressee_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
