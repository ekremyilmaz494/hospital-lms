-- Oyunlaştırma Faz 1 — Günün Soruları (spaced-repetition / Leitner).
-- SMG (mesleki gelişim / onay) sisteminden TAMAMEN AYRIDIR.

-- CreateTable
CREATE TABLE "daily_reviews" (
    "user_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "next_review_at" TIMESTAMPTZ NOT NULL,
    "last_result" BOOLEAN,
    "last_reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_reviews_pkey" PRIMARY KEY ("user_id","question_id")
);

-- CreateTable
CREATE TABLE "daily_submissions" (
    "submission_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "correct_count" INTEGER NOT NULL,
    "points_awarded" INTEGER NOT NULL,
    "results_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_submissions_pkey" PRIMARY KEY ("submission_id")
);

-- CreateIndex
CREATE INDEX "idx_daily_review_user_due" ON "daily_reviews"("user_id", "next_review_at");

-- CreateIndex
CREATE INDEX "idx_daily_review_org" ON "daily_reviews"("organization_id");

-- CreateIndex
CREATE INDEX "idx_daily_submission_user" ON "daily_submissions"("user_id");

-- AddForeignKey
ALTER TABLE "daily_reviews" ADD CONSTRAINT "daily_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reviews" ADD CONSTRAINT "daily_reviews_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_submissions" ADD CONSTRAINT "daily_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

