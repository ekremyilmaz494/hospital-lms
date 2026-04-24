-- Bulgu 3 ve 4 — training flow config alanları runtime'da ilk kez okunuyor.
-- Mevcut davranışı korumak için:
--   • require_pre_exam_on_retry: tüm mevcut kayıtlar FALSE (kod her zaman skip ediyordu)
--   • randomize_questions:       tüm mevcut kayıtlar TRUE  (kod her zaman shuffle ediyordu)
-- Ayrıca schema.prisma default'ları da bu değerlere güncellendi (yeni kayıtlar için).

-- Existing rows → current behavior
UPDATE "trainings" SET "require_pre_exam_on_retry" = false WHERE "require_pre_exam_on_retry" IS NOT NULL;
UPDATE "trainings" SET "randomize_questions"       = true  WHERE "randomize_questions"       IS NOT NULL;

-- Column defaults — Prisma migrate deploy bunları şemaya göre zaten set eder;
-- yine de savunmacı olarak yeni kurulum ortamlarında da garantiye alıyoruz.
ALTER TABLE "trainings" ALTER COLUMN "require_pre_exam_on_retry" SET DEFAULT false;
ALTER TABLE "trainings" ALTER COLUMN "randomize_questions"       SET DEFAULT true;
