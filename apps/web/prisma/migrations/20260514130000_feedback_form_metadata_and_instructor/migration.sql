-- Training: eğitmen adı (PDF raporlarında ve sertifikalarda görünür)
ALTER TABLE "trainings"
  ADD COLUMN IF NOT EXISTS "instructor_name" VARCHAR(255);

-- TrainingFeedbackForm: PDF header için sabit doküman metadata
-- publishedAt / revisionNumber / revisionDate — form yayına alındığında doldurulur
ALTER TABLE "training_feedback_forms"
  ADD COLUMN IF NOT EXISTS "published_at"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "revision_number" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "revision_date"   TIMESTAMPTZ;
