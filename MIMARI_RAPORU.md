# Hospital LMS — Kodlama Mimarisi Raporu

> **Tarih:** 25 Mart 2026
> **Proje:** `hospital-lms`
> **Amaç:** Çoklu hastane desteğine sahip SaaS Personel Eğitim ve Sınav Yönetim Sistemi

---

## 1. Genel Bakış

`hospital-lms`, Next.js 16 App Router tabanlı, tam-yığın (full-stack) bir SaaS uygulamasıdır. Türkçe arayüzüyle Türkiye'deki hastanelerin personel eğitimlerini yönetmesini sağlar. Sistem üç ayrı rol panelinden ve bağımsız bir sınav modülünden oluşur.

---

## 2. Teknoloji Yığını

| Katman | Teknoloji | Sürüm |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.1 |
| UI Kütüphanesi | React | 19.2.4 |
| Tip Sistemi | TypeScript | ^5 |
| Stil | Tailwind CSS | v4 |
| ORM | Prisma | 7.x |
| Veritabanı | PostgreSQL (Supabase) | — |
| Auth | Supabase Auth (JWT + SSR) | 2.x |
| Realtime | Supabase Realtime | 2.x |
| Cache / Zamanlayıcı | Upstash Redis | 1.x |
| Dosya Depolama | AWS S3 + CloudFront | AWS SDK v3 |
| E-posta | Nodemailer (SMTP) | 8.x |
| Client State | Zustand | 5.x |
| Form / Validasyon | react-hook-form + Zod v4 | — |
| Tablo | TanStack Table | 8.x |
| Grafik | Recharts | 3.x |
| Animasyon | Framer Motion | 12.x |
| Birim Test | Vitest | 4.x |
| E2E Test | Playwright | 1.x |
| Deploy | Vercel (Frankfurt/fra1) | — |
| Paket Yönetici | pnpm | workspace |

---

## 3. Klasör Yapısı

```
hospital-lms/
├── prisma/
│   ├── schema.prisma          # 15 model, PostgreSQL
│   └── migrations/            # Prisma migration dosyaları
│
├── src/
│   ├── app/                   # Next.js App Router sayfaları
│   │   ├── layout.tsx         # Kök layout (font, tema, auth provider)
│   │   ├── page.tsx           # Ana yönlendirme
│   │   ├── auth/              # Login, callback, şifre sıfırlama
│   │   ├── super-admin/       # Platform yönetici paneli
│   │   ├── admin/             # Hastane yönetici paneli
│   │   ├── staff/             # Personel paneli
│   │   ├── exam/[id]/         # Tam ekran sınav modülü
│   │   └── api/               # API Route'ları (Next.js Route Handlers)
│   │       ├── auth/
│   │       ├── super-admin/
│   │       ├── admin/
│   │       ├── staff/
│   │       ├── exam/[id]/
│   │       └── cron/cleanup/
│   │
│   ├── components/
│   │   ├── ui/                # shadcn/ui + animasyonlu bileşenler
│   │   ├── shared/            # Ortak bileşenler (StatCard, DataTable, vb.)
│   │   ├── layouts/           # Sidebar + Topbar
│   │   ├── providers/         # ThemeProvider, AuthProvider
│   │   └── super-admin/       # Super Admin'e özgü bileşenler
│   │
│   ├── lib/
│   │   ├── prisma.ts          # Singleton Prisma istemcisi
│   │   ├── supabase/          # Browser / Server / Middleware Supabase istemcileri
│   │   ├── redis.ts           # Sınav zamanlayıcısı + rate limiting
│   │   ├── s3.ts              # Upload / stream / delete yardımcıları
│   │   ├── email.ts           # SMTP + HTML e-posta şablonları
│   │   ├── api-helpers.ts     # getAuthUser, requireRole, createAuditLog
│   │   ├── validations.ts     # Tüm API girişleri için Zod şemaları
│   │   └── utils.ts           # Genel yardımcılar
│   │
│   ├── hooks/
│   │   ├── use-auth.ts                    # Zustand auth store sarmalayıcısı
│   │   └── use-realtime-notifications.ts  # Supabase Realtime bildirimleri
│   │
│   ├── store/
│   │   ├── auth-store.ts          # Kullanıcı oturumu state'i (Zustand)
│   │   └── notification-store.ts  # Bildirim state'i (Zustand)
│   │
│   ├── types/
│   │   └── database.ts        # Tüm entity'ler için TypeScript tipleri
│   │
│   └── generated/prisma/      # Prisma'nın ürettiği istemci kodu
│
├── e2e/                       # Playwright E2E testleri
├── scripts/                   # Seed ve RLS uygulama betikleri
├── supabase-rls.sql           # 15 tablo için Row Level Security politikaları
└── vercel.json                # Vercel deploy konfigürasyonu
```

---

## 4. Veri Modeli (15 Model)

