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
CREATE TABLE IF NOT EXISTS trusted_devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(128) NOT NULL UNIQUE,
  user_agent   TEXT,
  ip_address   VARCHAR(45),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user    ON trusted_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_expires ON trusted_devices (expires_at);

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
