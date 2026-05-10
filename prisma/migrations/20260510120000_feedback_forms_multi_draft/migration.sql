-- ============================================================================
-- Feedback Forms: Çoklu taslak desteği
-- ----------------------------------------------------------------------------
-- training_feedback_forms tablosunda organization_id @unique constraint'ı
-- kaldırıldı. Bir organizasyon birden çok form taslağı tutabilir; bir anda
-- yalnızca biri aktif olur. Aktif tek-form kuralı partial unique index ile
-- DB seviyesinde garantilenir (prisma diff partial index üretmez, elle eklendi).
-- ============================================================================

-- 1) Eski unique constraint'i kaldır
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM   information_schema.table_constraints
        WHERE  table_name = 'training_feedback_forms'
        AND    constraint_name = 'training_feedback_forms_organization_id_key'
    ) THEN
        ALTER TABLE "training_feedback_forms"
            DROP CONSTRAINT "training_feedback_forms_organization_id_key";
    END IF;
END $$;

-- 2) Eski auto-generated unique index'i kaldır (varsa)
DROP INDEX IF EXISTS "training_feedback_forms_organization_id_key";

-- 3) Yeni standart index'ler
CREATE INDEX IF NOT EXISTS "idx_feedback_forms_org"
    ON "training_feedback_forms" ("organization_id");

CREATE INDEX IF NOT EXISTS "idx_feedback_forms_org_updated"
    ON "training_feedback_forms" ("organization_id", "updated_at" DESC);

-- 4) Partial unique index — bir org için en fazla 1 aktif form
--    is_active = TRUE olan satırlarda organization_id'nin benzersiz olmasını zorlar.
--    is_active = FALSE olan taslak satırlar bu kısıttan muaftır (sınırsız taslak).
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_feedback_form_per_org"
    ON "training_feedback_forms" ("organization_id")
    WHERE "is_active" = TRUE;

-- 5) is_active default değerini false'a çevir (yeni form taslak olarak başlar)
ALTER TABLE "training_feedback_forms"
    ALTER COLUMN "is_active" SET DEFAULT FALSE;
