-- G5.4 — Eğitim durumu: draft / published / archived
-- Mevcut is_active alanı korunuyor (geriye dönük uyumluluk)
-- publish_status: draft = oluşturuldu henüz yayınlanmadı
--                published = aktif, personel görebilir
--                archived = arşivlendi, yeni atama yapılamaz
ALTER TABLE "trainings"
  ADD COLUMN "publish_status" VARCHAR(20) NOT NULL DEFAULT 'published';

-- Mevcut is_active=false satırları archived olarak işaretle
UPDATE "trainings" SET "publish_status" = 'archived' WHERE "is_active" = false;

-- Index: publish_status'a göre hızlı filtreleme
CREATE INDEX "idx_trainings_publish_status" ON "trainings"("organization_id", "publish_status");
