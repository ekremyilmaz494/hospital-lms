-- AlterTable: users — HIS external ID alanı
ALTER TABLE "users" ADD COLUMN "his_external_id" VARCHAR(100);
CREATE INDEX "idx_users_his_external_id" ON "users"("his_external_id");

-- CreateTable: his_integrations
CREATE TABLE "his_integrations" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID         NOT NULL,
    "name"            VARCHAR(255) NOT NULL,
    "base_url"        VARCHAR(500) NOT NULL,
    "auth_type"       VARCHAR(20)  NOT NULL,
    "credentials"     JSONB        NOT NULL,
    "is_active"       BOOLEAN      NOT NULL DEFAULT true,
    "last_sync_at"    TIMESTAMPTZ,
    "sync_interval"   INTEGER      NOT NULL DEFAULT 60,
    "field_mapping"   JSONB        NOT NULL DEFAULT '{}',
    "webhook_token"   VARCHAR(128) NOT NULL,
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "his_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "his_integrations_webhook_token_key" ON "his_integrations"("webhook_token");
CREATE INDEX "idx_his_integrations_org" ON "his_integrations"("organization_id");
CREATE INDEX "idx_his_integrations_active" ON "his_integrations"("is_active");

-- CreateTable: sync_logs
CREATE TABLE "sync_logs" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "organization_id"   UUID        NOT NULL,
    "integration_id"    UUID        NOT NULL,
    "sync_type"         VARCHAR(30) NOT NULL,
    "status"            VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "total_records"     INTEGER     NOT NULL DEFAULT 0,
    "processed_records" INTEGER     NOT NULL DEFAULT 0,
    "errors"            JSONB       NOT NULL DEFAULT '[]',
    "started_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"      TIMESTAMPTZ,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_sync_logs_org" ON "sync_logs"("organization_id");
CREATE INDEX "idx_sync_logs_integration" ON "sync_logs"("integration_id");
CREATE INDEX "idx_sync_logs_status" ON "sync_logs"("status");

-- AddForeignKey: his_integrations → organizations
ALTER TABLE "his_integrations" ADD CONSTRAINT "his_integrations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: sync_logs → organizations
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: sync_logs → his_integrations
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_integration_id_fkey"
    FOREIGN KEY ("integration_id") REFERENCES "his_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
