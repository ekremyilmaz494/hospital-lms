-- Drift fix: 20260515150000_training_assignment_rounds.sql line 24'te eski
-- 3-kolonlu unique için DROP CONSTRAINT IF EXISTS kullanılmış, ama
-- 20260505120000_add_training_periods.sql line 84'te bu kısıt CONSTRAINT
-- olarak değil CREATE UNIQUE INDEX olarak yaratılmıştı. DROP CONSTRAINT
-- bir INDEX'i bulamadığı için no-op oldu; eski 3-kolonlu unique INDEX
-- prod/local DB'de hâlâ ayakta. Sonuç:
--
--   1) CI migration drift check fail eder (schema 4-kolonlu unique ister,
--      migration replay'i 3-kolonlu unique de bırakır).
--   2) Production bug: aynı (training, user, period) için round=2+ atama
--      INSERT'ü unique violation alır → 2. Atama (Tekrar Tur) feature'ı
--      production'da hiç tetiklenmemiş olabilir.
--
-- Bu migration DROP INDEX IF EXISTS ile idempotent: eski index varsa
-- düşürür, yoksa no-op. Yeni 4-kolonlu unique zaten önceki migration
-- tarafından yaratıldı (training_assignments_training_id_user_id_period_id_round_key).

DROP INDEX IF EXISTS "training_assignments_training_id_user_id_period_id_key";
