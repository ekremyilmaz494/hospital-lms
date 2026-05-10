-- ============================================================================
-- TrainingFeedbackForm.isArchived
-- ----------------------------------------------------------------------------
-- Yanıt geçmişi olan formlar silinemez (FK: training_feedback_responses.form_id),
-- ama admin "kullanılmayan" formları listeden gizlemek isteyebilir. Arşiv flag'i
-- bu boşluğu doldurur: arşivli form admin liste UI'sında gizlenir, ama tarihi
-- response'lar/analytics çağrıları tarafından erişilebilir.
--
-- Aktif formlar arşive alınamaz (kontrol API katmanında).
-- ============================================================================

ALTER TABLE "training_feedback_forms"
    ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "idx_feedback_forms_org_archive"
    ON "training_feedback_forms" ("organization_id", "is_archived");
