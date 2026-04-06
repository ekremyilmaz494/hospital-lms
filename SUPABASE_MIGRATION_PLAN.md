# Supabase Region Migration: Seul → Frankfurt

## Neden?
Mevcut Supabase projesi `ap-northeast-2` (Seul, Kore) bölgesinde. Kullanıcı Türkiye'den bağlanıyor. Her DB sorgusu ~370ms ağ gecikmesi ekliyor. Frankfurt'a taşıma ile bu ~145ms'e düşecek (sorgu başına ~225ms kazanç). Vercel deployment zaten `fra1` (Frankfurt) bölgesinde — DB de aynı bölgede olursa Vercel ↔ DB arası gecikme ~1-5ms'e düşer.

Mevcut veritabanındaki veriler test amaçlı, önemli değil. Sadece tablo yapıları (Prisma migration'lar) taşınacak.

---

## Adım Adım Plan

### Adım 1: Frankfurt'ta yeni Supabase projesi oluştur
- https://supabase.com/dashboard adresine git
- "New Project" tıkla
- Organization: `hospital-lms`
- Name: `hospital-lms-eu`
- Region: **Central EU (Frankfurt)** seç
- Database password: güçlü bir şifre belirle (not al!)
- "Create new project" tıkla
- Proje hazır olana kadar bekle (~2 dakika)

### Adım 2: Yeni projenin bilgilerini al
Proje hazır olduktan sonra **Project Settings** sayfasından şunları kopyala:
- **Project Settings > API**: Project URL, anon key, service_role key
- **Project Settings > Database**: Connection string (pooler + direct)

### Adım 3: `.env.local` dosyasını güncelle
Aşağıdaki 5 satırı yeni proje bilgileriyle değiştir (diğer satırlar AYNI kalacak):

```env
# ─── Supabase ───
NEXT_PUBLIC_SUPABASE_URL=https://<YENİ-REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<YENİ-ANON-KEY>
SUPABASE_SERVICE_ROLE_KEY=<YENİ-SERVICE-ROLE-KEY>

# ─── Database (Supabase PostgreSQL) ───
DATABASE_URL=postgresql://postgres.<YENİ-REF>:<DB-PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=20 // secret-scanner-disable-line
DIRECT_URL=postgresql://postgres:<DB-PASSWORD>@db.<YENİ-REF>.supabase.co:5432/postgres // secret-scanner-disable-line
```

**DEĞİŞMEYECEK satırlar:** AWS, Redis, SMTP, CRON, AI — hepsi aynı kalır.

### Adım 4: Prisma migration'ları yeni DB'ye uygula
```bash
pnpm db:generate
pnpm db:migrate deploy
```
Bu komut 11 migration dosyasını sırayla yeni Frankfurt DB'ye uygulayacak:
- 20260325062452_init
- 20260325075331_add_departments
- 20260325191755_add_certificate_model
- 20260326120000_add_exam_attempt_unique
- 20260326140000_add_session_timeout
- 20260327100000_add_compliance_fields
- 20260330100000_add_training_publish_status
- 20260330200000_add_smg_tables
- 20260330210000_add_his_integration
- 20260330220000_add_accreditation
- 20260330300000_add_competency_tables

### Adım 5: RLS politikalarını uygula
Supabase Dashboard > SQL Editor'de `supabase-rls.sql` dosyasının içeriğini çalıştır.

### Adım 6: Test et
```bash
pnpm dev
```
- Login test et (hızlı olmalı)
- Dashboard yüklenme hızını kontrol et
- Latency testi:
```bash
curl -o /dev/null -s -w "Connect: %{time_connect}s\nTotal: %{time_total}s\n" https://<YENİ-REF>.supabase.co/rest/v1/
```

### Adım 7: Eski Seul projesini durdur
- Supabase Dashboard > eski proje > Settings > Pause project
- Silmek için hazır olduğunda Delete project

---

## Sorun olursa geri dönüş (30 saniye)
`.env.local`'daki 5 satırı eski değerlere geri koy:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<ESKİ-REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ESKİ-ANON-KEY>
SUPABASE_SERVICE_ROLE_KEY=<ESKİ-SERVICE-ROLE-KEY>
DATABASE_URL=postgresql://postgres.<ESKİ-REF>:<DB-PASSWORD>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=20 // secret-scanner-disable-line
DIRECT_URL=postgresql://postgres:<DB-PASSWORD>@db.<ESKİ-REF>.supabase.co:5432/postgres // secret-scanner-disable-line
```

---

## Beklenen sonuç

| Metrik | Önce (Seul) | Sonra (Frankfurt) |
|--------|-------------|-------------------|
| DB sorgu gecikmesi (kullanıcı) | ~370ms | ~145ms |
| Vercel ↔ DB gecikmesi (production) | ~300ms | ~1-5ms |
| Login süresi | ~2-3s | ~0.5-1s |
| Dashboard yüklenme | ~3-5s | ~1-2s |

## Risk
- **Sıfır** — yeni proje oluşturuyoruz, eskisine dokunmuyoruz
- Kod dosyaları hiç değişmiyor, sadece `.env.local` güncelleniyor
- Prisma migration'lar idempotent — tekrar çalıştırılabilir
