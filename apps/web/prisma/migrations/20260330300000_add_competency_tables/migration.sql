-- CreateTable: Competency Forms
CREATE TABLE "competency_forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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

-- CreateTable: Competency Categories
CREATE TABLE "competency_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "competency_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Competency Items
CREATE TABLE "competency_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "competency_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Competency Evaluations
CREATE TABLE "competency_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "form_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "evaluator_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "overall_score" DECIMAL(4,2),
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "competency_evaluations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "competency_evaluations_unique" UNIQUE ("form_id", "subject_id", "evaluator_id")
);

-- CreateTable: Competency Answers
CREATE TABLE "competency_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evaluation_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    CONSTRAINT "competency_answers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "competency_answers_unique" UNIQUE ("evaluation_id", "item_id")
);

-- CreateIndex
CREATE INDEX "idx_comp_forms_org" ON "competency_forms"("organization_id");
CREATE INDEX "idx_comp_categories_form" ON "competency_categories"("form_id");
CREATE INDEX "idx_comp_items_category" ON "competency_items"("category_id");
CREATE INDEX "idx_comp_evals_subject" ON "competency_evaluations"("subject_id");
CREATE INDEX "idx_comp_evals_evaluator" ON "competency_evaluations"("evaluator_id");
CREATE INDEX "idx_comp_evals_form" ON "competency_evaluations"("form_id");
CREATE INDEX "idx_comp_answers_eval" ON "competency_answers"("evaluation_id");

-- AddForeignKey
ALTER TABLE "competency_forms" ADD CONSTRAINT "competency_forms_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_categories" ADD CONSTRAINT "competency_categories_form_id_fkey"
    FOREIGN KEY ("form_id") REFERENCES "competency_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_items" ADD CONSTRAINT "competency_items_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "competency_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_form_id_fkey"
    FOREIGN KEY ("form_id") REFERENCES "competency_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_evaluations" ADD CONSTRAINT "competency_evaluations_evaluator_id_fkey"
    FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_answers" ADD CONSTRAINT "competency_answers_evaluation_id_fkey"
    FOREIGN KEY ("evaluation_id") REFERENCES "competency_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_answers" ADD CONSTRAINT "competency_answers_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "competency_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
