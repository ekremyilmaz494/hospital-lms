# Felaket Kurtarma Plani (Disaster Recovery)

> Son guncelleme: 2026-04-09

## RTO / RPO Hedefleri

| Metrik | Hedef | Mevcut | Aciklama |
|--------|-------|--------|----------|
| **RPO** (Recovery Point Objective — maks. veri kaybi suresi) | **< 1 saat** | ~1 saat | Supabase Pro'da point-in-time recovery (PITR) ile dakika bazinda geri alma mumkun. Free planda gunluk yedek = 24 saat RPO. |
| **RTO** (Recovery Time Objective — sistemi ayaga kaldirma suresi) | **< 4 saat** | ~3.5 saat | En kotu senaryo (DB tamamen coktu): yedekten geri yukleme ~3.5 saat. En iyi senaryo (Vercel deploy hatasi): rollback ~15 dakika. |

### RPO Iyilestirme Yol Haritasi
- **Supabase Free** → RPO: 24 saat (gunluk cron yedegi)
- **Supabase Pro** → RPO: < 1 saat (PITR + WAL arsivleme)
- **S3 Cross-Region Replication** → RPO: < 5 dakika (video/dosya icin)

---

## Yedekleme Yapisi

- **Otomatik yedekleme**: Her gun 03:15 UTC'de cron job calisir (`/api/cron/backup`)
- **Depolama**: AWS S3 (`backups/{orgId}/{timestamp}.json`)
- **Dogrulama**: Upload sonrasi S3 HeadObject ile dosya boyutu kontrolu yapilir
- **Kayit**: `db_backups` tablosunda `verified` ve `file_size` alanlari ile dogrulama durumu saklanir
- **Saklama suresi**: 90 gun (S3 Lifecycle Policy ile otomatik silme onerisi)

---

## Adim Adim Kurtarma Proseduru

### On Kosullar
1. AWS CLI yuklu ve konfigure edilmis olmali
2. Supabase CLI veya DB erisim bilgileri mevcut olmali
3. Vercel CLI yuklu olmali
4. `.env` dosyasinin guncel bir kopyasi guvenli yerde saklanmali

### Kurtarma Adimlari

1. **Sorunu tani ve degerlendir**
   - Hangi bilesenlerin etkilendigini belirle (DB, S3, Vercel, Redis)
   - Etkilenen organizasyonlari tespit et

