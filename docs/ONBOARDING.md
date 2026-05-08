# Onboarding — Hospital LMS

> Son güncelleme: 2026-05-08
> Hedef kitle: Projeye yeni katılan geliştirici
> Tahmini okuma süresi: 30 dakika
> Tahmini ilk hafta süresi: 5 iş günü

## Hoş Geldin

Hospital LMS, çoklu hastane (multi-tenant) personel eğitim ve sınav yönetim sistemidir. Türkiye'deki hastanelerin akreditasyon ve KVKK gerekliliklerini karşılaması için tasarlanmıştır. Şu an [N] hastanede aktif, [N] kullanıcı sistem üzerinde.

Bu doküman seni 1. günden itibaren tek başına PR atabilecek seviyeye getirmek için yazıldı. Acele etme — proje karmaşık, anlamak zaman alır.

**Önemli kurallar (özet):**
1. **Müşteri canlıdayken doğrudan prod'a deploy yok.** Her değişiklik staging'den geçer. ([ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md))
2. **Migration'ı staging'de denemeden prod'a alma.** ([CLAUDE.md](../CLAUDE.md))
3. **`pnpm db:push` YASAK.** Sadece `pnpm db:migrate dev`.
4. **Pre-commit hook'larını bypass etme.** Secret-scanner ve perf-check var, sebep var.

---

## 1. Gün — Erişim ve İlk Kurulum

### 1.1 Erişim Talepleri (Owner'dan iste)

Aşağıdaki sistemlere erişim için Owner'a başvur. Erişim matrisi:

| Sistem | Senin Rolün | Owner'ın Yapması Gereken | Ne Zaman? |
|--------|-------------|--------------------------|-----------|
| **GitHub Repo** | Read | Repo settings → Add collaborator (Read) | İlk gün |
| **Vercel Team** | Developer (Read) | Team settings → Invite (Developer rolü) | İlk gün |
| **Supabase** | Read-only | Project → Members → Invite (Read-only) | İlk gün |
| **AWS IAM** | None (başlangıçta) | — | İhtiyaç olunca |
| **Sentry** | Member | Org → Members → Invite (Member) | İlk gün |
| **Upstash** | Read-only | Team → Invite | İhtiyaç olunca |

**Not:** En az ayrıcalık prensibi — başlangıçta read-only, güven kuruldukça artırılır. Yazılı erişim taleplerini saklayın.

### 1.2 Bilgisayar Kurulumu

#### Gerekli Yazılımlar

```powershell
# Node.js 22.x (LTS) — sürüm kritik, .nvmrc kontrol et
node --version

# pnpm 9.x
npm install -g pnpm

# Git
git --version  # >= 2.40

# VS Code (önerilen) veya WebStorm
# Eklentiler: ESLint, Prettier, Tailwind CSS IntelliSense, Prisma
```

#### Repo'yu Klonla

```powershell
git clone https://github.com/[org]/hospital-lms.git
cd hospital-lms
pnpm install
```

#### `.env.local` Hazırla

```powershell
# Owner'dan staging credentials'ları al
cp .env.example .env.local

# Doldurman gereken anahtarlar (.env.example'da liste var):
# DATABASE_URL          → Staging Supabase pooler
# DIRECT_URL            → Staging Supabase session pooler (port 5432)
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY  ⚠️ ASLA client-side'a sızdırma
# AWS_S3_BUCKET             → Staging bucket (hospital-lms-videos-staging)
# AWS_REGION
# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY
# UPSTASH_REDIS_REST_URL
# UPSTASH_REDIS_REST_TOKEN
# BACKUP_ENCRYPTION_KEY     → Staging anahtarı (prod'tan farklı!)
```

⚠️ **GÜVENLİK:** `.env.local` ASLA commit edilmemeli. `.gitignore`'da. İlk push'tan önce `git status` ile kontrol et.

#### Prisma Client Üret

```powershell
pnpm db:generate
```

#### Dev Server'ı Çalıştır

```powershell
pnpm dev
```

Tarayıcıda http://localhost:3000 — login ekranı açılmalı.

#### Test Hesabıyla Giriş Yap

Owner'dan staging için test hesapları al. Genelde:
- `super_admin@devakent.invalid` (super admin)
- `admin@devakent.invalid` (hastane yöneticisi)
- `staff@devakent.invalid` (personel)

---

## 2. Gün — Repo Yapısını Anla

### 2.1 Önce Bunları Oku (Sırayla)

