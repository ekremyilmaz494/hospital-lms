-- Centralized email (AWS SES) — per-org override sadece display name + reply-to + enabled toggle.
-- SMTP alanları DEPRECATED ama bu PR'da silinmiyor (Faz B'de ayrı migration).

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "email_display_name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "email_reply_to"     VARCHAR(320),
  ADD COLUMN IF NOT EXISTS "email_enabled"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sector"             VARCHAR(50)  NOT NULL DEFAULT 'healthcare';

CREATE INDEX IF NOT EXISTS "Organization_sector_idx" ON "organizations"("sector");

-- Veri taşıma: eski smtp_from'dan display name çıkar (varsa "Org Adı" <addr> formatı).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'organizations' AND column_name = 'smtp_from'
  ) THEN
    UPDATE "organizations"
    SET "email_display_name" = TRIM(BOTH '"' FROM TRIM(SPLIT_PART("smtp_from", '<', 1)))
    WHERE "smtp_from" IS NOT NULL AND "smtp_from" LIKE '%<%' AND "email_display_name" IS NULL;

    UPDATE "organizations"
    SET "email_reply_to" = "smtp_reply_to"
    WHERE "smtp_reply_to" IS NOT NULL AND "email_reply_to" IS NULL;
  END IF;
END $$;
