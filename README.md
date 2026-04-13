# Hastane LMS

Çoklu hastane (organization) desteğine sahip, Next.js, Prisma, Supabase ve Tailwind CSS ile geliştirilmiş Profesyonel Personel Eğitim ve Sınav Yönetim Sistemi.

## İçindekiler
- [Teknoloji Yığını](#teknoloji-yığını)
- [Kurulum Adımları](#kurulum-adımları)
- [Veritabanı ve Supabase Yapılandırması](#veritabanı-ve-supabase-yapılandırması)
- [RLS ve Güvenlik](#rls-ve-güvenlik)
- [Demo Verileri](#demo-verileri)

## Teknoloji Yığını
- **Frontend Framework:** Next.js 15 (App Router, Turbopack)
- **Styling:** Tailwind CSS v4, Base UI, Shadcn/ui
- **Veritabanı & Auth:** Supabase (PostgreSQL), Prisma ORM
- **Durum Yönetimi:** Zustand, React Hook Form + Zod
- **Grafik & UI Bileşenleri:** Recharts, Framer Motion

## Kurulum Adımları

### 1. Gereksinimler
- Node.js `v20+`
- Pnpm (Önerilen) veya npm/yarn

### 2. Projeyi Klonlama ve Kurulum
```bash
git clone <repository-url>
cd hospital-lms
pnpm install
```

### 3. Çevresel Değişkenleri Hazırlama
`.env.example` dosyasını kopyalayarak `.env` oluşturun:
```bash
cp .env.example .env
```
Ardından aşağıdaki değişkenleri kendi Supabase projenizden alıp doldurun:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Sadece admin/sunucu işlemleri için)
- `DATABASE_URL` (Transaction pooler adresi `pgbouncer=true` ile önerilir)
- `DIRECT_URL` (Session pooler adresi)
- `DEMO_PASSWORD` (Seed scriptleri için zorunlu)

### 4. Prisma Setup
```bash
pnpm run db:generate
pnpm run db:migrate
```

## Veritabanı ve Supabase Yapılandırması
Supabase'de projenizi kurarken Auth (Kimlik Doğrulama) şemasını etkinleştirmelisiniz.
Prisma Schema veritabanının yapısını belirler. Ortak (multi-tenant) veri yapısı `organizationId` baz alınarak ayrılmıştır.

## RLS ve Güvenlik (Önemli)
Supabase veritabanındaki her tabloya RLS (Row Level Security) politikaları uygulanmalıdır. Uygulanmadığı takdirde farklı kurumların verileri birbirine karışabilir.

RLS politikalarını Supabase'e uygulamak için:
```bash
node scripts/apply-rls.js
```
> **Not:** RLS uygulandıysa veritabanına Dashboard'dan doğrudan müdahale etmek yerine `service_role_key` kullanmanız gerekebilir.

## Demo Verileri
Eğitim sisteminin özelliklerini test etmek ve hızlı bir ortam kurmak için sahte (seed) verilerini çalıştırabilirsiniz:
```bash
node scripts/seed-demo.js
```

## Projeyi Çalıştırma
```bash
pnpm run dev
```
Uygulama yayına `http://localhost:3000` adresinde başlayacaktır.