| # | Dosya | Süre | Niye Okumalı |
|---|-------|------|--------------|
| 1 | [README.md](../README.md) | 5dk | Genel proje özeti, başlama |
| 2 | [CLAUDE.md](../CLAUDE.md) | 20dk | Tüm konvansiyonlar, kurallar, yasaklar |
| 3 | [PERFORMANCE_RULES.md](../PERFORMANCE_RULES.md) | 15dk | Performans hatalarından çıkarılan kurallar |
| 4 | [docs/STAGING_SETUP.md](./STAGING_SETUP.md) | 10dk | Staging ortamı kullanımı |
| 5 | [docs/disaster-recovery.md](./disaster-recovery.md) | 10dk | Felaket senaryoları |
| 6 | [docs/ROLLBACK_RUNBOOK.md](./ROLLBACK_RUNBOOK.md) | 15dk | Sorun çıktığında ne yapılır |
| 7 | [docs/SLA.md](./SLA.md) | 10dk | Müşteri taahhütlerimiz |

**Toplam:** ~85 dakika. Aceleci olma — bu doc'ları okumadan kod yazma.

### 2.2 Repo Klasör Yapısı

```
hospital-lms/
├── src/
│   ├── app/                  # Next.js 16 App Router
│   │   ├── (super-admin)/    # /super-admin/* — platform yönetimi
│   │   ├── admin/            # /admin/*       — hastane yöneticisi
│   │   ├── staff/            # /staff/*       — personel
│   │   ├── exam/             # /exam/[id]/*   — fullscreen sınav akışı
│   │   ├── api/              # API route'lar
│   │   └── auth/             # Login, register, callback
│   ├── components/
│   │   ├── shared/           # data-table, page-header, stat-card vs
│   │   ├── layouts/          # Sidebar, topbar, role-aware config
│   │   ├── providers/        # ThemeProvider, AuthProvider, ToastProvider
│   │   └── ui/               # shadcn/ui primitives
│   ├── lib/
│   │   ├── api-handler.ts    # withAdminRoute, withStaffRoute vs.
│   │   ├── api-helpers.ts    # jsonResponse, ApiError, parseBody
│   │   ├── prisma.ts         # Prisma singleton (PrismaPg adapter)
│   │   ├── redis.ts          # Upstash + in-memory fallback
│   │   ├── s3.ts             # AWS S3 + CloudFront helpers
│   │   ├── validations.ts    # Zod şemaları
│   │   └── supabase/         # client.ts, server.ts, middleware.ts
│   ├── hooks/                # useFetch, useRealtimeNotifications vs.
│   ├── store/                # Zustand store
│   └── types/                # TypeScript tip tanımları
├── prisma/
│   ├── schema.prisma         # 51 model
│   └── migrations/           # 44+ migration dosyası
├── scripts/                  # seed, restore-drill, load-test vs.
├── e2e/                      # Playwright e2e testleri
├── docs/                     # Bu doc'un olduğu klasör
├── public/                   # Static dosyalar
└── .github/workflows/        # CI/CD
```

### 2.3 Önemli Tek Doğruluk Kaynakları

