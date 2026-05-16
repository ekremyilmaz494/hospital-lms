-- Legacy kolon ve index temizligi
-- 1. users.department: init'te VARCHAR(100) olarak vardi, sonra departments
--    tablosu + department_id eklendi ama eski kolon DROP edilmedi.
--    schema.prisma'da yok; veriler migrate edilmemis halde duruyor.
-- 2. users_tc_no_key / users_organization_id_tc_no_key: tc_no kolonu KVKK
--    migration'inda DROP edildi, ancak partial unique index kalintilari
--    olabilir. IF EXISTS ile temizle.

ALTER TABLE "users" DROP COLUMN IF EXISTS "department";
DROP INDEX IF EXISTS "users_tc_no_key";
DROP INDEX IF EXISTS "users_organization_id_tc_no_key";
