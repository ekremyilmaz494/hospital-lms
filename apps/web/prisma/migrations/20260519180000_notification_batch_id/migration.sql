-- Admin bildirim yönetimi: tek gönderim N alıcı satırı yerine tek karta indirgensin.
--
-- Sorun: POST /api/admin/notifications/send `createMany` ile alıcı başına 1 row
-- üretiyor; GET endpoint bunları olduğu gibi listeleyince aynı bildirim alt alta
-- "duplicate" gibi gözüküyor. Gruplama anahtarı yoktu.
--
-- Çözüm: `batch_id` (nullable UUID) eklendi. Admin manuel gönderiminde aynı
-- UUID tüm alıcı satırlarına yazılır. Sistem bildirimleri (sınav/atama/cron/
-- abonelik) NULL kalır — admin listesine zaten girmiyorlar.
--
-- Geri uyumluluk: Eski satırlarda batch_id NULL. GET endpoint o satırlar için
-- row.id'yi grup anahtarı olarak kullanır (legacy fallback) — backfill yok.

-- 1) Kolon ekle (idempotent — fresh DB'de + tekrar deploy'da sorunsuz)
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "batch_id" UUID;

-- 2) Batch detay endpoint'i için tek-kolon index
CREATE INDEX IF NOT EXISTS "idx_notifications_batch" ON "notifications" ("batch_id");

-- 3) Admin "Gönderdiklerim" listesinde groupBy performansı için composite index
CREATE INDEX IF NOT EXISTS "idx_notifications_sender_batch"
  ON "notifications" ("sender_id", "batch_id", "created_at");
