# Felaket-Kurtarma (DR) Restore Tatbikatı

`super-admin/restore` yıkıcı bir endpoint: bir kurumun tüm verisini silip yedekten geri yazar.
Unit test + tsc + FK-graf topolojik kontrolü doğruluğu garanti eder, **ama** "yedekten gerçekten
geri dönülüyor mu" sorusunu yalnızca **uçtan-uca bir tatbikat** yanıtlar. Bu tatbikat onu sağlar.

## Ne kanıtlar

İzole bir throwaway org seed edilir → **gerçek** `buildBackupSnapshot` ile yedeklenir → felaket
simüle edilir (`auth.users` WIPE + veri bozma/silme) → **gerçek** restore `POST` handler'ı çalıştırılır
→ doğrulanır:

- **`auth.users` parola hash'leri geri yüklendi** (DR'nin asıl kanıtı — 2026-05-20 kilitlenme incident'i).
- `public.users` bozulan alanı geri geldi.
- Departman `parentId` hiyerarşisi sağlam (self-FK iki-geçiş).
- BigInt alanlar (`TrainingVideo.fileSizeBytes`, `MediaAsset.fileSizeBytes`) doğru.
- Restrict-kenarlı modeller (Certificate, AccreditationReport) geri.
- v4 transitive zincir (TrainingFeedbackForm→Category→Item) geri.

Gerçek interactive `$transaction` (delete + auth.users INSERT + tüm model insert) tek seferde, FK
ihlali olmadan tamamlanır.

## Nasıl çalıştırılır

**Yerel (varsayılan):** Supabase local çalışır olmalı (`supabase start`), migration'lar uygulanmış olmalı.

```bash
# .env.local'i (DATABASE_URL) yükle + drill'i çalıştır
set -a; . apps/web/.env.local; set +a
DR_DRILL=1 pnpm --filter web dr:drill
```

Veya doğrudan: `cd apps/web && DATABASE_URL=postgresql://...@127.0.0.1:54322/postgres pnpm dr:drill`

**Staging'e karşı (dikkat):** Drill YIKICI olduğundan prod-guard yerel olmayan DB'yi reddeder.
Bilinçli olarak gerçek bir staging DB'sine karşı çalıştırmak için:

```bash
DATABASE_URL=<staging-db-url> DR_ALLOW_REMOTE=1 DR_DRILL=1 pnpm --filter web dr:drill
```

> **PROD'A ASLA çalıştırma.** Guard yalnız `127.0.0.1`/`localhost`'a otomatik izin verir; `DR_ALLOW_REMOTE=1`
> bilinçli bir staging override'ıdır. Drill yalnız sabit-UUID throwaway org'a (`dddddddd-…`) dokunur ve
> bittiğinde onu siler, ama prod verisiyle aynı veritabanına bağlanmak risklidir.

## Güvenlik & izolasyon

- **Varsayılan `pnpm test` / CI'da TAMAMEN ATLANIR** (`describe.skipIf(!process.env.DR_DRILL)`). CI'da DB
  yoktur; prisma client lazy bağlandığından import güvenlidir.
- **Prod-guard:** `DATABASE_URL` host'u yerel değilse VE `DR_ALLOW_REMOTE=1` yoksa `beforeAll` `throw` eder.
- **İzole throwaway org:** yalnız sabit drill-UUID'lerine dokunur; `beforeAll` idempotent teardown ile başlar,
  `afterAll` her şeyi siler → DB tertemiz kalır, tekrar tekrar çalıştırılabilir.
- **Düz-metin yedek:** drill verisi %100 sentetiktir → `ALLOW_PLAINTEXT_BACKUP=true` ile şifrelemesiz yedeklenir
  (şifreleme ayrıca `backup-crypto.test.ts`'te test edilir; drill RESTORE doğruluğuna odaklanır).

## Ne zaman çalıştırılmalı

- Restore route'u (`super-admin/restore/route.ts`) veya snapshot assembler'ı (`lib/backup/snapshot.ts`)
  değiştiğinde — yeni model/FK sırası eklenince **MUTLAKA**.
- Periyodik DR güvencesi olarak (örn. çeyreklik), tercihen bir staging DB'sine karşı.

Dosya: `src/app/api/super-admin/restore/__tests__/dr-drill.test.ts`
