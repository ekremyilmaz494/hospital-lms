-- ============================================================================
-- TC Kimlik No alanlarını users tablosuna ekle
-- ----------------------------------------------------------------------------
-- KVKK gereği TC değerleri DB'de plaintext tutulamaz:
--   tc_encrypted: AES-256-GCM ciphertext (görüntüleme/decrypt için)
--   tc_hash:     HMAC-SHA256 (lookup/duplicate-check için, deterministic)
--
-- Composite unique (org+tcHash):
--   - Aynı TC iki farklı kurumda olabilir (doktor 2 hastanede çalışır).
--   - Subdomain → orgId middleware'den geldiği için TC her zaman bir org
--     scope'unda aranır (cross-org leak yok).
--
-- NULL davranışı:
--   - PostgreSQL UNIQUE INDEX'te NULL'lar her zaman ayrı sayılır → eski TC'siz
--     kullanıcılar bu constraint'i ihlal etmez.
-- ============================================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tc_encrypted" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tc_hash" VARCHAR(64);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tc_added_at" TIMESTAMPTZ;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tc_added_by" UUID;

-- Org içinde TC unique olmalı; eklemeden ÖNCE eski idempotent çalışmayı garantile
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_org_tc_unique"
    ON "users"("organization_id", "tc_hash");

-- TC ile login lookup için (WHERE tc_hash = ?)
CREATE INDEX IF NOT EXISTS "idx_users_tc_hash" ON "users"("tc_hash");
