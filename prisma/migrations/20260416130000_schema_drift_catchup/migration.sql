-- ============================================================================
-- DRIFT CATCH-UP MIGRATION (2026-04-16)
-- ============================================================================
-- schema.prisma ile mevcut migration zinciri arasindaki farki kapatir.
--
-- Idempotency stratejisi:
-- 1. CREATE TABLE IF NOT EXISTS  - mevcut tabloyu atlar
-- 2. ALTER TABLE ADD COLUMN IF NOT EXISTS - her kolonu ayrica kontrol eder
--    (mevcut tabloya eksik kolonlari ekler)
-- 3. CREATE INDEX IF NOT EXISTS  - mevcut indeksi atlar
-- 4. ADD CONSTRAINT DO $$ EXCEPTION duplicate_object - mevcut FK'yi atlar
--
-- Mevcut prod ortamlarda cogu sema zaten var (db push ile eklenmis).
-- Fresh ortam: tum sema sifirdan kurulur.
-- Mevcut ortam: yalnizca eksik kolon/index/FK eklenir.
--
-- Prod baseline icin (her ortamda tek seferlik):
--   pnpm prisma migrate resolve --applied 20260416130000_schema_drift_catchup
-- ============================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "max_staff" INTEGER,
    "max_trainings" INTEGER,
    "max_storage_gb" INTEGER NOT NULL DEFAULT 10,
    "price_monthly" DECIMAL(10,2),
    "price_annual" DECIMAL(10,2),
    "features" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "has_ai_content_studio" BOOLEAN NOT NULL DEFAULT false,
    "has_scorm_support" BOOLEAN NOT NULL DEFAULT false,
    "has_his_integration" BOOLEAN NOT NULL DEFAULT false,
    "has_advanced_reports" BOOLEAN NOT NULL DEFAULT false,
    "has_sso_support" BOOLEAN NOT NULL DEFAULT false,
    "has_competency_module" BOOLEAN NOT NULL DEFAULT false,
    "has_accreditation_module" BOOLEAN NOT NULL DEFAULT false,
    "has_bulk_import" BOOLEAN NOT NULL DEFAULT false,
    "has_custom_certificates" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: subscription_plans
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "name" VARCHAR(100) NOT NULL;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(50) NOT NULL;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "max_staff" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "max_trainings" INTEGER;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "max_storage_gb" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "price_monthly" DECIMAL(10,2);
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "price_annual" DECIMAL(10,2);
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "features" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_ai_content_studio" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_scorm_support" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_his_integration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_advanced_reports" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_sso_support" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_competency_module" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_accreditation_module" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_bulk_import" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "has_custom_certificates" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50),
    "custom_domain" VARCHAR(255),
    "address" TEXT,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "logo_url" TEXT,
    "brand_color" VARCHAR(9) NOT NULL DEFAULT '#0F172A',
    "secondary_color" VARCHAR(9) NOT NULL DEFAULT '#3B82F6',
    "login_banner_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspended_reason" TEXT,
    "suspended_at" TIMESTAMPTZ,
    "session_timeout" INTEGER NOT NULL DEFAULT 30,
    "default_passing_score" INTEGER NOT NULL DEFAULT 70,
    "default_max_attempts" INTEGER NOT NULL DEFAULT 3,
    "default_exam_duration" INTEGER NOT NULL DEFAULT 30,
    "sso_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sso_provider" VARCHAR(50),
    "sso_email_domain" VARCHAR(255),
    "saml_entry_point" TEXT,
    "saml_issuer" TEXT,
    "saml_cert" TEXT,
    "oidc_discovery_url" TEXT,
    "oidc_client_id" VARCHAR(255),
    "oidc_client_secret" TEXT,
    "sso_auto_provision" BOOLEAN NOT NULL DEFAULT true,
    "sso_default_role" VARCHAR(20) NOT NULL DEFAULT 'staff',
    "setup_completed" BOOLEAN NOT NULL DEFAULT false,
    "setup_step" INTEGER NOT NULL DEFAULT 0,
    "language" VARCHAR(5) NOT NULL DEFAULT 'tr',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50) NOT NULL;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(50);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "custom_domain" VARCHAR(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "brand_color" VARCHAR(9) NOT NULL DEFAULT '#0F172A';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "secondary_color" VARCHAR(9) NOT NULL DEFAULT '#3B82F6';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "login_banner_url" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "is_suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "suspended_reason" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "session_timeout" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "default_passing_score" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "default_max_attempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "default_exam_duration" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sso_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sso_provider" VARCHAR(50);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sso_email_domain" VARCHAR(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "saml_entry_point" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "saml_issuer" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "saml_cert" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "oidc_discovery_url" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "oidc_client_id" VARCHAR(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "oidc_client_secret" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sso_auto_provision" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "sso_default_role" VARCHAR(20) NOT NULL DEFAULT 'staff';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "setup_completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "setup_step" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "language" VARCHAR(5) NOT NULL DEFAULT 'tr';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "created_by" UUID;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "organization_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'trial',
    "billing_cycle" VARCHAR(10),
    "trial_ends_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: organization_subscriptions
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "plan_id" UUID NOT NULL;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'trial';
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "billing_cycle" VARCHAR(10);
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "created_by" UUID;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organization_subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "payments" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TRY',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "payment_method" VARCHAR(30),
    "iyzico_payment_id" VARCHAR(100),
    "iyzico_conversation_id" VARCHAR(100),
    "card_last_four" VARCHAR(4),
    "card_brand" VARCHAR(20),
    "error_message" TEXT,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "subscription_id" UUID NOT NULL;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(10,2) NOT NULL;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NOT NULL DEFAULT 'TRY';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(30);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "iyzico_payment_id" VARCHAR(100);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "iyzico_conversation_id" VARCHAR(100);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "card_last_four" VARCHAR(4);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "card_brand" VARCHAR(20);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMPTZ;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_number" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "amount" DECIMAL(10,2) NOT NULL,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'TRY',
    "billing_name" VARCHAR(255) NOT NULL,
    "company_name" VARCHAR(255),
    "billing_address" TEXT,
    "tax_number" VARCHAR(20),
    "tax_office" VARCHAR(100),
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_id" UUID NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "subscription_id" UUID NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_number" VARCHAR(30) NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(10,2) NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 20;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "total_amount" DECIMAL(10,2) NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) NOT NULL DEFAULT 'TRY';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billing_name" VARCHAR(255) NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "company_name" VARCHAR(255);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "billing_address" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_number" VARCHAR(20);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "tax_office" VARCHAR(100);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMPTZ NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMPTZ NOT NULL;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMPTZ;


-- CreateTable
CREATE TABLE IF NOT EXISTS "departments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(7) NOT NULL DEFAULT '#0d9668',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: departments
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "name" VARCHAR(100) NOT NULL;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "color" VARCHAR(7) NOT NULL DEFAULT '#0d9668';
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "department_id" UUID,
    "title" VARCHAR(100),
    "role" VARCHAR(20) NOT NULL,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "his_external_id" VARCHAR(100),
    "kvkk_notice_acknowledged_at" TIMESTAMPTZ,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "terms_accepted" BOOLEAN NOT NULL DEFAULT false,
    "terms_accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" VARCHAR(100) NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" VARCHAR(100) NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department_id" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "title" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "his_external_id" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kvkk_notice_acknowledged_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "trainings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "thumbnail_url" TEXT,
    "passing_score" INTEGER NOT NULL DEFAULT 70,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "feedback_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "exam_duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "start_date" TIMESTAMPTZ NOT NULL,
    "end_date" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "publish_status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "is_compulsory" BOOLEAN NOT NULL DEFAULT false,
    "compliance_deadline" TIMESTAMPTZ,
    "regulatory_body" VARCHAR(200),
    "renewal_period_months" INTEGER,
    "smg_points" INTEGER NOT NULL DEFAULT 10,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scorm_manifest_path" TEXT,
    "scorm_entry_point" TEXT,
    "scorm_version" VARCHAR(10),
    "exam_only" BOOLEAN NOT NULL DEFAULT false,
    "require_pre_exam_on_retry" BOOLEAN NOT NULL DEFAULT true,
    "randomize_questions" BOOLEAN NOT NULL DEFAULT false,
    "random_question_count" INTEGER,
    "is_from_library" BOOLEAN NOT NULL DEFAULT false,
    "source_library_id" UUID,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: trainings
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) NOT NULL;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100);
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "passing_score" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "max_attempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "feedback_mandatory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "exam_duration_minutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMPTZ NOT NULL;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMPTZ NOT NULL;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "publish_status" VARCHAR(20) NOT NULL DEFAULT 'published';
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "is_compulsory" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "compliance_deadline" TIMESTAMPTZ;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "regulatory_body" VARCHAR(200);
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "renewal_period_months" INTEGER;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "smg_points" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "created_by" UUID;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "scorm_manifest_path" TEXT;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "scorm_entry_point" TEXT;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "scorm_version" VARCHAR(10);
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "exam_only" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "require_pre_exam_on_retry" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "randomize_questions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "random_question_count" INTEGER;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "is_from_library" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "trainings" ADD COLUMN IF NOT EXISTS "source_library_id" UUID;


