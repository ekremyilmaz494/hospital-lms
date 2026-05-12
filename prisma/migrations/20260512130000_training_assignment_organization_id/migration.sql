-- TrainingAssignment.organizationId — multi-tenant invariant denormalize edilir.
-- Bu sayede cross-tenant guard'lar Training join'i olmadan tek alanla yapılır
-- ve auto-assign benzeri çoklu yollarda "organizationId'yi unutma" hatası
-- DB-level FK ile yakalanır.
--
-- Safe migration sırası:
--   1. Kolonu nullable ekle (mevcut INSERT'leri kırmaz)
--   2. training.organization_id'den backfill
--   3. NOT NULL'a çevir
--   4. FK constraint ekle
--   5. Index ekle

-- 1. Kolon (nullable)
ALTER TABLE "training_assignments"
  ADD COLUMN IF NOT EXISTS "organization_id" UUID;

-- 2. Backfill
UPDATE "training_assignments" ta
SET "organization_id" = t."organization_id"
FROM "trainings" t
WHERE ta."training_id" = t."id" AND ta."organization_id" IS NULL;

-- 3. Sanity check: yetim atama varsa migration burada hata verir (bu istenir).
--    Yoksa NOT NULL constraint güvenli.
ALTER TABLE "training_assignments"
  ALTER COLUMN "organization_id" SET NOT NULL;

-- 4. FK constraint (ON DELETE CASCADE — org silinince atama da silinir; mevcut
--    pattern training/user için zaten Cascade, organization da aynı politikayı izler)
ALTER TABLE "training_assignments"
  ADD CONSTRAINT "training_assignments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Performans indexi
CREATE INDEX IF NOT EXISTS "idx_assignments_organization"
  ON "training_assignments" ("organization_id");
