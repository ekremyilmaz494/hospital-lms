-- B2 — Ayarlar → Bildirim sekmesi tercihlerinin kalıcılaştırılması.
-- Eskiden bu 4 alan UI'da değiştirilip "Kaydet" deniyordu ama settings PUT şeması onları
-- strip ediyordu ve Organization'da kolon yoktu → sessiz veri kaybı (dead-state).
-- Hepsi DEFAULT'lu NOT NULL → mevcut satırlar otomatik default alır.
-- IF NOT EXISTS → fresh DB'de ve tekrar çalıştırmada güvenli.

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "email_notifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "reminder_days_before" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "notify_on_complete" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "notify_on_fail" BOOLEAN NOT NULL DEFAULT true;
