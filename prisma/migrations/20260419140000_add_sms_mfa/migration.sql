-- SMS MFA (Çok Faktörlü Doğrulama)
-- 1) organizations: SMS MFA açma/kapatma ayarı (organization-level policy)
-- 2) users: telefon doğrulama zamanı (telefon sahipliği kanıtlandığında dolar)
-- 3) trusted_devices: 7 gün geçerli güvenilir cihaz token'ları (hash'li saklanır)

-- ── ORGANIZATIONS ──
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sms_mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_mfa_enforced_at TIMESTAMPTZ;

-- ── USERS ──
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- ── TRUSTED DEVICES ──
-- Canonical Prisma output ile bire bir uyumlu. ID default yok (Prisma @default(uuid())
-- client-side üretim). CURRENT_TIMESTAMP kullanılıyor (now() yerine) — Prisma migrate diff
-- uyumu için. FK ismi ve ON UPDATE CASCADE explicit.
CREATE TABLE IF NOT EXISTS "trusted_devices" (
  "id"           UUID NOT NULL,
  "user_id"      UUID NOT NULL,
  "token_hash"   VARCHAR(128) NOT NULL,
  "user_agent"   TEXT,
  "ip_address"   VARCHAR(45),
  "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"   TIMESTAMPTZ NOT NULL,
  "revoked_at"   TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "trusted_devices_token_hash_key" ON "trusted_devices"("token_hash");
CREATE INDEX IF NOT EXISTS "idx_trusted_devices_user"    ON "trusted_devices"("user_id");
CREATE INDEX IF NOT EXISTS "idx_trusted_devices_expires" ON "trusted_devices"("expires_at");

-- FK: ON DELETE CASCADE ON UPDATE CASCADE (Prisma canonical)
-- IF NOT EXISTS guard: yeniden uygulanırsa çakışma olmasın
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trusted_devices_user_id_fkey'
  ) THEN
    ALTER TABLE "trusted_devices"
      ADD CONSTRAINT "trusted_devices_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── RLS ──
-- Kullanıcı kendi cihazlarını görür/yönetir; service_role tüm tabloya erişir (zaten RLS bypass'lı).
-- `auth.uid()` sadece Supabase'de tanımlı — CI shadow DB'sinde `auth` schema yok,
-- o yüzden varlığı kontrol ediliyor. Supabase dışı ortamlarda RLS policy skip edilir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE 'ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'trusted_devices' AND policyname = 'user_trusted_devices_own'
    ) THEN
      EXECUTE 'CREATE POLICY "user_trusted_devices_own" ON trusted_devices FOR ALL USING (user_id = auth.uid())';
    END IF;
  END IF;
END $$;
