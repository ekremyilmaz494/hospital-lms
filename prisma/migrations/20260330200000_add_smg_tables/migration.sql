-- CreateTable: SMG Activities
CREATE TABLE "smg_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "activity_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(255),
    "completion_date" DATE NOT NULL,
    "smg_points" INTEGER NOT NULL,
    "certificate_url" VARCHAR(1000),
    "approval_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smg_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SMG Periods
CREATE TABLE "smg_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "required_points" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smg_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_smg_activities_user" ON "smg_activities"("user_id");
CREATE INDEX "idx_smg_activities_org" ON "smg_activities"("organization_id");
CREATE INDEX "idx_smg_periods_org" ON "smg_periods"("organization_id");

-- AddForeignKey
ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "smg_periods" ADD CONSTRAINT "smg_periods_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
