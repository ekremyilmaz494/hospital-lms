-- SmgTarget unique constraint fix
--
-- Sorun: Önceki "idx_smg_targets_unique" (period_id, unvan, user_id) PostgreSQL'de
-- NULL != NULL olduğu için aynı satırın defalarca eklenmesine izin veriyordu.
-- Örn: (period1, NULL, NULL) ve (period1, NULL, NULL) aynı tabloda yan yana olabilir.
--
-- Çözüm: 3 adet partial unique index — her senaryo için ayrı ayrı benzersizlik sağlar:
--   1. Dönemin varsayılan hedefi (unvan=NULL AND user_id=NULL) → dönem başına tek satır
--   2. Unvan bazlı hedef (unvan NOT NULL, user_id=NULL) → her (dönem, unvan) için tek satır
--   3. Kişiye özel hedef (user_id NOT NULL) → her (dönem, kullanıcı) için tek satır

DROP INDEX IF EXISTS "idx_smg_targets_unique";

CREATE UNIQUE INDEX "idx_smg_targets_default"
  ON "smg_targets"("period_id")
  WHERE "unvan" IS NULL AND "user_id" IS NULL;

CREATE UNIQUE INDEX "idx_smg_targets_by_unvan"
  ON "smg_targets"("period_id", "unvan")
  WHERE "unvan" IS NOT NULL AND "user_id" IS NULL;

CREATE UNIQUE INDEX "idx_smg_targets_by_user"
  ON "smg_targets"("period_id", "user_id")
  WHERE "user_id" IS NOT NULL;