2. **En son dogrulanmis yedegi bul**
   ```sql
   SELECT * FROM db_backups
   WHERE status = 'completed' AND verified = true
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **S3'ten yedek dosyasini indir**
   ```bash
   aws s3 cp s3://<BUCKET>/backups/<orgId>/<timestamp>.json ./restore-data.json
   ```

4. **JSON verisini dogrula**
   ```bash
   python3 -c "import json; d=json.load(open('restore-data.json')); print(f'Org: {d[\"organizationName\"]}, Users: {len(d[\"users\"])}, Trainings: {len(d[\"trainings\"])}')"
   ```

5. **Veritabanina geri yukle**
   - Supabase SQL Editor veya `psql` ile ilgili tablolardaki organizasyon verilerini temizle
   - JSON dosyasindaki verileri sirayla ekle (users -> departments -> trainings -> assignments -> ...)
   - Foreign key sirasina dikkat et

6. **Dogrulama**
   - Organizasyon dashboardini kontrol et
   - Kayit sayilarini yedek dosyasi ile karsilastir
   - Orneklem olarak birkac egitim ve sertifikanin dogru gorundugunu teyit et

---

## Senaryo Bazli Aksiyon Planlari

### Senaryo 1: Supabase Tamamen Coktu (DB erisim yok)

| Adim | Aksiyon | Sorumlu | Sure |
|------|---------|---------|------|
| 1 | Supabase status sayfasini kontrol et: https://status.supabase.com | Gelistirici | 5 dk |
| 2 | Supabase genel arizasiysa: Kullanicilari bilgilendir, bekle | Proje Yoneticisi | - |
| 3 | Supabase Pro'da PITR (Point-in-Time Recovery) kullan | Gelistirici | 30 dk |
| 4 | PITR yoksa: En son dogrulanmis S3 yedegini indir | Gelistirici | 15 dk |
| 5 | Yeni Supabase projesi olustur | Gelistirici | 15 dk |
| 6 | Prisma migration calistir: `pnpm db:migrate` | Gelistirici | 15 dk |
| 7 | RLS politikalarini uygula: `node scripts/apply-rls.js` | Gelistirici | 10 dk |
| 8 | Yedek verisini geri yukle: Restore API (`/api/super-admin/restore`) | Gelistirici | 60 dk |
| 9 | Vercel env degiskenlerini guncelle (yeni DB URL) | Gelistirici | 15 dk |
| 10 | Vercel'i yeniden deploy et | Gelistirici | 10 dk |
| 11 | Dogrulama: Dashboard, personel listesi, egitimler kontrol | Proje Yoneticisi | 30 dk |
| **Toplam** | | | **~3.5 saat** |

**Otomatik fallback:** Yok — DB olmadan sistem calismaz. Kullanicilara "Bakim calismasi" mesaji gosterilir.

### Senaryo 2: Vercel Coktu / Deploy Hatasi

| Adim | Aksiyon | Sorumlu | Sure |
|------|---------|---------|------|
| 1 | Vercel status kontrol et: https://www.vercel-status.com | Gelistirici | 5 dk |
| 2 | Vercel genel arizasiysa: Kullanicilari bilgilendir, bekle | Proje Yoneticisi | - |
| 3 | Deploy hatasiysa: Vercel Dashboard > Deployments > onceki deploy'u "Promote" et | Gelistirici | 5 dk |
| 4 | Alternatif CLI: `vercel rollback` | Gelistirici | 5 dk |
| 5 | Her iki yol basarisizsza: Farkli bolgeye yeni deploy | Gelistirici | 60 dk |
| **Toplam** | | | **~15 dk - 1.5 saat** |

**Otomatik fallback:** PWA Service Worker son cache'lenen sayfalari gosterir (offline mode). API istekleri basarisiz olur ama kullanici bos sayfa yerine cache'li veri gorur.

### Senaryo 3: S3 Bucket Erisim Yok (videolar/dosyalar yuklenmiyor)

| Adim | Aksiyon | Sorumlu | Sure |
|------|---------|---------|------|
| 1 | AWS Health Dashboard kontrol et | Gelistirici | 5 dk |
| 2 | IAM kullanici izinlerini dogrula (Access Key gecerli mi?) | Gelistirici | 10 dk |
| 3 | S3 bucket policy kontrol et | Gelistirici | 10 dk |
| 4 | **Gecici cozum**: CloudFront cache'den video servisi devam eder (~4 saat) | Otomatik | - |
| 5 | S3 tamamen kaybolduysa: Yedek bucket olustur, cross-region copy baslat | Gelistirici | 60 dk |
| 6 | Vercel env'de `AWS_S3_BUCKET` degiskenini yeni bucket ile guncelle | Gelistirici | 10 dk |
| 7 | Video dosyalari kayipsa: Organizasyonlardan orijinal dosyalari talep et | Proje Yoneticisi | - |
| **Toplam** | | | **~2-4 saat** |

**Otomatik fallback:** CloudFront signed URL'ler 4 saat gecerli — bu sure boyunca videolar cache'den izlenmeye devam eder. Yeni video yukleme basarisiz olur.

### Senaryo 4: Redis Coktu (Upstash)

| Adim | Aksiyon | Sorumlu | Sure |
|------|---------|---------|------|
| 1 | Upstash Dashboard'dan durumu kontrol et | Gelistirici | 5 dk |
| 2 | **Etki**: Sinav zamanlayicilari ve rate limiting gecici olarak devre disi | - | - |
| 3 | **OTOMATIK FALLBACK AKTIF** — `src/lib/redis.ts` in-memory fallback devreye girer: | Otomatik | 0 dk |
| | - Sinav zamanlayicilari: `memoryTimers` Map ile calismaya devam eder | | |
| | - Rate limiting: `memoryRateLimits` Map ile calismaya devam eder | | |
| | - Cache: L1 in-memory cache aktif kalir, L2 Redis cache devre disi | | |
| 4 | Upstash duzeldikten sonra: Sistem otomatik Redis'e reconnect eder | Otomatik | 0 dk |
| 5 | Aktif sinav oturumlarini kontrol et (suresi dolmus mu?) | Gelistirici | 10 dk |
| 6 | Upstash tamamen kaybolduysa: Yeni instance olustur, env guncelle | Gelistirici | 20 dk |
| **Toplam** | | | **~0 dk (otomatik) - 30 dk** |

**Otomatik fallback:** ✅ TAM CALISIYOR. Redis cokse bile sistem calismaya devam eder. Kod dogrulamasi: `src/lib/redis.ts` satir 20-22 (`memoryTimers`, `memoryRateLimits`) ve satir 229-246 (in-memory fallback). Tek risk: Vercel'de birden fazla serverless instance varsa in-memory state paylasılmaz — her instance kendi rate limit sayacini tutar.

---

## Iletisim Zinciri

| Oncelik | Kisi/Rol | Aksiyon |
|---------|----------|---------|
| 1 | DevOps / Backend Gelistirici | Teknik mudahale |
| 2 | Proje Yoneticisi | Organizasyonlara bilgilendirme |
| 3 | Musteri Destek | Kullanici sorularini yonetme |

---

## Periyodik Testler

- [ ] **Aylik**: `node scripts/restore-drill.js` — en yeni verified yedegin restore edilebilirligini dry-run olarak dogrula (DB'ye yazmaz)
- [ ] **3 Aylik**: Tam kurtarma simulasyonu (staging ortaminda, gercek restore)
- [ ] **6 Aylik**: RPO/RTO hedeflerini gozden gecir ve guncelle
- [ ] **Yillik**: Felaket kurtarma planini tum ekiple tekrar gozden gecir

---

## S3 Lifecycle Policy (90 Gun Retention)

Yedek bucket'indaki `backups/` prefix'i icin otomatik silme politikasi:

```json
{
  "Rules": [
    {
      "ID": "backup-retention-90d",
      "Status": "Enabled",
      "Filter": { "Prefix": "backups/" },
      "Expiration": { "Days": 90 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 }
    }
  ]
}
```

**Uygulama:** AWS Console > S3 > Bucket > Management > Lifecycle rules > Create rule.
Veya CLI:
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket <bucket-name> \
  --lifecycle-configuration file://lifecycle.json
```

