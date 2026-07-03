-- İK/HBYS personel senkron entegrasyonu (kanal-bağımsız: push/file/pull).
-- Eski his_integrations'ın (2026-03 eklendi, 2026-06 kaldırıldı) yerine geçer;
-- farkları: API-key servis auth (hash'li), dry-run, satır-bazlı sonuç (sync_row_results),
-- güvenli deaktivasyon eşiği, users.external_id org-scoped unique (NULL'lar serbest).

-- CreateEnum
CREATE TYPE "integration_channel" AS ENUM ('push', 'file', 'pull');

-- CreateEnum
CREATE TYPE "sync_mode" AS ENUM ('delta', 'snapshot');

-- CreateEnum
CREATE TYPE "pull_auth_type" AS ENUM ('bearer', 'basic', 'header_key');

-- CreateEnum
CREATE TYPE "sync_run_trigger" AS ENUM ('api', 'file', 'schedule', 'manual');

-- CreateEnum
CREATE TYPE "sync_run_mode" AS ENUM ('dry_run', 'apply');

-- CreateEnum
CREATE TYPE "sync_run_status" AS ENUM ('running', 'completed', 'completed_with_errors', 'failed', 'aborted');

-- CreateEnum
CREATE TYPE "sync_row_action" AS ENUM ('create', 'update', 'deactivate', 'reactivate', 'skip', 'conflict', 'error');

-- AlterTable
ALTER TABLE "subscription_plans" ADD COLUMN     "has_staff_integration" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "external_id" VARCHAR(100);

-- CreateTable
CREATE TABLE "staff_integrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "integration_channel" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sync_mode" "sync_mode" NOT NULL DEFAULT 'delta',
    "field_mapping" JSONB,
    "defaults" JSONB,
    "deactivate_missing" BOOLEAN NOT NULL DEFAULT false,
    "deactivate_threshold_pct" INTEGER NOT NULL DEFAULT 20,
    "pull_base_url" VARCHAR(500),
    "pull_auth_type" "pull_auth_type",
    "pull_credentials_encrypted" TEXT,
    "pull_interval_minutes" INTEGER,
    "pull_pagination" JSONB,
    "last_run_at" TIMESTAMPTZ,
    "last_run_status" VARCHAR(30),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_api_keys" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "key_prefix" VARCHAR(20) NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "integration_id" UUID,
    "channel" "integration_channel" NOT NULL,
    "trigger" "sync_run_trigger" NOT NULL,
    "mode" "sync_run_mode" NOT NULL,
    "sync_mode" "sync_mode" NOT NULL,
    "status" "sync_run_status" NOT NULL DEFAULT 'running',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "created_rows" INTEGER NOT NULL DEFAULT 0,
    "updated_rows" INTEGER NOT NULL DEFAULT 0,
    "deactivated_rows" INTEGER NOT NULL DEFAULT 0,
    "reactivated_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "error_summary" JSONB,
    "api_key_id" UUID,
    "requested_by_id" UUID,
    "file_name" VARCHAR(255),
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_row_results" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sync_run_id" UUID NOT NULL,
    "row_index" INTEGER NOT NULL,
    "external_id" VARCHAR(100),
    "action" "sync_row_action" NOT NULL,
    "user_id" UUID,
    "message" TEXT,
    "payload_masked" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_row_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_staff_integrations_org" ON "staff_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_staff_integrations_org_channel" ON "staff_integrations"("organization_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "idx_integration_api_keys_hash" ON "integration_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_integration_api_keys_org" ON "integration_api_keys"("organization_id");

-- CreateIndex
CREATE INDEX "idx_sync_runs_org_time" ON "sync_runs"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "idx_sync_row_results_run" ON "sync_row_results"("sync_run_id");

-- CreateIndex
CREATE INDEX "idx_sync_row_results_org_time" ON "sync_row_results"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idx_users_org_external_unique" ON "users"("organization_id", "external_id");

-- AddForeignKey
ALTER TABLE "staff_integrations" ADD CONSTRAINT "staff_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_api_keys" ADD CONSTRAINT "integration_api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "staff_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "integration_api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_row_results" ADD CONSTRAINT "sync_row_results_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

