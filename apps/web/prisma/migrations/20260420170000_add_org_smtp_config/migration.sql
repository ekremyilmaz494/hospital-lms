-- Hastane başına SMTP konfigürasyonu — her organization kendi mail sunucusundan gönderebilir.
-- smtp_pass_encrypted: AES-256-GCM ile şifrelenmiş (src/lib/crypto.ts).
-- smtp_enabled: false iken e-posta gönderimi atlanır (sadece in-app notification).

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "smtp_host" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "smtp_port" INTEGER DEFAULT 587,
  ADD COLUMN IF NOT EXISTS "smtp_secure" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "smtp_user" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "smtp_pass_encrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "smtp_from" VARCHAR(320),
  ADD COLUMN IF NOT EXISTS "smtp_reply_to" VARCHAR(320),
  ADD COLUMN IF NOT EXISTS "smtp_enabled" BOOLEAN NOT NULL DEFAULT false;
