-- ─────────────────────────────────────────────────────────────────────
-- Esas Yönetici (Organization Owner) Katmanı
-- ─────────────────────────────────────────────────────────────────────
-- Her organization için 1 adet "Esas Yönetici" tanımlanır. Bu user
-- kendi org'unda yeni admin davet edebilir (max_admins limiti dahilinde).
-- Sıradan admin'ler bu yetkiye sahip değildir.
--
-- Devir: yalnızca super_admin tarafından yapılır.
-- ON DELETE SET NULL: owner user silinirse org owner'sız kalır;
-- super_admin yeni owner atamak zorundadır.
-- ─────────────────────────────────────────────────────────────────────

-- 1) organizations.owner_user_id — Esas Yönetici user FK (nullable)
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "owner_user_id" uuid;

-- 2) organizations.max_admins — admin sayı limiti (default 5, plan bazlı esnek)
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "max_admins" integer NOT NULL DEFAULT 5;

-- 3) UNIQUE: bir user en fazla 1 org'un owner'ı olabilir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'organizations_owner_user_id_key'
  ) THEN
    CREATE UNIQUE INDEX "organizations_owner_user_id_key"
      ON "organizations" ("owner_user_id");
  END IF;
END $$;

-- 4) FK: owner_user_id → users.id, ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_owner_user_id_fkey'
  ) THEN
    ALTER TABLE "organizations"
      ADD CONSTRAINT "organizations_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
