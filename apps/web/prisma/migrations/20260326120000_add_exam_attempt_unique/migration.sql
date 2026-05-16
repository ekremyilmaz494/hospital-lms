-- Delete duplicate exam attempts, keeping only the latest one per (assignment_id, attempt_number)
DELETE FROM "exam_attempts" a
USING "exam_attempts" b
WHERE a."assignment_id" = b."assignment_id"
  AND a."attempt_number" = b."attempt_number"
  AND a."created_at" < b."created_at";

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_assignment_id_attempt_number_key" ON "exam_attempts"("assignment_id", "attempt_number");