-- CreateTable
CREATE TABLE IF NOT EXISTS "training_videos" (
    "id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "video_url" TEXT NOT NULL,
    "video_key" TEXT NOT NULL,
    "document_key" TEXT,
    "duration_seconds" INTEGER NOT NULL,
    "content_type" VARCHAR(20) NOT NULL DEFAULT 'video',
    "page_count" INTEGER,
    "file_size_bytes" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_videos_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: training_videos
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "training_id" UUID NOT NULL;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) NOT NULL;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "video_url" TEXT NOT NULL;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "video_key" TEXT NOT NULL;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "document_key" TEXT;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "duration_seconds" INTEGER NOT NULL;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "content_type" VARCHAR(20) NOT NULL DEFAULT 'video';
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "page_count" INTEGER;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "file_size_bytes" BIGINT;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "questions" (
    "id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" VARCHAR(20) NOT NULL DEFAULT 'multiple_choice',
    "points" INTEGER NOT NULL DEFAULT 10,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: questions
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "training_id" UUID NOT NULL;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "question_text" TEXT NOT NULL;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "question_type" VARCHAR(20) NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: question_options
ALTER TABLE "question_options" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "question_options" ADD COLUMN IF NOT EXISTS "question_id" UUID NOT NULL;
ALTER TABLE "question_options" ADD COLUMN IF NOT EXISTS "option_text" TEXT NOT NULL;
ALTER TABLE "question_options" ADD COLUMN IF NOT EXISTS "is_correct" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "question_options" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;


-- CreateTable
CREATE TABLE IF NOT EXISTS "training_assignments" (
    "id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'assigned',
    "current_attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "original_max_attempts" INTEGER NOT NULL DEFAULT 3,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "training_assignments_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: training_assignments
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "training_id" UUID NOT NULL;
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) NOT NULL DEFAULT 'assigned';
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "current_attempt" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "max_attempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "original_max_attempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "assigned_by" UUID;
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;


-- CreateTable
CREATE TABLE IF NOT EXISTS "exam_attempts" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "pre_exam_score" DECIMAL(5,2),
    "post_exam_score" DECIMAL(5,2),
    "pre_exam_started_at" TIMESTAMPTZ,
    "pre_exam_completed_at" TIMESTAMPTZ,
    "post_exam_started_at" TIMESTAMPTZ,
    "post_exam_completed_at" TIMESTAMPTZ,
    "videos_completed_at" TIMESTAMPTZ,
    "is_passed" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pre_exam',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signed_at" TIMESTAMPTZ,
    "signature_data" TEXT,
    "signature_ip" VARCHAR(45),
    "signature_method" VARCHAR(20),
    "organization_id" UUID NOT NULL,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: exam_attempts
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "assignment_id" UUID NOT NULL;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "training_id" UUID NOT NULL;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "attempt_number" INTEGER NOT NULL;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "pre_exam_score" DECIMAL(5,2);
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "post_exam_score" DECIMAL(5,2);
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "pre_exam_started_at" TIMESTAMPTZ;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "pre_exam_completed_at" TIMESTAMPTZ;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "post_exam_started_at" TIMESTAMPTZ;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "post_exam_completed_at" TIMESTAMPTZ;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "videos_completed_at" TIMESTAMPTZ;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "is_passed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) NOT NULL DEFAULT 'pre_exam';
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "signature_data" TEXT;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "signature_ip" VARCHAR(45);
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "signature_method" VARCHAR(20);
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;


-- CreateTable
CREATE TABLE IF NOT EXISTS "exam_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_id" UUID,
    "is_correct" BOOLEAN,
    "exam_phase" VARCHAR(10) NOT NULL,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: exam_answers
ALTER TABLE "exam_answers" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "exam_answers" ADD COLUMN IF NOT EXISTS "attempt_id" UUID NOT NULL;
ALTER TABLE "exam_answers" ADD COLUMN IF NOT EXISTS "question_id" UUID NOT NULL;
ALTER TABLE "exam_answers" ADD COLUMN IF NOT EXISTS "selected_option_id" UUID;
ALTER TABLE "exam_answers" ADD COLUMN IF NOT EXISTS "is_correct" BOOLEAN;
ALTER TABLE "exam_answers" ADD COLUMN IF NOT EXISTS "exam_phase" VARCHAR(10) NOT NULL;
ALTER TABLE "exam_answers" ADD COLUMN IF NOT EXISTS "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "video_progress" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "total_seconds" INTEGER NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "last_position_seconds" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_progress_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: video_progress
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "attempt_id" UUID NOT NULL;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "video_id" UUID NOT NULL;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "watched_seconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "total_seconds" INTEGER NOT NULL;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "is_completed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "last_position_seconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;
ALTER TABLE "video_progress" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "title" VARCHAR(500) NOT NULL,
    "message" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "related_training_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: notifications
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "message" TEXT NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" VARCHAR(50) NOT NULL;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "related_training_id" UUID;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_read" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "organization_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "hash" VARCHAR(64),
    "prev_hash" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: audit_logs
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "action" VARCHAR(100) NOT NULL;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entity_type" VARCHAR(50) NOT NULL;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "entity_id" UUID;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "old_data" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "new_data" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "hash" VARCHAR(64);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "prev_hash" VARCHAR(64);
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "db_backups" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "backup_type" VARCHAR(20) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size_mb" DECIMAL(10,2),
    "file_size" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'completed',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "db_backups_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: db_backups
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "backup_type" VARCHAR(20) NOT NULL;
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "file_url" TEXT NOT NULL;
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "file_size_mb" DECIMAL(10,2);
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "file_size" INTEGER;
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'completed';
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "created_by" UUID;
ALTER TABLE "db_backups" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "certificates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "certificate_code" VARCHAR(50) NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "revocation_reason" VARCHAR(500),
    "organization_id" UUID,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: certificates
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "training_id" UUID NOT NULL;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "attempt_id" UUID NOT NULL;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "certificate_code" VARCHAR(50) NOT NULL;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ;
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "revocation_reason" VARCHAR(500);
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "organization_id" UUID;


-- CreateTable
CREATE TABLE IF NOT EXISTS "kvkk_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "description" TEXT NOT NULL,
    "response_note" TEXT,
    "responded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "kvkk_requests_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: kvkk_requests
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "request_type" VARCHAR(30) NOT NULL;
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "response_note" TEXT;
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "responded_by" UUID;
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "kvkk_requests" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;


-- CreateTable
CREATE TABLE IF NOT EXISTS "scorm_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "suspend_data" TEXT,
    "lesson_status" VARCHAR(30),
    "score" DOUBLE PRECISION,
    "total_time" VARCHAR(50),
    "launch_data" TEXT,
    "completion_status" VARCHAR(30),
    "success_status" VARCHAR(30),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scorm_attempts_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: scorm_attempts
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "training_id" UUID NOT NULL;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "attempt_id" UUID NOT NULL;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "suspend_data" TEXT;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "lesson_status" VARCHAR(30);
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "score" DOUBLE PRECISION;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "total_time" VARCHAR(50);
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "launch_data" TEXT;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "completion_status" VARCHAR(30);
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "success_status" VARCHAR(30);
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "scorm_attempts" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "department_training_rules" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_training_rules_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: department_training_rules
ALTER TABLE "department_training_rules" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "department_training_rules" ADD COLUMN IF NOT EXISTS "department_id" UUID NOT NULL;
ALTER TABLE "department_training_rules" ADD COLUMN IF NOT EXISTS "training_id" UUID NOT NULL;
ALTER TABLE "department_training_rules" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "department_training_rules" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "department_training_rules" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "smg_activities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "activity_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(255),
    "completion_date" DATE NOT NULL,
    "smg_points" INTEGER NOT NULL,
    "certificate_url" VARCHAR(1000),
    "category_id" UUID,
    "approval_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smg_activities_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: smg_activities
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "activity_type" VARCHAR(50) NOT NULL;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) NOT NULL;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(255);
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "completion_date" DATE NOT NULL;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "smg_points" INTEGER NOT NULL;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "certificate_url" VARCHAR(1000);
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "category_id" UUID;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "approval_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "approved_by" UUID;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ;
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "rejection_reason" VARCHAR(500);
ALTER TABLE "smg_activities" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "smg_periods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "required_points" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smg_periods_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: smg_periods
ALTER TABLE "smg_periods" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "smg_periods" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "smg_periods" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL;
ALTER TABLE "smg_periods" ADD COLUMN IF NOT EXISTS "start_date" DATE NOT NULL;
ALTER TABLE "smg_periods" ADD COLUMN IF NOT EXISTS "end_date" DATE NOT NULL;
ALTER TABLE "smg_periods" ADD COLUMN IF NOT EXISTS "required_points" INTEGER NOT NULL;
ALTER TABLE "smg_periods" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "smg_periods" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "smg_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "max_points_per_activity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smg_categories_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: smg_categories
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50) NOT NULL;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "max_points_per_activity" INTEGER;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "smg_categories" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "smg_targets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "unvan" VARCHAR(100),
    "user_id" UUID,
    "required_points" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smg_targets_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: smg_targets
