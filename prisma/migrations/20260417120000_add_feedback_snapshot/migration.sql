-- EY.FR.40 Geri Bildirim — Form/Item Snapshot
--
-- Sorun: Admin formu düzenleyip kategori/item silince, eski cevaplar
-- Cascade ile silinip tarihsel rapor bütünlüğü bozuluyordu. Ayrıca detay
-- sayfası "güncel form" layout'unu gösterdiği için silinmiş sorular için
-- sadece "—" görülüyordu (hangi soru olduğu bilinmiyordu).
--
-- Çözüm:
-- 1. training_feedback_responses.form_snapshot JSONB
--    Submit anındaki form yapısı (title, documentCode, categories + items).
-- 2. training_feedback_answers.item_id NULLABLE + ON DELETE SET NULL
--    Item silinse bile cevap kaydı korunur (analytics geriye dönük bozulmaz).
-- 3. training_feedback_answers.item_snapshot JSONB
--    Cevap verildiği andaki item (text, questionType, categoryName).
--    Detay sayfası silinmiş item için hâlâ "soru metnini" gösterebilir.

-- 1) form_snapshot kolonu
ALTER TABLE "training_feedback_responses"
  ADD COLUMN IF NOT EXISTS "form_snapshot" JSONB;

-- 2) item_id nullable + FK'yi SET NULL olarak değiştir
ALTER TABLE "training_feedback_answers"
  ALTER COLUMN "item_id" DROP NOT NULL;

ALTER TABLE "training_feedback_answers"
  DROP CONSTRAINT IF EXISTS "training_feedback_answers_item_id_fkey";

ALTER TABLE "training_feedback_answers"
  ADD CONSTRAINT "training_feedback_answers_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "training_feedback_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) item_snapshot kolonu
ALTER TABLE "training_feedback_answers"
  ADD COLUMN IF NOT EXISTS "item_snapshot" JSONB;

-- NOT: Mevcut unique index (response_id, item_id) kalabilir. PostgreSQL'de
-- NULL değerler unique karşılaştırmasında eşit sayılmaz, bu yüzden aynı
-- response için birden fazla "silinmiş item" cevabı (item_id=NULL) duplicate
-- olarak görülmez. Submit sırasında tüm item_id'ler hâlâ dolu — NULL sadece
-- item silindikten SONRA oluşur.
