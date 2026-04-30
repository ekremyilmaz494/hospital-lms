# CLAUDE.md

Bu dosya Claude Code'a bu repoda çalışırken yol gösterir.

## ⚠️ Next.js 16 Uyarısı
Proje **Next.js 16** kullanır — önceki sürümlerden kırıcı değişiklikler var. Next.js'e özel kod yazmadan önce `node_modules/next/dist/docs/` altındaki rehberi oku. API'ler, konvansiyonlar ve dosya yapısı eski sürümlerden farklı olabilir.

## Proje Tanımı
**Hospital LMS** — Hastane Personel Eğitim ve Sınav Yönetim Sistemi (LMS).
Multi-tenant SaaS — her hastane (organization) birbirinden tamamen izole.
Türkçe UI (`lang="tr"`).

## Komutlar

```bash
pnpm dev          # Dev server (Turbopack)
pnpm build        # Production build (migrate-on-prod + prisma generate + next build)
pnpm lint         # ESLint
pnpm start        # Production build serve
pnpm tsc --noEmit # Type check

# Test
pnpm test                                           # Vitest unit
pnpm test:watch                                     # Watch mode
pnpm test -- src/lib/__tests__/validations.test.ts  # Tek dosya
pnpm test:e2e                                       # Playwright
pnpm test:e2e -- --grep "login"                     # İsimle filtre

# Prisma
pnpm db:generate  # Client generate → src/generated/prisma
pnpm db:migrate   # Migration çalıştır (şema değişikliğinde ZORUNLU)
pnpm db:studio    # DB GUI
pnpm db:push      # ⚠️ YASAK — sadece tek seferlik yerel deneme. Migration dosyası üretmez, drift yaratır.

# Scriptler
node scripts/seed-demo.js        # Demo data
npx tsx scripts/seed-users.ts    # User seed
node scripts/apply-rls.js        # RLS policy uygula
```

## Pre-commit Hook'ları
Husky + lint-staged → `scripts/secret-scanner.js` + `scripts/perf-check.js` çalışır. Secret veya perf ihlali varsa commit engellenir.

## Mimari

### Panel yapısı
- **Super Admin** (`/super-admin/*`) — Hastaneler, abonelikler, platform raporları
- **Hospital Admin** (`/admin/*`) — Eğitim wizard'ı, personel, raporlar, sertifikalar
- **Staff** (`/staff/*`) — Atanan eğitimler, sertifikalar, takvim
- **Exam** (`/exam/[id]/*`) — Fullscreen: pre-exam → video → post-exam

### Eğitim akışı
Atama → Ön sınav → Video (ileri sarma yok) → Son sınav → Geçti/Kaldı (retry)

### Tech Stack
- Next.js 16 (App Router, RSC) + React 19 + TypeScript + Tailwind 4
- Supabase (Auth + Realtime + RLS)
- Prisma 7 + PostgreSQL (51 model, `@map` snake_case)
- AWS S3 + CloudFront (presigned URL)
- Upstash Redis (timer + rate limit + cache)
- Nodemailer (SMTP)
- ExcelJS (server-side) + jsPDF + html2canvas-pro
- shadcn/ui + Zustand + TanStack Table + Recharts + Framer Motion
- react-hook-form + zod v4
- Vitest + Playwright

### Path alias
`@/*` → `./src/*`

### Proje yapısı
- `src/app/api/` — API route'lar (auth, super-admin, admin, staff, exam, cron)
- `src/components/shared/` — stat-card, page-header, data-table, notification-bell
- `src/components/layouts/` — Sidebar (role-aware `sidebar-config.ts`), topbar
- `src/components/providers/` — Theme, Auth, SessionTimeout, Toast
- `src/lib/` — api-helpers, validations (zod), s3, redis, email, exam-helpers
- `src/hooks/` — use-realtime-notifications, use-session-timeout, use-fetch
- `src/store/` — Zustand state
- `src/types/database.ts` — Entity tipleri
- `src/generated/prisma/` — Prisma client (tsconfig'de hariç tutuldu)

### API Route Pattern
**Tüm authenticated route'lar için `withApiHandler` (veya preset'leri) ZORUNLU** — auth, role, write-guard, error handling ve audit helper'ı tek noktada toplar. Mevcut 180 route Faz 1-7 ile migrate edildi (admin, staff, super-admin, exam, feedback, certificates, authenticated auth). Eski helper'lar (`getAuthUser`, `requireRole`, `checkWritePermission`) hâlâ public ama YENİ route'larda KULLANMA — sadece pure-Supabase auth route'ları (login/register/mfa/sso-callback) ve cron route'ları (CRON_SECRET pattern) wrapper dışında bırakıldı.

