-- HIS (Hastane Bilgi Sistemi) entegrasyonu kaldırıldı.
-- Jenerik REST konnektörüydü; hiçbir gerçek HIS'e bağlanıp prod'da kullanılmadı.
-- Bağımlı tablolar, feature-gate kolonu ve user.his_external_id alanı düşürülüyor.
-- IF EXISTS → fresh DB'de ve tekrar çalıştırmada güvenli.

-- 1. Senkronizasyon logları (his_integrations'a FK ile bağlı → önce bu düşer)
DROP TABLE IF EXISTS "sync_logs";

-- 2. HIS entegrasyon konfigürasyonu
DROP TABLE IF EXISTS "his_integrations";

-- 3. Abonelik planındaki feature-gate kolonu
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "has_his_integration";

-- 4. User → HIS dış kimlik eşlemesi (index önce, sonra kolon)
DROP INDEX IF EXISTS "idx_users_his_external_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "his_external_id";
