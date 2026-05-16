-- Department.name artık org içinde GLOBAL unique değil; parent altında unique.
-- Aynı isim (ör. "ACİL SERVİS") farklı parent'lar (BAŞHEKİMLİK / HEMŞİRELİK) altında olabilir.
-- Postgres'te NULL ≠ NULL davrandığı için tek bir composite unique index kök
-- departmanlarda duplicate'lere izin verirdi → iki ayrı partial unique index.

ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_organizationId_name_key";
DROP INDEX IF EXISTS "departments_organizationId_name_key";

-- Kök departmanlar (parent_id IS NULL): org içinde isim unique
CREATE UNIQUE INDEX "departments_org_name_root_unique"
  ON "departments" ("organization_id", "name")
  WHERE "parent_id" IS NULL;

-- Alt departmanlar (parent_id IS NOT NULL): aynı parent altında isim unique
CREATE UNIQUE INDEX "departments_org_name_parent_unique"
  ON "departments" ("organization_id", "name", "parent_id")
  WHERE "parent_id" IS NOT NULL;

-- Lookup performansı için non-unique composite index
CREATE INDEX IF NOT EXISTS "idx_departments_org_name"
  ON "departments" ("organization_id", "name");
