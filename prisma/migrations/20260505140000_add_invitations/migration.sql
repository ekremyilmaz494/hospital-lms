-- ============================================================================
-- Davet Token'ları (Invitation) — link tabanlı hesap aktivasyonu
-- ----------------------------------------------------------------------------
-- Slack/Linear/Notion pattern: davet anında auth user yaratılmaz.
-- Plaintext token mail/URL'de, DB'de SHA-256 hash saklanır.
-- Token 72 saat geçerli, single-use, attempt_count >= 5 → revoke.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(50),
    "title" VARCHAR(100),
    "role" VARCHAR(20) NOT NULL,
    "organization_id" UUID NOT NULL,
    "invited_by_user_id" UUID,
    "set_as_owner" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "accepted_user_id" UUID,
    "revoked_at" TIMESTAMPTZ,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- token_hash unique (lookup hızlı)
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_hash_key" ON "invitations"("token_hash");

-- Owner pending invitation listesi için (organizationId + state filter)
CREATE INDEX IF NOT EXISTS "idx_invitations_org_status" ON "invitations"("organization_id", "accepted_at", "revoked_at");

-- Cleanup cron için (sonra eklenebilir)
CREATE INDEX IF NOT EXISTS "idx_invitations_expires" ON "invitations"("expires_at");

-- "Bu maile son 24 saatte davet gönderildi mi" check için
CREATE INDEX IF NOT EXISTS "idx_invitations_email_org" ON "invitations"("email", "organization_id");

-- ── Foreign Keys ─────────────────────────────────────────────────────────────
-- Org silinirse davetleri de sil (orphan invite anlamsız)
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Davet eden user silinirse davet kalır (audit trail), invited_by NULL olur
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_fkey"
    FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Kabul eden user silinirse davet kalır, accepted_user NULL olur
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_user_id_fkey"
    FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Davet tablosu service_role + public claim endpoint kullanır.
-- Owner'lar kendi org'larındaki bekleyen davetleri görmeli, sıradan admin görmemeli.
-- `service_role`, `authenticated` rolleri ve `auth.uid()` sadece Supabase'de tanımlı —
-- CI shadow DB'sinde `auth` schema yok, o yüzden varlığı kontrol ediliyor.
-- Supabase dışı ortamlarda RLS bloğu skip edilir (policy'ler prod Supabase'de zaten var,
-- migration RLS'i sadece fresh ortam kurulumunda ilk uygular).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE 'ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY';

    -- service_role bypass (default)
    EXECUTE 'DROP POLICY IF EXISTS "service_role_full_access" ON "invitations"';
    EXECUTE 'CREATE POLICY "service_role_full_access" ON "invitations" FOR ALL TO service_role USING (true) WITH CHECK (true)';

    -- Esas Yönetici (org owner) kendi org'undaki davetleri görebilir
    EXECUTE 'DROP POLICY IF EXISTS "owner_select_invitations" ON "invitations"';
    EXECUTE 'CREATE POLICY "owner_select_invitations" ON "invitations" FOR SELECT TO authenticated USING (organization_id IN (SELECT id FROM organizations WHERE owner_user_id = auth.uid()))';

    -- super_admin tüm davetleri görebilir
    EXECUTE 'DROP POLICY IF EXISTS "super_admin_all_invitations" ON "invitations"';
    EXECUTE 'CREATE POLICY "super_admin_all_invitations" ON "invitations" FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = ''super_admin''))';
  END IF;
END $$;
