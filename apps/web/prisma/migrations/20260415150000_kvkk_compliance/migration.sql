-- KVKK Uyum Migrasyonu — 2026-04-15
-- 1. TC Kimlik No kaldır (KVKK md.4/c ölçülülük ilkesi)
-- 2. Geçersiz kvkkConsent alanlarını kaldır, kvkkNoticeAcknowledgedAt ekle

-- TC No: önce mevcut verileri temizle, sonra constraint + kolonu kaldır
UPDATE "users" SET "tc_no" = NULL WHERE "tc_no" IS NOT NULL;
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_organization_id_tc_no_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "tc_no";

-- hisExternalId üzerinde organization bazlı partial unique index (NULL olmayan kayıtlar)
CREATE UNIQUE INDEX IF NOT EXISTS "users_orgId_hisExtId_key"
  ON "users"("organization_id", "his_external_id")
  WHERE "his_external_id" IS NOT NULL;

-- KVKK rıza alanlarını kaldır, bilgilendirme teyit alanı ekle
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kvkk_notice_acknowledged_at" TIMESTAMPTZ;

-- Mevcut consent=true olan kullanıcıların tarihi taşı (veri kaybı olmadan)
-- Idempotent: kolonlar yoksa (fresh DB) UPDATE atlanır
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'kvkk_consent_date'
  ) THEN
    EXECUTE 'UPDATE "users"
             SET "kvkk_notice_acknowledged_at" = kvkk_consent_date
             WHERE kvkk_consent = true AND kvkk_consent_date IS NOT NULL';
  END IF;
END $$;

ALTER TABLE "users" DROP COLUMN IF EXISTS "kvkk_consent";
ALTER TABLE "users" DROP COLUMN IF EXISTS "kvkk_consent_date";