ALTER TABLE "smg_targets" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "smg_targets" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "smg_targets" ADD COLUMN IF NOT EXISTS "period_id" UUID NOT NULL;
ALTER TABLE "smg_targets" ADD COLUMN IF NOT EXISTS "unvan" VARCHAR(100);
ALTER TABLE "smg_targets" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "smg_targets" ADD COLUMN IF NOT EXISTS "required_points" INTEGER NOT NULL;
ALTER TABLE "smg_targets" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "content_library" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "thumbnail_url" TEXT,
    "duration" INTEGER NOT NULL,
    "smg_points" INTEGER NOT NULL DEFAULT 0,
    "difficulty" VARCHAR(20) NOT NULL,
    "target_roles" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content_type" VARCHAR(30),
    "s3_key" TEXT,
    "file_type" VARCHAR(20),
    "content_data" JSONB,
    "organization_id" UUID,

    CONSTRAINT "content_library_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: content_library
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) NOT NULL;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) NOT NULL;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "duration" INTEGER NOT NULL;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "smg_points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "difficulty" VARCHAR(20) NOT NULL;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "target_roles" JSONB NOT NULL;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "created_by" UUID;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "content_type" VARCHAR(30);
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "s3_key" TEXT;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "file_type" VARCHAR(20);
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "content_data" JSONB;
ALTER TABLE "content_library" ADD COLUMN IF NOT EXISTS "organization_id" UUID;


