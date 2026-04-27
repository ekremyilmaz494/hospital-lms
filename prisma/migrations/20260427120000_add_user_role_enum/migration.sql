-- GAP-2: role string → enum migration
-- Sanity: Nisan 2026'da staging'de DISTINCT role değerleri sadece
--   super_admin / admin / staff — ::cast güvenli.

-- 1) Enum tipini idempotent oluştur
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE "user_role" AS ENUM ('super_admin', 'admin', 'staff');
  END IF;
END $$;

-- 2) admin_users_insert policy 'users.role' kolonuna depend ediyor.
--    ALTER COLUMN TYPE bunu engeller → policy'yi drop, alter et, yeniden yarat.
--    Supabase'de drop, CI shadow DB'de policy zaten yok (no-op).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_users_insert" ON "users"';
  END IF;
END $$;

-- 3) organizations.sso_default_role: önce default'u kaldır, tipi değiştir, default'u geri koy
ALTER TABLE "organizations"
  ALTER COLUMN "sso_default_role" DROP DEFAULT,
  ALTER COLUMN "sso_default_role" TYPE "user_role" USING "sso_default_role"::"user_role",
  ALTER COLUMN "sso_default_role" SET DEFAULT 'staff'::"user_role";

-- 4) users.role: tipi değiştir
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";

-- 5) Policy'yi yeniden yarat — inline JWT extract (supabase-rls.sql konvansiyonu).
--    `public.get_user_role()` / `get_user_org_id()` helper'ları apply-rls.js'te
--    tanımlı, CI shadow DB'sinde yok. `auth.jwt()` de sadece Supabase'de var.
--    DO/EXECUTE wrap compile-time auth.* parsing'i atlatır → shadow DB skip,
--    Supabase'de gerçek policy yaratılır (add_sms_mfa pattern, satır 65 referans).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE $policy$
      CREATE POLICY "admin_users_insert" ON "users"
        FOR INSERT WITH CHECK (
          (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
          AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
          AND role = 'staff'::"user_role"
        )
    $policy$;
  END IF;
END $$;
