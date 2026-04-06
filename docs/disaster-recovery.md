# Felaket Kurtarma Plani (Disaster Recovery)

> Son guncelleme: 2026-04-05

## Hedefler

| Metrik | Deger | Aciklama |
|--------|-------|----------|
| **RPO** (Recovery Point Objective) | **24 saat** | Maksimum kabul edilebilir veri kaybi suresi. Gunluk otomatik yedekleme ile saglanir. |
| **RTO** (Recovery Time Objective) | **4 saat** | Sistem kesintisinden tam calisir hale donme suresi. |

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

### Senaryo 1: Veritabani Bozulmasi (DB Corrupted)

| Adim | Aksiyon | Sure |
|------|---------|------|
| 1 | Supabase Dashboard'dan DB durumunu kontrol et | 15 dk |
| 2 | Supabase'in otomatik point-in-time recovery ozelligini kullan (varsa) | 30 dk |
| 3 | Basarisizsza: En son dogrulanmis S3 yedegini indir | 15 dk |
| 4 | Yeni bir Supabase projesi olustur veya mevcut DB'yi resetle | 30 dk |
| 5 | Prisma migration'lari calistir: `pnpm db:migrate` | 15 dk |
| 6 | RLS politikalarini uygula: `node scripts/apply-rls.js` | 10 dk |
| 7 | Yedek verisini geri yukle | 60 dk |
| 8 | Vercel env degiskenlerini guncelle (yeni DB URL gerekiyorsa) | 15 dk |
| 9 | Dogrulama testleri | 30 dk |
| **Toplam** | | **~3.5 saat** |

### Senaryo 2: Vercel Coktu / Deploy Hatasi

| Adim | Aksiyon | Sure |
|------|---------|------|
| 1 | Vercel status sayfasini kontrol et: https://www.vercel-status.com | 5 dk |
| 2 | Vercel genel arizasiysa: Bekle ve kullanicilari bilgilendir | - |
| 3 | Deploy hatasiysa: Son calisan deployment'a rollback yap | 10 dk |
| 4 | `vercel rollback` veya Vercel Dashboard > Deployments > Promote | 5 dk |
| 5 | Alternatif: Farkli bir hesap/bolgeye yeni deploy | 60 dk |
| **Toplam** | | **~15 dk - 1.5 saat** |

### Senaryo 3: S3 Erisim Kaybi

| Adim | Aksiyon | Sure |
|------|---------|------|
| 1 | AWS Health Dashboard kontrol et | 5 dk |
| 2 | S3 bucket erisim politikalarini kontrol et | 10 dk |
| 3 | IAM kullanici/role izinlerini dogrula | 10 dk |
| 4 | Gecici: CloudFront cache'den video servisi devam edebilir | - |
| 5 | S3 tamamen kaybolduysa: Yedek bucket'tan cross-region replikasyon | 60 dk |
| 6 | Video dosyalari icin: Organizasyonlardan orijinal dosyalari talep et | - |
| 7 | Backup JSON dosyalari icin: DB'den mevcut verileri tekrar export et | 30 dk |
| **Toplam** | | **~2-4 saat** |

### Senaryo 4: Redis Coktu (Upstash)

| Adim | Aksiyon | Sure |
|------|---------|------|
| 1 | Upstash Dashboard'dan durumu kontrol et | 5 dk |
| 2 | **Etki**: Sinav zamanlayicilari ve rate limiting calismaz | - |
| 3 | Gecici cozum: Redis bagimliliklarini devre disi birak | 15 dk |
| 4 | `src/lib/redis.ts`'de fallback: in-memory cache veya no-op | 15 dk |
| 5 | Upstash duzeldikten sonra: Aktif sinav oturumlarini kontrol et | 10 dk |
| 6 | Alternatif: Yeni Upstash instance olustur ve env degiskenlerini guncelle | 20 dk |
| **Toplam** | | **~30 dk - 1 saat** |

---

## Iletisim Zinciri

| Oncelik | Kisi/Rol | Aksiyon |
|---------|----------|---------|
| 1 | DevOps / Backend Gelistirici | Teknik mudahale |
| 2 | Proje Yoneticisi | Organizasyonlara bilgilendirme |
| 3 | Musteri Destek | Kullanici sorularini yonetme |

---

## Periyodik Testler

- [ ] **Aylik**: Rastgele bir organizasyonun yedegini indirip JSON yapisini dogrula
- [ ] **3 Aylik**: Tam kurtarma simulasyonu (test ortaminda)
- [ ] **6 Aylik**: RPO/RTO hedeflerini gozden gecir ve guncelle
- [ ] **Yillik**: Felaket kurtarma planini tum ekiple tekrar gozden gecir
