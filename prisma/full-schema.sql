-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "subscription_plans" (
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

-- CreateTable
CREATE TABLE "organizations" (
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

-- CreateTable
CREATE TABLE "organization_subscriptions" (
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

-- CreateTable
CREATE TABLE "payments" (
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

-- CreateTable
CREATE TABLE "invoices" (
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

-- CreateTable
CREATE TABLE "departments" (
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

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "tc_no" VARCHAR(11),
    "phone" VARCHAR(20),
    "department_id" UUID,
    "title" VARCHAR(100),
    "role" VARCHAR(20) NOT NULL,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "kvkk_consent" BOOLEAN NOT NULL DEFAULT false,
    "kvkk_consent_date" TIMESTAMPTZ,
    "his_external_id" VARCHAR(100),
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "terms_accepted" BOOLEAN NOT NULL DEFAULT false,
    "terms_accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "thumbnail_url" TEXT,
    "passing_score" INTEGER NOT NULL DEFAULT 70,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "exam_duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "start_date" TIMESTAMPTZ NOT NULL,
    "end_date" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "publish_status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "is_compulsory" BOOLEAN NOT NULL DEFAULT false,
    "compliance_deadline" TIMESTAMPTZ,
    "regulatory_body" VARCHAR(200),
    "renewal_period_months" INTEGER,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scorm_manifest_path" TEXT,
    "scorm_entry_point" TEXT,
    "scorm_version" VARCHAR(10),
    "exam_only" BOOLEAN NOT NULL DEFAULT false,
    "randomize_questions" BOOLEAN NOT NULL DEFAULT false,
    "random_question_count" INTEGER,
    "is_from_library" BOOLEAN NOT NULL DEFAULT false,
    "source_library_id" UUID,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_videos" (
    "id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "video_url" TEXT NOT NULL,
    "video_key" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "content_type" VARCHAR(20) NOT NULL DEFAULT 'video',
    "page_count" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" VARCHAR(20) NOT NULL DEFAULT 'multiple_choice',
    "points" INTEGER NOT NULL DEFAULT 10,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "option_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_assignments" (
    "id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'assigned',
    "current_attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "training_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
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

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_answers" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_id" UUID,
    "is_correct" BOOLEAN,
    "exam_phase" VARCHAR(10) NOT NULL,
    "answered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_progress" (
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

-- CreateTable
CREATE TABLE "notifications" (
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

-- CreateTable
CREATE TABLE "audit_logs" (
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
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "db_backups" (
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

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "certificate_code" VARCHAR(50) NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kvkk_requests" (
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

-- CreateTable
CREATE TABLE "scorm_attempts" (
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

-- CreateTable
CREATE TABLE "department_training_rules" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_training_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smg_activities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "activity_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(255),
    "completion_date" DATE NOT NULL,
    "smg_points" INTEGER NOT NULL,
    "certificate_url" VARCHAR(1000),
    "approval_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smg_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smg_periods" (
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

-- CreateTable
CREATE TABLE "content_library" (
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

    CONSTRAINT "content_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_content_library" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "content_library_id" UUID NOT NULL,
    "installed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "installed_by" UUID,

    CONSTRAINT "organization_content_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "his_integrations" (
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

-- CreateTable
CREATE TABLE "sync_logs" (
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

-- CreateTable
CREATE TABLE "competency_forms" (
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

-- CreateTable
CREATE TABLE "competency_categories" (
    "id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competency_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competency_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_evaluations" (
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

-- CreateTable
CREATE TABLE "competency_answers" (
    "id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,

    CONSTRAINT "competency_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accreditation_standards" (
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

-- CreateTable
CREATE TABLE "accreditation_reports" (
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

-- CreateTable
CREATE TABLE "training_categories" (
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

-- CreateTable
CREATE TABLE "question_bank" (
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

-- CreateTable
CREATE TABLE "question_bank_options" (
    "id" UUID NOT NULL,
    "question_bank_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "question_bank_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_notebooks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "notebooklm_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_notebooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_notebook_sources" (
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

-- CreateTable
CREATE TABLE "ai_generations" (
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

-- CreateTable
CREATE TABLE "ai_google_connections" (
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

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_custom_domain_key" ON "organizations"("custom_domain");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key" ON "organization_subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "idx_payments_org" ON "payments"("organization_id");

-- CreateIndex
CREATE INDEX "idx_payments_org_status" ON "payments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "idx_payments_iyzico" ON "payments"("iyzico_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_invoices_org" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX "idx_invoices_number" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_invoices_org_status" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "idx_departments_org" ON "departments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "departments"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_org" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_users_department" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "idx_users_his_external_id" ON "users"("his_external_id");

-- CreateIndex
CREATE INDEX "idx_users_org_active" ON "users"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_users_org_department" ON "users"("organization_id", "department_id");

-- CreateIndex
CREATE INDEX "idx_users_org_role" ON "users"("organization_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_organization_id_tc_no_key" ON "users"("organization_id", "tc_no");

-- CreateIndex
CREATE INDEX "idx_trainings_org" ON "trainings"("organization_id");

-- CreateIndex
CREATE INDEX "idx_trainings_dates" ON "trainings"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_trainings_org_publish_status" ON "trainings"("organization_id", "publish_status");

-- CreateIndex
CREATE INDEX "idx_trainings_org_compulsory" ON "trainings"("organization_id", "is_compulsory");

-- CreateIndex
CREATE INDEX "idx_trainings_org_created" ON "trainings"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_trainings_org_start_end" ON "trainings"("organization_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_training_videos_training" ON "training_videos"("training_id");

-- CreateIndex
CREATE INDEX "idx_questions_training" ON "questions"("training_id");

-- CreateIndex
CREATE INDEX "idx_question_options_question" ON "question_options"("question_id");

-- CreateIndex
CREATE INDEX "idx_assignments_user" ON "training_assignments"("user_id");

-- CreateIndex
CREATE INDEX "idx_assignments_training" ON "training_assignments"("training_id");

-- CreateIndex
CREATE INDEX "idx_assignments_status" ON "training_assignments"("status");

-- CreateIndex
CREATE INDEX "idx_assignments_user_status" ON "training_assignments"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_assignments_training_status" ON "training_assignments"("training_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "training_assignments_training_id_user_id_key" ON "training_assignments"("training_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_attempts_assignment" ON "exam_attempts"("assignment_id");

-- CreateIndex
CREATE INDEX "idx_attempts_user" ON "exam_attempts"("user_id");

-- CreateIndex
CREATE INDEX "idx_attempts_training" ON "exam_attempts"("training_id");

-- CreateIndex
CREATE INDEX "idx_attempts_training_status" ON "exam_attempts"("training_id", "status");

-- CreateIndex
CREATE INDEX "idx_attempts_user_training" ON "exam_attempts"("user_id", "training_id");

-- CreateIndex
CREATE INDEX "idx_attempts_user_status" ON "exam_attempts"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_attempts_assignment_status" ON "exam_attempts"("assignment_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_assignment_id_attempt_number_key" ON "exam_attempts"("assignment_id", "attempt_number");

-- CreateIndex
CREATE INDEX "idx_exam_answers_attempt" ON "exam_answers"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_answers_attempt_id_question_id_exam_phase_key" ON "exam_answers"("attempt_id", "question_id", "exam_phase");

-- CreateIndex
CREATE INDEX "idx_video_progress_user_video" ON "video_progress"("user_id", "video_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_progress_attempt_id_video_id_key" ON "video_progress"("attempt_id", "video_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notifications_user_date" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_org_read_date" ON "notifications"("organization_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_org_date" ON "notifications"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_date" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_org_date" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_date" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_attempt_id_key" ON "certificates"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_certificate_code_key" ON "certificates"("certificate_code");

-- CreateIndex
CREATE INDEX "idx_certificates_user" ON "certificates"("user_id");

-- CreateIndex
CREATE INDEX "idx_certificates_training" ON "certificates"("training_id");

-- CreateIndex
CREATE INDEX "idx_kvkk_requests_org_status" ON "kvkk_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "idx_kvkk_requests_user" ON "kvkk_requests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "scorm_attempts_attempt_id_key" ON "scorm_attempts"("attempt_id");

-- CreateIndex
CREATE INDEX "idx_scorm_attempts_user_training" ON "scorm_attempts"("user_id", "training_id");

-- CreateIndex
CREATE INDEX "idx_dept_training_rules_org" ON "department_training_rules"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_training_rules_department_id_training_id_key" ON "department_training_rules"("department_id", "training_id");

-- CreateIndex
CREATE INDEX "idx_smg_activities_user" ON "smg_activities"("user_id");

-- CreateIndex
CREATE INDEX "idx_smg_activities_org" ON "smg_activities"("organization_id");

-- CreateIndex
CREATE INDEX "idx_smg_periods_org" ON "smg_periods"("organization_id");

-- CreateIndex
CREATE INDEX "idx_content_library_category" ON "content_library"("category");

-- CreateIndex
CREATE INDEX "idx_org_content_library_org" ON "organization_content_library"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_content_library_organization_id_content_librar_key" ON "organization_content_library"("organization_id", "content_library_id");

-- CreateIndex
CREATE UNIQUE INDEX "his_integrations_webhook_token_key" ON "his_integrations"("webhook_token");

-- CreateIndex
CREATE INDEX "idx_his_integrations_org" ON "his_integrations"("organization_id");

-- CreateIndex
CREATE INDEX "idx_his_integrations_active" ON "his_integrations"("is_active");

-- CreateIndex
CREATE INDEX "idx_sync_logs_org" ON "sync_logs"("organization_id");

-- CreateIndex
CREATE INDEX "idx_sync_logs_integration" ON "sync_logs"("integration_id");

-- CreateIndex
CREATE INDEX "idx_sync_logs_status" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX "idx_comp_forms_org" ON "competency_forms"("organization_id");

-- CreateIndex
CREATE INDEX "idx_comp_categories_form" ON "competency_categories"("form_id");

-- CreateIndex
CREATE INDEX "idx_comp_items_category" ON "competency_items"("category_id");

-- CreateIndex
CREATE INDEX "idx_comp_evals_subject" ON "competency_evaluations"("subject_id");

-- CreateIndex
CREATE INDEX "idx_comp_evals_evaluator" ON "competency_evaluations"("evaluator_id");

-- CreateIndex
CREATE INDEX "idx_comp_evals_form" ON "competency_evaluations"("form_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_evaluations_form_id_subject_id_evaluator_id_key" ON "competency_evaluations"("form_id", "subject_id", "evaluator_id");

-- CreateIndex
CREATE INDEX "idx_comp_answers_eval" ON "competency_answers"("evaluation_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_answers_evaluation_id_item_id_key" ON "competency_answers"("evaluation_id", "item_id");

-- CreateIndex
CREATE INDEX "idx_push_subscriptions_user" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "accreditation_standards_code_key" ON "accreditation_standards"("code");

-- CreateIndex
CREATE INDEX "idx_accreditation_standards_body" ON "accreditation_standards"("standard_body");

-- CreateIndex
CREATE INDEX "idx_accreditation_reports_org" ON "accreditation_reports"("organization_id");

-- CreateIndex
CREATE INDEX "idx_accreditation_reports_body" ON "accreditation_reports"("standard_body");

-- CreateIndex
CREATE INDEX "idx_accreditation_reports_date" ON "accreditation_reports"("generated_at");

-- CreateIndex
CREATE INDEX "idx_training_categories_org_order" ON "training_categories"("organization_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "training_categories_organization_id_value_key" ON "training_categories"("organization_id", "value");

-- CreateIndex
CREATE INDEX "idx_question_bank_org" ON "question_bank"("organization_id");

-- CreateIndex
CREATE INDEX "ai_notebooks_organization_id_idx" ON "ai_notebooks"("organization_id");

-- CreateIndex
CREATE INDEX "ai_notebook_sources_notebook_id_idx" ON "ai_notebook_sources"("notebook_id");

-- CreateIndex
CREATE INDEX "ai_generations_organization_id_idx" ON "ai_generations"("organization_id");

-- CreateIndex
CREATE INDEX "ai_generations_user_id_idx" ON "ai_generations"("user_id");

-- CreateIndex
CREATE INDEX "ai_generations_status_idx" ON "ai_generations"("status");

-- CreateIndex
CREATE INDEX "ai_generations_artifact_type_idx" ON "ai_generations"("artifact_type");

-- CreateIndex
CREATE INDEX "ai_generations_evaluation_idx" ON "ai_generations"("evaluation");

-- CreateIndex
CREATE UNIQUE INDEX "ai_google_connections_organization_id_key" ON "ai_google_connections"("organization_id");

-- CreateIndex
CREATE INDEX "ai_google_connections_status_idx" ON "ai_google_connections"("status");

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organization_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_source_library_id_fkey" FOREIGN KEY ("source_library_id") REFERENCES "content_library"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_videos" ADD CONSTRAINT "training_videos_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_assignments" ADD CONSTRAINT "training_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "training_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "training_videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_training_id_fkey" FOREIGN KEY ("related_training_id") REFERENCES "trainings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "db_backups" ADD CONSTRAINT "db_backups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kvkk_requests" ADD CONSTRAINT "kvkk_requests_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorm_attempts" ADD CONSTRAINT "scorm_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_training_rules" ADD CONSTRAINT "department_training_rules_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_training_rules" ADD CONSTRAINT "department_training_rules_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smg_periods" ADD CONSTRAINT "smg_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_library" ADD CONSTRAINT "content_library_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_content_library" ADD CONSTRAINT "organization_content_library_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_content_library" ADD CONSTRAINT "organization_content_library_content_library_id_fkey" FOREIGN KEY ("content_library_id") REFERENCES "content_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_content_library" ADD CONSTRAINT "organization_content_library_installed_by_fkey" FOREIGN KEY ("installed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "his_integrations" ADD CONSTRAINT "his_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "his_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_forms" ADD CONSTRAINT "competency_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_categories" ADD CONSTRAINT "competency_categories_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "competency_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_items" ADD CONSTRAINT "competency_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "competency_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "competency_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_answers" ADD CONSTRAINT "competency_answers_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "competency_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_answers" ADD CONSTRAINT "competency_answers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "competency_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accreditation_reports" ADD CONSTRAINT "accreditation_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accreditation_reports" ADD CONSTRAINT "accreditation_reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_categories" ADD CONSTRAINT "training_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank" ADD CONSTRAINT "question_bank_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_bank_options" ADD CONSTRAINT "question_bank_options_question_bank_id_fkey" FOREIGN KEY ("question_bank_id") REFERENCES "question_bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_notebooks" ADD CONSTRAINT "ai_notebooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_notebook_sources" ADD CONSTRAINT "ai_notebook_sources_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "ai_notebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_notebook_id_fkey" FOREIGN KEY ("notebook_id") REFERENCES "ai_notebooks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_evaluated_by_id_fkey" FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_content_library_id_fkey" FOREIGN KEY ("content_library_id") REFERENCES "content_library"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_google_connections" ADD CONSTRAINT "ai_google_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_google_connections" ADD CONSTRAINT "ai_google_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

