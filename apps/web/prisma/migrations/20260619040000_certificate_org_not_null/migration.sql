-- B4 — Certificate.organization_id NOT NULL + onDelete RESTRICT
-- Sebep: tenant izolasyonu kolon-bazlı tutarlı olsun. Kolon eskiden legacy nedeniyle
-- nullable'dı; admin listesi tenant filtresini training.organization_id üzerinden yapıyordu.
-- training_id zaten NOT NULL + FK, ve trainings.organization_id NOT NULL → her sertifikanın
-- training'i üzerinden geçerli bir org'u var; backfill sonrası NULL kalmaz.
-- Adım sırası fresh DB'de ve tekrar çalıştırmada güvenli (koşullu UPDATE + IF EXISTS).

-- 1. Eski kayıtlarda boş organization_id'yi training üzerinden doldur
UPDATE "certificates" c
SET "organization_id" = t."organization_id"
FROM "trainings" t
WHERE c."training_id" = t."id"
  AND c."organization_id" IS NULL;

-- 2. Eski FK'yı düşür (nullable kolona bağlı ON DELETE SET NULL idi)
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_organization_id_fkey";

-- 3. Kolonu NOT NULL yap
ALTER TABLE "certificates" ALTER COLUMN "organization_id" SET NOT NULL;

-- 4. FK'yı non-null ilişki için ON DELETE RESTRICT ile yeniden ekle
--    (Training.organization ile aynı kural — sertifikalı org hard-delete edilemez)
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
