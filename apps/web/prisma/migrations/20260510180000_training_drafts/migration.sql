-- Wizard taslak alanları: yarım bırakılan eğitim oluşturma akışlarının
-- sunucu tarafında saklanması ve daha sonra kaldığı yerden devam edilmesi için.
ALTER TABLE "trainings"
  ADD COLUMN IF NOT EXISTS "draft_data"        JSONB,
  ADD COLUMN IF NOT EXISTS "draft_step"        INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "draft_updated_at"  TIMESTAMPTZ;

-- Kullanıcının kendi taslakları için hızlı lookup
CREATE INDEX IF NOT EXISTS "idx_trainings_org_creator_publish"
  ON "trainings" ("organization_id", "created_by", "publish_status");
