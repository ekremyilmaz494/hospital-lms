-- Content Library: storage quota tracking + duplicate s3Key koruması
--
-- 1) fileSizeBytes kolonu (BigInt, nullable) — yeni yüklemeler için byte cinsi
--    boyut. Geçmiş kayıtlarda NULL kalır (quota hesabında 0 sayılır). İleride
--    cron'la S3 head'leme ile geri doldurulabilir.
-- 2) (organization_id, s3_key) kompozit unique — aynı dosyanın aynı kuruma
--    iki kez yüklenmesini DB seviyesinde engeller. Postgres NULL semantiği
--    sayesinde s3_key=NULL olan metadata-only kayıtlar (AI quiz vb.) constraint
--    dışında kalır. organization_id=NULL (platform içerikleri) için super-admin
--    upload'ı zaten farklı bir path izler ve bu indeks aynı s3_key'in iki kez
--    yazılmasını yine engeller.

-- Idempotent uygulama — fresh DB ile mevcut DB'de aynı çalışır.
ALTER TABLE "content_library"
  ADD COLUMN IF NOT EXISTS "file_size_bytes" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_content_library_org_s3key_unique'
  ) THEN
    CREATE UNIQUE INDEX "idx_content_library_org_s3key_unique"
      ON "content_library" ("organization_id", "s3_key");
  END IF;
END $$;
