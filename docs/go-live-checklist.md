# Go-Live Kontrol Listesi

> Hospital LMS — Production'a Gecis Oncesi Kontrol Listesi
> Son guncelleme: 2026-04-05

---

## A. Guvenlik

- [ ] Middleware tum korunmasi gereken route'lari kapsiyor (`src/lib/supabase/middleware.ts`)
- [ ] Supabase Auth JWT dogrulamasi aktif
- [ ] Rol bazli erisim kontrolleri tum API route'larinda mevcut (`requireRole`)
- [ ] Row Level Security (RLS) tum tablolarda aktif (`scripts/apply-rls.js` calistirildi)
- [ ] Rate limiting kritik endpoint'lerde aktif (login, signup, exam submit)
- [ ] CORS ayarlari sadece `NEXT_PUBLIC_APP_URL` ile sinirli
- [ ] Content Security Policy (CSP) header'lari `next.config.ts`'de tanimli
- [ ] HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff aktif
- [ ] Tum secret'lar environment variable'larda, kodda hardcoded deger yok
- [ ] `scripts/secret-scanner.js` pre-commit hook aktif (Husky)
- [ ] `service_role_key` sadece sunucu tarafinda kulllaniliyor, client'a expose edilmiyor
- [ ] Supabase anon key sadece public islemler icin kullaniliyor
- [ ] API route'larda input sanitizasyonu ve Zod validasyonu mevcut
- [ ] Dosya upload boyut limitleri kontrol edildi (512MB video limiti)
- [ ] SQL injection korumalari — Prisma parametreli sorgular kullaniliyor

## B. Veritabani

- [ ] Tum Prisma migration'lari calistirildi: `pnpm db:migrate`
- [ ] Prisma client generate edildi: `pnpm db:generate`
- [ ] Indeksler kontrol edildi (ozellikle `organizationId` iceren tablolar)
- [ ] RLS politikalari uygulanidi: `node scripts/apply-rls.js` veya `supabase-rls.sql`
- [ ] Otomatik yedekleme cron job'i aktif (`/api/cron/backup` — 03:15 UTC)
- [ ] Yedekleme dogrulama (verified) calisiyor
- [ ] Supabase point-in-time recovery aktif (Pro plan gerekli)
- [ ] Connection pooling ayarlari kontrol edildi (Supabase PgBouncer)
- [ ] Stale veri temizleme cron job'i aktif (`/api/cron/cleanup` — 03:00 UTC)

## C. Altyapi

### Vercel
- [ ] Production deployment basarili: `pnpm build`
- [ ] Frankfurt (`fra1`) bolgesi secili
- [ ] Custom domain bagli
- [ ] Environment variable'lar tamamlandi (asagidaki listeye bak)
- [ ] Vercel Cron Jobs konfigurasyonu (`vercel.json`)
- [ ] Function timeout yeterli (Hobby: 10s, Pro: 60s)
- [ ] Edge middleware dogru calisiyor

### Environment Variables
- [ ] `DATABASE_URL` — Supabase PostgreSQL
- [ ] `DIRECT_URL` — Supabase direct connection (migration icin)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- [ ] `AWS_CLOUDFRONT_DOMAIN`, `AWS_CLOUDFRONT_KEY_PAIR_ID`, `AWS_CLOUDFRONT_PRIVATE_KEY`
- [ ] `REDIS_URL`, `REDIS_TOKEN`
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- [ ] `CRON_SECRET`
- [ ] `NEXT_PUBLIC_APP_URL` (production domain)
- [ ] `SENTRY_DSN` (varsa)

### S3 & CloudFront
- [ ] S3 bucket olusturuldu ve erisim politikasi dogru
- [ ] CloudFront distribution aktif ve SSL sertifikasi gecerli
- [ ] Signed URL / Presigned upload calisiyor
- [ ] CORS politikasi S3 bucket'ta tanimli
- [ ] S3 Lifecycle Policy — eski yedekler icin otomatik silme (90 gun)

### Redis (Upstash)
- [ ] Redis instance olusturuldu
- [ ] Sinav zamanlayici calisiyor
- [ ] Rate limiting calisiyor
- [ ] Cache mekanizmasi aktif (dashboard vb.)

### SMTP
- [ ] E-posta gonderimleri test edildi (kayit, sifre sifirlama, bildirimler)
- [ ] SPF, DKIM, DMARC kayitlari tanimli
- [ ] Gonderici adresi dogru: `SMTP_FROM`

### Sentry (Hata Izleme)
- [ ] Sentry projesi olusturuldu
- [ ] DSN environment variable eklendi
- [ ] Source map'ler yuklendi
- [ ] Hata bildirimleri test edildi

## D. DNS & Domain