**Dikkat:** Retention'i azaltmadan once `db_backups` tablosundaki ilgili kayitlari
da temizlemek gerekir, aksi halde UI'da "dosya yok" hatalari gorunur.

---

## BACKUP_ENCRYPTION_KEY Rotasyonu

Anahtar sizdirma veya periyodik guvenlik politikasi gerektirdiginde:

1. **Yeni anahtar uret:** `openssl rand -hex 32` (64 karakter hex)
2. **Env guncelle (Vercel):**
   - `BACKUP_ENCRYPTION_KEY_OLD` = eski anahtar
   - `BACKUP_ENCRYPTION_KEY` = yeni anahtar
3. **Deploy et.** `decryptBackup` once yeni anahtari dener, basarisiz olursa
   eski anahtara fallback yapar (bkz. `src/lib/backup-crypto.ts`).
4. **Re-encrypt (opsiyonel):** Tum eski yedekleri manuel olarak indirip yeni
   anahtarla yeniden yazabilirsiniz. Pratikte 90 gunluk retention doldugunda
   eski yedekler silineceginden `BACKUP_ENCRYPTION_KEY_OLD` 90 gun sonra
   kaldirilabilir.
5. **Dogrula:** `node scripts/restore-drill.js` calistir — eski ve yeni
   anahtarla cozulmus yedekler icin hem `encrypted=true, oldKey=false/true`
   durumlarini raporlar.

**Kritik:** `BACKUP_ENCRYPTION_KEY_OLD`'u erken silmeyin — rotasyondan sonra
90 gunluk geri alma penceresi icin gereklidir.
