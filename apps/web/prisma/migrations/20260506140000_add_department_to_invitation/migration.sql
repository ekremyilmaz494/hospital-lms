-- ============================================================================
-- Invitation tablosuna departmentId ekle
-- ----------------------------------------------------------------------------
-- Personel daveti yönetici davetinin pattern'ini kullanıyor; ancak personel
-- kayıtlarında departmentId zorunlu. Davet token'ı kabul edilirken
-- createAuthUser'a departmentId geçirebilmek için Invitation tablosunda
-- nullable bir kolon tutuyoruz (yönetici davetlerinde NULL kalır).
-- ============================================================================

ALTER TABLE "invitations"
    ADD COLUMN IF NOT EXISTS "department_id" UUID;

-- Departman silinirse davet kalır (audit), ama departman ataması düşer
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.table_constraints
        WHERE  table_name = 'invitations'
        AND    constraint_name = 'invitations_department_id_fkey'
    ) THEN
        ALTER TABLE "invitations"
            ADD CONSTRAINT "invitations_department_id_fkey"
            FOREIGN KEY ("department_id") REFERENCES "departments"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
