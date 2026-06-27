-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "backup_retention_days" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "data_retention_days" INTEGER NOT NULL DEFAULT 365,
ADD COLUMN     "ip_allowlist" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "ip_allowlist_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notification_retention_days" INTEGER NOT NULL DEFAULT 90;
