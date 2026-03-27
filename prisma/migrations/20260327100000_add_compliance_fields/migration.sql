-- AlterTable: Eğitim tablosuna compliance (uyum) alanları ekleniyor
ALTER TABLE "trainings"
  ADD COLUMN "is_compulsory"          BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "compliance_deadline"    TIMESTAMPTZ,
  ADD COLUMN "regulatory_body"        VARCHAR(200),
  ADD COLUMN "renewal_period_months"  INTEGER;

-- Index: Zorunlu eğitimleri hızlı sorgulamak için
CREATE INDEX "idx_trainings_compulsory" ON "trainings"("organization_id", "is_compulsory");
