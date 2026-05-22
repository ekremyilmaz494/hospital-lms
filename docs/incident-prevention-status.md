# Hospital LMS — Incident Önleme: Güncel Durum Raporu

> **Tarih:** 22 Mayıs 2026
> **Kapsam:** 20 Mayıs 2026 production auth incident'i önleme çalışmasının ilerleme durumu
> **İlgili belgeler:** `docs/incident-prevention-checklist.md` (operasyonel checklist),
> `docs/local-development.md` (lokal kurulum rehberi)

---

## 1. Kısa Hatırlatma — Ne Olmuştu?

20 Mayıs 2026'da bir felaket-kurtarma (DR) tatbikatı sırasında yıkıcı scriptler
(`wipe-auth-users.ts`) yanlışlıkla **production** veritabanına çalıştırıldı;
Devakent Hastanesi'ndeki **143 personelin parola hash'leri** silindi. Kök neden:
laptoptaki `.env.local` production'a bakıyordu + yıkıcı scriptlerde koruma yoktu
+ yedek `auth.users`'ı kapsamıyordu.

Önleme stratejisi: **P0** (tekrarı yapısal olarak imkânsız kıl), **P1** (hızlı
tespit + kurtarma), **P2** (sertleştirme).

---

## 2. Yapılanlar ✅

### 2.1 P0.2 — `.env` denetimi (TAMAMLANDI)
- Kök + `apps/web` `.env*` dosyaları denetlendi.
- Checklist'in "sil" dediği 5 eski `.env` yedeği zaten yoktu.
- `.env.production.reference` (git'e commitli) denetlendi: **gerçek secret yok**,
  sadece yorum + altyapı tanımlayıcıları. Commitli kalması güvenli.
- `ENCRYPTION_KEY` "2 anahtar karışık" sorunu yok — kök ve `apps/web` `.env.local`
  birebir aynıydı.

### 2.2 `docs/local-development.md` Windows'a uyarlandı (PR #171)
Doküman macOS-merkezliydi (`brew`). Windows kurulum yolu eklendi (winget ile
Docker, proje-yerel Supabase CLI). Komutların PowerShell + bash sürümleri.
`.env.local`'in doğru konumu `apps/web` olarak düzeltildi.

### 2.3 P0.5 — Least-privilege SQL yazıldı (PR #171)
`apps/web/supabase-least-privilege.sql` oluşturuldu: `postgres` rolünden `auth`
şemasındaki tüm tablolarda `DELETE`/`TRUNCATE`/`UPDATE` yetkisini alır. Kazara bir
`DELETE FROM auth.users` artık DB seviyesinde reddedilir. `SELECT` korunur (backup
route okuyor). İnceleme + doğrulama + rollback adımları dosyanın içinde.

### 2.4 Geliştirme makinesi (Windows) güvene alındı
- `apps/web/.env.local` production credential'larından arındırılıp lokal şablona
  çevrildi. Fazlalık kök `.env.local` silindi.
- **Sonuç:** bu makineden artık hiçbir komut production'ı vuramaz — incident'in
  "dev makinesi prod'a bağlı" deliği bu makinede kapatıldı.

### 2.5 P0.1 başlatıldı (Windows geliştirme makinesi)
- Docker Desktop 4.73 kuruldu.
- Modern WSL2 kuruldu, reboot yapıldı, WSL2 varsayılan sürüm oldu.

---

## 3. Yapılacaklar ⏳

### P0.1 — Lokal Supabase (DEVAM EDİYOR — ertelendi)

**Windows geliştirme makinesinde kalan engel: BIOS'ta sanallaştırma (VT-x) kapalı.**
Docker Desktop "Virtualization support not detected" veriyor. CPU sanallaştırmayı
destekliyor ama BIOS ayarı kapalı.

1. BIOS'a gir → **Advanced → CPU Setup → `Intel(R) Virtualization Technology` = Enabled**
2. Docker Desktop aç → "Engine running" beklenir
3. `pnpm add -D -w supabase`
4. `pnpm exec supabase init` + `pnpm exec supabase start`
5. `apps/web/.env.local`'ı `supabase start` çıktısındaki lokal değerlerle doldur
6. `cd apps/web` → `pnpm exec prisma migrate deploy` → `pnpm db:generate`
   → `node scripts/apply-rls.js` → demo seed
7. `pnpm dev` ile yerel ortamda doğrula

Geliştirme yapılan **her makinede** (Mac dahil) P0.1 uygulanmalıdır. Mac'lerde
sanallaştırma her zaman açık olduğu için BIOS adımı yoktur. Rehber:
`docs/local-development.md`.

### P0.5 — Least-privilege uygulama + key rotation
- `supabase-least-privilege.sql`'i ÖNCE lokal Supabase'de çalıştır + doğrula,
  SONRA Supabase Dashboard → SQL Editor ile prod'a uygula.
- Prod DB parolasını rotate et (Dashboard → Settings → Database).
- `service_role` anahtarını rotate et (Dashboard → Settings → API).

### P1 — Hızlı tespit ve kurtarma
- Supabase Pro plan → **PITR** aç (~$25/ay) — auth şeması dahil tüm DB'yi geri
  sarabilir. Tek başına en güçlü koruma.
- Yedeğin `auth.users` + `auth.identities`'i geri yazabildiğini test et.
- Auth hata oranı / canary login alarmı kur.

### P2 — Sertleştirme
- Audit log dayanıklılığı (`auth.audit_log_entries` silinememeli).
- Onaylı DR + Incident Response runbook'ları — tatbikatlar yalnızca izole ortamda.

---

## 4. Şu An Yürürlükte Olan Korumalar

✅ Yıkıcı scriptler prod env tespit ederse otomatik **abort** eder (`_guard.ts`).
✅ Guard'sız yeni bir yıkıcı script eklenirse **CI kırılır**.
✅ Windows geliştirme makinesinin `.env.local`'ı prod'a bakmıyor.
✅ P0.5 least-privilege SQL'i hazır (uygulanmayı bekliyor).

⚠️ **Hâlâ açık riskler:**
- Diğer geliştirme makinelerinin (Mac) `.env.local`'ı hâlâ prod'a bakıyor olabilir
  — her makinede P0.1 yapılmalı.
- PITR yok (Supabase Pro plan yok).
- Prod DB parolası + `service_role` anahtarı henüz rotate edilmedi.

---

## 5. Referans Dosyalar

- Operasyonel checklist: `docs/incident-prevention-checklist.md`
- Lokal kurulum rehberi: `docs/local-development.md`
- P0.5 SQL: `apps/web/supabase-least-privilege.sql`
- Production proje ref: `pkkkyyajfmusurcoovwt` (yıkıcı scriptler asla buraya çalışmamalı)