-- CreateTable
CREATE TABLE IF NOT EXISTS "organization_content_library" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "content_library_id" UUID NOT NULL,
    "installed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installed_by" UUID,

    CONSTRAINT "organization_content_library_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: organization_content_library
ALTER TABLE "organization_content_library" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "organization_content_library" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "organization_content_library" ADD COLUMN IF NOT EXISTS "content_library_id" UUID NOT NULL;
ALTER TABLE "organization_content_library" ADD COLUMN IF NOT EXISTS "installed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organization_content_library" ADD COLUMN IF NOT EXISTS "installed_by" UUID;


-- CreateTable
CREATE TABLE IF NOT EXISTS "his_integrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "base_url" VARCHAR(500) NOT NULL,
    "auth_type" VARCHAR(20) NOT NULL,
    "credentials" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMPTZ,
    "sync_interval" INTEGER NOT NULL DEFAULT 60,
    "field_mapping" JSONB NOT NULL DEFAULT '{}',
    "webhook_token" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "his_integrations_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: his_integrations
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "base_url" VARCHAR(500) NOT NULL;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(20) NOT NULL;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "credentials" JSONB NOT NULL;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMPTZ;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "sync_interval" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "field_mapping" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "webhook_token" VARCHAR(128) NOT NULL;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "his_integrations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "sync_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "sync_type" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "total_records" INTEGER NOT NULL DEFAULT 0,
    "processed_records" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: sync_logs
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "integration_id" UUID NOT NULL;
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "sync_type" VARCHAR(30) NOT NULL;
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING';
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "total_records" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "processed_records" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "errors" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;