```typescript
import { withAdminRoute } from '@/lib/api-handler';
import { jsonResponse, ApiError, parseBody } from '@/lib/api-helpers';

export const POST = withAdminRoute<{ id: string }>(
  async ({ request, params, dbUser, organizationId, audit }) => {
    const body = await parseBody<MySchema>(request);
    if (!body) throw new ApiError('Geçersiz veri', 400);

    const created = await prisma.foo.create({
      data: { ...body, organizationId },
    });

    await audit({
      action: 'foo.create',
      entityType: 'foo',
      entityId: created.id,
      newData: created,
    });

    return jsonResponse(created, 201);
  },
);
```

Preset'ler:
- `withAdminRoute` — `['admin', 'super_admin']`
- `withStaffRoute` — `['staff', 'admin', 'super_admin']`
- `withSuperAdminRoute` — `['super_admin']` + `strict: true` (cryptographic JWT)
- `withApiHandler` — özel kombinasyonlar için (örn. `{ public: true }` veya `{ writeGuard: false }`)

Otomatik davranışlar:
- POST/PUT/PATCH/DELETE'te `checkWritePermission` (subscription guard) **otomatik çalışır**
- `ApiError` throw edilirse `errorResponse`'a çevrilir
- Yapılandırılmamış hatalar Sentry'e gider, kullanıcıya generic 500
- `audit()` helper'ı `userId/organizationId/request`'i otomatik doldurur

**`requireOrganization: true`** — tenant-scoped mutation route'ları için ZORUNLU:
```typescript
export const PUT = withAdminRoute<{ id: string }>(async ({ params, organizationId, audit }) => {
  // organizationId tipi `string` (non-null garantili) — `!` veya null check yok
  // ...
}, { requireOrganization: true });
```
super_admin null `organizationId` ile gelirse 400 döner, route'a girmez. Bu, "global kayıtları (organizationId=null) hospital admin route'undan değiştirme" tuzağını engeller (`null !== null === false` bug'ı).

### Auth & Security
- Supabase Auth JWT, cookie'de saklanır (`@supabase/ssr`)
- Client helpers: `src/lib/supabase/{client,server,middleware}.ts`
- Public routes: `/auth/login`, `/auth/callback`, `/auth/forgot-password`, `/api/auth/*`
- Rol bilgisi: `user.user_metadata.role` → `super_admin` | `admin` | `staff`
- `service_role` sadece sunucu tarafında (admin user create için)
- RLS tüm tablolarda aktif — `supabase-rls.sql`

### Prisma
- Client: `src/generated/prisma` → `@/generated/prisma/client` import
- Singleton: `src/lib/prisma.ts` (PrismaPg adapter)
- Konvansiyon: camelCase field + `@map("snake_case")`, UUID ID'ler
- Multi-tenant: tüm modellerde `organizationId`

### Next.js config
- `proxyClientMaxBodySize: '512mb'` (video upload)
- Security headers: HSTS, X-Frame-Options DENY, CSP, XSS
- CORS: `/api/*` → `NEXT_PUBLIC_APP_URL`
- `optimizePackageImports`: recharts, lucide-react, framer-motion

### Design System
- Font: Plus Jakarta Sans (display), Inter (body), JetBrains Mono (mono)
- Primary: `#0d9668` · Accent: `#f59e0b` · BG: `#f1f5f9`
- CSS variable'larla theming — raw Tailwind renk class'ı YASAK
- Cards: `rounded-2xl` + hover lift · Badges: `rounded-full` + dot
- `transition-all` YASAK — property'yi açıkça belirt

---

## 🔒 Multi-Tenant Güvenlik (KRİTİK)
- Her DB sorgusunda `organizationId` filtresi **ZORUNLU**
- Supabase RLS her tabloda aktif olmalı
- `service_role_key` client'a **ASLA** expose edilmez
- Yeni tablo → `supabase-rls.sql`'a RLS policy ekle

---

## 📝 Kod Yazma Kuralları

