-- CreateTable
CREATE TABLE "guilds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guild_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guilds_tenant_id_idx" ON "guilds"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "guilds_tenant_id_slug_key" ON "guilds"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "guild_memberships_tenant_id_user_id_idx" ON "guild_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "guild_memberships_guild_id_idx" ON "guild_memberships"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "guild_memberships_tenant_id_guild_id_user_id_key" ON "guild_memberships"("tenant_id", "guild_id", "user_id");

-- AddForeignKey
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_memberships" ADD CONSTRAINT "guild_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_memberships" ADD CONSTRAINT "guild_memberships_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guild_memberships" ADD CONSTRAINT "guild_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