-- CreateTable
CREATE TABLE IF NOT EXISTS "competency_forms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "target_role" VARCHAR(100),
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_forms_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: competency_forms
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) NOT NULL;
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "target_role" VARCHAR(100);
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "period_start" DATE NOT NULL;
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "period_end" DATE NOT NULL;
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "competency_forms" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "competency_categories" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competency_categories_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: competency_categories
ALTER TABLE "competency_categories" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "competency_categories" ADD COLUMN IF NOT EXISTS "form_id" UUID NOT NULL;
ALTER TABLE "competency_categories" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL;
ALTER TABLE "competency_categories" ADD COLUMN IF NOT EXISTS "weight" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "competency_categories" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;


-- CreateTable
CREATE TABLE IF NOT EXISTS "competency_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competency_items_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: competency_items
ALTER TABLE "competency_items" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "competency_items" ADD COLUMN IF NOT EXISTS "category_id" UUID NOT NULL;
ALTER TABLE "competency_items" ADD COLUMN IF NOT EXISTS "text" VARCHAR(500) NOT NULL;
ALTER TABLE "competency_items" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "competency_items" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;


-- CreateTable
CREATE TABLE IF NOT EXISTS "competency_evaluations" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "evaluator_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "overall_score" DECIMAL(4,2),
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_evaluations_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: competency_evaluations
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "form_id" UUID NOT NULL;
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "subject_id" UUID NOT NULL;
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "evaluator_id" UUID NOT NULL;
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "evaluator_type" VARCHAR(20) NOT NULL;
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "overall_score" DECIMAL(4,2);
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;
ALTER TABLE "competency_evaluations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "competency_answers" (
    "id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "competency_answers_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: competency_answers
ALTER TABLE "competency_answers" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "competency_answers" ADD COLUMN IF NOT EXISTS "evaluation_id" UUID NOT NULL;
ALTER TABLE "competency_answers" ADD COLUMN IF NOT EXISTS "item_id" UUID NOT NULL;
ALTER TABLE "competency_answers" ADD COLUMN IF NOT EXISTS "score" INTEGER NOT NULL;
ALTER TABLE "competency_answers" ADD COLUMN IF NOT EXISTS "comment" TEXT;


-- CreateTable
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: push_subscriptions
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "endpoint" TEXT NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "p256dh" TEXT NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "auth" TEXT NOT NULL;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "accreditation_standards" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "standard_body" VARCHAR(20) NOT NULL,
    "required_training_categories" JSONB NOT NULL DEFAULT '[]',
    "required_completion_rate" INTEGER NOT NULL DEFAULT 80,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accreditation_standards_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: accreditation_standards
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50) NOT NULL;
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) NOT NULL;
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "standard_body" VARCHAR(20) NOT NULL;
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "required_training_categories" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "required_completion_rate" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "accreditation_standards" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "accreditation_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "standard_body" VARCHAR(20) NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" UUID NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "overall_compliance_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "report_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accreditation_reports_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: accreditation_reports
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) NOT NULL;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "standard_body" VARCHAR(20) NOT NULL;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "generated_by" UUID NOT NULL;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMPTZ NOT NULL;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMPTZ NOT NULL;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "overall_compliance_rate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "findings" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "report_url" TEXT;
ALTER TABLE "accreditation_reports" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "training_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "value" VARCHAR(100) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(30) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_categories_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: training_categories
ALTER TABLE "training_categories" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "training_categories" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "training_categories" ADD COLUMN IF NOT EXISTS "value" VARCHAR(100) NOT NULL;
ALTER TABLE "training_categories" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100) NOT NULL;
ALTER TABLE "training_categories" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(30) NOT NULL;
ALTER TABLE "training_categories" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "training_categories" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "training_categories" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "question_bank" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "difficulty" VARCHAR(10) NOT NULL DEFAULT 'medium',
    "tags" TEXT[],
    "points" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: question_bank
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "text" TEXT NOT NULL;
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) NOT NULL;
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "difficulty" VARCHAR(10) NOT NULL DEFAULT 'medium';
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "tags" TEXT[];
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "points" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "question_bank" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "question_bank_options" (
    "id" UUID NOT NULL,
    "question_bank_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "question_bank_options_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: question_bank_options
ALTER TABLE "question_bank_options" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "question_bank_options" ADD COLUMN IF NOT EXISTS "question_bank_id" UUID NOT NULL;
ALTER TABLE "question_bank_options" ADD COLUMN IF NOT EXISTS "text" TEXT NOT NULL;
ALTER TABLE "question_bank_options" ADD COLUMN IF NOT EXISTS "is_correct" BOOLEAN NOT NULL;
ALTER TABLE "question_bank_options" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL;


-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_notebooks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "notebooklm_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_notebooks_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: ai_notebooks
ALTER TABLE "ai_notebooks" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "ai_notebooks" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "ai_notebooks" ADD COLUMN IF NOT EXISTS "notebooklm_id" VARCHAR(100) NOT NULL;
ALTER TABLE "ai_notebooks" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) NOT NULL;
ALTER TABLE "ai_notebooks" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ai_notebooks" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL;


