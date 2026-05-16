-- Orijinal atama hakkı (immutable). Admin ek hak verdiğinde max_attempts artar
-- ama original_max_attempts değişmez. Feedback trigger bu değere bakar.
ALTER TABLE "training_assignments" ADD COLUMN "original_max_attempts" INTEGER NOT NULL DEFAULT 3;

-- Mevcut satırlar için: şu anki maxAttempts'i orijinal olarak backfill et.
-- (Admin zaten ek hak vermiş olabilir; geçmişe dönük ayırt edemediğimiz için
--  mevcut değeri baz alıyoruz.)
UPDATE "training_assignments" SET "original_max_attempts" = "max_attempts";
