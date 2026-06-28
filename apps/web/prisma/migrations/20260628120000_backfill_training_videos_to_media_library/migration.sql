-- Backfill: yöneticinin eğitimlere yüklediği TÜM video/ses dosyalarını Medya Kütüphanesine ekle.
--
-- Kullanıcı isteği (2026-06-28): "yöneticinin eğitimlere yüklediği videoların tamamı da
-- kütüphanede olsun." Rebuild migration'ı (20260626120000) yalnız eski content_library
-- video/ses'ini taşımıştı; bu migration training_videos'taki GERÇEK (çalışan key'li) video/ses
-- içeriğini de media_assets'e ekler ve soft geri-bağ kurar.
--
-- VERİ KORUMA (KRİTİK): Yalnız EKLER (INSERT) + soft geri-bağ kurar (UPDATE source_media_asset_id).
-- HİÇBİR satır veya S3 nesnesi SİLİNMEZ, hiçbir videoKey değişmez (oynatma etkilenmez).
-- Multi-tenant: organization_id daima training'in join'inden gelir → her org yalnız kendi
-- içeriğini alır. Tekrar-çalıştırma ve fresh-DB güvenli (boş training_videos → 0 satır).

-- 1) training_videos (video/audio) → media_assets.
--    DISTINCT ON: aynı (org, video_key) birden çok eğitimde kullanılıyorsa tek kayıt (en eski).
--    ON CONFLICT: zaten media_assets'te olan key'ler (content_library taşıması veya daha önce
--    kütüphaneden seçilmiş videolar) atlanır → çift kayıt olmaz.
--    PDF/doküman (content_type='pdf') HARİÇ — kütüphane yalnız video + ses barındırır.
INSERT INTO "media_assets" (id, organization_id, title, description, media_type, s3_key,
                            mime_type, duration_seconds, file_size_bytes, uploaded_by,
                            created_at, updated_at)
SELECT DISTINCT ON (t.organization_id, tv.video_key)
       gen_random_uuid(),
       t.organization_id,
       tv.title,
       tv.description,
       tv.content_type,                 -- WHERE ile yalnız 'video' | 'audio'
       tv.video_key,
       NULL,                            -- mime_type training_videos'ta tutulmuyor
       tv.duration_seconds,
       tv.file_size_bytes,
       t.created_by,                    -- eğitimi oluşturan (provenance); SetNull FK, dangling olamaz
       tv.created_at,
       CURRENT_TIMESTAMP
FROM "training_videos" tv
JOIN "trainings" t ON t.id = tv.training_id
WHERE tv.video_key IS NOT NULL
  AND tv.video_key <> ''
  AND tv.content_type IN ('video', 'audio')
ORDER BY t.organization_id, tv.video_key, tv.created_at ASC
ON CONFLICT (organization_id, s3_key) DO NOTHING;

-- 2) Soft geri-bağ: her video/ses training_video'yu aynı (org, key) media_asset'ine bağla.
--    Böylece kütüphanede "N eğitimde kullanılıyor" rozeti + silme referans-kontrolü (usageCount)
--    doğru çalışır. source_media_asset_id soft ref (onDelete: SetNull) → silme engellemez,
--    videoKey değişmez → personelin video oynatması etkilenmez.
UPDATE "training_videos" tv
SET source_media_asset_id = ma.id
FROM "media_assets" ma, "trainings" t
WHERE tv.training_id = t.id
  AND ma.organization_id = t.organization_id
  AND ma.s3_key = tv.video_key
  AND tv.content_type IN ('video', 'audio')
  AND tv.source_media_asset_id IS NULL;