| Konu | Doğruluk Kaynağı |
|------|------------------|
| API route auth | `src/lib/api-handler.ts` (withApiHandler ve preset'ler) |
| Validation | `src/lib/validations.ts` (Zod şemaları) |
| Renk teması | `src/lib/editorial-palette.ts` veya CSS variable'lar |
| Eğitim ilerleme hesabı | `src/lib/training-progress.ts` |
| Sınav state machine | `src/lib/exam-state-machine.ts` |
| RLS policy'leri | `supabase-rls.sql` |

---

## 3. Gün — Tech Stack ve Konvansiyonlar

### 3.1 Tech Stack Özeti

- **Frontend:** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind 4, shadcn/ui
- **Backend:** Next.js API routes, Prisma 7, PostgreSQL (Supabase)
- **Auth:** Supabase Auth (JWT, cookie-based via @supabase/ssr)
- **Storage:** AWS S3 (videolar, PDF), CloudFront (signed URL)
- **Cache/Timer:** Upstash Redis + in-memory fallback
- **Email:** Brevo (2026-05-07'de SES'ten geçildi)
- **Monitoring:** Sentry (PII redaction aktif)
- **Hosting:** Vercel (fra1 region)

### 3.2 Kritik Kuralları (CLAUDE.md'den özet)

#### TypeScript

- **`any` YASAK** — strict mode aktif
- **Magic number YASAK** — `constants.ts` kullan
- **`console.log` YASAK** — `logger` (src/lib/logger.ts) kullan
- **Public API'lere JSDoc** — küçük component'lere zorunlu değil

#### API Route'lar

- **Yeni route → `withApiHandler` preset'leri ZORUNLU**
- `withAdminRoute`, `withStaffRoute`, `withSuperAdminRoute` mevcut
- **Eski helper'lar (`getAuthUser`, `requireRole`) yeni route'larda YASAK**
- **`supabase.auth.getUser()` doğrudan çağırma** — pre-commit engelliyor
- **GET'lerde Cache-Control zorunlu** — pre-commit engelliyor
- **Bağımsız Prisma sorguları → `Promise.all`**, ardışık await yasak

#### Database

- **Şema değişikliği:** `pnpm db:migrate dev --name <açıklayıcı-isim>`
- **`pnpm db:push` YASAK** — drift yaratır (Nisan 2026'da 8 tablo + 40 kolon drift olmuştu)
- **DROP COLUMN tek migration'da YAPMA** — 2 aşamalı (önce deprecated, sonra DROP)
- **Multi-tenant filtre:** Her DB sorgusu `organizationId` ile filtrelenmeli
- **RLS:** Yeni tablo → `supabase-rls.sql`'a policy ekle

#### Frontend

- **Server Component varsayılan** — `"use client"` sadece gerekirse
- **shadcn/ui mevcut component'leri** kullan, sıfırdan yazma
- **`transition-all` YASAK** — property'yi açıkça belirt
- **Raw Tailwind renk class'ı YASAK** — CSS variable kullan
- **3+ filter/map/reduce zinciri → `useMemo`**

### 3.3 Klasik Tuzaklar (memory'den derlenmiş)

- **`endsWith('-auth-token')` YASAK** — Supabase chunked cookie kullanır, `includes()` kullan
- **401 ≠ 403** — 401 = login'e yönlendir, 403 = hata göster (redirect yapma)
- **`onAuthStateChange`'de `TOKEN_REFRESHED` event'inde `setUser()` çağırma** — gereksiz re-render
- **Login sonrası `window.location.href`** kullan — `router.push` race condition yaratır
- **CSS `tr::before` koltuğa hücre ekler** — kullanma
- **`[data-color]` selector'larında `html` prefix zorunlu** — specificity için
- **Migration sonrası dev server reset** — `.next` sil + `db:generate` + restart

---

## 4-5. Gün — İlk PR

### 4.1 Görev Seçimi

Owner'dan **küçük bir UI bug düzeltme** veya **kozmetik iyileştirme** iste. İdeal ilk görev:
- Sadece bir dosya etkilemeli
- DB değişikliği yok
- Yeni dependency yok
- Etkilenen akış sınırlı
- Risk piramidinde en alt seviye

Örnekler:
- "Şu sayfada yazı tipi tutarsız, düzelt"
- "Şu butonda hover state eksik"
- "Şu liste boş olduğunda mesaj göster"
- "Şu sertifika tarihi yanlış formatta"

### 4.2 Branch ve Geliştirme

```powershell
# Main'den taze branch
git checkout main
git pull
git checkout -b fix/<açıklayıcı-isim>

# Kod yaz, dev server'da test et
pnpm dev

# Statik kontrol
pnpm tsc --noEmit
pnpm lint

# Test
pnpm test  # (varsa ilgili test)
```

### 4.3 Commit ve Push

```powershell
git add <belirli dosyalar>
# git add -A KULLANMA — secret veya unrelated dosya gelebilir

git commit -m "fix: <kısa açıklama>"
# Pre-commit hook otomatik çalışır:
# - secret-scanner.js
# - perf-check.js
# Eğer engelleniyorsan, sebebi okuyup düzelt — bypass etme

git push -u origin fix/<branch-isim>
```

### 4.4 PR Aç

GitHub'da PR aç. PR description şablonu:

```markdown
## Ne yaptım?
[1-2 cümle]

## Niye yaptım?
[Sorunun ne olduğu, nereden tespit edildi]

## Etkilenen alanlar
- Dosyalar: [liste]
- Akışlar: [örn. login, sınav başlatma]
- Risk seviyesi: P0 / P1 / P2 / P3 (UI = P3)

## Test ettim
- [ ] Lokal dev'de gözle test
- [ ] `pnpm tsc --noEmit` temiz
- [ ] `pnpm lint` temiz
- [ ] (varsa) `pnpm test` geçti

## Rollback planı
[Sorun çıkarsa nasıl geri alırız]

## Ekran görüntüsü (UI değişikliği varsa)
[Önce / Sonra]
```

### 4.5 Code Review

- Owner / senior dev review yapacak
- Yorumları savunma reflex'iyle değil, anlamak için oku
- Soru sormak utanç değil — açıklama iste
- "Niye böyle yaptın?" → CLAUDE.md veya konvansiyon işaret edebilir

### 4.6 Merge ve Deploy

- Owner merge edecek (en az 1 hafta boyunca sen merge etmiyorsun)
- Merge sonrası Vercel preview otomatik prod'a yükselir
- 5-10 dakika canlıyı izle (Sentry + Vercel logs)

---

## Sürekli Yapman Gerekenler

### Günlük

- ✅ Sentry — son 24 saatte yeni hata var mı? (5 dakika)
- ✅ Slack/E-posta — Owner'dan mesaj veya PR review beklenen?
- ✅ GitHub notifications — sana atanan PR/issue var mı?

### Haftalık

- ✅ Sürüm notlarını oku (varsa)
- ✅ `git pull` — main güncel mi?
- ✅ Bağımlılık güncellemeleri Dependabot PR — review

### Aylık

- ✅ Bu doc'u tekrar gözden geçir — sana hala alakalı mı, eksik mi?
- ✅ docs/incidents/ klasörü — geçen ay olanları oku, ders çıkar
- ✅ Performans metriklerine bak (Vercel Speed Insights, Sentry Transactions)

---

## Yardım İstemek — Kim, Ne Zaman?

| Sorun türü | Kime sor | Nasıl |
|-----------|----------|-------|
| Repo erişimi, env, kurulum | Owner | E-posta + Slack |
| Konvansiyon belirsiz | Owner / CLAUDE.md | Önce CLAUDE.md oku |
| Mimari karar | Owner | PR'da sor |
| Acil prod sorunu | Owner | Telefon (sen P0'a müdahale etme ilk hafta) |
| Sentry'de yeni alarm | Owner | Slack |
| Müşteri talebi | Owner | Forward e-posta |

**İlk 30 gün boyunca:** Owner'a günde 1-2 kez "şunu sorabilir miyim?" demek normaldir. Çekinme.

---

## Acil Durum (İlk Hafta)

İlk hafta boyunca:
- 🚫 Acil prod müdahalesi yapma — Owner halletsin
- 🚫 Müşteriyle direkt iletişim yapma — Owner üzerinden
- 🚫 Production environment'a erişme — staging yeterli
- 🚫 `git push --force` yapma
- 🚫 Migration deploy etme

Bunları sorarak da yapabilirsin — ama sorulmadan tek başına yapma.

---

## 30. Gün Hedefi — Kendine Test

İlk 30 gün sonunda kendi kendine bu soruları sor:

- [ ] CLAUDE.md'deki kuralları başkasına anlatabilir miyim?
- [ ] `withApiHandler` ve preset'lerini kullanarak yeni bir admin route yazabilir miyim?
- [ ] Bir migration dosyası okuyup riskini değerlendirebilir miyim?
- [ ] Müşteri bir bug bildirdiğinde hangi dosyaya bakacağımı biliyor muyum?
- [ ] Staging'de test → PR akışını rahat yapabiliyor muyum?
- [ ] Sentry'de bir hatanın kök nedenini repo'da bulabiliyor muyum?

Hepsi "evet" ise — tek başına orta seviye PR atmaya hazırsın. Olmadıysa Owner'a söyle, eksiklik nerede beraber çalışırsınız.

---

## Yararlı Linkler

- [Next.js 16 docs](https://nextjs.org/docs)
- [Prisma docs](https://www.prisma.io/docs)
- [Supabase docs](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [Vercel deployment](https://vercel.com/docs)

## Sözlük (Türkçe Proje Terimleri)

| Terim | Anlamı |
|-------|--------|
| **Esas Yönetici** | Hastanenin sistemdeki ana yetkilisi (Org Owner) |
| **Personel** | Eğitim alacak son kullanıcı (Staff) |
| **Atama** | Bir personele bir eğitim verilmesi (TrainingAssignment) |
| **Ön sınav** | Eğitim öncesi bilgi seviyesi testi |
| **Son sınav** | Eğitim sonrası geçerlilik testi |
| **Deneme hakkı** | Sınavı kaç kez tekrar girebileceği (max attempts) |
| **Atama Talebi** | Personelin ek deneme isteği (AttemptRequest) |
| **Eğitim dönemi** | Yıllık eğitim periyodu (TrainingPeriod) |
| **Akreditasyon** | JCI / ISO / TJC / OSHA standartları |
| **SMG** | Stratejik / Master / Genel kategoriler |
| **KVKK** | Kişisel Verilerin Korunması Kanunu |

---

Hoş geldin, başarılar. Sorun olursa Owner'a yaz — bu doc bir başlangıç noktası, asıl öğrenme kod yazarken oluşacak.