- [ ] Production domain'i alindi ve DNS ayarlari yapildi
- [ ] Vercel'e custom domain eklendi
- [ ] SSL sertifikasi otomatik olarak aktif (Vercel Let's Encrypt)
- [ ] www → non-www (veya tersi) redirect tanimli
- [ ] MX kayitlari e-posta hizmeti icin dogru

## E. Ilk Veriler

- [ ] Super Admin hesabi olusturuldu (Supabase Auth + `users` tablosu)
- [ ] Abonelik planlari tanimlandi (`subscription_plans` tablosu)
- [ ] Demo hastane olusturuldu ve test edildi (istege bagli)
- [ ] Varsayilan egitim kategorileri tanimlandi
- [ ] Sistem bildirimleri sablonlari kontrol edildi

## F. Yasal

- [ ] Kullanim Kosullari sayfasi yayinda (`/terms`)
- [ ] Gizlilik Politikasi sayfasi yayinda (`/privacy`)
- [ ] KVKK Aydinlatma Metni hazirlandi ve yayinda
- [ ] KVKK veri isleme envantesi hazirlandi
- [ ] Cookie (cerez) onay banner'i aktif
- [ ] Kisisel veri silme (KVKK hak talebi) mekanizmasi calisiyor
- [ ] Veri isleme sozlesmesi (hastaneler icin) hazir

## G. Izleme

- [ ] Sentry hata izleme aktif ve bildirimler ayarli
- [ ] Health check endpoint'i mevcut (`/api/health` veya benzeri)
- [ ] Uptime monitoring servisi bagli (UptimeRobot, Better Uptime vb.)
- [ ] Cron job basarisizlik bildirimleri aktif
- [ ] Yedekleme dogrulama basarisizliklari icin alert mekanizmasi
- [ ] Vercel Analytics veya Web Vitals izleme aktif

## H. Performans

- [ ] Lighthouse skoru kontrol edildi (Performance > 80, Accessibility > 90)
- [ ] API response sureleri kabul edilebilir duzeyde (< 500ms ortalama)
- [ ] Dashboard API cache mekanizmasi aktif (Redis, 5 dk TTL)
- [ ] Buyuk ktuphane optimizasyonu: `optimizePackageImports` (`next.config.ts`)
- [ ] Gorsel optimizasyonu: Next.js Image bilesenileri kullaniliyor
- [ ] Video streaming performansi test edildi (CloudFront CDN)
- [ ] Load test yapildi (en az 50 es zamanli kullanici)
- [ ] Bundle analizi yapildi (`@next/bundle-analyzer`)
- [ ] `useFetch` timeout degerleri uygun (20000ms)

## I. Test

- [ ] Unit testler gecti: `pnpm test`
- [ ] E2E testler gecti: `pnpm test:e2e`
- [ ] Manuel test: Super Admin paneli tum islevler
- [ ] Manuel test: Hastane Admin paneli tum islevler
- [ ] Manuel test: Personel paneli tum islevler
- [ ] Manuel test: Sinav akisi (on sinav → video → sinav → sonuc)
- [ ] Manuel test: Sertifika olusturma ve indirme
- [ ] Manuel test: Excel/PDF export
- [ ] Manuel test: Bildirim sistemi (realtime)
- [ ] Mobil test: iOS Safari
- [ ] Mobil test: Android Chrome
- [ ] Tarayici testi: Chrome, Firefox, Safari, Edge
- [ ] PWA kurulumu test edildi (mobil)
- [ ] Karanlik tema test edildi

## J. Iletisim & Destek

- [ ] Destek e-posta adresi tanimli ve calisiyor
- [ ] Hata bildirim mekanizmasi kullanicilara acik
- [ ] Kullanici kilavuzu / yardim dokumanlari hazir
- [ ] Admin icin egitim/onboarding materyali hazir
- [ ] Teknik dokumantasyon guncel (API, deployment, DR plani)
- [ ] Iletisim formu veya canli destek entegrasyonu (istege bagli)

## K. Son Kontroller

- [ ] `pnpm build` hatasiz tamamlandi
- [ ] Browser console'da hata yok (tum paneller kontrol edildi)
- [ ] Tum environment variable'lar production degerlerine ayarlandi
- [ ] Git tag olusturuldu: `git tag -a v1.0.0 -m "Production release v1.0.0"`
- [ ] Deployment sonrasi smoke test yapildi
- [ ] Rollback plani hazir (onceki deployment'a donme proseduru)
- [ ] Felaket kurtarma plani gozden gecirildi (`docs/disaster-recovery.md`)
- [ ] Tum ekip uyelerine go-live bildirimi yapildi
- [ ] Ilk 24 saat izleme plani belirlendi (kim, ne zaman, ne kontrol edecek)