### TypeScript & Validation
- Strict mode — `any` **YASAK**
- Zod ile tüm input validasyonu zorunlu
- Magic number yok — `constants.ts` kullan
- `console.log` yok — `logger` kullan
- Public helper ve hook'lar (`src/lib/`, `src/hooks/`) için JSDoc — her küçük component'e JSDoc ekleme, sadece parametresi/davranışı belirsiz olanlara

### Next.js
- App Router zorunlu, Pages Router **YASAK**
- Server Component varsayılan — gerekmedikçe `"use client"` ekleme
- Form işlemleri Server Actions ile
- Her route için `loading.tsx`, `error.tsx`, `not-found.tsx`

### Veritabanı (KRİTİK)
- Ham SQL yerine Prisma Client
- Transaction gerektiren işlemlerde `prisma.$transaction()`
- **Şema değişikliği workflow'u:** `pnpm db:migrate dev --name <açıklayıcı-isim>` ZORUNLU. Bu komut hem `schema.prisma`'yı hem `prisma/migrations/`'ı senkron tutar + Prisma client'ı yeniden üretir
- **`pnpm db:push` YASAK** — migration dosyası üretmez, prod DB ile `migrations/` arasında drift yaratır (Nisan 2026'da 8 tablo + 40 kolon drift oldu, fresh ortam kurulumunu kırdı)
- Her `schema.prisma` commit'inde `prisma/migrations/` altında yeni klasör olmalı
- Migration SQL'i fresh DB'de çalışmalı: `UPDATE`/`ALTER` için `IF EXISTS` veya `DO $$` bloğu kullan
- CI'da drift detector çalışır (`.github/workflows/ci.yml` → "Migration drift check"). Drift varsa PR merge edilemez

### UI / Frontend
- Mevcut shadcn/ui component'lerini kullan, sıfırdan yazma
- Generic "AI slop" tasarımdan kaç — kalın estetik kararlar al
- Inter/Roboto/Arial/sistem fontlarından kaç
- Mor gradient + beyaz arka plandan kaç
- Hastane/sağlık bağlamına özgü tasarım dili

### Kullanıcı mesajları
- Tüm hata mesajları Türkçe
- İç sistem detayı (DB tablo/kolon adı) **ASLA** kullanıcıya gösterme → `logger.error()` ile sunucu loguna yaz

---

## ⚡ Performans Kuralları (ZORUNLU)

`scripts/perf-check.js` pre-commit hook bu kuralları kontrol eder.

### API Route
1. **Auth:** Yeni route'larda `withApiHandler` (veya preset) ZORUNLU; eski helper'lar (`getAuthUser`, `requireRole`) yeni route'larda kullanılmaz. Wrapper içinde de `supabase.auth.getUser()` doğrudan çağrılmaz — `dbUser` context'i kullan (HTTP round-trip yok, middleware zaten doğruluyor)
2. **Paralellik:** Bağımsız Prisma sorguları **MUTLAKA** `Promise.all` — ardışık `await prisma` **YASAK**
3. **Select vs Include:** `include` yerine `select` — sadece gereken alanları çek. Nested `include` içinde bile `select` kullan
4. **Cache-Control (GET'te zorunlu):**
   - Sık değişen (bildirim): `private, max-age=10, stale-while-revalidate=30`
   - Normal (eğitim, takvim): `private, max-age=30, stale-while-revalidate=60`
   - Nadir değişen (profil, SMG): `private, max-age=60, stale-while-revalidate=120`
5. **Rate Limit:** Write endpoint'lerde (POST/PUT/DELETE) `checkRateLimit()` (`@/lib/redis`)
6. **Error:** Prisma çağrıları `try/catch` + `logger.error()`
7. **Redis Cache:** Yoğun GET'lerde `getCached`/`setCached` — write sonrası `invalidateCache(key)`
8. **Perf Log:** Kritik route'ları `withPerfLogging()` ile sar (>1s loglanır)
9. **GET'te DB write YASAK** — auto-fix logic migration/setup script'te olmalı

### Client-side
1. **useMemo:** 3+ filter/map/reduce/sort zinciri → `useMemo`
2. **O(n×m) yasak:** Nested loop yerine Map/Set ile O(n+m) hash lookup
3. **Provider'da ağır iş yok:** AuthProvider mount'ta ağır API → `setTimeout` ile geciktir
4. **Timer'lar ayrı component:** `setInterval(fn, 1000)` → memoize edilmiş ayrı component'te
5. **useFetch:** Her çağrıda `isLoading` + `error` kontrol et
6. **useFetch timeout:** En yavaş API'nin 2 katı olmalı (şu an 20s). Abort hatası **ASLA** sessiz yutma

### perf-check.js engelleri
- `supabase.auth.getUser()` → **COMMIT ENGEL**
- 5+ ardışık `await prisma` → **COMMIT ENGEL**
- 3+ ardışık `await prisma` → uyarı
- GET'te `Cache-Control` yok → **COMMIT ENGEL**
- Nested `include` içinde `select` yok → uyarı
- 4+ memoize edilmemiş filter/map/reduce → uyarı
- False positive → `// perf-check-disable-line`

---

## 🔐 Auth & Redirect Döngüsü Önleme (KRİTİK)

Geçmiş sonsuz yenilenme döngülerinden çıkarılmış kurallar:

1. **Cookie kontrolü:** `endsWith('-auth-token')` **YASAK** — Supabase SSR chunked cookie kullanır (`sb-xxx-auth-token.0`). Her zaman `includes('-auth-token')`
2. **401 vs 403:** 401 = session expired (login'e yönlendir). 403 = yetkisiz (hata göster, redirect **YAPMA**). Karıştırma
3. **Staff API rol guard'ı:** `requireRole(dbUser.role, ['staff'])` **YASAK** — Middleware tüm rollere staff paneli verir. API de aynı olmalı: `requireRole(dbUser.role, ['staff', 'admin', 'super_admin'])`
4. **Layout guard ↔ Middleware tutarlılığı:** Middleware izin veriyorsa layout engellemeMELİ
5. **onAuthStateChange:** `TOKEN_REFRESHED` event'inde `setUser()` **ÇAĞIRMA** — gereksiz re-render. Sadece `SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`
6. **useEffect deps:** `useCallback(fn, [])` stabil olsa bile `fetchData`'yı dependency array'e **EKLEME** (Strict Mode'da döngü)
7. **Loop guard:** 401 redirect'i 30s'de 2+ → döngü tespit → durdur
8. **Login sonrası navigasyon:** `window.location.href` kullan (full reload) — `router.push` **YASAK** (onAuthStateChange ile race condition)

---

## ✅ Otomatik Doğrulama Protokolü

Kod değişikliğinden sonra sırayla uygula:

**Her değişiklikte (hızlı):**
1. **TypeScript:** `pnpm tsc --noEmit` — hata varsa düzelt
2. **Lint:** `pnpm lint` — error'lar geçmez

**PR açmadan / commit öncesi (ağır):**
3. **Test:** `pnpm test` — mevcut testler bozulduysa düzelt
4. **Build:** `pnpm build` — sadece deploy/PR öncesi. Next.js 16 build'i dakikalar sürer, her küçük değişiklikte çalıştırma

3 denemede çözülmezse → kullanıcıya hata mesajını göster ve sor.

### Tamamlama raporu formatı
```
✅ TypeScript — temiz
✅ Lint — temiz
✅ Test — X test geçti  (PR öncesi: ✅ Build — başarılı)
📁 Değiştirilen dosyalar: [liste]
➡️ Sıradaki adım: [adım]
```

---

## 🧪 Test Kuralları
- Her yeni feature → Vitest unit testi
- Kritik kullanıcı akışı → Playwright e2e
- Coverage %80 altına düşmemeli
- `pnpm test` her PR öncesi geçmeli

---

## Claude'dan Beklentiler

(Yukarıdaki bölümlerde geçmeyen ek davranışlar. Diğer kurallar ilgili başlıklarında.)

1. `pnpm` kullan — `npm`/`yarn` önerme
2. Güvenlik açığı gördüğünde hemen uyar (kullanıcı sormasa bile)
3. Önemli değişiklikten sonra test yazmayı hatırlat
4. Server/Client Component ayrımına dikkat — Server Component varsayılan, `"use client"` sadece gerektiğinde

---

## 🚀 Deploy
- **Vercel** — Next.js hosting (`vercel.json`, `fra1` region)
- **Supabase** — PostgreSQL + Auth + Realtime
- **AWS** — S3 + CloudFront
- **Upstash** — Redis
- Cron: `/api/cron/cleanup` günlük 03:00 UTC (stale attempt, eski bildirim, audit rotation)
