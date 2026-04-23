-- AI İçerik Stüdyosu modülü tamamen kaldırıldı.
-- ai_generations → ai_notebook_sources → ai_notebooks → ai_google_connections
-- sırasıyla drop ediliyor (FK bağımlılıkları nedeniyle).

DROP TABLE IF EXISTS "ai_generations" CASCADE;
DROP TABLE IF EXISTS "ai_notebook_sources" CASCADE;
DROP TABLE IF EXISTS "ai_notebooks" CASCADE;
DROP TABLE IF EXISTS "ai_google_connections" CASCADE;

-- SubscriptionPlan feature-flag kolonu
ALTER TABLE "subscription_plans" DROP COLUMN IF EXISTS "has_ai_content_studio";
