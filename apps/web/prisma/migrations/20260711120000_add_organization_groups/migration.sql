-- Hastane Grupları (çok-hastaneli müşteri) — additive + nullable, geriye uyumlu.
-- Mevcut standalone hastaneler group_id = NULL ile aynen çalışmaya devam eder.
-- Fresh-DB-safe: yalnız CREATE TABLE + nullable ADD COLUMN + FK (veri işlemi/backfill YOK).

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "group_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "group_id" UUID;

-- CreateTable
CREATE TABLE "organization_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "owner_user_id" UUID,
    "max_organizations" INTEGER,
    "logo_url" TEXT,
    "brand_color" VARCHAR(9) NOT NULL DEFAULT '#0F172A',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_groups_code_key" ON "organization_groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organization_groups_owner_user_id_key" ON "organization_groups"("owner_user_id");

-- CreateIndex
CREATE INDEX "organization_group_is_active_idx" ON "organization_groups"("is_active");

-- CreateIndex
CREATE INDEX "organization_group_idx" ON "organizations"("group_id");

-- CreateIndex
CREATE INDEX "idx_users_group" ON "users"("group_id");

-- AddForeignKey
ALTER TABLE "organization_groups" ADD CONSTRAINT "organization_groups_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "organization_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "organization_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
