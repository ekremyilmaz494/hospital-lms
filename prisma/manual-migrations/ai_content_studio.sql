-- AI İÇERİK STÜDYOSU — Manual Migration
-- ================================================================
-- Sadece YENİ tablo ekler. Mevcut hiçbir tabloya/kolona dokunmaz.
-- Geri alma: DROP TABLE ai_generations, ai_notebook_accounts CASCADE;
--
-- Uygulama:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Bu dosyanın tüm içeriğini yapıştır
--   3. Run
--   4. Tablolar oluştuktan sonra `pnpm prisma generate` ile TS tipleri güncellenir
-- ================================================================

BEGIN;

-- ── ai_notebook_accounts: Per-org NotebookLM Google hesabı ──
CREATE TABLE IF NOT EXISTS ai_notebook_accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL UNIQUE,
  storage_state_encrypted  TEXT NOT NULL,
  google_email             VARCHAR(255),
  connected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at         TIMESTAMPTZ,
  last_used_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ai_notebook_accounts_org_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- ── ai_generations: AI üretim geçmişi ──
CREATE TABLE IF NOT EXISTS ai_generations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL,
  created_by_id     UUID NOT NULL,
  artifact_type     VARCHAR(20) NOT NULL,
  prompt            TEXT,
  source_files      JSONB,
  source_urls       TEXT[] NOT NULL DEFAULT '{}',
  options           JSONB,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  worker_job_id     VARCHAR(100),
  s3_key            TEXT,
  file_size         INTEGER,
  mime_type         VARCHAR(100),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,

  CONSTRAINT ai_generations_org_fk
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT ai_generations_user_fk
    FOREIGN KEY (created_by_id) REFERENCES users(id),
  CONSTRAINT ai_generations_artifact_type_check
    CHECK (artifact_type IN ('audio','video','slide_deck','infographic','report','mind_map','data_table','quiz','flashcards')),
  CONSTRAINT ai_generations_status_check
    CHECK (status IN ('pending','processing','completed','failed'))
);

CREATE INDEX IF NOT EXISTS idx_ai_gen_org_status_created
  ON ai_generations (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_gen_org_user_created
  ON ai_generations (organization_id, created_by_id, created_at DESC);

-- ── RLS POLICIES ──

ALTER TABLE ai_notebook_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_ai_notebook_accounts_all" ON ai_notebook_accounts FOR ALL USING (
  (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
);

CREATE POLICY "super_admin_ai_notebook_accounts_all" ON ai_notebook_accounts FOR ALL USING (
  (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_ai_generations_all" ON ai_generations FOR ALL USING (
  (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
  AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
);

CREATE POLICY "super_admin_ai_generations_all" ON ai_generations FOR ALL USING (
  (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);

COMMIT;

-- ── Doğrulama ──
-- Tabloların oluştuğunu kontrol et:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('ai_notebook_accounts','ai_generations');
-- 2 satır dönmeli.
