-- FK rule hardening: niyet dokumante eder.
-- Prisma'nın default davranışı zorunlu ilişkilerde NoAction; Postgres bunu
-- silmeyi bloklamak olarak yorumlar. Bu migration aynı davranışı RESTRICT
-- olarak explicit hale getirir — schema okuyan herkes onDelete kuralını görür.
-- (Certificate.organization ve Training.organization için davranış değişmez;
--  sadece açıkça yazılmış olur.)

-- Training.organization: NoAction → Restrict
ALTER TABLE "trainings" DROP CONSTRAINT IF EXISTS "trainings_organization_id_fkey";
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Certificate.user: NoAction → Restrict
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_user_id_fkey";
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Certificate.training: NoAction → Restrict
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_training_id_fkey";
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_training_id_fkey"
  FOREIGN KEY ("training_id") REFERENCES "trainings"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Certificate.attempt: NoAction → Restrict (1:1 unique attemptId)
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_attempt_id_fkey";
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Certificate.organization: SetNull (optional FK; default zaten SetNull, explicit yazıyoruz)
ALTER TABLE "certificates" DROP CONSTRAINT IF EXISTS "certificates_organization_id_fkey";
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
