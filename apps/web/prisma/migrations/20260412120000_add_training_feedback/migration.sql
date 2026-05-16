-- EY.FR.40 Eğitim Değerlendirme Anket Formu (Geri Bildirim) Sistemi
-- Her organizasyon için tek form; dinamik kategori + soru yapısı.
-- Eğitim/sınav akışı sonunda (geçsin/kalsın) personele gösterilir.

-- CreateTable: training_feedback_forms
CREATE TABLE "training_feedback_forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL DEFAULT 'Eğitim Değerlendirme Anket Formu',
    "description" TEXT,
    "document_code" VARCHAR(50) DEFAULT 'EY.FR.40',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_feedback_forms_pkey" PRIMARY KEY ("id")
);

-- Unique: org başına tek form
CREATE UNIQUE INDEX "training_feedback_forms_organization_id_key" ON "training_feedback_forms"("organization_id");

-- CreateTable: training_feedback_categories
CREATE TABLE "training_feedback_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_feedback_categories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_tfb_categories_form" ON "training_feedback_categories"("form_id");

-- CreateTable: training_feedback_items
CREATE TABLE "training_feedback_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "question_type" VARCHAR(20) NOT NULL DEFAULT 'likert_5',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_feedback_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_tfb_items_category" ON "training_feedback_items"("category_id");

-- CreateTable: training_feedback_responses
CREATE TABLE "training_feedback_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "include_name" BOOLEAN NOT NULL DEFAULT false,
    "is_passed" BOOLEAN NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_feedback_responses_pkey" PRIMARY KEY ("id")
);

-- Unique: ExamAttempt başına tek response (idempotency)
CREATE UNIQUE INDEX "training_feedback_responses_attempt_id_key" ON "training_feedback_responses"("attempt_id");
CREATE INDEX "idx_tfb_responses_org_training" ON "training_feedback_responses"("organization_id", "training_id");
CREATE INDEX "idx_tfb_responses_org_submitted" ON "training_feedback_responses"("organization_id", "submitted_at");

-- CreateTable: training_feedback_answers
CREATE TABLE "training_feedback_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "response_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "score" INTEGER,
    "text_answer" TEXT,

    CONSTRAINT "training_feedback_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_feedback_answers_response_id_item_id_key" ON "training_feedback_answers"("response_id", "item_id");
CREATE INDEX "idx_tfb_answers_response" ON "training_feedback_answers"("response_id");

-- ── Foreign Keys ──

ALTER TABLE "training_feedback_forms" ADD CONSTRAINT "training_feedback_forms_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_feedback_categories" ADD CONSTRAINT "training_feedback_categories_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "training_feedback_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_feedback_items" ADD CONSTRAINT "training_feedback_items_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "training_feedback_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "training_feedback_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_training_id_fkey"
  FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "training_feedback_answers" ADD CONSTRAINT "training_feedback_answers_response_id_fkey"
  FOREIGN KEY ("response_id") REFERENCES "training_feedback_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "training_feedback_answers" ADD CONSTRAINT "training_feedback_answers_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "training_feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
