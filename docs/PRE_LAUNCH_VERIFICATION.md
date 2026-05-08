# Pre-Launch Verification Runbook

> Son güncelleme: 2026-05-08
> Hedef: 200 kişilik müşteri canlıya geçmeden önce mevcut güvenlik altyapısının
> gerçekten çalıştığını **kanıtla**. Bu döküman, Faz 0'daki "çalıştırılacak" kalemleri
> komut komut yürütmen için.
> İlişkili: [ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md), [disaster-recovery.md](./disaster-recovery.md)

## Neden bu doküman?

Mevcut altyapıda kurulu ama hiç çalıştırılmamış 4 kritik script var:
- `scripts/restore-drill.js` — backup gerçekten geri yüklenebilir mi?
- `scripts/load-test.js` — sistem 200 user'ı kaldırıyor mu?
- `scripts/verify-backup.js` — backup'lar düzenli doğrulanıyor mu?
- `/api/super-admin/restore` — gerçek restore akışı çalışıyor mu?

"Yazılı ama denenmemiş" = "yok" demektir. Bu rehberi takip ederek hepsini bir kez bile çalıştır, sonuçları doc'a yaz, sonra müşteriye git.

---

## Önkoşullar

### Yerel makinede yüklü olması gerekenler

```powershell
# Node.js + pnpm (zaten yüklü olmalı)
node --version       # ≥ 22
pnpm --version       # ≥ 9

# k6 (yük testi için)
# Windows:
winget install k6
# Mac:
brew install k6

# AWS CLI (opsiyonel, restore-drill için gerekli değil ama disaster-recovery için faydalı)
aws --version
```

### Repo + env

```powershell
# 1. Repo güncel mi?
git pull
pnpm install
pnpm db:generate

# 2. .env.local kopyalanmış mı? (gerçek değerlerle)
# Şu key'lerin DOLU olduğunu doğrula:
#   DATABASE_URL                   (prod pooler)
#   DIRECT_URL                     (prod session pooler)
#   AWS_S3_BUCKET                  (hospital-lms-videos)
#   AWS_REGION                     (eu-central-1)
#   AWS_ACCESS_KEY_ID + SECRET
#   BACKUP_ENCRYPTION_KEY          (64 hex char)
#   BACKUP_ENCRYPTION_KEY_OLD      (varsa)
#   HEALTH_CHECK_SECRET
```

⚠️ **Güvenlik:** Bu kontrolleri çalıştırırken prod credential'lar lokalde olur. İşin sonunda `.env.local` dosyasının commit edilmediğini doğrula (zaten `.gitignore`'da olmalı).

---

## Kontrol 1 — Restore Drill (Dry-Run)

**Amaç:** En son verified backup S3'ten indirilebiliyor, decrypt edilebiliyor, struktur olarak sağlam.

**Risk:** Yok — DB'ye yazmaz, sadece okur.

### Çalıştırma

```powershell
# En yeni verified=true backup
node scripts/restore-drill.js

# Belirli kurum
node scripts/restore-drill.js --org-id=<organization-id>

# Belirli backup kaydı
node scripts/restore-drill.js --backup-id=<db_backups.id>
```

### Beklenen çıktı

```
🩺 Restore Drill (DRY RUN) başlıyor...
────────────────────────────────────────────────────────────
📦 Backup: <uuid>
   Org: <org-uuid>
   Key: backups/<org>/<timestamp>.json
   Size: 12.34 MB
   Created: 2026-05-08T03:15:23.000Z
⬇️  S3 download: 1234ms, 12.34 MB
🔓 Decrypt: 45ms (encrypted=true, oldKey=false)
📄 JSON parse: 67ms

📊 Kayıt sayıları:
   users                100
   departments          15
   trainings            42
   ...

────────────────────────────────────────────────────────────
✅ DRILL BAŞARILI — toplam 1346ms
   Yedek restore edilebilir durumda. DB yazılmadı (dry run).
```

### Sorun olursa

