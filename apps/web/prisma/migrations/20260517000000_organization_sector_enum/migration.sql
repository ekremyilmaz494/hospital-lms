-- Faz 3: Organization.sector String → Sector enum
--
-- Plan dosyası: .claude/plans/projeyi-3-par-aya-b-l-abstract-seahorse.md
--
-- Önce CREATE TYPE ile Postgres enum'u oluştur, sonra ALTER COLUMN ... USING
-- CAST ile mevcut VARCHAR(50) sütununu enum tipine çevir. Devakent'in
-- "healthcare" string değeri enum value healthcare'e birebir eşleşir.
--
-- Backward compat:
--  - default 'healthcare' korundu — eski Organization.create() çağrıları kırılmaz
--  - column adı 'sector' aynı
--  - index 'organization_sector_idx' enum üzerinde otomatik yeniden kullanılır
--
-- Yeni sektör eklemek için: ALTER TYPE "sector" ADD VALUE 'new_sector';
-- Sektör çıkarmak için: önce o sektördeki org'ları başka bir değere migrate et,
-- sonra Postgres'te enum değer çıkarma manuel + dikkatli.

-- 1) Postgres ENUM tipini yarat (yoksa)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sector') THEN
    CREATE TYPE "sector" AS ENUM ('healthcare', 'manufacturing', 'education', 'retail', 'other');
  END IF;
END$$;

-- 2) Tutarsız değerleri 'other'a düşür (CAST'ten önce safety net — Devakent'te
--    'healthcare' var, başka değer beklenmiyor ama yine de paranoid kontrol).
UPDATE "organizations"
SET "sector" = 'other'
WHERE "sector" NOT IN ('healthcare', 'manufacturing', 'education', 'retail', 'other');

-- 3) Default'u geçici kaldır (CAST sırasında default expression VARCHAR'a bağlı,
--    enum'a CAST için önce default detach gerekiyor).
ALTER TABLE "organizations" ALTER COLUMN "sector" DROP DEFAULT;

-- 4) Sütun tipini enum'a çevir (USING ifadesi VARCHAR → enum CAST yapar).
ALTER TABLE "organizations"
  ALTER COLUMN "sector" TYPE "sector" USING "sector"::"sector";

-- 5) Default'u enum value olarak yeniden ekle.
ALTER TABLE "organizations" ALTER COLUMN "sector" SET DEFAULT 'healthcare'::"sector";

-- 6) Eski organization_sector_idx index'i sütun tipi değişince otomatik düşmüş
--    olabilir, garantiye al — IF NOT EXISTS ile yeniden kur (enum tipinde de
--    btree çalışır, sorgular aynı şekilde gider).
CREATE INDEX IF NOT EXISTS "organization_sector_idx" ON "organizations"("sector");
