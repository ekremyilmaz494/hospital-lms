-- Drift fix: id kolonları için DEFAULT gen_random_uuid() yoktu.
-- Prisma schema'da @default(dbgenerated("gen_random_uuid()")) tanımlı ama migration
-- oluşturulurken DEFAULT DDL'i yazılmamıştı. Sonuç: Prisma client INSERT'te id
-- göndermiyor, DB de üretmediği için "null value in column id violates not-null
-- constraint" hatası atıyordu (training_feedback submit, smg_activities vs.).
--
-- Production Supabase'e manuel uygulandı (2026-04-19). Bu dosya fresh DB setup
-- ve CI drift check için.

ALTER TABLE "training_feedback_responses" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "training_feedback_answers"    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "training_feedback_forms"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "training_feedback_categories" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "training_feedback_items"      ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "smg_activities"               ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
