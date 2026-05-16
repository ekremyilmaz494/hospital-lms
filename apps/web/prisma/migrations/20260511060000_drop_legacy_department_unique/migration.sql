-- 20260510210000_department_unique_per_parent migration'ı `departments_organizationId_name_key`
-- (camelCase) adıyla drop denemişti ama gerçek constraint adı snake_case'di:
-- `departments_organization_id_name_key`. `IF EXISTS` koruması sessizce no-op yaptı.
--
-- Sonuç: eski unique(organization_id, name) constraint'i prod DB'de aktif kalmış ve
-- "aynı isim farklı parent altında olabilsin" feature'ı sessizce kırılmış.
-- Ayrıca prisma migrate diff drift uyarısı veriyordu.
--
-- Bu migration gerçek constraint adını drop eder; idempotent.

ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_organization_id_name_key";
DROP INDEX IF EXISTS "departments_organization_id_name_key";
