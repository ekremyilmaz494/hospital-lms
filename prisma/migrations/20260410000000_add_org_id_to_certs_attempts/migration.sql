-- AlterTable: ExamAttempt — organizationId ekleme
ALTER TABLE "exam_attempts" ADD COLUMN "organization_id" UUID;

-- AlterTable: Certificate — organizationId ekleme
ALTER TABLE "certificates" ADD COLUMN "organization_id" UUID;

-- AlterTable: TrainingVideo — fileSizeBytes ekleme
ALTER TABLE "training_videos" ADD COLUMN "file_size_bytes" BIGINT;

-- AlterTable: Training — requirePreExamOnRetry ekleme
ALTER TABLE "trainings" ADD COLUMN "require_pre_exam_on_retry" BOOLEAN NOT NULL DEFAULT true;

-- Data Migration: Mevcut kayıtlara organizationId ata
UPDATE exam_attempts ea
SET organization_id = t.organization_id
FROM trainings t
WHERE ea.training_id = t.id AND ea.organization_id IS NULL;

UPDATE certificates c
SET organization_id = t.organization_id
FROM trainings t
WHERE c.training_id = t.id AND c.organization_id IS NULL;

-- Foreign keys
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "idx_attempts_organization" ON "exam_attempts"("organization_id");
CREATE INDEX "idx_certificates_organization" ON "certificates"("organization_id");
