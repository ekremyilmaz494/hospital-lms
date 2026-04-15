-- Per-training feedback zorunluluğu bayrağı.
-- true ise: personel bu eğitim için feedback doldurmadan başka eğitim başlatamaz.
ALTER TABLE "trainings" ADD COLUMN "feedback_mandatory" BOOLEAN NOT NULL DEFAULT false;
