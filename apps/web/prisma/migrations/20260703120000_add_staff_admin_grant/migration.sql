-- Esas Yönetici'nin bir personele verdiği ek yönetici (hastane-admin) yetkisi.
-- Kişi role='staff' olarak kalır, /admin paneline erişir. Yetki kararı tek kaynak:
-- lib/auth/admin-authority.ts. JWT'ye app_metadata.admin_access olarak yansır.
-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_access_granted" BOOLEAN NOT NULL DEFAULT false;
