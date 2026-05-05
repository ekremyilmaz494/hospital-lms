-- Centralized transactional email (AWS SES klinovax.com).
-- Eski per-tenant SMTP alanları (smtp_*) DEPRECATED — Faz B'de DROP edilecek;
-- şu an code path'lerinden çıkarılıyor ama kolon korunuyor (rollback emniyeti).

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "email_display_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "email_reply_to"     VARCHAR(320),
  ADD COLUMN IF NOT EXISTS "email_enabled"      BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "sector"             VARCHAR(50) NOT NULL DEFAULT 'healthcare';

-- Sector index (multi-sector pivot için listeleme/filter)
CREATE INDEX IF NOT EXISTS "organization_sector_idx"
  ON "organizations" ("sector");

-- Veri taşıma: eski smtp_from'da güzel bir görünen ad varsa email_display_name'a kopyala
-- (formatlar değişebilir: "Hastane Adı <noreply@x>", "noreply@x", "Sadece Ad")
UPDATE "organizations"
SET "email_display_name" = TRIM(SPLIT_PART("smtp_from", '<', 1))
WHERE "email_display_name" IS NULL
  AND "smtp_from" IS NOT NULL
  AND "smtp_from" <> ''
  AND TRIM(SPLIT_PART("smtp_from", '<', 1)) <> '';

UPDATE "organizations"
SET "email_reply_to" = "smtp_reply_to"
WHERE "email_reply_to" IS NULL
  AND "smtp_reply_to" IS NOT NULL
  AND "smtp_reply_to" <> '';
