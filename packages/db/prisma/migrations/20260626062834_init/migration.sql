-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publicTitle" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "publicHandle" TEXT,
    "displayName" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Canvas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "termLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Canvas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pixel_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "canvas_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "prev_color" INTEGER,
    "new_color" INTEGER NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pixel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pixels" (
    "tenant_id" TEXT NOT NULL,
    "canvas_id" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "color" INTEGER NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "last_event_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "placed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pixels_pkey" PRIMARY KEY ("canvas_id","x","y")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_tenantId_userId_key" ON "Membership"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Canvas_tenantId_idx" ON "Canvas"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Canvas_tenantId_termLabel_key" ON "Canvas"("tenantId", "termLabel");

-- CreateIndex
CREATE INDEX "pixel_events_canvas_id_user_id_idx" ON "pixel_events"("canvas_id", "user_id");

-- CreateIndex
CREATE INDEX "pixel_events_tenant_id_idx" ON "pixel_events"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pixel_events_canvas_id_seq_key" ON "pixel_events"("canvas_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "pixel_events_tenant_id_idempotency_key_key" ON "pixel_events"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "pixels_tenant_id_idx" ON "pixels"("tenant_id");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canvas" ADD CONSTRAINT "Canvas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_canvas_id_fkey" FOREIGN KEY ("canvas_id") REFERENCES "Canvas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixels" ADD CONSTRAINT "pixels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixels" ADD CONSTRAINT "pixels_canvas_id_fkey" FOREIGN KEY ("canvas_id") REFERENCES "Canvas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixels" ADD CONSTRAINT "pixels_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixels" ADD CONSTRAINT "pixels_last_event_id_fkey" FOREIGN KEY ("last_event_id") REFERENCES "pixel_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
