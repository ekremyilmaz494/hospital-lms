-- ContactMessage: pazarlama atfı (UTM + açılış yolu + referrer host).
-- IF NOT EXISTS: tekrar çalıştırılabilir; tablo zaten RLS'li (super_admin_contact_messages_all),
-- yeni kolonlar mevcut politika kapsamında.
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "landing_path" VARCHAR(300),
ADD COLUMN IF NOT EXISTS "referrer_host" VARCHAR(200),
ADD COLUMN IF NOT EXISTS "utm_campaign" VARCHAR(150),
ADD COLUMN IF NOT EXISTS "utm_content" VARCHAR(150),
ADD COLUMN IF NOT EXISTS "utm_medium" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "utm_source" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "utm_term" VARCHAR(150);
