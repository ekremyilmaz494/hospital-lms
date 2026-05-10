-- ============================================================================
-- TrainingFeedbackForm.isMandatory
-- ----------------------------------------------------------------------------
-- Form taslağına "zorunlu mu?" flag'i. Admin formu "Tüm Eğitimlere Ata"
-- aksiyonu ile aktive ettiğinde, bu flag'in değeri organizasyondaki tüm
-- Training.feedbackMandatory'lerini günceller (aşağı iner).
--
-- Default true: mevcut akış (sertifika feedback'siz üretilmez) varsayımıyla
-- bütün form'lar zorunlu olarak başlar.
-- ============================================================================

ALTER TABLE "training_feedback_forms"
    ADD COLUMN IF NOT EXISTS "is_mandatory" BOOLEAN NOT NULL DEFAULT TRUE;
