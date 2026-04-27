-- AI İÇERİK STÜDYOSU v2 — NotebookLM entegrasyonu
-- ================================================================
-- Önceki AI modülü (ai_notebooks/ai_notebook_sources/ai_generations/
-- ai_google_connections) `20260423170000_drop_ai_content_studio` ile
-- kaldırılmıştı. Bu migration yeni minimal şemayı (per-org NotebookLM
-- session + üretim history) ekler.
--
-- Worker servisi (packages/notebook-worker, Fly.io) bu tabloları okur.
-- Bkz. AI_CONTENT_STUDIO_SETUP.md
-- ================================================================

-- ── ai_notebook_accounts: Per-org NotebookLM Google hesabı ──
CREATE TABLE IF NOT EXISTS "ai_notebook_accounts" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"          UUID NOT NULL UNIQUE,
  "storage_state_encrypted"  TEXT NOT NULL,
  "google_email"             VARCHAR(255),
  "connected_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_verified_at"         TIMESTAMPTZ,
  "last_used_at"             TIMESTAMPTZ,
  "created_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_notebook_accounts_org_fk'
  ) THEN
    ALTER TABLE "ai_notebook_accounts"
      ADD CONSTRAINT "ai_notebook_accounts_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ai_generations: AI üretim geçmişi ──
CREATE TABLE IF NOT EXISTS "ai_generations" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"   UUID NOT NULL,
  "created_by_id"     UUID NOT NULL,
  "artifact_type"     VARCHAR(20) NOT NULL,
  "prompt"            TEXT,
  "source_files"      JSONB,
  "source_urls"       TEXT[] NOT NULL DEFAULT '{}',
  "options"           JSONB,
  "status"            VARCHAR(20) NOT NULL DEFAULT 'pending',
  "worker_job_id"     VARCHAR(100),
  "s3_key"            TEXT,
  "file_size"         INTEGER,
  "mime_type"         VARCHAR(100),
  "error_message"     TEXT,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at"      TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_generations_org_fk') THEN
    ALTER TABLE "ai_generations"
      ADD CONSTRAINT "ai_generations_org_fk"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_generations_user_fk') THEN
    ALTER TABLE "ai_generations"
      ADD CONSTRAINT "ai_generations_user_fk"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_generations_artifact_type_check') THEN
    ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_artifact_type_check"
      CHECK ("artifact_type" IN ('audio','video','slide_deck','infographic','report','mind_map','data_table','quiz','flashcards'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_generations_status_check') THEN
    ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_status_check"
      CHECK ("status" IN ('pending','processing','completed','failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_ai_gen_org_status_created"
  ON "ai_generations" ("organization_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_ai_gen_org_user_created"
  ON "ai_generations" ("organization_id", "created_by_id", "created_at" DESC);

-- ── RLS POLICIES ──
-- `auth.jwt()` sadece Supabase'de tanımlı. CI shadow DB'sinde auth schema yok.
-- DO/EXECUTE wrap compile-time parsing'i atlatır → shadow DB skip,
-- Supabase'de gerçek policy yaratılır (add_sms_mfa pattern).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE 'ALTER TABLE "ai_notebook_accounts" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "ai_generations" ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_notebook_accounts' AND policyname = 'admin_ai_notebook_accounts_all') THEN
      EXECUTE $policy$
        CREATE POLICY "admin_ai_notebook_accounts_all" ON "ai_notebook_accounts" FOR ALL USING (
          (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
          AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        )
      $policy$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_notebook_accounts' AND policyname = 'super_admin_ai_notebook_accounts_all') THEN
      EXECUTE $policy$
        CREATE POLICY "super_admin_ai_notebook_accounts_all" ON "ai_notebook_accounts" FOR ALL USING (
          (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
        )
      $policy$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_generations' AND policyname = 'admin_ai_generations_all') THEN
      EXECUTE $policy$
        CREATE POLICY "admin_ai_generations_all" ON "ai_generations" FOR ALL USING (
          (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
          AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        )
      $policy$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_generations' AND policyname = 'super_admin_ai_generations_all') THEN
      EXECUTE $policy$
        CREATE POLICY "super_admin_ai_generations_all" ON "ai_generations" FOR ALL USING (
          (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
        )
      $policy$;
    END IF;
  END IF;
END $$;
