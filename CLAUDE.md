# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev          # Start dev server (Next.js 16, Turbopack)
pnpm build        # Production build
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
- **Hospital Admin** (`/admin/*`) — Manages trainings (4-step wizard), staff, reports (6-tab), backups, notifications, export (Excel/PDF)
- **Staff** (`/staff/*`) — Views assigned trainings, calendar, profile, notifications
- **Exam** (`/exam/[id]/*`) — Fullscreen routes (no sidebar): pre-exam → video player → post-exam

### Training flow
Assignment → Pre-exam → Watch videos (no fast-forward) → Post-exam → Pass/fail with retry attempts

### Key tech stack
- **Next.js 16** (App Router, RSC), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Supabase Auth** (JWT, role-based middleware, RLS), **Supabase Realtime** (notifications)
- **Prisma 7** with PostgreSQL (15 models, `@map` snake_case table/column names)
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
- `src/app/api/admin/` — Staff CRUD, trainings CRUD (videos, questions, assignments), reports, notifications, audit-logs, backups, export (Excel/PDF)
- `src/app/api/staff/` — My trainings, notifications, profile, calendar
- `src/app/api/exam/[id]/` — Start attempt, submit answers, video progress, streaming URLs, timer
- `src/app/api/cron/cleanup/` — Daily cleanup at 03:00 UTC (Vercel Cron)

### Auth & security
- Supabase Auth with JWT tokens stored in cookies (`@supabase/ssr`)
- Three Supabase client helpers in `src/lib/supabase/`:
  - `client.ts` — Browser client (`createBrowserClient`)
  - `server.ts` — Server client (`createClient()`) + service role client (`createServiceClient()`)
  - `middleware.ts` — Session refresh + role-based route guards
- `src/lib/api-helpers.ts` — `getAuthUser()`, `requireRole()`, `createAuditLog()`, `parseBody()`
- `supabase-rls.sql` — Complete RLS policies for all 15 tables (run in Supabase SQL Editor after migrations)
- API routes use `service_role` key only for admin user creation; all other operations use user JWT
- Roles stored in `user.user_metadata.role`: `super_admin`, `admin`, `staff`

### Prisma conventions
- Generated client at `src/generated/prisma` (import from `@/generated/prisma/client`)
- Singleton instance in `src/lib/prisma.ts` using `PrismaPg` adapter
- Models use camelCase fields with `@map("snake_case")` for DB columns and `@@map("table_name")` for tables
- All IDs are UUIDs (`@db.Uuid`)

### Project structure
- `src/components/shared/` — Reusable: stat-card, page-header, chart-card, data-table, notification-bell
- `src/components/layouts/` — App sidebar (role-aware config) and topbar
- `src/components/providers/` — ThemeProvider (next-themes), AuthProvider (Supabase session listener)
- `src/types/database.ts` — TypeScript types for all entities
- `src/lib/validations.ts` — Zod v4 schemas for all API inputs
- `src/lib/s3.ts` — S3 upload/download/stream/delete helpers
- `src/lib/redis.ts` — Exam timer, rate limiting
- `src/lib/email.ts` — SMTP transporter + Turkish HTML email templates
- `src/hooks/use-realtime-notifications.ts` — Supabase Realtime postgres_changes listener

### Design system
- Fonts: Syne (`--font-display`, headings), DM Sans (`--font-body`), JetBrains Mono (`--font-mono`)
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
