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

-- 2) admin_users_insert policy 'users.role' kolonuna depend ediyor (apply-rls.js).
--    ALTER COLUMN TYPE bunu engeller → policy'yi drop, alter et, yeniden yarat.
DROP POLICY IF EXISTS "admin_users_insert" ON "users";

-- 3) organizations.sso_default_role: önce default'u kaldır, tipi değiştir, default'u geri koy
ALTER TABLE "organizations"
  ALTER COLUMN "sso_default_role" DROP DEFAULT,
  ALTER COLUMN "sso_default_role" TYPE "user_role" USING "sso_default_role"::"user_role",
  ALTER COLUMN "sso_default_role" SET DEFAULT 'staff'::"user_role";

-- 4) users.role: tipi değiştir
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "user_role" USING "role"::"user_role";

-- 5) Policy'yi yeniden yarat (helper fonksiyon app_metadata'dan okur)
CREATE POLICY "admin_users_insert" ON "users"
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
    AND organization_id = public.get_user_org_id()
    AND role = 'staff'::"user_role"
  );
