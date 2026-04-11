# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Next.js Version Warning

This project uses **Next.js 16** which has breaking changes from earlier versions. Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/`. APIs, conventions, and file structure may differ from training data — heed deprecation notices.

## Commands

```bash
pnpm dev          # Start dev server (Next.js 16, Turbopack)
pnpm build        # Production build (runs prisma generate first)
pnpm lint         # ESLint (flat config, next core-web-vitals + typescript)
pnpm start        # Serve production build

# Testing
pnpm test                        # Run all Vitest unit tests
pnpm test:watch                  # Vitest in watch mode
pnpm test -- src/lib/__tests__/validations.test.ts  # Run a single test file
pnpm test:e2e                    # Run Playwright E2E tests (e2e/ dir, needs dev server)
pnpm test:e2e -- --grep "login"  # Run specific E2E tests by name

# Prisma (v7, PostgreSQL via Supabase)
pnpm db:generate  # Generate client (outputs to src/generated/prisma)
pnpm db:migrate   # Run migrations (prisma/migrations/)
pnpm db:studio    # Open DB GUI

# Seed & DB scripts
node scripts/seed-demo.js        # Seed demo data
npx tsx scripts/seed-users.ts    # Seed users
node scripts/apply-rls.js        # Apply RLS policies to Supabase
```

## Pre-commit hooks
Husky + lint-staged runs `scripts/secret-scanner.js` on all staged files before every commit. If it detects secrets (API keys, tokens), the commit is blocked.

## Architecture

**Hospital LMS** — A multi-tenant SaaS platform for hospital staff training and exam management. Turkish-language UI (`lang="tr"`).

### Three role-based panels + exam module
- **Super Admin** (`/super-admin/*`) — Manages hospitals, subscription plans, platform-wide reports, audit logs
- **Hospital Admin** (`/admin/*`) — Manages trainings (4-step wizard), staff, reports (6-tab), certificates, backups, notifications, export (Excel/PDF)
- **Staff** (`/staff/*`) — Views assigned trainings, certificates, calendar, profile, notifications
- **Exam** (`/exam/[id]/*`) — Fullscreen routes (no sidebar): pre-exam → video player → post-exam

### Training flow
Assignment → Pre-exam → Watch videos (no fast-forward) → Post-exam → Pass/fail with retry attempts

### Key tech stack
- **Next.js 16** (App Router, RSC), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Supabase Auth** (JWT, role-based middleware, RLS), **Supabase Realtime** (notifications)
- **Prisma 7** with PostgreSQL (17 models, `@map` snake_case table/column names)
- **AWS S3 + CloudFront** for video storage/streaming (presigned uploads, signed URLs)
- **Upstash Redis** for exam timers and rate limiting
- **Nodemailer** for transactional emails (SMTP)
- **ExcelJS** + **jsPDF** for data export
- **shadcn/ui** (base-nova style, components in `src/components/ui/`)
- **Zustand** for client state (`src/store/`)
- **TanStack Table** for data tables, **Recharts** for charts, **Framer Motion** for animations
- **react-hook-form** + **zod v4** for forms and API validation
- **Vitest** (unit) + **Playwright** (E2E)

### Path aliases
`@/*` → `./src/*`

### Backend structure (API routes)
- `src/app/api/auth/` — Login, logout, callback, me
- `src/app/api/super-admin/` — Hospitals CRUD, subscriptions, reports, audit-logs, user creation
- `src/app/api/admin/` — Staff CRUD, trainings CRUD (videos, questions, assignments), reports, notifications, audit-logs, backups, export (Excel/PDF), certificates, dashboard stats
- `src/app/api/staff/` — My trainings, notifications, profile, calendar, certificates, dashboard
- `src/app/api/exam/[id]/` — Start attempt, submit answers, video progress, streaming URLs, timer
- `src/app/api/cron/cleanup/` — Daily cleanup at 03:00 UTC (Vercel Cron)

### API route pattern
All API routes follow a consistent pattern using helpers from `src/lib/api-helpers.ts`:
```typescript
const { user, profile } = await getAuthUser();       // Auth check + DB profile
requireRole(profile.role, ['admin']);                  // Role guard
const body = await parseBody<Schema>(request);         // Zod-validated body parsing
createAuditLog({ ... });                               // Audit trail
return jsonResponse(data);                             // Consistent responses
```
- `safePagination(searchParams)` — Parses page/limit with bounds (1-100 items, default 20)
- `errorResponse(message, status)` — Standardized error format

### Auth & security
- Supabase Auth with JWT tokens stored in cookies (`@supabase/ssr`)
- Three Supabase client helpers in `src/lib/supabase/`:
  - `client.ts` — Browser client (`createBrowserClient`)
  - `server.ts` — Server client (`createClient()`) + service role client (`createServiceClient()`)
  - `middleware.ts` — Session refresh + role-based route guards
- Public routes: `/auth/login`, `/auth/callback`, `/auth/forgot-password`
- Role-based redirects enforce panel access (e.g., staff can't access `/admin/*`)
- API routes use `service_role` key only for admin user creation; all other operations use user JWT
- Roles stored in `user.user_metadata.role`: `super_admin`, `admin`, `staff`
- `supabase-rls.sql` — Complete RLS policies for all tables (run in Supabase SQL Editor after migrations)
- Session timeout is configurable per organization (default 30 min)

### Next.js config
- `proxyClientMaxBodySize: '512mb'` — Required for video uploads
- Security headers on all routes (HSTS, X-Frame-Options DENY, CSP, XSS protection)
- CORS configured for `/api/*` routes scoped to `NEXT_PUBLIC_APP_URL`

### Prisma conventions
- Generated client at `src/generated/prisma` (import from `@/generated/prisma/client`); excluded from tsconfig to avoid proactive TS scanning
- Singleton instance in `src/lib/prisma.ts` using `PrismaPg` adapter
- Models use camelCase fields with `@map("snake_case")` for DB columns and `@@map("table_name")` for tables
- All IDs are UUIDs (`@db.Uuid`)
- Multi-tenant: most models have `organizationId` for tenant isolation

### Vitest config
- Environment: `node`, globals enabled
- Test files: `src/**/*.test.ts` and `src/**/*.test.tsx`
- Coverage: `src/lib/**` and `src/app/api/**`

### Project structure
- `src/components/shared/` — Reusable: stat-card, page-header, chart-card, data-table, notification-bell, toast
- `src/components/layouts/` — App sidebar (role-aware config in `sidebar-config.ts`) and topbar
- `src/components/providers/` — ThemeProvider, AuthProvider, SessionTimeoutProvider, ToastProvider
- `src/types/database.ts` — TypeScript types for all entities
- `src/lib/validations.ts` — Zod v4 schemas for all API inputs
- `src/lib/s3.ts` — S3 upload/download/stream/delete helpers
- `src/lib/redis.ts` — Exam timer, rate limiting
- `src/lib/email.ts` — SMTP transporter + Turkish HTML email templates
- `src/lib/exam-helpers.ts` — Shared exam logic (attempt validation, scoring)
- `src/hooks/use-realtime-notifications.ts` — Supabase Realtime postgres_changes listener
- `src/hooks/use-session-timeout.ts` — Auto-logout on inactivity

### Design system
- Fonts: Plus Jakarta Sans (`--font-display`, headings), Inter (`--font-body`), JetBrains Mono (`--font-mono`)
- Primary: `#0d9668`, Accent: `#f59e0b`, BG: `#f1f5f9`
- CSS variables for theming (light/dark), never use raw Tailwind color classes
- Cards: `rounded-2xl` with hover lift. Badges: `rounded-full` with dot indicators
- Never use `transition-all` — always specify properties

### Current state
Full-stack application. Frontend pages use demo/mock data (switchable). Backend API routes, auth, RLS, video infrastructure, exam timer, email, export, and realtime notifications are implemented. To activate backend:
1. Copy `.env.example` to `.env` and fill in credentials (Supabase, AWS, Redis, SMTP)
2. Run `pnpm db:migrate` then execute `supabase-rls.sql` in Supabase SQL Editor
3. Replace mock data in frontend pages with API calls

### Deploy
- **Vercel** for Next.js hosting (config in `vercel.json`, Frankfurt `fra1` region)
- **Supabase** for PostgreSQL + Auth + Realtime
- **AWS** for S3 video storage + CloudFront CDN
- **Upstash** for serverless Redis
- Daily cron job at `/api/cron/cleanup` (stale attempts, old notifications, audit log rotation)

---

# Hospital LMS — Claude Sistem Talimatlari

## Proje Tanimi
Hastane Personel Egitim ve Sinav Yonetim Sistemi (LMS).
Multi-tenant SaaS — her hastane (organization) birbirinden tamamen izole.

## Kaynaklar & Referanslar
Bu projede asagidaki GitHub repolarindaki skill ve rehberlerden faydalanilmaktadir:

- Anthropic resmi skill'leri: https://github.com/anthropics/skills
- Anthropic kod ornekleri: https://github.com/anthropics/claude-cookbooks
- Claude Code tam sistem: https://github.com/affaan-m/everything-claude-code
- Subagent koleksiyonu: https://github.com/VoltAgent/awesome-claude-code-subagents
- Skill dizini: https://github.com/travisvn/awesome-claude-skills

## Multi-Tenant Guvenlik Kurallari (KRITIK)
- Her veritabani sorgusunda `organizationId` filtresi ZORUNLU
- Supabase RLS (Row Level Security) her tabloda aktif olmali
- `service_role_key` sadece sunucu tarafinda kullanilir, client'a asla expose edilmez
- Farkli organizasyonlarin verileri birbirine ASLA karismamali
- Yeni tablo eklenince `supabase-rls.sql` dosyasina RLS politikasi da ekle

## Rol Yapisi
- **Super Admin** — tum organizasyonlari yonetir
- **Hastane Admin** — sadece kendi organizasyonunu yonetir
- **Personel** — sadece kendi egitim ve sinavlarini gorur

## Kod Yazma Kurallari

### Genel
- TypeScript strict mode — `any` tipi YASAK
- Zod ile tum input validasyonu zorunlu
- Magic number yok — sabitler ayri `constants.ts` dosyasinda
- `console.log` birakma — production'da logger kullan
- Her fonksiyon ve component icin JSDoc yorum

### Next.js
- App Router kullan, Pages Router KULLANMA
- Server Components varsayilan — gerekmedikce `"use client"` ekleme
- Form islemleri Server Actions ile
- API route'lari: `src/app/api/` altinda
- Her route icin `loading.tsx`, `error.tsx`, `not-found.tsx` olustur

### Veritabani
- Prisma migration her sema degisikliginde: `pnpm run db:generate` → `pnpm run db:migrate`
- Ham SQL yerine Prisma Client kullan
- Transaction gerektiren islemlerde `prisma.$transaction()` kullan
- Her sorguda `organizationId` ile filtrele

### UI / Frontend
- Mevcut Shadcn/ui componentlerini kullan, sifirdan yazma
- https://github.com/anthropics/skills/tree/main/skills/frontend-design skill'ini uygula:
  - Generic "AI slop" tasarimdan kac — kalin estetik kararlar al
  - Inter/Roboto/Arial/sistem fontlarindan kac
  - Mor gradient uzerine beyaz arka plandan kac
  - Hastane/saglik baglamina ozgu tasarim dili kullan

### Guvenlik
- `.env` dosyasina asla secret commit etme
- Her API endpoint'inde input sanitizasyonu
- Rate limiting kritik endpoint'lerde zorunlu
- CORS ayarlari production'da kisitli olmali

## Test Kurallari
- Her yeni feature icin Vitest unit testi
- Kritik kullanici akislari icin Playwright e2e testi
- Test coverage %80 altina dusurulmemelidir
- `pnpm test` her PR oncesi gecmeli

## Claude'dan Beklentiler
1. TypeScript tip guvenligini her zaman koru
2. Multi-tenant izolasyonunu asla atlama
3. Supabase RLS destekleyecek sekilde kod yaz
4. Server / Client Component ayrimina dikkat et
5. pnpm kullan, baska paket yoneticisi onerme
6. Mevcut Shadcn/ui componentlerini tercih et
7. Kullaniciya gosterilen hata mesajlarini Turkce yaz
8. Guvenlik acigi gorursen hemen uyar
9. Her onemli degisiklikten sonra test yazmayi hatirlat
10. https://github.com/VoltAgent/awesome-claude-code-subagents reposundaki `security-auditor` ve `typescript-pro` subagent yaklasimlarini benimse

---

## API Route Performans Checklist (ZORUNLU)

Her yeni API route yazarken asagidaki kurallar ZORUNLUDUR. `scripts/perf-check.js` pre-commit hook'u bu kurallari otomatik kontrol eder.

1. **Auth:** `getAuthUser()` kullan (asla `supabase.auth.getUser()` cagirma — HTTP round-trip yapar)
2. **Paralellestirme:** Bagimsiz Prisma sorgularini `Promise.all` ile calistir, ardisik `await` YASAK
3. **Select:** `include` yerine `select` kullan — sadece gereken alanlari cek
4. **Cache-Control:** GET handler'larinda `jsonResponse(data, 200, { 'Cache-Control': 'private, max-age=N' })` ekle
5. **Rate Limiting:** Write endpoint'lerinde (POST/PUT/DELETE) `checkRateLimit()` kullan (`@/lib/redis`)
6. **Error Handling:** Prisma cagrilarini `try/catch` ile sar, hatalari `logger.error()` ile logla
7. **Redis Cache:** Yogun GET route'larinda `getCached`/`setCached` kullan (`@/lib/redis`)
8. **Perf Logging:** Kritik route'lari `withPerfLogging()` ile sar (`@/lib/api-perf`) — >1s suren istekleri loglar

### Pre-commit Guard
`scripts/perf-check.js` — commit sirasinda API route dosyalarinda otomatik calisir:
- `supabase.auth.getUser()` tespit → **COMMIT ENGELLENIR**
- 5+ ardisik `await prisma` → **COMMIT ENGELLENIR**
- 3+ ardisik `await prisma` → **UYARI**
- GET handler'da `Cache-Control` eksik → **COMMIT ENGELLENIR**
- Nested `include` içinde `select` eksik → **UYARI**
- Client page'de 4+ memoize edilmemiş filter/map/reduce → **UYARI**
- False positive icin: `// perf-check-disable-line` satir yorumu ekle

---

## Client-Side Performans Kuralları (ZORUNLU)

Her yeni sayfa veya component değişikliğinde aşağıdaki kurallar ZORUNLUDUR:

1. **useMemo:** 3+ filter/map/reduce/sort zinciri varsa `useMemo` ile sar
2. **Hesaplama karmaşıklığı:** O(n*m) nested loop YASAK — Map/Set ile O(n+m) hash lookup kullan
3. **Provider'da API çağrısı:** AuthProvider mount'unda ağır API çağrısı yapma, `setTimeout` ile geciktir
4. **Gereksiz re-render:** `setInterval(fn, 1000)` gibi timer'lar ayrı memoized component'e taşınmalı
5. **useFetch:** Her `useFetch` çağrısının `isLoading` ve `error` state'leri kontrol edilmeli
6. **include vs select:** Prisma `include` kullanırken mutlaka `select` ile sadece gereken alanları çek
7. **Cache-Control:** Her GET API route'unda `Cache-Control` header ZORUNLU:
   - Sık değişen (bildirimler): `private, max-age=10, stale-while-revalidate=30`
   - Normal (eğitimler, takvim): `private, max-age=30, stale-while-revalidate=60`
   - Nadir değişen (profil, SMG): `private, max-age=60, stale-while-revalidate=120`
8. **Promise.all:** Bağımsız Prisma sorguları MUTLAKA `Promise.all` ile paralel çalıştırılmalı

---

## Auth & Redirect Döngüsü Önleme Kuralları (KRİTİK)

Bu kurallar geçmişte yaşanan sonsuz yenilenme döngülerinden çıkarılmıştır. MUTLAKA uyulmalıdır:

1. **Supabase cookie kontrolü:** `endsWith('-auth-token')` YASAK! Supabase SSR chunked cookie kullanır (`sb-xxx-auth-token.0`). Her zaman `includes('-auth-token')` kullan.
2. **useFetch 401 vs 403:** 401 = session expired (login'e yönlendir). 403 = yetkisiz (hata mesajı göster, redirect YAPMA). Bu iki durum ASLA karıştırılmamalı.
3. **Staff API route'ları:** `requireRole(dbUser.role, ['staff'])` YASAK! Middleware tüm rollere (`staff`, `admin`, `super_admin`) staff paneli erişimi verir → API da aynı rolleri kabul etmeli: `requireRole(dbUser.role, ['staff', 'admin', 'super_admin'])`.
4. **Layout auth guard:** Staff layout guard'ı middleware ile TUTARLI olmalı. Middleware izin veriyorsa layout engellemeMELİ.
5. **onAuthStateChange:** `TOKEN_REFRESHED` event'inde `setUser()` çağırma — gereksiz re-render döngüsü yaratır. Sadece `SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED` event'lerine tepki ver.
6. **useEffect dependency:** `fetchData` gibi callback'ler `useCallback(fn, [])` ile stabil olsa bile, useEffect dependency array'ine eklenmemeli — React Strict Mode'da döngü oluşturabilir.
7. **Loop guard:** `useFetch`'teki 401 redirect'i mutlaka loop guard içermeli: 30 saniyede 2+ redirect → döngü tespit → durdur.
8. **window.location vs router.push:** Login sonrası navigasyonda `window.location.href` kullan (full reload), `router.push` kullanma (SPA geçişi onAuthStateChange ile race condition yaratır).

---

## Otomatik Doğrulama Kuralı

Her kod değişikliğinden sonra aşağıdaki adımları sırayla uygula.
Kullanıcıdan onay bekleme, her şeyi kendin yap:

### 1. TypeScript Kontrolü
```bash
pnpm tsc --noEmit
```
Hata varsa → düzelt → tekrar çalıştır. Temiz geçene kadar devam et.

### 2. Lint Kontrolü
```bash
pnpm lint
```
Hata varsa → düzelt. Warning'leri geçebilirsin, error'ları geçemezsin.

### 3. Build Kontrolü
```bash
pnpm build --webpack
```
Build hatası varsa → hata mesajını oku → ilgili dosyayı düzelt → tekrar build al.
"Build failed" görürsen bir sonraki adıma geçme.

### 4. Test Kontrolü (ilgili dosya varsa)
```bash
pnpm test
```
Mevcut testler bozulduysa düzelt. Yeni önemli bir özellik eklediysen test dosyası da yaz.

### 5. Sorun Çözme Protokolü
Herhangi bir adımda hata alınırsa:
1. Hata mesajını tam oku
2. İlgili dosyayı aç ve satır numarasına git
3. Düzelt
4. Sadece o adımı tekrar çalıştır (tümünü baştan alma)
5. 3 denemede çözemediysen kullanıcıya hata mesajını göster ve sor

### 6. Adım Tamamlama Raporu
Tüm kontroller geçince kullanıcıya şu formatta özet ver:
```
✅ TypeScript — temiz
✅ Lint — temiz
✅ Build — başarılı
✅ Test — X test geçti
📁 Değiştirilen dosyalar: [liste]
➡️ Sıradaki adım: [adım adı]
```

---

## Öğrenilen Dersler

> Bu bölüm, projede karşılaşılan hatalar ve çözümlerinden çıkarılan kuralları içerir.
> Her göreve başlamadan önce bu bölümü oku ve geçmiş hataları tekrarlamamak için tüm kuralları uygula.
> Yeni bir bug fix veya çalışan çözüm bulunduğunda buraya otomatik olarak yeni bir kural eklenir.

### Middleware Public Routes Eksikliği
- **Problem**: Login API'si (`POST /api/auth/login`) çalışmıyordu — 302 redirect döndürüyordu
- **Kök Neden**: Middleware'in `publicRoutes` listesinde `/api/auth/` yoktu
- **Çözüm**: `/api/auth/` yolunu middleware'in public routes listesine ekle
- **Kural**: Yeni public API endpoint oluşturulduğunda mutlaka `src/lib/supabase/middleware.ts` → `publicRoutes` dizisine ekle
- **Tarih**: 2026-03-29

### Prisma Schema - DB Uyumsuzluğu
- **Problem**: Dashboard 500 hatası veriyordu
- **Kök Neden**: Schema'ya yeni modeller eklendi ama DB'de tablolar oluşturulmadı
- **Çözüm**: `pnpm setup` scripti (`prisma db push` ile otomatik sync)
- **Kural**: Schema değişikliğinden sonra mutlaka `pnpm db:generate` + `pnpm db:push` çalıştır
- **Tarih**: 2026-03-29

### GET Request'te DB Write Anti-Pattern
- **Problem**: Staff GET'te her istekte `prisma.user.update()` çağrılıyordu
- **Kök Neden**: Auto-fix logic GET içinde DB write olarak yapılıyordu
- **Çözüm**: In-memory çözümlemeye dönüştürüldü
- **Kural**: GET handler'larında asla DB write yapma. Data fix'ler migration/setup script olmalı
- **Tarih**: 2026-03-29

### jsPDF Türkçe Karakter Sorunu
- **Problem**: PDF'te İ, Ş, Ç, Ğ kırık görünüyordu
- **Kök Neden**: jsPDF Helvetica ASCII-only
- **Çözüm**: HTML → html2canvas-pro → Canvas → jsPDF yaklaşımı
- **Kural**: Türkçe PDF için jsPDF `.text()` kullanma — HTML template + html2canvas tercih et
- **Tarih**: 2026-03-29

### ExcelJS Client-Side Çalışmıyor
- **Problem**: Browser'da ExcelJS runtime hatası veriyordu
- **Kök Neden**: ExcelJS Node.js stream/Buffer API'lerine bağımlı
- **Çözüm**: FormData ile server'a gönder, server-side parse et
- **Kural**: ExcelJS her zaman server-side kullan. Client-side için SheetJS (xlsx) tercih et
- **Tarih**: 2026-03-29

### DB Hata Mesajı Kullanıcıya Expose
- **Problem**: DB hata detayları (tablo adları, kolon bilgileri) kullanıcıya gösteriliyordu
- **Kök Neden**: `errorResponse(\`DB hatası: \${dbError.message}\`)` ile iç hata mesajı iletiliyordu
- **Çözüm**: Güvenli Türkçe mesaj + `logger.error()` ile sunucu loguna yazma
- **Kural**: API hatalarında asla iç sistem detayı kullanıcıya gösterme
- **Tarih**: 2026-03-29

### useFetch Timeout ile API Race Condition — Stat Kartlar Gözükmüyor
- **Problem**: Dashboard stat kartları (Toplam Personel, Aktif Eğitim vb.) render edilmiyordu; sayfanın geri kalanı görünüyordu
- **Kök Neden**: `src/hooks/use-fetch.ts` timeout 8000ms; dashboard API 8s sürdüğünde AbortController tam anda tetikleniyor. Timeout hatası `setError(null)` ile sessizce yutulduğu için `data=null`, `isLoading=false`, `error=null` — boş sayfa render edildi
- **Çözüm 1**: `use-fetch.ts` timeout 8000ms → 20000ms (anlık düzeltme)
- **Çözüm 2**: Dashboard API'deki 6 ayrı trend DB sorgusunu tek sorguda birleştir (`src/app/api/admin/dashboard/route.ts`) → API süresi ~1-2s'ye düştü
- **Kural 1**: `useFetch` timeout, en yavaş API'nin 2 katı olmalı; timeout hatası asla sessiz yutulmamalı — abort hatası `setError(null)` ile yutulursa kullanıcı boş sayfa görür
- **Kural 2**: API route'larda döngü içinde `await prisma...` YASAK — tüm bağımsız sorgular tek `Promise.all` içinde paralel çalıştırılmalı
- **Kural 3**: `git pull` sonrası dashboard çalışmıyorsa önce `pnpm db:generate` çalıştır (Prisma client stale kalır)
- **Kural 4**: Vercel'de yavaşlama olursa ilk bakılacak yer: API route'larda sıralı `await` zinciri. Her `await prisma...` ayrı bir DB round-trip demektir.
- **Tarih**: 2026-03-30

### Vercel Performans — Yavaş Sayfa/Buton Sorunu
- **Problem**: Vercel'de bazı sayfalar ve butonlar çok yavaş yükleniyor
- **Kök Neden 1**: Dashboard API'de 6 bağımsız `await prisma...` sırayla çalışıyordu — toplam DB round-trip: 6
- **Kök Neden 2**: `useFetch` timeout 8000ms — yavaş API istekleri sessizce kesiliyordu
- **Kök Neden 3**: `recharts`, `lucide-react`, `framer-motion` gibi büyük kütüphaneler tam bundle halinde yükleniyordu
- **Çözüm 1**: Dashboard API tüm sorgular tek `Promise.all`'a taşındı → DB round-trip: 6 → 2
- **Çözüm 2**: `useFetch` timeout 8000ms → 20000ms; abort hatası artık kullanıcıya gösterilir
- **Çözüm 3**: `next.config.ts`'e `optimizePackageImports` eklendi (recharts, lucide-react, framer-motion)
- **Kural 1**: Yeni API route yazarken tüm bağımsız sorgular `Promise.all` ile çalıştırılmalı — sıralı `await` YASAK
- **Kural 2**: `useFetch` ile çekilen veriler boş görünüyorsa önce timeout ve sessiz hata yutma kontrol edilmeli
- **Kural 3**: `next.config.ts`'deki `optimizePackageImports` listesine yeni ağır kütüphaneler eklenmeli
- **Tarih**: 2026-03-30

### Next.js 16 + Turbopack ile PWA (next-pwa) Uyumsuzluğu
- **Problem**: `pnpm build` "This build is using Turbopack, with a `webpack` config" hatası veriyordu
- **Kök Neden**: Next.js 16'dan itibaren `next build` varsayılan olarak Turbopack kullanıyor; `@ducanh2912/next-pwa` ise Workbox webpack plugin kullandığından Turbopack ile çalışmıyor
- **Çözüm**: `package.json`'daki build script'ine `--webpack` flag'i eklendi: `"build": "prisma generate && next build --webpack"`
- **Kural**: `@ducanh2912/next-pwa` kullanan projelerde `next build` komutuna `--webpack` flag'i eklenmelidir; `next dev --turbopack` development'ta kullanılabilir ama build webpack gerektirir
- **Tarih**: 2026-03-30

### Next.js + Supabase Performans — Çift Auth HTTP Call ve Cache Eksikliği
- **Problem**: Her API request'te sayfa geçişleri ve login yavaştı. Local dev özellikle etkileniyordu.
- **Kök Neden 1**: `getAuthUser()` her API route'unda `supabase.auth.getUser()` çağırıyordu. Middleware zaten `getUser()` ile doğrulama yaptığından **çift HTTP round-trip** oluşturuyordu (~50-150ms ek gecikme per request).
- **Kök Neden 2**: Dashboard API 5000+ `trainingAssignment` kaydı çekip Node.js'de işliyordu; Redis cache yoktu, her page açılışında 12 DB sorgusu çalışıyordu.
- **Kök Neden 3**: `/api/auth/me` cache header'ı yoktu, AuthProvider mount'ta 3 sıralı HTTP call yapıyordu.
- **Çözüm 1**: `getAuthUser()` içinde `getUser()` → `getSession()` (local JWT parse, HTTP yok) — `src/lib/api-helpers.ts`
- **Çözüm 2**: `src/lib/redis.ts`'e `getCached`/`setCached`/`invalidateCache` helper'ları eklendi. Dashboard API 5 dk TTL ile cache'lendi — `src/app/api/admin/dashboard/route.ts`
- **Çözüm 3**: `/api/auth/me` response'a `Cache-Control: private, max-age=30` eklendi
- **Kural 1**: API route'larda `supabase.auth.getUser()` KULLANMA — middleware zaten doğruluyor. `getSession()` yeterli (local parse, network yok)
- **Kural 2**: Pahalı hesaplama yapan API route'larına Redis cache ekle (`getCached`/`setCached` `src/lib/redis.ts`'de). Aggregate dashboard gibi sorgular için 5 dk TTL idealdir.
- **Kural 3**: Data yazma (create/update/delete) sonrasında ilgili cache key'i `invalidateCache(key)` ile temizle
- **Kural 4**: Auth profil endpoint'lerine (`/api/auth/me` gibi) `Cache-Control: private, max-age=30` ekle
- **Tarih**: 2026-03-31
