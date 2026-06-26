-- Medya Kütüphanesini sıfırdan kurma: ContentLibrary ekosistemini kaldır, sade MediaAsset kur.
--
-- VERİ KORUMA (KRİTİK): Bu migration HİÇBİR S3 nesnesine dokunmaz ve org-owned video/ses
-- kayıtlarını yeni media_assets tablosuna TAŞIR (silmez). DROP'lardan ÖNCE INSERT çalışır.
-- Tüm adımlar IF EXISTS / ON CONFLICT ile fresh-DB ve tekrar-çalıştırma güvenli.

-- 1) Yeni tablo: media_assets
CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "media_type" VARCHAR(20) NOT NULL,
    "s3_key" TEXT NOT NULL,
    "mime_type" VARCHAR(100),
    "duration_seconds" INTEGER,
    "file_size_bytes" BIGINT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_media_assets_org_s3key_unique" ON "media_assets"("organization_id", "s3_key");
CREATE INDEX IF NOT EXISTS "idx_media_assets_org_id" ON "media_assets"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_media_assets_org_media_type" ON "media_assets"("organization_id", "media_type");

-- FK'ler — content_library hâlâ dururken eklenebilir (bağımsız tablolar).
DO $$ BEGIN
  ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_fkey"
    FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) VERİ TAŞI (silme DEĞİL) — org-owned video/ses content_library satırları → media_assets.
--    Platform (organization_id IS NULL), AI/quiz/pdf vb. taşınmaz (kullanıcı kararı: yalnız video+ses).
--    content_library tablosu yoksa (fresh DB) bu blok sessizce atlanır.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_library') THEN
    INSERT INTO "media_assets" (id, organization_id, title, description, media_type, s3_key,
                                duration_seconds, file_size_bytes, uploaded_by, created_at, updated_at)
    SELECT gen_random_uuid(), cl.organization_id, cl.title, cl.description,
           cl.content_type,                          -- yalnız 'video' | 'audio'
           cl.s3_key,
           COALESCE(cl.duration, 0) * 60,            -- content_library.duration dakika → saniye
           cl.file_size_bytes, cl.created_by, cl.created_at, CURRENT_TIMESTAMP
    FROM "content_library" cl
    WHERE cl.organization_id IS NOT NULL
      AND cl.s3_key IS NOT NULL
      AND cl.content_type IN ('video', 'audio')
    ON CONFLICT (organization_id, s3_key) DO NOTHING;
  END IF;
END $$;

-- 3) TrainingVideo → MediaAsset soft geri-bağı (silme engellemez, SetNull).
ALTER TABLE "training_videos" ADD COLUMN IF NOT EXISTS "source_media_asset_id" UUID;

DO $$ BEGIN
  ALTER TABLE "training_videos" ADD CONSTRAINT "training_videos_source_media_asset_id_fkey"
    FOREIGN KEY ("source_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_training_videos_source_media_asset" ON "training_videos"("source_media_asset_id");

-- 4) Eski install-takip tablosunu düşür.
DROP TABLE IF EXISTS "organization_content_library" CASCADE;

-- 5) Training'ten kütüphane geri-bağı kolonlarını düşür.
ALTER TABLE "trainings" DROP CONSTRAINT IF EXISTS "trainings_source_library_id_fkey";
ALTER TABLE "trainings" DROP COLUMN IF EXISTS "is_from_library";
ALTER TABLE "trainings" DROP COLUMN IF EXISTS "source_library_id";

-- 6) content_library tablosunu düşür. CASCADE şart: DB'de ai_generations.content_library_id
--    → content_library FK'i var (Prisma modelinde yok, drift artığı). CASCADE bu FK
--    constraint'ini temiz düşürür; ai_generations tablosu/satırları korunur.
DROP TABLE IF EXISTS "content_library" CASCADE;