-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_notebook_sources" (
    "id" UUID NOT NULL,
    "notebook_id" UUID NOT NULL,
    "source_lm_id" VARCHAR(100),
    "file_name" VARCHAR(500) NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "s3_key" TEXT,
    "source_type" VARCHAR(30) NOT NULL,
    "source_url" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'uploading',
    "summary" TEXT,
    "key_topics" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_notebook_sources_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: ai_notebook_sources
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "notebook_id" UUID NOT NULL;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "source_lm_id" VARCHAR(100);
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "file_name" VARCHAR(500) NOT NULL;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "file_type" VARCHAR(50) NOT NULL;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "file_size" INTEGER NOT NULL;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "s3_key" TEXT;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(30) NOT NULL;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "source_url" TEXT;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) NOT NULL DEFAULT 'uploading';
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "key_topics" JSONB;
ALTER TABLE "ai_notebook_sources" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_generations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notebook_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "artifact_type" VARCHAR(30) NOT NULL,
    "artifact_lm_id" VARCHAR(100),
    "task_lm_id" VARCHAR(100),
    "instructions" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "output_s3_key" TEXT,
    "output_file_type" VARCHAR(20),
    "output_size" INTEGER,
    "transcript" TEXT,
    "content_data" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "evaluation" VARCHAR(20),
    "evaluation_note" TEXT,
    "evaluated_at" TIMESTAMPTZ,
    "evaluated_by_id" UUID,
    "saved_to_library" BOOLEAN NOT NULL DEFAULT false,
    "content_library_id" UUID,
    "saved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: ai_generations
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "notebook_id" UUID NOT NULL;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) NOT NULL;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "artifact_type" VARCHAR(30) NOT NULL;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "artifact_lm_id" VARCHAR(100);
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "task_lm_id" VARCHAR(100);
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "instructions" TEXT;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(30) NOT NULL DEFAULT 'pending';
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "output_s3_key" TEXT;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "output_file_type" VARCHAR(20);
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "output_size" INTEGER;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "transcript" TEXT;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "content_data" JSONB;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "evaluation" VARCHAR(20);
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "evaluation_note" TEXT;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "evaluated_at" TIMESTAMPTZ;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "evaluated_by_id" UUID;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "saved_to_library" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "content_library_id" UUID;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "saved_at" TIMESTAMPTZ;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL;


-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_google_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "encrypted_cookie" TEXT,
    "last_verified_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_google_connections_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: ai_google_connections
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "user_id" UUID NOT NULL;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "encrypted_cookie" TEXT;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMPTZ;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "error_message" TEXT;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ai_google_connections" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL;


-- CreateTable
CREATE TABLE IF NOT EXISTS "training_feedback_forms" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL DEFAULT 'Eğitim Değerlendirme Anket Formu',
    "description" TEXT,
    "document_code" VARCHAR(50) DEFAULT 'EY.FR.40',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_feedback_forms_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: training_feedback_forms
ALTER TABLE "training_feedback_forms" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "training_feedback_forms" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "training_feedback_forms" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) NOT NULL DEFAULT 'Eğitim Değerlendirme Anket Formu';
ALTER TABLE "training_feedback_forms" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "training_feedback_forms" ADD COLUMN IF NOT EXISTS "document_code" VARCHAR(50) DEFAULT 'EY.FR.40';
ALTER TABLE "training_feedback_forms" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "training_feedback_forms" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "training_feedback_forms" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "training_feedback_categories" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_feedback_categories_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: training_feedback_categories
ALTER TABLE "training_feedback_categories" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "training_feedback_categories" ADD COLUMN IF NOT EXISTS "form_id" UUID NOT NULL;
ALTER TABLE "training_feedback_categories" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) NOT NULL;
ALTER TABLE "training_feedback_categories" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;


-- CreateTable
CREATE TABLE IF NOT EXISTS "training_feedback_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "question_type" VARCHAR(20) NOT NULL DEFAULT 'likert_5',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "training_feedback_items_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: training_feedback_items
ALTER TABLE "training_feedback_items" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "training_feedback_items" ADD COLUMN IF NOT EXISTS "category_id" UUID NOT NULL;
ALTER TABLE "training_feedback_items" ADD COLUMN IF NOT EXISTS "text" VARCHAR(500) NOT NULL;
ALTER TABLE "training_feedback_items" ADD COLUMN IF NOT EXISTS "question_type" VARCHAR(20) NOT NULL DEFAULT 'likert_5';
ALTER TABLE "training_feedback_items" ADD COLUMN IF NOT EXISTS "is_required" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "training_feedback_items" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;


