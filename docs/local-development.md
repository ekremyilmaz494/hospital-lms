# Yerel Geliştirme Ortamı (Local Supabase)

> **Neden bu doküman var:** 2026-05-20'de bir DR tatbikatı sırasında yıkıcı
> scriptler **production** veritabanına çalıştırıldı; 143 personelin parolası
> kayboldu. Kök neden: laptoptaki `.env.local` production'a bakıyordu ve ayrı bir
> yerel veritabanı yoktu. Bu doküman, geliştirmenin **tamamen yerel** bir
> Supabase üzerinde yapılmasını sağlar — laptopta prod credential'ı bulunmazsa,
> hiçbir komut prod'u bozamaz.

## Kural

- **Günlük geliştirme yereldedir.** `.env.local` yalnızca local Supabase'e bakar.
- **Production credential'ı laptopta tutulmaz.** Prod env'i yalnızca Vercel'de yaşar.
- `env:pull:prod` komutu **kullanılmaz** (prod sırlarını laptopa indirir).

## Ön koşullar

1. **Docker Desktop** — local Supabase stack'i Docker container'larında çalışır.
   https://www.docker.com/products/docker-desktop/
2. **Supabase CLI**
   ```bash
   brew install supabase/tap/supabase
   supabase --version   # kurulumu doğrula
   ```

## İlk kurulum (tek seferlik)

```bash
# 1. Repo kökünde local Supabase projesini başlat
#    (supabase/config.toml üretir — CLI sürümüne uygun)
supabase init

# 2. Local stack'i ayağa kaldır (ilk seferde imaj indirir, birkaç dakika)
supabase start
#    Çıktıda şunlar yazılır — NOT AL:
#      API URL          → http://127.0.0.1:54321
#      DB URL           → postgresql://postgres:postgres@127.0.0.1:54322/postgres
#      Studio URL       → http://127.0.0.1:54323
#      anon key         → eyJ...
#      service_role key → eyJ...

# 3. Yerel env dosyasını oluştur
cp .env.local.example .env.local
#    .env.local'i aç, <...> alanlarını yukarıdaki anon/service_role key ile doldur.
#    ENCRYPTION_KEY / BACKUP_ENCRYPTION_KEY için YENİ değer üret:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 4. Şemayı yerel DB'ye uygula (prisma/migrations/ → boş local DB)
cd apps/web
pnpm exec prisma migrate deploy
pnpm db:generate

# 5. RLS politikaları + demo veri (her ikisi de guard'lı — local'de sorunsuz çalışır)
node scripts/apply-rls.js
DEMO_PASSWORD=DemoLocal123! node scripts/seed-demo.js

# 6. Başlat
pnpm dev
```

## Günlük akış

```bash
supabase start      # stack kapalıysa
cd apps/web && pnpm dev
supabase stop       # iş bitince (opsiyonel — container'ları durdurur)
```

`pnpm dev` artık güvenli: `predev` aşamasındaki `sync-db.js`, prod tespit ederse
migration'ı **atlar** (incident sonrası eklenen koruma). Yerel ortamda zaten prod
yoktur, migration normal çalışır.

## Şema değişikliği

```bash
cd apps/web
pnpm db:migrate dev --name <açıklayıcı-isim>   # yerel DB'de migration üret + uygula
```

Migration dosyası `prisma/migrations/` altına yazılır, commit edilir. Production'a
deploy, Vercel build'inde otomatik (`prisma-migrate-prod-only.js`) — laptoptan
prod'a migration **çalıştırılmaz**.

## Doğru ortamda olduğunu doğrula

```bash
cd apps/web
grep -E '^(DATABASE_URL|NEXT_PUBLIC_SUPABASE_URL)=' .env.local
# 127.0.0.1 / localhost görmelisin. 'pkkkyyajfmusurcoovwt' GÖRÜRSEN prod'dasın — DUR.
```

Yıkıcı scriptler (`wipe-*`, `setup`, `seed-*`) bir production proje ref'i tespit
ederse otomatik **abort** eder (`scripts/_guard.ts` / `_guard.cjs`). Bilinçli
olarak prod'da çalıştırman gerekirse `--i-understand-production` bayrağı şarttır.

## Production'a karşı iş yapmak gerekirse

Nadir ve bilinçli bir istisnadır. Asla `.env.local`'i prod'a çevirme; bunun
yerine komuta özel env ver ve override bayrağını ekle:

```bash
DATABASE_URL="$PROD_URL" npx tsx scripts/<script>.ts --i-understand-production
```

Yıkıcı bir işlemse: önce yedek/PITR doğrula, sonra çalıştır. Bkz. incident
önleme planı (`.claude/plans/hospital-lms-incident-prevention.md`).

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `supabase start` Docker hatası | Docker Desktop açık mı? `docker ps` çalışıyor mu? |
| Port 54321/54322 kullanımda | `supabase stop` sonra tekrar `start`; başka stack çalışıyor olabilir |
| Prisma "relation does not exist" | `prisma migrate deploy` çalıştırılmamış (kurulum adım 4) |
| Login çalışmıyor | `seed-demo.js` çalıştırıldı mı? `DEMO_PASSWORD` ile giriş dene |
| Guard "PRODUCTION KORUMASI" veriyor | `.env.local` prod'a bakıyor — local değerlere çevir |
