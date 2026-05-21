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
- **Env dosyasının doğru yeri `apps/web/.env.local`** — Next.js ve Prisma bu
  konumu okur, repo kökünü değil. Repo kökünde ayrı bir `.env.local` tutma.

## Ön koşullar

### 1. Docker Desktop

Local Supabase stack'i Docker container'larında çalışır.

**Windows** (yönetici PowerShell):

```powershell
winget install -e --id Docker.DockerDesktop
```

Kurulum sonrası Docker Desktop'ı başlat; ilk açılışta **WSL2 backend**'i
etkinleştirmesine izin ver (gerekirse bir kez yeniden başlatma ister).
Doğrulama: yeni bir terminalde `docker ps` hatasız çalışmalı.

**macOS:**

```bash
brew install --cask docker
```

Manuel indirme (her platform): https://www.docker.com/products/docker-desktop/

### 2. Supabase CLI

**Önerilen — proje-yerel kurulum (her platform, sürüm kilitli):**

```bash
pnpm add -D -w supabase          # workspace köküne devDependency olarak ekle
pnpm exec supabase --version     # kurulumu doğrula
```

Bu yöntemde CLI sürümü `package.json`'da kilitlenir (CI ile birebir aynı) ve
`brew`/`scoop` gerekmez. Tüm `supabase ...` komutlarını `pnpm exec supabase ...`
olarak çalıştır.

**Alternatif — OS-native global kurulum:**

- **Windows (scoop):**
  ```powershell
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase
  ```
- **macOS / Linux (brew):**
  ```bash
  brew install supabase/tap/supabase
  ```

> Aşağıdaki adımlarda komutlar `supabase ...` diye yazılı. **Proje-yerel
> kurduysan** her birinin başına `pnpm exec` ekle (`pnpm exec supabase start`).

## İlk kurulum (tek seferlik)

```bash
# 1. Repo kökünde local Supabase projesini başlat
#    (supabase/config.toml üretir — commit edilir)
supabase init

# 2. Local stack'i ayağa kaldır (ilk seferde imaj indirir, birkaç dakika)
supabase start
#    Çıktıda şunlar yazılır — NOT AL:
#      API URL          → http://127.0.0.1:54321
#      DB URL           → postgresql://postgres:postgres@127.0.0.1:54322/postgres
#      Studio URL       → http://127.0.0.1:54323
#      anon key         → eyJ...
#      service_role key → eyJ...
```

**3. Yerel env dosyasını oluştur — konum `apps/web/.env.local`:**

Windows (PowerShell):

```powershell
Copy-Item .env.local.example apps\web\.env.local
# ENCRYPTION_KEY / BACKUP_ENCRYPTION_KEY için YENİ değer üret:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

macOS / Linux:

```bash
cp .env.local.example apps/web/.env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`apps/web/.env.local`'i aç:
- `<...>` alanlarını `supabase start` çıktısındaki anon / service_role key ile doldur.
- API URL / DB URL alanlarına yukarıdaki `127.0.0.1` adreslerini yaz.
- `ENCRYPTION_KEY` ve `BACKUP_ENCRYPTION_KEY` için **yeni üretilen** değeri kullan
  — prod'unkini ASLA kopyalama.

```bash
# 4. Şemayı yerel DB'ye uygula (prisma/migrations/ → boş local DB)
cd apps/web
pnpm exec prisma migrate deploy
pnpm db:generate

# 5. RLS politikaları + demo veri (ikisi de guard'lı — local'de sorunsuz çalışır)
node scripts/apply-rls.js
```

Demo veri — Windows (PowerShell):

```powershell
$env:DEMO_PASSWORD = "DemoLocal123!"; node scripts/seed-demo.js  # secret-scanner-disable-line
```

macOS / Linux:

```bash
DEMO_PASSWORD=DemoLocal123! node scripts/seed-demo.js
```

```bash
# 6. Başlat
pnpm dev
```

## Günlük akış

```bash
supabase start                  # stack kapalıysa (proje-yerel: pnpm exec supabase start)
cd apps/web && pnpm dev
supabase stop                   # iş bitince (opsiyonel — container'ları durdurur)
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

Windows (PowerShell):

```powershell
Select-String -Path apps\web\.env.local -Pattern '^(DATABASE_URL|NEXT_PUBLIC_SUPABASE_URL)='
```

macOS / Linux:

```bash
grep -E '^(DATABASE_URL|NEXT_PUBLIC_SUPABASE_URL)=' apps/web/.env.local
```

`127.0.0.1` / `localhost` görmelisin. `pkkkyyajfmusurcoovwt` (prod ref) GÖRÜRSEN
prod'dasın — **DUR**, yerel değerlere çevir.

Yıkıcı scriptler (`wipe-*`, `setup`, `seed-*`) bir production proje ref'i tespit
ederse otomatik **abort** eder (`apps/web/scripts/_guard.ts` / `_guard.cjs`).
Bilinçli olarak prod'da çalıştırman gerekirse `--i-understand-production` bayrağı
şarttır.

## Production'a karşı iş yapmak gerekirse

Nadir ve bilinçli bir istisnadır. Asla `.env.local`'i prod'a çevirme; bunun
yerine komuta özel env ver ve override bayrağını ekle:

Windows (PowerShell):

```powershell
$env:DATABASE_URL = $PROD_URL; npx tsx scripts/<script>.ts --i-understand-production
```

macOS / Linux:

```bash
DATABASE_URL="$PROD_URL" npx tsx scripts/<script>.ts --i-understand-production
```

Yıkıcı bir işlemse: önce yedek/PITR doğrula, sonra çalıştır.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `supabase start` Docker hatası | Docker Desktop açık mı? `docker ps` çalışıyor mu? |
| Port 54321/54322 kullanımda | `supabase stop` sonra tekrar `start`; başka stack çalışıyor olabilir |
| `supabase` komutu bulunamadı | Proje-yerel kurduysan `pnpm exec supabase ...` kullan |
| Prisma "relation does not exist" | `prisma migrate deploy` çalıştırılmamış (kurulum adım 4) |
| Login çalışmıyor | `seed-demo.js` çalıştırıldı mı? `DEMO_PASSWORD` ile giriş dene |
| Guard "PRODUCTION KORUMASI" veriyor | `.env.local` prod'a bakıyor — local değerlere çevir |
