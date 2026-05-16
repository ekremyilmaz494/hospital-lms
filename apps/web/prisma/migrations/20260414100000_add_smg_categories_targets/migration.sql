-- CreateTable smg_categories
CREATE TABLE "smg_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "max_points_per_activity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "smg_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable smg_targets
CREATE TABLE "smg_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "unvan" VARCHAR(100),
    "user_id" UUID,
    "required_points" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "smg_targets_pkey" PRIMARY KEY ("id")
);

-- AlterTable smg_activities: category_id ekle
ALTER TABLE "smg_activities" ADD COLUMN "category_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "idx_smg_categories_org_code" ON "smg_categories"("organization_id", "code");
CREATE UNIQUE INDEX "idx_smg_targets_unique" ON "smg_targets"("period_id", "unvan", "user_id");
CREATE INDEX "idx_smg_categories_org" ON "smg_categories"("organization_id");
CREATE INDEX "idx_smg_targets_period" ON "smg_targets"("period_id");
CREATE INDEX "idx_smg_targets_org" ON "smg_targets"("organization_id");
CREATE INDEX "idx_smg_activities_category" ON "smg_activities"("category_id");

-- AddForeignKey
ALTER TABLE "smg_categories" ADD CONSTRAINT "smg_categories_org_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_org_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_period_fkey"
    FOREIGN KEY ("period_id") REFERENCES "smg_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_category_fkey"
    FOREIGN KEY ("category_id") REFERENCES "smg_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
