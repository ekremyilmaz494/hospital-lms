# Hastane LMS — Teknik Kurulum ve Deploy Rehberi

Bu rehber, Hastane LMS platformunun sifirdan kurulumu, yapilandirilmasi ve production ortamina deploy edilmesi icin gerekli tum adimlari icerir.

---

## Icindekiler

1. [On Kosullar](#1-on-kosullar)
2. [Supabase Proje Kurulumu](#2-supabase-proje-kurulumu)
3. [Veritabani Kurulumu](#3-veritabani-kurulumu)
4. [AWS S3 ve CloudFront](#4-aws-s3-ve-cloudfront)
5. [Upstash Redis](#5-upstash-redis)
6. [E-posta SMTP](#6-e-posta-smtp)
7. [Vercel Deploy](#7-vercel-deploy)
8. [DNS Yapilandirmasi](#8-dns-yapilandirmasi)
9. [Ilk Super Admin Olusturma](#9-ilk-super-admin-olusturma)
10. [Dogrulama Checklist](#10-dogrulama-checklist)
11. [Guncelleme Proseduru](#11-guncelleme-proseduru)

---

## 1. On Kosullar

### Yazilim Gereksinimleri

- **Node.js** 20 veya ustu (LTS onerilir)
- **pnpm** 9 veya ustu (paket yoneticisi)
- **Git** 2.40+
- **Prisma CLI** (proje bagimliligi olarak dahildir)

### Gerekli Hesaplar

Asagidaki servislerde hesabinizin olmasi gerekmektedir:

| Servis | Amac | Web Sitesi |
|--------|------|-----------|
| **Supabase** | PostgreSQL veritabani, Auth, Realtime | https://supabase.com |
| **Vercel** | Next.js hosting, cron jobs | https://vercel.com |
| **AWS** | S3 video depolama, CloudFront CDN | https://aws.amazon.com |
| **Upstash** | Serverless Redis (sinav zamanlayici, cache) | https://upstash.com |
| **SMTP Saglayici** | E-posta gonderimi | (asagida detayli) |
| **GitHub** | Kaynak kod deposu | https://github.com |

### Opsiyonel Hesaplar

| Servis | Amac |
|--------|------|
| **Sentry** | Hata izleme (error tracking) |
| **Iyzico** | Odeme entegrasyonu (SaaS faturalandirma) |

---

## 2. Supabase Proje Kurulumu

### Yeni Proje Olusturma

1. [Supabase Dashboard](https://supabase.com/dashboard) adresine gidin.
2. "New Project" butonuna tiklayin.
3. Asagidaki ayarlari yapin:
   - **Name:** `hospital-lms-production` (veya tercihinize gore)
   - **Database Password:** Guclu bir sifre belirleyin ve kaydedin (sonra lazim olacak)
   - **Region:** `eu-central-1` (Frankfurt) — Vercel region ile ayni olmali
   - **Plan:** Ihtiyaciniza gore Free veya Pro

### API Anahtarlarini Alma

Proje olusturulduktan sonra **Settings > API** bolumune gidin:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` olarak kullanilacak
- **anon (public) key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` olarak kullanilacak
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` olarak kullanilacak (GIZLI TUTUN)

### Connection String

**Settings > Database** bolumunden **Connection string > URI** degerini kopyalayin. `[YOUR-PASSWORD]` kismini proje olusturma sirasinda belirlediginiz sifre ile degistirin:

```
<supabase-veritabani-baglanti-adresi>
```

Bu deger `DATABASE_URL` olarak kullanilacaktir.

### Auth Ayarlari

**Authentication > URL Configuration** bolumunde:

- **Site URL:** `https://your-domain.com` (production URL'iniz)
- **Redirect URLs:** `https://your-domain.com/auth/callback`, `https://*.your-domain.com/auth/callback`

**Authentication > Providers** bolumunde:

- **Email** saglayicisinin aktif oldugunu dogrulayin
- "Confirm email" secenegini ihtiyaciniza gore ayarlayin

---

## 3. Veritabani Kurulumu

### Projeyi Klonlama ve Bagimliliklari Yukleme

```bash
git clone https://github.com/YOUR-ORG/hospital-lms.git
cd hospital-lms
pnpm install
```

### Ortam Degiskenleri

`.env.example` dosyasini `.env` olarak kopyalayin ve degerlerini doldurun:

```bash
cp .env.example .env
```

Asagida tum ortam degiskenleri ve aciklamalari yer almaktadir:

```env
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# --- Database ---
DATABASE_URL=<veritabani-baglanti-adresi-buraya>

# --- AWS ---
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=eu-central-1
AWS_S3_BUCKET=hospital-lms-videos
AWS_CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
AWS_CLOUDFRONT_KEY_PAIR_ID=K1234567890
AWS_CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# --- Redis (Upstash) ---
REDIS_URL=https://xxxxx.upstash.io
REDIS_TOKEN=AX...

# --- E-posta (SMTP) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=app-password-here
SMTP_FROM="Hastane LMS <noreply@yourdomain.com>"

# --- Iyzico Odeme (opsiyonel) ---
IYZICO_API_KEY=
IYZICO_SECRET_KEY=
IYZICO_BASE_URL=https://api.iyzipay.com

# --- App ---
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_BASE_DOMAIN=your-domain.com
JWT_SECRET=min-32-karakter-rastgele-string
CRON_SECRET=min-32-karakter-rastgele-string

# --- Backup Sifreleme ---
BACKUP_ENCRYPTION_KEY=min-32-karakter-rastgele-string

# --- Health Check (opsiyonel) ---
HEALTH_CHECK_SECRET=

# --- Admin Uyari E-postasi (opsiyonel) ---
ADMIN_ALERT_EMAIL=admin@yourdomain.com

# --- Destek E-postasi (opsiyonel) ---
NEXT_PUBLIC_SUPPORT_EMAIL=destek@yourdomain.com

# --- CDN (opsiyonel — profil fotograflari) ---
NEXT_PUBLIC_CDN_URL=

# --- HIS Entegrasyon Sifreleme ---
# Olusturmak icin: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=

# --- Web Push / PWA (VAPID) ---
# Olusturmak icin: node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(JSON.stringify(k,null,2))"
NEXT_PUBLIC_VAPID_KEY=
VAPID_PRIVATE_KEY=

# --- Sentry (opsiyonel) ---
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_SENTRY_DSN=

# --- AI Content Studio (opsiyonel) ---
AI_CONTENT_SERVICE_URL=http://localhost:8100
AI_CONTENT_INTERNAL_KEY=min-32-karakter-rastgele-string
```

### Prisma Client Olusturma ve Veritabani Senkronizasyonu

```bash
# Prisma Client olustur
pnpm db:generate

# Semayi veritabanina uygula (migration olmadan, direkt push)
pnpm db:push
```

Eger migration dosyalari ile calismayi tercih ediyorsaniz:

```bash
pnpm db:migrate
```

### RLS Politikalarini Uygulama

Row Level Security politikalari multi-tenant guvenligin temelini olusturur. Bu adimi ATLAMAMANIZ kritiktir.

1. Supabase Dashboard'da **SQL Editor** bolumune gidin.
2. Proje kok dizinindeki `supabase-rls.sql` dosyasinin icerigini kopyalayip SQL Editor'de calistirin.

Alternatif olarak komut satirindan:

```bash
node scripts/apply-rls.js
```

### Demo Verisi (Opsiyonel)

Sistemi test etmek icin demo verisi yukleyebilirsiniz:

```bash
node scripts/seed-demo.js
```

---

## 4. AWS S3 ve CloudFront

### S3 Bucket Olusturma

1. AWS Console'da **S3** servisine gidin.
2. "Create bucket" butonuna tiklayin:
   - **Bucket name:** `hospital-lms-videos` (veya tercihinize gore)
   - **Region:** `eu-central-1` (Frankfurt)
   - **Block all public access:** Isaretli birakin (erisim CloudFront uzerinden yapilacak)
   - **Versioning:** Opsiyonel (onerilir)

3. Bucket olusturulduktan sonra **Permissions > CORS** bolumune gidin ve asagidaki yapilandirmayi ekleyin:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### IAM Kullanici Olusturma

1. AWS Console'da **IAM > Users > Add user** yolunu izleyin.
2. Kullanici adi: `hospital-lms-s3`
3. **Access type:** Programmatic access
4. Asagidaki inline policy'yi ekleyin:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::hospital-lms-videos",
        "arn:aws:s3:::hospital-lms-videos/*"
      ]
    }
  ]
}
```

5. Olusturulan **Access Key ID** ve **Secret Access Key** degerlerini `.env` dosyasina yazin.

### CloudFront Dagitimi Olusturma

1. AWS Console'da **CloudFront > Create distribution** yolunu izleyin.
2. **Origin domain:** S3 bucket'inizi secin (`hospital-lms-videos.s3.eu-central-1.amazonaws.com`)
3. **Origin access:** "Origin access control settings" secin ve yeni bir OAC olusturun
4. **Viewer protocol policy:** "Redirect HTTP to HTTPS"
5. **Allowed HTTP methods:** GET, HEAD
6. **Cache policy:** CachingOptimized
7. **Restrict viewer access:** "Yes" — Signed URLs kullanilacak
8. **Trusted key groups:** Yeni bir key group olusturun (asagida anlatiliyor)

### CloudFront Imzali URL Ayarlari

1. Bir RSA anahtar cifti olusturun:

```bash
openssl genrsa -out private_key.pem 2048
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

2. AWS Console'da **CloudFront > Key management > Public keys** bolumune gidin.
3. `public_key.pem` icerigini yapistirarak yeni bir public key olusturun.
4. Bir **Key group** olusturup bu public key'i ekleyin.
5. CloudFront distribution'da **Behaviors** sekmesinde "Trusted key groups" olarak bu grubu secin.
6. `private_key.pem` icerigini `AWS_CLOUDFRONT_PRIVATE_KEY` olarak `.env` dosyasina ekleyin.
7. Key pair ID'yi `AWS_CLOUDFRONT_KEY_PAIR_ID` olarak ekleyin.

**Onemli:** S3 bucket policy'sini CloudFront OAC icin guncellemeyi unutmayin. CloudFront distribution olusturulurken AWS size gerekli policy'yi kopyalama secenegi sunacaktir.

---

## 5. Upstash Redis

### Yeni Veritabani Olusturma

1. [Upstash Console](https://console.upstash.com/) adresine gidin.
2. "Create Database" butonuna tiklayin:
   - **Name:** `hospital-lms-redis`
   - **Region:** `eu-central-1` (Frankfurt) — Vercel ve Supabase ile ayni bolge
   - **Type:** Regional (dusuk gecikme icin)
   - **TLS:** Aktif

### REST API Bilgilerini Alma

Veritabani olusturulduktan sonra **Details** sekmesinde:

- **UPSTASH_REDIS_REST_URL** → `REDIS_URL` olarak kullanilacak
- **UPSTASH_REDIS_REST_TOKEN** → `REDIS_TOKEN` olarak kullanilacak

Bu degerler sinav zamanlayicisi, oran sinirlamasi (rate limiting) ve dashboard cache icin kullanilmaktadir.

---

## 6. E-posta SMTP

### Saglayici Secimi

Asagidaki SMTP saglayicilarindan birini tercih edebilirsiniz:

| Saglayici | Ucretsiz Limit | Onerilir |
|-----------|----------------|----------|
| **Gmail App Password** | 500/gun | Kucuk olcek, test |
| **Amazon SES** | 62.000/ay (EC2 ile) | Production |
| **Resend** | 3.000/ay | Kolay kurulum |
| **Postmark** | 100/ay (deneme) | Yuksek iletim orani |
| **SendGrid** | 100/gun | Yaygin kullanim |

### SMTP Yapilandirmasi

Sectiginiz saglayicinin SMTP bilgilerini `.env` dosyasina girin:

```env
SMTP_HOST=smtp.gmail.com        # veya saglayicinizin SMTP adresi
SMTP_PORT=587                    # genellikle 587 (STARTTLS) veya 465 (SSL)
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-app-password
SMTP_FROM="Hastane LMS <noreply@yourdomain.com>"
```

### Gmail Icin Ozel Not

Gmail kullaniyorsaniz:

1. Google hesabinizda **2 Adimli Dogrulama** aktif olmali
2. **App Passwords** bolumunden yeni bir uygulama sifresi olusturun
3. Bu sifseyi `SMTP_PASS` olarak kullanin
4. Normal Gmail sifrenizi KULLANMAYIN

### Test

Kurulum tamamlandiktan sonra e-posta gonderimini test edin:

```bash
# Dev sunucusunu baslatip bir test istegi gonderin
pnpm dev
# Tarayicida /auth/forgot-password sayfasindan test e-postasi tetikleyin
```

---

## 7. Vercel Deploy

### GitHub Baglantisi

1. [Vercel Dashboard](https://vercel.com/dashboard) adresine gidin.
2. "Add New Project" butonuna tiklayin.
3. GitHub reponuzu secin: `hospital-lms`

### Proje Ayarlari

- **Framework Preset:** Next.js
- **Root Directory:** `.` (varsayilan)
- **Build Command:** `prisma generate && next build --webpack`
- **Output Directory:** `.next` (varsayilan)
- **Install Command:** `pnpm install`
- **Node.js Version:** 20.x

### Region Secimi

**Settings > Functions** bolumunden function region olarak **Frankfurt (fra1)** secin. Bu, Supabase ve AWS ile ayni bolgede olmali — dusuk gecikme icin kritiktir.

### Ortam Degiskenleri

**Settings > Environment Variables** bolumunde tum `.env` degiskenlerini ekleyin. Her degiskenin hangi ortamlarda (Production, Preview, Development) gecerli olacagini secebilirsiniz.

Asagidaki degiskenlerin **mutlaka** eklenmesi gerekir:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET
AWS_CLOUDFRONT_DOMAIN
AWS_CLOUDFRONT_KEY_PAIR_ID
AWS_CLOUDFRONT_PRIVATE_KEY
REDIS_URL
REDIS_TOKEN
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_BASE_DOMAIN
JWT_SECRET
CRON_SECRET
```

**Onemli:** `NEXT_PUBLIC_APP_URL` degerinin production domain'iniz ile eslestiginden emin olun (ornegin `https://hastanelms.com`).

### Cron Jobs

Proje deploy edildikten sonra `vercel.json` dosyasindaki cron job'lar otomatik olarak aktif olur:

| Zaman | Endpoint | Gorev |
|-------|----------|-------|
| Her gun 03:00 UTC | `/api/cron/cleanup` | Eski bildirimler, stale sinav girisimleri, audit log temizligi |
| Her gun 03:15 UTC | `/api/cron/backup` | Otomatik veritabani yedekleme |
| Her gun 07:00 UTC | `/api/cron/reminders` | Egitim hatirlatma bildirimleri |
| Her gun 04:00 UTC | `/api/cron/his-sync` | HIS veri senkronizasyonu |
| Her gun 08:00 UTC | `/api/cron/subscription-reminders` | Abonelik hatirlatmalari |

Cron job'larin calismasi icin `CRON_SECRET` ortam degiskeninin ayarlanmis olmasi gerekir. Vercel, cron isteklerini bu secret ile dogrular.

**Not:** Cron jobs ozelligini kullanmak icin Vercel Pro veya ustu plan gerekebilir.

### Ilk Deploy

Tum ayarlar tamamlandiktan sonra:

1. GitHub'a push yapin — Vercel otomatik build ve deploy baslatir.
2. **Deployments** sekmesinden build loglarini takip edin.
3. Build basarili olursa Vercel size bir `*.vercel.app` URL'i atayacaktir.

---

## 8. DNS Yapilandirmasi

### Ozel Domain Ekleme

1. Vercel Dashboard'da projenize gidin.
2. **Settings > Domains** bolumune gidin.
3. Domain'inizi ekleyin: `hastanelms.com`

### DNS Kayitlari

Domain saglayicinizin (Cloudflare, GoDaddy, Namecheap vb.) DNS yonetim panelinde asagidaki kayitlari olusturun:

```
Type    Name    Value                   TTL
A       @       76.76.21.21             300
CNAME   www     cname.vercel-dns.com    300
```

### Wildcard Subdomain (Multi-Tenant)

Her hastane kendi subdomain'i ile erisecekse wildcard subdomain yapilandirmasi gerekir:

```
Type    Name    Value                   TTL
CNAME   *       cname.vercel-dns.com    300
```

Vercel Dashboard'da ayrica wildcard domain'i de ekleyin: `*.hastanelms.com`

### SSL Sertifikasi

Vercel, eklenen domain'ler icin otomatik olarak Let's Encrypt SSL sertifikasi olusturur ve yeniler. DNS kayitlari dogru yapilandirilmissa SSL sertifikasi birleac dakika icinde aktif olur.

### Dogrulama

DNS degisikliklerinin yayilmasi 5 dakika ile 48 saat arasinda surebilir. Dogrulamak icin:

```bash
# DNS kayitlarini kontrol edin
dig hastanelms.com
dig ornek-hastane.hastanelms.com

# HTTPS erisimini test edin
curl -I https://hastanelms.com
```

---

## 9. Ilk Super Admin Olusturma

Sistem ilk kez deploy edildikten sonra bir Super Admin hesabi olusturmaniz gerekir. Bu islem Supabase Dashboard uzerinden manuel olarak yapilir.

### Adim 1: Supabase Auth'ta Kullanici Olusturma

1. Supabase Dashboard'da **Authentication > Users** bolumune gidin.
2. "Add user" butonuna tiklayin ve "Create new user" secin.
3. Asagidaki bilgileri girin:
   - **Email:** `admin@hastanelms.com` (veya tercihiniz)
   - **Password:** Guclu bir sifre
   - **Auto Confirm User:** Isaretleyin

### Adim 2: User Metadata Ayarlama

Supabase Dashboard'da **SQL Editor** bolumune gidin ve asagidaki sorguyu calistirin:

```sql
-- Olusturdugunuz kullanicinin auth.users tablosundaki ID'sini alin
SELECT id, email FROM auth.users WHERE email = 'admin@hastanelms.com';

-- User metadata'ya rol bilgisini ekleyin (ID'yi yukaridaki sorgudan alin)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'),
  '{role}',
  '"super_admin"'
)
WHERE email = 'admin@hastanelms.com';
```

### Adim 3: Veritabaninda Kullanici Profili Olusturma

```sql
-- users tablosuna profil kaydi ekleyin
-- auth_user_id degerini yukaridaki sorgudan alin
INSERT INTO users (id, auth_user_id, email, first_name, last_name, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'AUTH_USER_ID_BURAYA',  -- auth.users tablosundaki id
  'admin@hastanelms.com',
  'Super',
  'Admin',
  'super_admin',
  true,
  NOW(),
  NOW()
);
```

### Adim 4: Giris Testi

Tarayicinizda production URL'inizi acin ve olusturdugunuz Super Admin bilgileri ile giris yapin. Basarili giris sonrasi Super Admin paneline yonlendirilmeniz gerekir.

---

## 10. Dogrulama Checklist

Deploy isleminden sonra asagidaki kontrolleri yaparak tum bilesenlerin dogru calistigini dogrulayin:

### Altyapi

- [ ] Vercel deploy basarili (build hata yok)
- [ ] Custom domain HTTPS ile erisilebilir
- [ ] Wildcard subdomain calisiyor (test: `xxx.yourdomain.com`)

### Veritabani

- [ ] Supabase baglantisi calisiyor (`DATABASE_URL` dogru)
- [ ] Tum tablolar olusturulmus (`pnpm db:push` basarili)
- [ ] RLS politikalari uygulanmis (Supabase Dashboard'da kontrol edin)

### Auth

- [ ] Super Admin giris yapabiliyor
- [ ] Yanlis sifre ile giris reddediliyor
- [ ] Sifre sifirlama e-postasi gonderiliyor
- [ ] Oturum zaman asimi calisiyor

### Dosya Depolama

- [ ] S3 bucket'a dosya yuklenebiliyor
- [ ] CloudFront uzerinden video izlenebiliyor
- [ ] Imzali URL'ler dogru calisiyor (suresi dolan URL erisim reddediyor)
- [ ] CORS ayarlari dogru (yukleme sirasinda hata yok)

### Redis

- [ ] Upstash baglantisi calisiyor
- [ ] Sinav zamanlayicisi dogru calisiyor
- [ ] Dashboard cache aktif

### E-posta

- [ ] SMTP baglantisi calisiyor
- [ ] Sifre sifirlama e-postasi aliniyor
- [ ] E-posta icerigi Turkce ve dogru formatlanmis

### Cron Jobs

- [ ] `/api/cron/cleanup` 200 donuyor (manuel tetikleme ile test)
- [ ] `/api/cron/backup` 200 donuyor
- [ ] `/api/cron/reminders` 200 donuyor
- [ ] `CRON_SECRET` header dogrulamasi calisiyor

### Performans

- [ ] Dashboard 3 saniye icinde yukleliyor
- [ ] Video oynatma gecikmesiz basliyor
- [ ] API response sureleri kabul edilebilir (<500ms)

---

## 11. Guncelleme Proseduru

### Standart Guncelleme

Production ortamindaki sistemi guncellemek icin asagidaki adimlari izleyin:

```bash
# 1. En son degisiklikleri cekin
git pull origin main

# 2. Bagimliliklari guncelleyin
pnpm install

# 3. Prisma Client'i yeniden olusturun
pnpm db:generate

# 4. Veritabani sema degisikliklerini uygulayin (varsa)
pnpm db:push
```

### Vercel Otomatik Deploy

GitHub `main` branch'ine push yapildiginda Vercel otomatik olarak yeni bir deploy baslatir. Manuel deploy gerekmez. Deploy sureci:

1. `pnpm install` — bagimliliklari yukler
2. `prisma generate` — Prisma Client olusturur
3. `next build --webpack` — production build alir
4. Deploy tamamlanir ve trafik yeni versiyona yonlendirilir

Vercel "Instant Rollback" ozelligi sayesinde sorun durumunda onceki versiyona saniyeler icinde donebilirsiniz.

### Veritabani Migrasyonlari

Eger yeni bir migration dosyasi eklendiyse:

```bash
# Yerel ortamda migration olusturma
pnpm db:migrate

# Production'da migration uygulama (db:push ile)
pnpm db:push
```

**Onemli:** Production veritabaninda migration oncesi mutlaka yedek alin. Supabase Dashboard'dan manuel yedek alabilir veya `/api/cron/backup` endpoint'ini manuel tetikleyebilirsiniz.

### RLS Politika Guncellemeleri

Yeni tablolar eklendiyse veya mevcut RLS politikalari degistiyse:

1. `supabase-rls.sql` dosyasindaki yeni/degisen politikalari kopyalayin.
2. Supabase SQL Editor'de calistirin.
3. Politikalarin dogru uygulandigini Supabase Dashboard > Database > Policies bolumunden dogrulayin.

### Sorun Giderme

Guncelleme sonrasi sorun yasarsaniz:

```bash
# Prisma Client stale olabilir — yeniden olusturun
pnpm db:generate

# .next cache'i temizleyip yeniden build alin
rm -rf .next
pnpm build

# Vercel'de onceki versiyona donun
# Vercel Dashboard > Deployments > Onceki basarili deploy > "..." > "Promote to Production"
```

---

> Bu rehber Hastane LMS v0.1.0 icin hazirlanmistir. Sorulariniz icin teknik destek e-posta adresine basvurabilirsiniz.
