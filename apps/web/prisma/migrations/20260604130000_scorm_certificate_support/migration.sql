-- D1b — Sertifika ya bir ExamAttempt'e (sınavlı eğitim) YA da bir ScormAttempt'e
-- (saf SCORM) bağlanabilsin diye certificates tablosu genişletilir.
--
-- Sorun: certificates.attempt_id NOT NULL + FK→exam_attempts olduğundan, saf SCORM
-- eğitiminin tamamlanması sertifika ÜRETEMİYORDU (saf SCORM'da ExamAttempt yok →
-- scorm/tracking route sertifika oluşturmayı sessizce atlıyordu).
--
-- Bu migration:
--   1) scorm_attempt_id (nullable, UUID) kolonu ekler,
--   2) attempt_id'yi nullable yapar (mevcut satırların hepsinde dolu — etkilenmez),
--   3) scorm_attempt_id için @unique index ekler (deneme başına tek sertifika),
--   4) scorm_attempts(id)'ye RESTRICT FK ekler (sertifikalı SCORM denemesi silinemez).
--
-- İnvariant: attempt_id XOR scorm_attempt_id (tam olarak biri set). DB CHECK
-- EKLENMEDİ — Prisma CHECK yönetmiyor; drift detector ile uyum için invariant
-- uygulama katmanında (scorm/tracking + exam/submit) zorlanır.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS + DROP NOT NULL no-op + DO $$ guard):
-- fresh DB sıralı replay + prod re-apply güvenli. `migrate dev` shadow DB yerelde
-- çalışmadığından SQL `prisma migrate diff --from-schema/--to-schema` ile üretildi.

-- 1) scorm_attempt_id kolonu (nullable)
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "scorm_attempt_id" UUID;

-- 2) attempt_id'yi nullable yap (zaten nullable ise DROP NOT NULL no-op → idempotent)
ALTER TABLE "certificates" ALTER COLUMN "attempt_id" DROP NOT NULL;

-- 3) scorm_attempt_id için unique index
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_scorm_attempt_id_key" ON "certificates"("scorm_attempt_id");

-- 4) FK → scorm_attempts(id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificates_scorm_attempt_id_fkey') THEN
    ALTER TABLE "certificates"
      ADD CONSTRAINT "certificates_scorm_attempt_id_fkey"
      FOREIGN KEY ("scorm_attempt_id") REFERENCES "scorm_attempts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;
