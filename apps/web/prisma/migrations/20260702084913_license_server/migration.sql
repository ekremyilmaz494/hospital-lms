-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "contact_email" VARCHAR(200),
    "license_jwt" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "license_type" VARCHAR(20) NOT NULL DEFAULT 'standard',
    "max_organizations" INTEGER,
    "max_staff" INTEGER,
    "grace_days" INTEGER NOT NULL DEFAULT 14,
    "valid_until" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "revoked_at" TIMESTAMPTZ,
    "revoke_reason" TEXT,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_activations" (
    "id" UUID NOT NULL,
    "license_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "app_version" VARCHAR(40),
    "hostname" VARCHAR(200),
    "first_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_heartbeats" (
    "id" UUID NOT NULL,
    "license_id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "org_count" INTEGER NOT NULL,
    "staff_count" INTEGER NOT NULL,
    "app_version" VARCHAR(40),
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_heartbeats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "license_activations_license_id_instance_id_key" ON "license_activations"("license_id", "instance_id");

-- CreateIndex
CREATE INDEX "idx_license_heartbeat_license_time" ON "license_heartbeats"("license_id", "received_at");

-- AddForeignKey
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_heartbeats" ADD CONSTRAINT "license_heartbeats_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