| Hata | Sebep | Çözüm |
|------|-------|-------|
| `BACKUP_ENCRYPTION_KEY tanımlı değil` | env eksik | `.env.local`'e ekle |
| `decipher.final() ... Unsupported state` | Yanlış key | `BACKUP_ENCRYPTION_KEY` doğrulanmalı |
| `usedOldKey=true` uyarısı | Anahtar rotasyonu sonrası eski yedek | Normal — re-encrypt planla |
| `Hiç verified=true yedek yok` | Cron çalışmamış | `db_backups` tablo kontrol, cron log'a bak |
| `S3 NoSuchKey` | 90 gün retention'da silindi | Daha yeni backup seç |

### Acceptance

- [ ] Drill prod'a karşı en az 1 kez çalıştı
- [ ] "DRILL BAŞARILI" çıktısı alındı
- [ ] Toplam süre < 5 saniye (büyük org için < 30 saniye)
- [ ] Sonuç ekran görüntüsü `docs/incidents/2026-MM-DD-pre-launch-drill.md`'ye eklendi

---

## Kontrol 2 — Restore API Test (Staging)

**Amaç:** `/api/super-admin/restore` endpoint'i preview + confirm akışı çalışıyor.

**Risk:** Orta — STAGING DB'sine yazar, mevcut staging verisi silinir/değişir.

### Önkoşullar

- Staging Supabase projesinde test org'u var
- Staging için super_admin hesabın var
- Staging URL'inde sisteme giriş yapabiliyorsun

### Adımlar

```
1. Staging UI'da super_admin olarak giriş yap
2. /super-admin/backups (varsa) sayfasına git
   YOKSA: doğrudan API call yap (curl/Postman):

   # Step 1 — Preview
   curl -X POST https://<staging-url>/api/super-admin/restore \
     -H "Content-Type: application/json" \
     -H "Cookie: <staging session cookie>" \
     -d '{"backupId":"<staging-backup-id>","confirm":false}'

   # Beklenen response:
   # {
   #   "preview": true,
   #   "backupId": "...",
   #   "organizationId": "...",
   #   "exportedAt": "...",
   #   "counts": { "users": N, "trainings": N, ... }
   # }

3. Counts mantıklı mı kontrol et
4. Step 2 — Confirm
   curl -X POST .../api/super-admin/restore \
     -d '{"backupId":"<id>","confirm":true}'

   # Beklenen: { "success": true, "counts": {...} }
   # Süre: 5-60 saniye (org boyutuna göre)

5. Staging UI'da org dashboard'unu aç
   - Kayıt sayıları backup ile aynı mı?
   - Audit log'da "restore_executed" entry'si görünüyor mu?
```

### Acceptance

- [ ] Preview yanıtı doğru kayıt sayıları döndü
- [ ] Confirm başarıyla tamamlandı
- [ ] Audit log'da entry oluştu
- [ ] UI'da geri yüklenmiş veri görünüyor
- [ ] Toplam süre `<` 2 dakika

---

## Kontrol 3 — Load Test (k6)

**Amaç:** Sistem 200 eşzamanlı kullanıcıyı kaldırıyor mu?

