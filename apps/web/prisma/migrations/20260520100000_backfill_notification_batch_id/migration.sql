-- Legacy bildirim backfill: batch_id NULL olan admin gönderimlerini grupla.
--
-- Sorun: 20260519180000_notification_batch_id migration'ı `batch_id` kolonunu
-- ekledi ama eski satırlar NULL kaldı (o migration bilinçli olarak backfill
-- yapmamıştı). Admin "Bildirim Yönetimi" listesi GET endpoint'i NULL satırları
-- `id` ile gruplayınca tek gönderim N ayrı kart olarak görünüyor — ör. 141
-- alıcılı "Yeni Eğitim Duyurusu" → 141 kart alt alta.
--
-- Çözüm: Aynı gönderime ait satırlara ortak `batch_id` ata. Gruplama anahtarı:
--   (sender_id, organization_id, title, message, created_at)
-- Prisma `createMany` tek INSERT statement olduğu için bir gönderimin tüm alıcı
-- satırları aynı `created_at`'i paylaşır (Postgres now() = transaction zamanı).
-- Doğrulandı: mevcut 252 legacy satır bu anahtarla tam 2 temiz batch'e ayrılıyor.
--
-- Sistem bildirimleri (sender_id NULL — sınav/atama/cron/abonelik) hariç tutulur;
-- admin "Gönderdiklerim" listesine zaten girmiyorlar.
--
-- Idempotent: fresh DB'de legacy satır yok → 0 satır etkilenir. Tekrar deploy'da
-- tüm satırların batch_id'si dolu → WHERE batch_id IS NULL → 0 satır. Güvenli.

WITH legacy_batches AS (
  SELECT
    sender_id,
    organization_id,
    title,
    message,
    created_at,
    gen_random_uuid() AS new_batch_id
  FROM "notifications"
  WHERE "batch_id" IS NULL
    AND "sender_id" IS NOT NULL
  GROUP BY sender_id, organization_id, title, message, created_at
)
UPDATE "notifications" n
SET "batch_id" = b.new_batch_id
FROM legacy_batches b
WHERE n."batch_id" IS NULL
  AND n."sender_id" IS NOT NULL
  AND n."sender_id" = b.sender_id
  AND n."organization_id" = b.organization_id
  AND n."title" = b.title
  AND n."message" = b.message
  AND n."created_at" = b.created_at;
