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

-- 5) Policy'yi yeniden yarat — supabase-rls.sql konvansiyonu (inline JWT extract)
--    `public.get_user_role()` / `public.get_user_org_id()` helper fonksiyonları
--    migration sistemi dışında tanımlı (apply-rls.js); CI shadow DB'de yok →
--    drift detector "function does not exist" ile patlıyordu. İnline pattern
--    projedeki diğer 39+ policy ile birebir aynı (supabase-rls.sql:62-105).
CREATE POLICY "admin_users_insert" ON "users"
  FOR INSERT WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND role = 'staff'::"user_role"
  );
