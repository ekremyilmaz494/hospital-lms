-- Tüm modellere eksik zaman damgası alanları (36 tablo, 44 kolon).
-- created_at: 9 tablo (video_progress + 8 alt-tablo). updated_at: 35 tablo.
-- @updatedAt Prisma Client tarafından yönetilir — DB trigger YOK.
-- Mevcut satırlar NOT NULL DEFAULT NOW() ile otomatik backfill edilir.
-- Idempotent (ADD COLUMN IF NOT EXISTS): fresh DB + prod re-apply güvenli.
-- AuditLog (audit_logs) bilinçli olarak hariç — append-only, hash-zincirli.
-- Grup C (invoices, certificates, training_assignments, exam_answers,
-- organization_content_library, sync_logs, expo_push_tickets,
-- training_feedback_responses): zaten domain oluşturma damgası var
-- (issued_at/assigned_at/answered_at/installed_at/started_at/sent_at/
-- submitted_at), bu yüzden yalnız updated_at eklenir.

-- ── Grup A: updated_at ekle (19 tablo) ──
ALTER TABLE "subscription_plans"        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "payments"                  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_videos"           ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "questions"                 ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "exam_attempts"             ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "notifications"             ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "db_backups"                ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "kvkk_requests"             ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "department_training_rules" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "smg_activities"            ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "smg_periods"               ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "smg_targets"               ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "content_library"           ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "competency_forms"          ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "competency_evaluations"    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "push_subscriptions"        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "expo_push_tokens"          ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "accreditation_reports"     ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_categories"       ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Grup B: created_at ekle (1 tablo) ──
ALTER TABLE "video_progress"            ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Grup C: updated_at ekle, domain oluşturma damgası korunur (8 tablo) ──
ALTER TABLE "invoices"                     ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "certificates"                 ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_assignments"         ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "exam_answers"                 ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "organization_content_library" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "sync_logs"                    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "expo_push_tickets"            ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_feedback_responses"  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Grup D: created_at + updated_at ekle, hiç damga yok (8 tablo) ──
ALTER TABLE "question_options"             ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "question_options"             ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "competency_categories"        ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "competency_categories"        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "competency_items"             ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "competency_items"             ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "competency_answers"           ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "competency_answers"           ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "question_bank_options"        ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "question_bank_options"        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_feedback_categories" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_feedback_categories" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_feedback_items"      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_feedback_items"      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_feedback_answers"    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "training_feedback_answers"    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