Prisma şeması üzerinden tespit edilen modeller ve aralarındaki ilişkiler:

```
SubscriptionPlan ──< OrganizationSubscription >── Organization
                                                       │
                                          ┌────────────┼────────────┐
                                       Department    User         Training
                                          │            │              │
                                       User[]      ExamAttempt   TrainingVideo
                                                       │           VideoProgress
                                                   ExamAnswer
                                                       │
                                                   Question ──< QuestionOption

Organization ──< Notification
Organization ──< AuditLog
Organization ──< DbBackup
```

Tüm primary key'ler UUID tipindedir. Tablo ve sütun isimleri veritabanında `snake_case`, kod içinde `camelCase` olarak `@map` ile eşleştirilmiştir.

---

## 5. Rol Mimarisi

Sistem üç rol katmanı üzerine inşa edilmiştir:

**Super Admin** (`super_admin`)
- Platform genelinde tüm hastaneleri yönetir
- Abonelik planları oluşturur ve atar
- Tüm audit log ve raporlara erişir
- Yeni admin kullanıcıları oluşturur

**Hastane Admin** (`admin`)
- Yalnızca kendi organizasyonunun verilerini görür
- Eğitim oluşturma (4 adımlı wizard: temel bilgi → video → sorular → atama)
- Personel CRUD, departman yönetimi
- Raporlar (6 sekme), Excel/PDF export
- Manuel yedek alma

**Personel** (`staff`)
- Atanan eğitimleri görür ve tamamlar
- Takvim, profil yönetimi
- Bildirim merkezi

---

## 6. Kimlik Doğrulama ve Güvenlik

### 6.1 Auth Akışı
Supabase Auth, JWT token'larını `@supabase/ssr` aracılığıyla cookie'lerde saklar. Üç ayrı Supabase istemcisi vardır:
- `client.ts` → Browser ortamı (`createBrowserClient`)
- `server.ts` → Server Components ve API route'ları (`createClient`, `createServiceClient`)
- `middleware.ts` → Her istekte session yenileme + rol tabanlı yönlendirme

`service_role` anahtarı yalnızca admin tarafından kullanıcı oluşturma işleminde kullanılır; diğer tüm işlemler kullanıcı JWT'si ile yapılır.

### 6.2 Middleware Güvenliği
`src/lib/supabase/middleware.ts` şu görevleri üstlenir:
- Oturumsuz kullanıcıları `/auth/login` sayfasına yönlendirir
- Rol kontrolü yapar: her panel kendi role kilitlidir (`/super-admin` → yalnızca `super_admin`, vb.)
- Giriş yapmış kullanıcıların login sayfasına erişimini engeller

### 6.3 API Güvenlik Katmanı
`api-helpers.ts` içindeki `getAuthUser()` fonksiyonu her API route'unda çağrılır ve:
1. Supabase'den JWT doğrular
2. Prisma üzerinden veritabanı kullanıcı profilini çeker
3. Kullanıcının aktif olup olmadığını kontrol eder

`requireRole()` ile endpoint başına izin listesi tanımlanır.

### 6.4 Row Level Security
`supabase-rls.sql` dosyasında 15 tablonun tamamı için RLS politikaları tanımlanmıştır. Veri izolasyonu hem uygulama katmanında hem de veritabanı katmanında çift katmanlı şekilde sağlanmaktadır.

---

## 7. Eğitim ve Sınav Akışı

```
Atama (Admin)
    │
    ▼
Ön Sınav (Pre-Exam)
    │  Supabase Realtime + Redis timer ile süre takibi
    ▼
Video İzleme (no fast-forward)
    │  VideoProgress tablosunda izlenme süresi takip edilir
    ▼
Son Sınav (Post-Exam)
    │
    ▼
Geçti / Kaldı
    │  Kaldıysa maxAttempts'e kadar tekrar hakkı
    ▼
Tamamlandı / Kilitli
```

Sınav modülü (`/exam/[id]`) sidebar içermeyen bağımsız bir layout'ta çalışır. Redis (`Upstash`) sınav süresini sunucu tarafında yönetir, tarayıcı kapatılsa bile süre devam eder.

---

## 8. Altyapı Servisleri

### AWS S3 + CloudFront
- Video yükleme: Presigned PUT URL ile doğrudan tarayıcıdan S3'e yükleme
- Video oynatma: CloudFront imzalı URL ile CDN üzerinden akış (4 saatlik geçerlilik)
- S3 key formatı: `videos/{orgId}/{trainingId}/{timestamp}-{filename}`

### Upstash Redis
- **Sınav zamanlayıcısı:** `exam:timer:{attemptId}` key'i ile TTL tabanlı süre takibi
- **Rate limiting:** `ratelimit:{key}` key'i ile pencere-tabanlı istek sınırlama