-- CreateTable
CREATE TABLE IF NOT EXISTS "training_feedback_responses" (
    "id" UUID NOT NULL,
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

-- AddMissingColumns: training_feedback_responses
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "form_id" UUID NOT NULL;
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "attempt_id" UUID NOT NULL;
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "training_id" UUID NOT NULL;
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "organization_id" UUID NOT NULL;
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "include_name" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "is_passed" BOOLEAN NOT NULL;
ALTER TABLE "training_feedback_responses" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- CreateTable
CREATE TABLE IF NOT EXISTS "training_feedback_answers" (
    "id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "score" INTEGER,
    "text_answer" TEXT,

    CONSTRAINT "training_feedback_answers_pkey" PRIMARY KEY ("id")
);

-- AddMissingColumns: training_feedback_answers
ALTER TABLE "training_feedback_answers" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL;
ALTER TABLE "training_feedback_answers" ADD COLUMN IF NOT EXISTS "response_id" UUID NOT NULL;
ALTER TABLE "training_feedback_answers" ADD COLUMN IF NOT EXISTS "item_id" UUID NOT NULL;
ALTER TABLE "training_feedback_answers" ADD COLUMN IF NOT EXISTS "score" INTEGER;
ALTER TABLE "training_feedback_answers" ADD COLUMN IF NOT EXISTS "text_answer" TEXT;


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_custom_domain_key" ON "organizations"("custom_domain");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organization_subscriptions_organization_id_key" ON "organization_subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_payments_org" ON "payments"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_payments_org_status" ON "payments"("organization_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_payments_iyzico" ON "payments"("iyzico_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_invoices_org" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_invoices_number" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_invoices_org_status" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_departments_org" ON "departments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "departments_organization_id_name_key" ON "departments"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_org" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_department" ON "users"("department_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_his_external_id" ON "users"("his_external_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_org_active" ON "users"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_org_department" ON "users"("organization_id", "department_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_users_org_role" ON "users"("organization_id", "role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_trainings_org" ON "trainings"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_trainings_dates" ON "trainings"("start_date", "end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_trainings_org_publish_status" ON "trainings"("organization_id", "publish_status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_trainings_org_compulsory" ON "trainings"("organization_id", "is_compulsory");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_trainings_org_created" ON "trainings"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_trainings_org_start_end" ON "trainings"("organization_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_training_videos_training" ON "training_videos"("training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_questions_training" ON "questions"("training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_question_options_question" ON "question_options"("question_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_assignments_user" ON "training_assignments"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_assignments_training" ON "training_assignments"("training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_assignments_status" ON "training_assignments"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_assignments_user_status" ON "training_assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_assignments_training_status" ON "training_assignments"("training_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_assignments_completed_at" ON "training_assignments"("completed_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "training_assignments_training_id_user_id_key" ON "training_assignments"("training_id", "user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_assignment" ON "exam_attempts"("assignment_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_user" ON "exam_attempts"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_training" ON "exam_attempts"("training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_training_status" ON "exam_attempts"("training_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_user_training" ON "exam_attempts"("user_id", "training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_user_status" ON "exam_attempts"("user_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_assignment_status" ON "exam_attempts"("assignment_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_user_passed" ON "exam_attempts"("user_id", "is_passed");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_attempts_organization" ON "exam_attempts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exam_attempts_assignment_id_attempt_number_key" ON "exam_attempts"("assignment_id", "attempt_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_exam_answers_attempt" ON "exam_answers"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exam_answers_attempt_id_question_id_exam_phase_key" ON "exam_answers"("attempt_id", "question_id", "exam_phase");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_video_progress_user_video" ON "video_progress"("user_id", "video_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_video_progress_user_completed" ON "video_progress"("user_id", "is_completed");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "video_progress_attempt_id_video_id_key" ON "video_progress"("attempt_id", "video_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notifications_user_date" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notifications_org_read_date" ON "notifications"("organization_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notifications_org_date" ON "notifications"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_audit_logs_date" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_audit_logs_org_date" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_date" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_attempt_id_key" ON "certificates"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "certificates_certificate_code_key" ON "certificates"("certificate_code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_certificates_user" ON "certificates"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_certificates_training" ON "certificates"("training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_certificates_organization" ON "certificates"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_kvkk_requests_org_status" ON "kvkk_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_kvkk_requests_user" ON "kvkk_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "scorm_attempts_attempt_id_key" ON "scorm_attempts"("attempt_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_scorm_attempts_user_training" ON "scorm_attempts"("user_id", "training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_dept_training_rules_org" ON "department_training_rules"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "department_training_rules_department_id_training_id_key" ON "department_training_rules"("department_id", "training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_smg_activities_user" ON "smg_activities"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_smg_activities_org" ON "smg_activities"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_smg_activities_category" ON "smg_activities"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "idx_smg_activities_unique" ON "smg_activities"("user_id", "activity_type", "title", "completion_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_smg_periods_org" ON "smg_periods"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_smg_categories_org" ON "smg_categories"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "idx_smg_categories_org_code" ON "smg_categories"("organization_id", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_smg_targets_period" ON "smg_targets"("period_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_smg_targets_org" ON "smg_targets"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_content_library_category" ON "content_library"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_content_library_content_type" ON "content_library"("content_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_content_library_org_id" ON "content_library"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_org_content_library_org" ON "organization_content_library"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organization_content_library_organization_id_content_librar_key" ON "organization_content_library"("organization_id", "content_library_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "his_integrations_webhook_token_key" ON "his_integrations"("webhook_token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_his_integrations_org" ON "his_integrations"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_his_integrations_active" ON "his_integrations"("is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_sync_logs_org" ON "sync_logs"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_sync_logs_integration" ON "sync_logs"("integration_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_sync_logs_status" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_comp_forms_org" ON "competency_forms"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_comp_categories_form" ON "competency_categories"("form_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_comp_items_category" ON "competency_items"("category_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_comp_evals_subject" ON "competency_evaluations"("subject_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_comp_evals_evaluator" ON "competency_evaluations"("evaluator_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_comp_evals_form" ON "competency_evaluations"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "competency_evaluations_form_id_subject_id_evaluator_id_key" ON "competency_evaluations"("form_id", "subject_id", "evaluator_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_comp_answers_eval" ON "competency_answers"("evaluation_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "competency_answers_evaluation_id_item_id_key" ON "competency_answers"("evaluation_id", "item_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_user" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "accreditation_standards_code_key" ON "accreditation_standards"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_accreditation_standards_body" ON "accreditation_standards"("standard_body");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_accreditation_reports_org" ON "accreditation_reports"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_accreditation_reports_body" ON "accreditation_reports"("standard_body");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_accreditation_reports_date" ON "accreditation_reports"("generated_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_training_categories_org_order" ON "training_categories"("organization_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "training_categories_organization_id_value_key" ON "training_categories"("organization_id", "value");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_question_bank_org" ON "question_bank"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_notebooks_organization_id_idx" ON "ai_notebooks"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_notebook_sources_notebook_id_idx" ON "ai_notebook_sources"("notebook_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_generations_organization_id_idx" ON "ai_generations"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_generations_user_id_idx" ON "ai_generations"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_generations_status_idx" ON "ai_generations"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_generations_artifact_type_idx" ON "ai_generations"("artifact_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_generations_evaluation_idx" ON "ai_generations"("evaluation");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ai_google_connections_organization_id_key" ON "ai_google_connections"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_google_connections_status_idx" ON "ai_google_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "training_feedback_forms_organization_id_key" ON "training_feedback_forms"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tfb_categories_form" ON "training_feedback_categories"("form_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tfb_items_category" ON "training_feedback_items"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "training_feedback_responses_attempt_id_key" ON "training_feedback_responses"("attempt_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tfb_responses_org_training" ON "training_feedback_responses"("organization_id", "training_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tfb_responses_org_submitted" ON "training_feedback_responses"("organization_id", "submitted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_tfb_answers_response" ON "training_feedback_answers"("response_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "training_feedback_answers_response_id_item_id_key" ON "training_feedback_answers"("response_id", "item_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "trainings" ADD CONSTRAINT "trainings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "trainings" ADD CONSTRAINT "trainings_source_library_id_fkey" FOREIGN KEY ("source_library_id") REFERENCES "content_library"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "trainings" ADD CONSTRAINT "trainings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_videos" ADD CONSTRAINT "training_videos_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "training_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "training_videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_training_id_fkey" FOREIGN KEY ("related_training_id") REFERENCES "trainings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "db_backups" ADD CONSTRAINT "db_backups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "department_training_rules" ADD CONSTRAINT "department_training_rules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "department_training_rules" ADD CONSTRAINT "department_training_rules_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "smg_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_periods" ADD CONSTRAINT "smg_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_categories" ADD CONSTRAINT "smg_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "smg_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "content_library" ADD CONSTRAINT "content_library_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "content_library" ADD CONSTRAINT "content_library_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "organization_content_library" ADD CONSTRAINT "organization_content_library_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "organization_content_library" ADD CONSTRAINT "organization_content_library_content_library_id_fkey" FOREIGN KEY ("content_library_id") REFERENCES "content_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "organization_content_library" ADD CONSTRAINT "organization_content_library_installed_by_fkey" FOREIGN KEY ("installed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "his_integrations" ADD CONSTRAINT "his_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "his_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "competency_forms" ADD CONSTRAINT "competency_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "competency_categories" ADD CONSTRAINT "competency_categories_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "competency_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "competency_items" ADD CONSTRAINT "competency_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "competency_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "competency_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "competency_answers" ADD CONSTRAINT "competency_answers_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "competency_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "competency_answers" ADD CONSTRAINT "competency_answers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "competency_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "accreditation_reports" ADD CONSTRAINT "accreditation_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "accreditation_reports" ADD CONSTRAINT "accreditation_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_categories" ADD CONSTRAINT "training_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "question_bank" ADD CONSTRAINT "question_bank_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "question_bank_options" ADD CONSTRAINT "question_bank_options_question_bank_id_fkey" FOREIGN KEY ("question_bank_id") REFERENCES "question_bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_notebooks" ADD CONSTRAINT "ai_notebooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_notebook_sources" ADD CONSTRAINT "ai_notebook_sources_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "ai_notebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "ai_notebooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_evaluated_by_id_fkey" FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_content_library_id_fkey" FOREIGN KEY ("content_library_id") REFERENCES "content_library"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_google_connections" ADD CONSTRAINT "ai_google_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ai_google_connections" ADD CONSTRAINT "ai_google_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_forms" ADD CONSTRAINT "training_feedback_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_categories" ADD CONSTRAINT "training_feedback_categories_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "training_feedback_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_items" ADD CONSTRAINT "training_feedback_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "training_feedback_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "training_feedback_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_responses" ADD CONSTRAINT "training_feedback_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_answers" ADD CONSTRAINT "training_feedback_answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "training_feedback_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "training_feedback_answers" ADD CONSTRAINT "training_feedback_answers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "training_feedback_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

