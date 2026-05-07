-- ============================================================================
-- TC Kimlik No alanlarını invitations tablosuna ekle
-- ----------------------------------------------------------------------------
-- Esas yönetici (owner) ve admin daveti akışında TC bilgisi davet anında alınır;
-- davet kabul edildiğinde User tablosuna kopyalanır (createAuthUser ile).
--
-- KVKK:
--   tc_encrypted: AES-256-GCM ciphertext (görüntüleme için decrypt)
--   tc_hash:     HMAC-SHA256 (organizationId + tcHash unique check için)
--
-- Davet'te composite unique YOK — bir personel iptal edilen davet sonrası
-- yeniden davet edilebilir, açık davet sayısı invitation.acceptedAt/revokedAt
-- üzerinden zaten kontrol ediliyor (mevcut akış).
-- ============================================================================

ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "tc_encrypted" TEXT;
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "tc_hash" VARCHAR(64);
