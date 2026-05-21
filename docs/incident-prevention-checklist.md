# Incident Önleme — Operasyonel Checklist

> 2026-05-20 auth incident'i sonrası. Kod tarafı (guard'lar, CI kontrolü, local
> ortam şablonu) `fix/incident-prevention-p0` PR'ında. **Bu dosya, koddan
> yapılamayan, elle yapılması gereken adımlardır.** Tam gerekçe ve P1/P2 için:
> `.claude/plans/hospital-lms-incident-prevention.md`.

## P0.1 — Yerel ortamı kur (kod hazır, kurulum sende)

PR'daki `.env.local.example` + `docs/local-development.md` ile:

- [ ] Docker Desktop kur
- [ ] Supabase CLI kur (`brew install supabase/tap/supabase`)
- [ ] `supabase init` + `supabase start`
- [ ] `.env.local.example` → `.env.local` kopyala, local Supabase anahtarlarını gir
- [ ] `prisma migrate deploy` + `apply-rls.js` + `seed-demo.js` ile yerel DB'yi kur
- [ ] `pnpm dev` ile yerel ortamda çalıştığını doğrula
- [ ] Doğrula: `.env.local` içinde `pkkkyyajfmusurcoovwt` (prod ref) **yok**

## P0.2 — `.env` dosyalarını tek doğruya indir

Repo kökünde şu an 9 `.env*` varyantı var; 2 Supabase projesi + 2 `ENCRYPTION_KEY`
dolaşıyor. Bu karışıklık, yanlış ortama bağlanmanın zeminidir.

- [ ] Şu yedek/artık dosyaları **sil** (içlerinde eski secret'lar var):
  - `.env.local.bak-1778004683`
  - `.env.local.bak.1778272229`
  - `.env.local.save`
  - `.env.backup-before-vercel-pull`
  - `.env.vercel`
- [ ] Yalnızca şunlar kalsın: `.env.local` (yerel dev), `.env` (gerekiyorsa),
  `.env.example` + `.env.local.example` (commitli şablonlar)
- [ ] `.env.production.reference` **git'e commitli** — içinde gerçek secret var mı
  kontrol et. Varsa: değerleri rotate et (P0.5) + dosyayı placeholder'a indir.
  (Geçmişteki commit'lerde de sızmış olabilir — git history temizliği gerekebilir.)
- [ ] `ENCRYPTION_KEY`: prod ile local **farklı** olmalı. Prod'daki doğru değeri
  Vercel'de sabitle; local için yeni üret. İki değerin karışmadığından emin ol.

## P0.5 — Least privilege + key rotation (Supabase Dashboard)

Incident sırasında prod DB parolası ve `service_role` key birçok env dosyasında
dolaştı; ayrıca uygulamanın kullandığı rol `auth.users`'ı silebiliyordu.

- [ ] **Prod DB parolasını rotate et** — Supabase Dashboard → Settings → Database
  → Reset database password. Yeni değeri yalnızca Vercel env'ine yaz.
- [ ] **`service_role` key'i rotate et** — Settings → API → service_role → roll.
  Vercel'de güncelle. (Eski key'ler env dosyalarında dolaştı.)
- [ ] **Yıkıcı yetkiyi daralt** — SQL Editor'de uygulamanın günlük kullandığı
  rolden `auth.users` üzerindeki `DELETE`/`TRUNCATE` yetkisini al; yıkıcı işlem
  yalnızca ayrı bir "break-glass" rolünde kalsın. (auth şeması Supabase yönetir —
  uygulama rolünün auth tablolarına yazma ihtiyacı yoktur.)
- [ ] `CRON_SECRET`, `BACKUP_ENCRYPTION_KEY` gibi diğer sırların da env
  dosyalarında dolaşıp dolaşmadığını gözden geçir; şüpheliyse rotate et.

## Sıradaki adım — P1 (kuvvetle önerilir)

Kod PR'ı P0'ı kapatır. Kurtarma tarafında en yüksek kaldıraç:

- [ ] **Supabase Pro + PITR aç** (~$25/ay). PITR, `auth` şeması dahil tüm DB'yi
  son 7 günün herhangi bir saniyesine geri sarar. Bu incident PITR ile 5
  dakikalık bir geri-alma olurdu. Tek başına en güçlü koruma.
- [ ] Yedeğin `auth.users`'ı geri yazabildiğini test et (restore tarafı).
- [ ] Auth hata oranı / canary login alarmı kur.

Ayrıntı: `.claude/plans/hospital-lms-incident-prevention.md`.
