-- ============================================================================
-- Department tablosuna parentId ekle (2 seviyeli hiyerarşi için)
-- ----------------------------------------------------------------------------
-- Büyük departmanlar (örn. "Dahiliye") alt birimlere ayrılabilsin diye
-- parent_id self-referential FK eklendi. API katmanı parent'ın kendi
-- parentId'si null olmasını zorlar (max 2 seviye); DB cycle önlemez.
-- ============================================================================

ALTER TABLE "departments"
    ADD COLUMN IF NOT EXISTS "parent_id" UUID;

-- Parent silinirse children root'a düşer (data korunur)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   information_schema.table_constraints
        WHERE  table_name = 'departments'
        AND    constraint_name = 'departments_parent_id_fkey'
    ) THEN
        ALTER TABLE "departments"
            ADD CONSTRAINT "departments_parent_id_fkey"
            FOREIGN KEY ("parent_id") REFERENCES "departments"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- parentId üzerinden children sorgusu için index
CREATE INDEX IF NOT EXISTS "idx_departments_parent" ON "departments"("parent_id");
