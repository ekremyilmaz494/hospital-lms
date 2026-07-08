-- CreateTable
CREATE TABLE "platform_license" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "license_jwt" TEXT NOT NULL,
    "license_id" VARCHAR(64) NOT NULL,
    "instance_id" UUID NOT NULL,
    "receipt_jwt" TEXT,
    "last_heartbeat_at" TIMESTAMPTZ,
    "last_heartbeat_status" VARCHAR(20),
    "clock_watermark" TIMESTAMPTZ NOT NULL,
    "activated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_license_pkey" PRIMARY KEY ("id")
);