### Supabase Realtime
- Bildirimler `postgres_changes` eventi ile gerçek zamanlı iletilir
- Kullanıcıya `user_id=eq.{userId}` filtresiyle kişisel kanal açılır
- Tarayıcı bildirim API'si de tetiklenir (izin alınırsa)

### E-posta
- Nodemailer SMTP üzerinden gönderim
- Türkçe HTML şablonlar `src/lib/email.ts` içinde tanımlı

### Cron Job
- Her gece 03:00 UTC'de `/api/cron/cleanup` çalışır
- Eski/stale denemeler, okunmuş bildirimler ve eski audit log kayıtları temizlenir
- Vercel Cron ile tetiklenir (`vercel.json`)

---

## 9. Client State Yönetimi

Zustand ile iki minimal store:

- **`auth-store.ts`** — Oturum açık kullanıcı nesnesi, yükleme durumu, `isAuthenticated` bayrağı
- **`notification-store.ts`** — Bildirim listesi, okunmamış sayacı

`use-auth.ts` hook'u store'u sarmalar ve rol kontrol yardımcılarını (`isSuperAdmin`, `isAdmin`, `isStaff`) ve kullanıcı görüntü adını türetir.

---

## 10. Component Mimarisi

### shadcn/ui + Özel Bileşenler
`src/components/ui/` içinde temel bileşenler (button, input, dialog, table vb.) shadcn/ui ile kurulmuştur. Bunlara ek olarak MagicUI kaynaklı animasyonlu bileşenler de bulunmaktadır: `border-beam`, `shine-border`, `blur-fade`, `particles`, `number-ticker` vb.

### Paylaşılan Bileşenler (`shared/`)
- `stat-card.tsx` — Metrik kartı (istatistik gösterimi)
- `data-table.tsx` — TanStack Table tabanlı veri tablosu
- `page-header.tsx` — Sayfa başlık + aksiyon alanı
- `chart-card.tsx` — Recharts sarmalayıcısı
- `notification-bell.tsx` — Topbar bildirim zili

### Layout (`layouts/`)
- `sidebar/` — Role göre menü öğelerini dinamik olarak render eder
- `topbar/` — Kullanıcı avatarı, bildirim zili, tema geçişi

---

## 11. API Katmanı

Tüm API route'ları Next.js Route Handler (`route.ts`) olarak `src/app/api/` altında düzenlenmiştir. Her route:
1. `getAuthUser()` ile oturumu doğrular
2. `requireRole()` ile yetki kontrolü yapar
3. `parseBody()` + Zod şeması ile girdiyi doğrular
4. Prisma üzerinden veritabanı işlemi gerçekleştirir
5. Önemli işlemler için `createAuditLog()` kaydı oluşturur
6. `jsonResponse()` / `errorResponse()` ile yanıt döner

---

## 12. Test Stratejisi

| Test Türü | Araç | Konum |
|---|---|---|
| Birim Testi | Vitest | `src/lib/__tests__/` |
| E2E Testi | Playwright | `e2e/` |

`src/lib/__tests__/validations.test.ts` dosyasından anlaşıldığı üzere birim testleri öncelikli olarak validasyon şemalarını kapsamaktadır. E2E testleri auth akışı (`auth.spec.ts`) ve navigasyon (`navigation.spec.ts`) üzerine yoğunlaşmıştır.

---

## 13. Mevcut Durum ve Önemli Not

CLAUDE.md dosyasına göre proje **hibrit bir aşamadadır:**

- **Tamamlanmış:** Tüm backend API route'ları, auth sistemi, RLS politikaları, video altyapısı, sınav zamanlayıcısı, e-posta, export (Excel/PDF) ve realtime bildirimler
- **Beklemede:** Frontend sayfaları şu an demo/mock veri kullanmaktadır. Aktivasyon için `.env` dosyasının doldurulması, migration çalıştırılması ve frontend sayfalarında mock verinin gerçek API çağrılarıyla değiştirilmesi gerekmektedir

---

## 14. Mimari Güçlü Yönler

- **Çift katmanlı güvenlik:** Hem middleware hem RLS düzeyinde veri izolasyonu
- **Servis ayrımı:** Auth (Supabase), DB (Prisma/PG), Cache (Redis), Storage (S3), CDN (CloudFront) net şekilde ayrılmış
- **Tip güvenliği:** Prisma'dan türetilen tipler + Zod şemaları + TypeScript uçtan uca tip güvenliği sağlar
- **Sunucu taraflı zamanlama:** Sınav süresi Redis'te tutulur, client manipülasyonu önlenir
- **Audit trail:** Her kritik işlem `audit_logs` tablosuna IP + userAgent ile kaydedilir
- **Ölçeklenebilir çoklu kiracılık:** Her organizasyon kendi verilerinden izole edilmiştir

---

*Rapor tamamen inceleme amaçlıdır, herhangi bir dosya değiştirilmemiştir.*
