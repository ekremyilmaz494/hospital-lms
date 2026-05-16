-- ExamAttempt.organization_id: nullable -> NOT NULL
-- 20260410 migration kolonu nullable ekledi; schema.prisma NOT NULL diyor.
-- Drift catch-up migration ADD COLUMN IF NOT EXISTS olarak atladigi icin
-- nullability degismedi - bu migration kapatir.

-- 1. Backfill: organization_id NULL olan satirlari training'den doldur
UPDATE exam_attempts
SET organization_id = (SELECT organization_id FROM trainings WHERE id = exam_attempts.training_id)
WHERE organization_id IS NULL;

-- 2. NOT NULL constraint
ALTER TABLE exam_attempts ALTER COLUMN organization_id SET NOT NULL;

-- 3. FK'yi RESTRICT yap (organizasyon silindiginde attempt'leri orphan birakma)
ALTER TABLE exam_attempts DROP CONSTRAINT IF EXISTS exam_attempts_organization_id_fkey;
ALTER TABLE exam_attempts ADD CONSTRAINT exam_attempts_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT ON UPDATE CASCADE;
