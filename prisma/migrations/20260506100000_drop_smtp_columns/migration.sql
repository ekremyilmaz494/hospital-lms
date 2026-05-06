-- Faz B: per-tenant SMTP kolonları kaldırılıyor.
-- AWS SES merkezi gönderime geçildi; smtp_* alanları kullanılmıyor.

ALTER TABLE "organizations"
  DROP COLUMN IF EXISTS "smtp_host",
  DROP COLUMN IF EXISTS "smtp_port",
  DROP COLUMN IF EXISTS "smtp_secure",
  DROP COLUMN IF EXISTS "smtp_user",
  DROP COLUMN IF EXISTS "smtp_pass_encrypted",
  DROP COLUMN IF EXISTS "smtp_from",
  DROP COLUMN IF EXISTS "smtp_reply_to",
  DROP COLUMN IF EXISTS "smtp_enabled";