**Risk:** Yüksek (eğer prod'a karşı çalıştırılırsa). Bu yüzden:
- ✅ Önce LOKAL prod build'e karşı
- ✅ Sonra STAGING'e karşı
- ❌ ASLA gerçek müşteri canlıyken prod'a karşı

### Hazırlık — Demo user'ları üret

`scripts/seed-devakent-test-users.ts` ile 200 test user'ı oluştur:

```powershell
# 200 test user'ı staging org'una ekle
npx tsx scripts/seed-devakent-test-users.ts --count=200 --org=<staging-org-id>

# Çıktı: scripts/test-users-credentials.json
# Format: [{"email":"...","password":"..."}, ...]
```

### Çalıştırma — Lokal Prod Build

```powershell
# Terminal 1: prod build başlat
pnpm build
pnpm start

# Terminal 2: load test
$env:BASE_URL = "http://localhost:3000"
$env:DEMO_USERS_JSON = (Get-Content scripts/test-users-credentials.json -Raw)
k6 run scripts/load-test.js
```

### Çalıştırma — Staging

```powershell
$env:BASE_URL = "https://<staging-url>"
$env:DEMO_USERS_JSON = (Get-Content scripts/test-users-credentials.json -Raw)
k6 run scripts/load-test.js
```

### Beklenen sonuç

```
╔══════════════════════════════════════════════╗
║         HOSPITAL LMS — LOAD TEST SONUCU      ║
╠══════════════════════════════════════════════╣
║  p95 Response Time:  XXXXms  (hedef: <2000ms) ✅
║  Error Rate:         X.XX%   (hedef: <%1)    ✅
║  Throughput:         XXX r/s (hedef: >100)   ✅
╠══════════════════════════════════════════════╣
║  SONUÇ: ✅ BAŞARILI — 200 kullanıcı destekleniyor
╚══════════════════════════════════════════════╝
```

### Sorun olursa — performans sorunlarını tespit

| Metrik | Eşik | Eğer aşılırsa |
|--------|------|---------------|
| p95 latency | > 2000ms | DB pool size, slow query log, cache eklenmemiş endpoint |
| error rate | > %1 | Sentry'de hata, rate limit aşımı, timeout |
| throughput | < 100 r/s | Vercel concurrency limit, DB connection saturation |

Sorun varsa adım adım:
1. Vercel logs → en yavaş endpoint
2. Sentry transactions → p99 endpoint
3. Supabase Dashboard → Database → Connection pool kullanımı
4. `scripts/perf-check.js` zaten engellemiş olmalı — yeni route eklenirken atlanmış olabilir

### Acceptance

- [ ] Lokal prod build'de geçti
- [ ] Staging'de geçti (gerçek network gecikmesi dahil)
- [ ] p95 < 2000ms
- [ ] Error rate < %1
- [ ] Sonuç ekran görüntüsü kayıt altında

---

## Kontrol 4 — Eksik Senaryo: 200 Paralel Sınav Submit

**Amaç:** En kritik tepe yükü — 200 kişi son 1 dakikada sınav bitirip submit ediyor.

**Risk:** Aynı load-test ile, ama daha ağır write yükü.

### Yeni script yaz

Mevcut `scripts/load-test.js` write-heavy senaryoyu kapsamıyor. Şu yeni dosyayı yaz: `scripts/load-test-exam-submit.js`

Senaryo:
- 200 VU
- Her biri: login → /api/exam/<id>/start → 30 cevap save-answer → /api/exam/<id>/submit
- Son submit'leri 30 saniyelik pencereye sıkıştır
- Threshold: submit endpoint p95 < 5000ms (puanlama + tx ağır)

Bu script'in detayı plan dosyasındaki "Aksiyon 2.1 ek" maddesinde — yazıldıktan sonra bu doc güncellenecek.

### Acceptance

- [ ] Script yazıldı
- [ ] Staging'de geçti
- [ ] DB connection saturation < %80 kaldı

---

## Kontrol 5 — Health Endpoint

**Amaç:** Acil durumda ilk kontrol noktası çalışıyor.

```powershell
# Public (status only)
curl https://<prod-url>/api/health

# Authenticated (detaylı)
curl -H "x-health-secret: $env:HEALTH_CHECK_SECRET" https://<prod-url>/api/health
```

### Beklenen

```json
{
  "status": "healthy",
  "refMatch": true,
  "region": "eu-central-1",
  "checks": {
    "db": "ok",
    "redis": "ok",
    "auth": "ok",
    "s3": "ok"
  },
  "version": "...",
  "timestamp": "..."
}
```

### Acceptance

- [ ] Public endpoint 200 dönüyor
- [ ] Authenticated endpoint tüm check'lerde "ok"
- [ ] `refMatch: true` (Supabase migration'ı doğru ortama gitti)

---

## Kontrol 6 — Sentry Alert Test

**Amaç:** Hata olduğunda gerçekten haberdar olacaksın.

### Test

```typescript
// Geçici test endpoint'i (sadece dev/staging):
// src/app/api/test-sentry/route.ts
export async function GET() {
  throw new Error('Pre-launch Sentry test — please ignore')
}
```

```powershell
# Staging'de tetikle
curl https://<staging-url>/api/test-sentry
```

### Doğrulama

- [ ] Sentry Issues sayfasında 1-2 dakika içinde görünüyor
- [ ] Tanımladığın alert kuralları tetiklendi (e-posta + Slack)
- [ ] PII redaction çalışıyor (request body'de hassas veri varsa maskelenmiş)
- [ ] Test sonrası endpoint'i SİL (commit'leme)

---

## Kontrol 7 — Backup Verify Cron Manuel Tetikle

```powershell
# Lokal'den verify çalıştır
node scripts/verify-backup.js
```

### Beklenen

- Son 24 saat içinde her aktif org için en az 1 verified=true backup
- Eksik varsa konsol uyarısı
- `db_backups` tablosunda `verified=false` veya `status=failed` kayıt sıfır

### Acceptance

- [ ] Tüm aktif org'lar için verified backup var
- [ ] Son 7 gün geriye doğru tutarlı verified akışı

---

## Kontrol 8 — Supabase + Vercel Plan Doğrulama

### Supabase

```
1. https://supabase.com/dashboard → projeyi aç
2. Settings → Subscription
3. Mevcut plan: Free / Pro?
4. Pro değilse → Upgrade ($25/ay)
5. Pro'da: Database → Backups → "Daily backups" görünmeli
6. Pro'da: Database → Point-in-time recovery → aktif olmalı (varsayılan kapalı)
```

### Vercel

```
1. https://vercel.com/[team] → Settings → Billing
2. Mevcut plan: Hobby / Pro?
3. Hobby ise → Pro'ya geçiş ($20/ay)
4. Pro'da: Concurrent function executions limit ≥ 1000 olmalı
5. Edge Network → fra1 region aktif
```

### Acceptance

- [ ] Supabase Pro aktif + daily backup görünüyor
- [ ] Vercel Pro aktif + concurrency 1000+
- [ ] Faturalama bilgisi güvenli depoda kayıtlı

---

## Sonuç Tablosu — Tüm Kontroller Geçti mi?

Müşteri canlıya geçmeden ÖNCE bu tablonun tamamı yeşil olsun:

| # | Kontrol | Durum | Tarih |
|---|---------|-------|-------|
| 1 | Restore Drill (prod) | ⬜ | |
| 2 | Restore API (staging) | ⬜ | |
| 3 | Load Test (lokal + staging) | ⬜ | |
| 4 | 200 paralel submit (yeni senaryo) | ⬜ | |
| 5 | Health endpoint | ⬜ | |
| 6 | Sentry alert test | ⬜ | |
| 7 | Verify-backup | ⬜ | |
| 8 | Plan upgrade'leri | ⬜ | |

Her bir kontrol başarısız olursa, geri dön ve düzelt — atlama. Müşteri canlıyken yangın söndürmektense, bugün 1 saat fazla harcamak çok daha ucuz.

---

## Bu Kontroller Ne Sıklıkla Tekrar Edilecek?

| Sıklık | Kontrol |
|--------|---------|
| Aylık | 1 (Restore Drill), 7 (Verify-backup) |
| 3 ayda bir | 2 (Restore API), 3 (Load Test), 4 (Submit) |
| 6 ayda bir | 6 (Sentry alert), 8 (Plan + faturalama) |
| Sürekli | 5 (Health endpoint — monitoring tarafından) |

---

## Sonraki Doc

- [ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md) — Sorun çıktığında ne yapacaksın
- [disaster-recovery.md](./disaster-recovery.md) — Felaket senaryoları
- [STAGING_SETUP.md](./STAGING_SETUP.md) — Staging ortamı kurulum
