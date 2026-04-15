# Staging Ortamı Kurulum Rehberi

> Hospital LMS için Vercel + Supabase ile ayrı bir staging ortamı nasıl kurulur.
> Süre: ilk kurulum ~45 dakika, ondan sonra sıfır bakım.

## İçindekiler

1. [Neden staging?](#neden-staging)
2. [Mimari](#mimari)
3. [Önkoşullar](#önkoşullar)
4. [Adım 1 — Supabase staging projesi](#adım-1--supabase-staging-projesi)
5. [Adım 2 — Staging branch'i](#adım-2--staging-branchi)
6. [Adım 3 — Vercel staging environment](#adım-3--vercel-staging-environment)
7. [Adım 4 — S3 staging bucket](#adım-4--s3-staging-bucket)
8. [Adım 5 — Redis staging database](#adım-5--redis-staging-database)
9. [Adım 6 — Staging'e deploy](#adım-6--staginge-deploy)
10. [Adım 7 — Seed data](#adım-7--seed-data)
11. [Adım 8 — Smoke test](#adım-8--smoke-test)
12. [Günlük kullanım akışı](#günlük-kullanım-akışı)
13. [Sorun giderme](#sorun-giderme)
14. [Maliyet özeti](#maliyet-özeti)

---

## Neden staging?

**Problem:** Şu an yalnızca iki ortam var:

| Ortam | URL | Veritabanı | Risk |
|-------|-----|-----------|------|
| Development | localhost:3000 | Local veya Supabase dev | — |
| Production | Vercel canlı | Supabase Frankfurt | **Müşteri verisi** |

Yeni özellik veya migration canlıya doğrudan gönderiliyor. Bir hata = 102 kullanıcının bozulması (geçmişte yaşandı).

**Çözüm:** Araya staging koy — production ile **birebir aynı** ama müşteri verisi olmayan bir ortam.

**Kullanım senaryoları:**
- Müşteri adayına "test hesabı" açmak (production'a dokunmadan)
- Yeni migration'ı canlıya atmadan önce gerçek DB'de denemek
- HIS entegrasyonunu müşterinin dev API'si ile test etmek
- QA ekibi / dış denetçi için erişilebilir demo
- E2E testlerini gerçek DB ile çalıştırmak

---

## Mimari

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│  DEVELOPMENT        │      │  STAGING             │      │  PRODUCTION         │
│  localhost:3000     │ ───▶ │  staging.*.vercel    │ ───▶ │  canlı URL          │
│                     │      │                      │      │                     │
│  Git branch: feat/* │      │  Git branch: staging │      │  Git branch: main   │
│  Supabase: local/dev│      │  Supabase: staging   │      │  Supabase: prod-eu  │
│  S3 bucket: dev     │      │  S3 bucket: staging  │      │  S3 bucket: prod    │
│  Redis: dev         │      │  Redis: staging      │      │  Redis: prod        │
└─────────────────────┘      └──────────────────────┘      └─────────────────────┘
```

**Kritik kural:** **Üç ortam birbirinden tamamen izole.** Staging'in Supabase'i production'ın verisini göremez, göremezdir.

---

## Önkoşullar

- [ ] Vercel hesabına admin erişim (proje settings düzenlenebilir)
- [ ] Supabase organization'a owner erişim (yeni proje kurmak için)
- [ ] AWS konsol erişim (S3 bucket oluşturmak için) — opsiyonel, aynı bucket'a farklı prefix de olur
- [ ] Upstash hesabı (ücretsiz plan yeterli)
- [ ] Git branch oluşturma yetkisi

---

## Adım 1 — Supabase staging projesi

Supabase ücretsiz planı **organization başına 2 aktif proje** veriyor. Şu an sadece `hospital-lms-eu` (production) aktif — ikincisini staging için kullanabiliriz.

**Alternatif: Supabase Branching** (beta, $10/ay). Tek projeye dallanan migration branch'leri. Daha temiz ama henüz beta. Bu rehber **ayrı proje** yaklaşımını kullanır.

1. https://supabase.com/dashboard → "New project"
2. **Name:** `hospital-lms-staging`
3. **Region:** `eu-central-1` (Frankfurt — production ile aynı)
4. **Database password:** Güçlü bir şifre üret ve **1Password/Bitwarden**'a kaydet
5. Proje oluşturulunca → **Settings → Database → Connection string**'leri al:
   - `DATABASE_URL` (Session pooler, port 5432, prisma migrate için zorunlu — `project_prisma_direct_url` memory'sine bakın)
   - `DIRECT_URL` (IPv6-only `db.xxx.supabase.co`, port 5432)

6. **Migrasyonları uygula:**
   ```bash
   # Geçici olarak .env.local'deki DATABASE_URL + DIRECT_URL'yi staging değerlerine set et
   DATABASE_URL="postgresql://postgres.xxx:pwd@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \ # secret-scanner-disable-line
   DIRECT_URL="postgresql://postgres:pwd@db.xxx.supabase.co:5432/postgres" \ # secret-scanner-disable-line
     pnpm prisma migrate deploy
   ```

7. **RLS policy'leri uygula:**
   ```bash
   DATABASE_URL="..." node scripts/apply-rls.js
   ```

8. **Supabase Auth email templates'ı production ile aynı yap:**
   - Authentication → Email Templates → her template'i production'dan kopyala
   - Site URL: `https://staging.YOUR_VERCEL_DOMAIN.vercel.app`
   - Redirect URLs: aynı domain + `/**`

---

## Adım 2 — Staging branch'i

```bash
cd hospital-lms
git checkout main
git pull
git checkout -b staging
git push -u origin staging
```

**Kural:** `staging` branch'i **silinmez**. `main`'den merge alır, feature branch'lerden **direkt almaz**.

**PR akışı:**

```
feature/* → staging (test et)
staging   → main    (canlıya çık)
```

---

## Adım 3 — Vercel staging environment

Vercel projesinin her branch'i **preview deployment** oluşturuyor. `staging` branch'ine özel environment tanımlanacak:

1. Vercel Dashboard → projenin sayfası → **Settings → Environments**
2. **Add Environment** → isim: `staging`, branch pattern: `staging`
3. **Settings → Environment Variables** sekmesine geç
4. Her environment variable için **Environment'ı "Preview" + "staging" olarak filtrele** ve **staging değerini** gir:

| Değişken | Staging değeri |
|----------|---------------|
| `DATABASE_URL` | Supabase staging Session pooler URL (port 5432) |
| `DIRECT_URL` | Supabase staging direct URL |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` (staging) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service_role (**asla client'a gitmez**) |
| `NEXT_PUBLIC_APP_URL` | `https://staging.YOUR_DOMAIN.vercel.app` |
| `AWS_ACCESS_KEY_ID` | Staging bucket'ın IAM user key'i |
| `AWS_SECRET_ACCESS_KEY` | Staging secret |
| `AWS_BUCKET_NAME` | `hospital-lms-staging` |
| `AWS_REGION` | `eu-central-1` |
| `REDIS_URL` | Upstash staging DB URL |
| `REDIS_TOKEN` | Upstash staging token |
| `NEXT_PUBLIC_CRISP_WEBSITE_ID` | **Boş bırak** (staging'de chat kapalı olsun) |
| `NEXT_PUBLIC_STATUS_PAGE_URL` | **Boş bırak** |
| `SMTP_HOST/PORT/USER/PASS` | Ethereal.email gibi **test SMTP** (gerçek e-posta gitmesin!) |
| `SENTRY_DSN` | Staging-specific Sentry project (opsiyonel ama önerilir) |

5. **Build & Development Settings → Root Directory**: production ile aynı
6. Settings kaydet, deploy tetikle

---

## Adım 4 — S3 staging bucket

Staging dosyalarının production ile karışmaması kritik.

### Seçenek A: Ayrı bucket (önerilen)

```bash
# AWS CLI
aws s3 mb s3://hospital-lms-staging --region eu-central-1

# CORS + public-read policy (production'dakilerin aynısı)
aws s3api put-bucket-cors --bucket hospital-lms-staging --cors-configuration file://cors.json
aws s3api put-bucket-policy --bucket hospital-lms-staging --policy file://policy.json
```

### Seçenek B: Aynı bucket, farklı prefix (bütçe dostu)

`src/lib/s3.ts` içinde `process.env.VERCEL_ENV === 'preview'` ise key'leri `staging/` prefix'i ile ön eklemek — küçük bir kod değişikliği, bir bucket, iki izole alan.

---

## Adım 5 — Redis staging database

Upstash ücretsiz planda **10 database** veriyor.

1. https://console.upstash.com → **Create Database**
2. **Name:** `hospital-lms-staging`
3. **Region:** Frankfurt (production ile aynı)
4. **Type:** Regional (ücretsiz)
5. Oluşturulunca → REST URL + Token kopyala → Vercel staging env'e ekle

**Önemli:** Production redis'inden rate limit / cache key'leri paylaşmamak için ayrı DB şart — aksi halde staging trafiği production rate limit'ini tetikler.

---

## Adım 6 — Staging'e deploy

```bash
# Staging branch'ine feature branch merge et
git checkout staging
git merge --no-ff feature/yeni-ozellik
git push origin staging
```

Vercel otomatik preview deploy açar → `https://hospital-lms-git-staging-xxx.vercel.app`

**Özel domain (önerilen):** Vercel → Settings → Domains → `staging.hastane-lms.com` ekle → DNS kaydı gir.

---

## Adım 7 — Seed data

Staging boş bir DB — test etmek için veri lazım.

```bash
# E2E test kullanıcılarını (admin/staff/super) oluştur
DATABASE_URL="<staging>" \
NEXT_PUBLIC_SUPABASE_URL="<staging>" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="<staging>" \
SUPABASE_SERVICE_ROLE_KEY="<staging>" \
  pnpm tsx scripts/setup-e2e-users.ts

# Demo organizasyon + eğitimler + sertifikalar
DATABASE_URL="<staging>" node scripts/seed-demo.js
```

**Test hesapları** (setup-e2e-users.ts oluşturur):
- `e2e-admin@test.local` / `E2eTestAdmin123!`
- `e2e-staff@test.local` / `E2eTestStaff123!`
- `e2e-super@test.local` / `E2eTestSuper123!`

**Kural:** Bu hesaplar **yalnızca staging'de**. Production'da varsa derhal silin.

---

## Adım 8 — Smoke test

Her staging deploy'dan sonra manuel çalıştırın:

- [ ] https://staging.YOUR_DOMAIN/ → landing açılıyor
- [ ] /auth/login → admin giriş başarılı
- [ ] /admin/dashboard → istatistikler yükleniyor (404 / 500 yok)
- [ ] /admin/staff → en az bir personel listede
- [ ] Yeni eğitim oluştur → video yükle → kaydet
- [ ] Staff olarak gir → atanmış eğitim görünüyor → pre-exam başlat
- [ ] /admin/accreditation → PDF indir → Türkçe karakter, logo, tablolar kontrol
- [ ] /admin/subscription → plan bilgisi, kota progress bar'ları
- [ ] Çıkış yap → login sayfasına dönüyor

Otomatik:

```bash
E2E_ADMIN_EMAIL="e2e-admin@test.local" \
E2E_ADMIN_PASSWORD="E2eTestAdmin123!" \ # secret-scanner-disable-line
PLAYWRIGHT_BASE_URL="https://staging.YOUR_DOMAIN.vercel.app" \
  pnpm test:e2e
```

---

## Günlük kullanım akışı

```
1. Feature branch aç
   git checkout -b feature/xyz

2. Kodla, local'de test et
   pnpm dev

3. Staging'e merge et
   git checkout staging && git merge --no-ff feature/xyz && git push

4. Vercel deploy olsun (2-3 dk), smoke test yap
   open https://staging.YOUR_DOMAIN

5. Sorun yoksa main'e merge
   git checkout main && git merge --no-ff staging && git push

6. Production deploy → canlı
```

**Migration varsa ekstra adım:** staging'de `prisma migrate deploy` çalıştır, 24 saat gözlem yap, sonra production'da aynısını.

---

## Sorun giderme

### "Invalid API key" Supabase hatası
Staging env'de yanlış key var — **production key'i staging'e kopyalama hatası** sık yapılır. Vercel → Settings → Environment Variables → staging filtresinde key'lerin staging projesinden geldiğini doğrula.

### Migration staging'de patlıyor
Önce local'de `DATABASE_URL=<staging>` ile `pnpm prisma migrate dev` çalıştırıp sorunu çöz, sonra branch'i güncelle.

### E-posta gidiyor gerçek adrese
`SMTP_HOST` production değerini aldı demektir. **Ethereal.email** kullan — test için mock SMTP. Staging'de **kesinlikle** gerçek müşteri e-postası olmamalı.

### Cron job'lar staging'de çalışıyor
`vercel.json` içindeki cron `src/app/api/cron/cleanup/route.ts` production ve staging'de ayrı çalışır → staging DB'si saatlik temizleniyor. İki seçenek:
- Cron route'ta `if (process.env.VERCEL_ENV !== 'production') return` kontrolü ekle
- Staging'de cron'u manuel devre dışı bırak (Vercel → Settings → Cron)

---

## Maliyet özeti

| Kaynak | Ücretsiz plan yeterli mi? | Aşarsa |
|--------|--------------------------|--------|
| Supabase 2. proje | ✅ Evet (org başına 2 ücretsiz) | — |
| Vercel Preview | ✅ Evet (Hobby plan tüm branch'lere izin verir) | — |
| Upstash Redis | ✅ Evet (10K komut/gün) | $0.20/100K |
| AWS S3 | ✅ Evet (5GB/ay) | $0.023/GB |
| Custom domain | ❌ (Domain kayıt ücreti) | ~$15/yıl |

**Sonuç:** Staging ortamı neredeyse sıfır maliyetle kurulabilir. Kurulum süresi 45-60 dakika, bakım yok.

---

## Referanslar

- Production deployment notları: `memory/project_vercel_deploy.md`
- Prisma DIRECT_URL Session Pooler: `memory/project_prisma_direct_url.md`
- Supabase bölge taşıma geçmişi: `memory/project_supabase_migration.md`
- RLS policy'leri: `supabase-rls.sql`
- Seed scripts: `scripts/setup-e2e-users.ts`, `scripts/seed-demo.js`
