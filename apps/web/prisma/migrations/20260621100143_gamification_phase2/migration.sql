-- Oyunlaştırma Faz 2 — Puan / Streak / Rozet. SMG'den TAMAMEN AYRIDIR.

-- CreateTable
CREATE TABLE "point_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "ref_id" UUID,
    "points" INTEGER NOT NULL,
    "dedup_key" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streaks" (
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "last_active_date" DATE,
    "freezes_left" INTEGER NOT NULL DEFAULT 2,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "tier" VARCHAR(10) NOT NULL,
    "icon" VARCHAR(40) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "threshold_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "earned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id","badge_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "point_ledger_dedup_key_key" ON "point_ledger"("dedup_key");

-- CreateIndex
CREATE INDEX "idx_point_ledger_user" ON "point_ledger"("user_id");

-- CreateIndex
CREATE INDEX "idx_point_ledger_user_event" ON "point_ledger"("user_id", "event_type");

-- CreateIndex
CREATE INDEX "idx_point_ledger_org" ON "point_ledger"("organization_id");

-- CreateIndex
CREATE INDEX "idx_user_streak_org" ON "user_streaks"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_code_key" ON "badges"("code");

-- CreateIndex
CREATE INDEX "idx_user_badge_user" ON "user_badges"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_badge_org" ON "user_badges"("organization_id");

-- AddForeignKey
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- DATA: Rozet katalog seed (idempotent). İkonlar mobil izinli setten.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO "badges" ("id","code","tier","icon","title","threshold_json","is_active","sort_order") VALUES
  (gen_random_uuid(), 'first_review', 'bronze', 'sparkles',             'İlk Tekrar',        '{"type":"event_count","eventType":"daily_review","value":1}'::jsonb, true, 1),
  (gen_random_uuid(), 'points_100',   'bronze', 'star.fill',            '100 Puan',          '{"type":"points","value":100}'::jsonb,                               true, 2),
  (gen_random_uuid(), 'points_500',   'silver', 'medal.fill',           '500 Puan',          '{"type":"points","value":500}'::jsonb,                               true, 3),
  (gen_random_uuid(), 'points_1000',  'gold',   'trophy.fill',          '1000 Puan',         '{"type":"points","value":1000}'::jsonb,                              true, 4),
  (gen_random_uuid(), 'streak_7',     'silver', 'flame.fill',           '7 Günlük Seri',     '{"type":"streak_longest","value":7}'::jsonb,                         true, 5),
  (gen_random_uuid(), 'streak_30',    'gold',   'flame.fill',           '30 Günlük Seri',    '{"type":"streak_longest","value":30}'::jsonb,                        true, 6),
  (gen_random_uuid(), 'first_pass',   'bronze', 'checkmark.seal.fill',  'İlk Sınav Geçişi',  '{"type":"event_count","eventType":"exam_pass","value":1}'::jsonb,    true, 7)
ON CONFLICT ("code") DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- DATA: Faz 1 günlük-review puanlarını point_ledger'a backfill (idempotent).
-- daily_submissions Faz 1'de puan kaydıydı; Faz 2'de kanonik kaynak point_ledger.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO "point_ledger" ("id","user_id","organization_id","event_type","ref_id","points","dedup_key","created_at")
SELECT gen_random_uuid(), ds."user_id", ds."organization_id", 'daily_review', ds."submission_id",
       ds."points_awarded", 'daily_review:'||ds."submission_id", ds."created_at"
FROM "daily_submissions" ds
ON CONFLICT ("dedup_key") DO NOTHING;
