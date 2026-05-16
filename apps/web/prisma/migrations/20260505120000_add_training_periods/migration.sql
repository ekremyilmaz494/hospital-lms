-- ─────────────────────────────────────────────────────────────────────
-- Training Periods (Yıllık Eğitim Dönemleri)
-- ─────────────────────────────────────────────────────────────────────
-- Hastaneler için takvim yılı (1 Oca – 31 Ara) bazlı eğitim döngüsü.
-- SKS / JCI / İSG yasal raporlama takvim yılına göre yapılır.
-- ─────────────────────────────────────────────────────────────────────

-- 1) users.hire_date — işe başlama tarihi (yıl içi başlayan personel için)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hire_date" timestamptz;

-- 2) training_periods tablosu
CREATE TABLE IF NOT EXISTS "training_periods" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" uuid NOT NULL,
    "year" integer NOT NULL,
    "label" varchar(100) NOT NULL,
    "start_date" timestamptz NOT NULL,
    "end_date" timestamptz NOT NULL,
    "status" varchar(20) NOT NULL DEFAULT 'upcoming',
    "is_default" boolean NOT NULL DEFAULT true,
    "closed_at" timestamptz,
    "closed_by" uuid,
    "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_periods_pkey" PRIMARY KEY ("id")
);

-- Org başına aynı yıl tek period
CREATE UNIQUE INDEX IF NOT EXISTS "training_periods_organization_id_year_key"
    ON "training_periods" ("organization_id", "year");

-- Org bazlı status sorguları için
CREATE INDEX IF NOT EXISTS "idx_periods_org_status"
    ON "training_periods" ("organization_id", "status");

-- KRİTİK: Org başına yalnızca 1 'active' period — partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_period_per_org"
    ON "training_periods" ("organization_id") WHERE "status" = 'active';

-- FK: organization
ALTER TABLE "training_periods"
    ADD CONSTRAINT "training_periods_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: closed_by (user nullable)
ALTER TABLE "training_periods"
    ADD CONSTRAINT "training_periods_closed_by_fkey"
    FOREIGN KEY ("closed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Mevcut org'lar için 2026 default period (BACKFILL)
INSERT INTO "training_periods" ("organization_id", "year", "label", "start_date", "end_date", "status", "is_default")
SELECT id, 2026, '2026 Eğitim Dönemi',
       '2026-01-01 00:00:00+03'::timestamptz,
       '2026-12-31 23:59:59+03'::timestamptz,
       'active',
       true
FROM "organizations"
ON CONFLICT ("organization_id", "year") DO NOTHING;

-- 4) training_assignments.period_id (nullable migration sırasında)
ALTER TABLE "training_assignments" ADD COLUMN IF NOT EXISTS "period_id" uuid;

-- Mevcut atamaları aktif period'a backfill
UPDATE "training_assignments" ta
SET period_id = tp.id
FROM "trainings" t, "training_periods" tp
WHERE ta.training_id = t.id
  AND tp.organization_id = t.organization_id
  AND tp.status = 'active'
  AND ta.period_id IS NULL;

-- FK: period
ALTER TABLE "training_assignments"
    ADD CONSTRAINT "training_assignments_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "training_periods"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) Composite unique migration: (training_id, user_id) → (training_id, user_id, period_id)
-- NOT: Eski init migration unique'i CREATE UNIQUE INDEX ile yarattı (constraint
-- değil), bu yüzden DROP CONSTRAINT no-op olur — DROP INDEX ile düşürmek şart.
CREATE UNIQUE INDEX IF NOT EXISTS "training_assignments_training_id_user_id_period_id_key"
    ON "training_assignments" ("training_id", "user_id", "period_id");

DROP INDEX IF EXISTS "training_assignments_training_id_user_id_key";

CREATE INDEX IF NOT EXISTS "idx_assignments_period"
    ON "training_assignments" ("period_id");

-- 6) certificates.period_id (opsiyonel raporlama için)
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "period_id" uuid;

ALTER TABLE "certificates"
    ADD CONSTRAINT "certificates_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "training_periods"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_certificates_period"
    ON "certificates" ("period_id");

-- NOT: RLS politikaları `supabase-rls.sql` içinde tanımlı; migration'a dahil
-- DEĞİL çünkü `auth.jwt()` Supabase'e özgü ve CI shadow DB'de `auth` schema yok
-- (P3006'ya yol açar). Deploy: `node scripts/apply-rls.js` ile uygulanır.
