-- Admin bildirim panelinde "Gönderdiklerim" görünümü için sender_id alanı.
-- Mevcut bildirimler NULL kalır (sistem/auto bildirimleri zaten NULL).
-- Sadece admin manuel gönderim akışlarında bu alan dolar; admin GET filtresi
-- senderId = adminId ile sadece kendi gönderdiklerini listeler.
--
-- Safe migration:
--   1. Kolonu nullable ekle
--   2. FK constraint (ON DELETE SET NULL — admin silinirse "Sistem" gibi davransın)
--   3. Index (sender_id, created_at) — admin paneli sıralı list query'si için

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "sender_id" UUID;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_notifications_sender_date"
  ON "notifications" ("sender_id", "created_at");
