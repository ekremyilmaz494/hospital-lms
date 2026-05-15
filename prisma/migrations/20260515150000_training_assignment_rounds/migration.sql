-- Eğitim "2. Atama" (Tekrar Tur) — TrainingAssignment'a round + per-atama dueDate + tur zinciri.
--
-- round: aynı (training, user, period) için 1, 2, 3 ... tur. Mevcut tüm kayıtlar default 1.
-- due_date: training.endDate'i atama-özel override eder. null ise fallback olarak training.endDate.
-- reassignment_reason: 2. turun hangi segmentten geldiği — 'failed' | 'no_show' | 'overdue_in_progress'.
-- previous_assignment_id: bir önceki tura self-FK; denetim zinciri.

ALTER TABLE "training_assignments"
  ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "due_date" TIMESTAMPTZ,
  ADD COLUMN "reassignment_reason" VARCHAR(20),
  ADD COLUMN "previous_assignment_id" UUID;

-- Self-FK (önceki tura zincir, ondan silinince null'lansın)
ALTER TABLE "training_assignments"
  ADD CONSTRAINT "training_assignments_previous_assignment_id_fkey"
  FOREIGN KEY ("previous_assignment_id")
  REFERENCES "training_assignments"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Composite unique'i round eklenmiş hâliyle yeniden kur.
-- Eski constraint adı Prisma konvansiyonu: "training_assignments_training_id_user_id_period_id_key".
ALTER TABLE "training_assignments"
  DROP CONSTRAINT IF EXISTS "training_assignments_training_id_user_id_period_id_key";

ALTER TABLE "training_assignments"
  ADD CONSTRAINT "training_assignments_training_id_user_id_period_id_round_key"
  UNIQUE ("training_id", "user_id", "period_id", "round");

-- Round'a göre filter index'i (eğitim detay sayfasında round=N filtre)
CREATE INDEX IF NOT EXISTS "idx_assignments_training_round"
  ON "training_assignments" ("training_id", "round");
