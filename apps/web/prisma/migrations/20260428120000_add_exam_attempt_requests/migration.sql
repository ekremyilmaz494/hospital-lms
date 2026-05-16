-- CreateTable
CREATE TABLE "exam_attempt_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "training_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "granted_attempts" INTEGER,
    "review_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_attempt_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_attempt_requests_org_status" ON "exam_attempt_requests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "idx_attempt_requests_user" ON "exam_attempt_requests"("user_id");

-- CreateIndex
CREATE INDEX "idx_attempt_requests_training" ON "exam_attempt_requests"("training_id");

-- CreateIndex
CREATE INDEX "idx_attempt_requests_user_training_status" ON "exam_attempt_requests"("user_id", "training_id", "status");

-- AddForeignKey
ALTER TABLE "exam_attempt_requests" ADD CONSTRAINT "exam_attempt_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_requests" ADD CONSTRAINT "exam_attempt_requests_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "trainings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_requests" ADD CONSTRAINT "exam_attempt_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_requests" ADD CONSTRAINT "exam_attempt_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
