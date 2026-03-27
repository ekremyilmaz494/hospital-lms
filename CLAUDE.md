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
- Generated client at `src/generated/prisma` (import from `@/generated/prisma/client`)
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

## Demo Giris Bilgileri
- Super Admin: `super@demo.com` / `demo123456`
- Hastane Admin: `admin@demo.com` / `demo123456`
- Personel: `staff@demo.com` / `demo123456`

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
