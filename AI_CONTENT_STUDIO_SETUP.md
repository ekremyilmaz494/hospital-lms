# AI İçerik Stüdyosu — Lokal Kurulum & Test Rehberi

Bu sürümde NotebookLM entegrasyonu MVP olarak yazıldı. Lokal'de end-to-end test
edebilmek için aşağıdaki adımları sırayla uygulayın.

## 1. Veritabanı migration'ı

```bash
cd hospital-lms
pnpm db:migrate dev --name add_ai_content_studio
```

Bu komut:
- `ai_notebook_accounts` ve `ai_generations` tablolarını yaratır
- `Organization` ve `User` modellerine yeni back-relations ekler
- Prisma client'ı yeniden üretir (`aiNotebookAccount`, `aiGeneration` erişilebilir olur)

## 2. RLS policy uygula

```bash
node scripts/apply-rls.js
```

(veya `supabase-rls.sql`'in son bölümünü Supabase SQL Editor'a yapıştır.)

## 3. Env değişkenleri

`.env.local` dosyasına ekle:

```bash
# AES-256-GCM (zaten varsa atla)
ENCRYPTION_KEY=<base64-encoded-32-bytes>
# Üret: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Worker URL + HMAC secret
NOTEBOOK_WORKER_URL=http://localhost:8080
WORKER_HMAC_SECRET=<32+ chars>
# Üret: openssl rand -hex 32
```

## 4. Worker servisini lokalde çalıştır

### Seçenek A: Docker (gerçek notebooklm-py + Chromium ile)

```bash
cd packages/notebook-worker
docker build -t hospital-nb-worker .
docker run -p 8080:8080 \
  -e WORKER_HMAC_SECRET=<aynı secret> \
  -v $HOME/.hospital-nb-data:/data \
  hospital-nb-worker
```

İlk build 5-10 dk (Chromium indirme dahil). Container ayağa kalktıktan sonra
`http://localhost:8080/healthz` → `{ "ok": true, "version": "0.1.0" }` dönmeli.

### Seçenek B: Mock mode (notebooklm-py kurulumsuz, sadece akış testi)

```bash
cd packages/notebook-worker
npm install
WORKER_HMAC_SECRET=<aynı secret> \
MOCK_NOTEBOOKLM=1 \
DATA_DIR=/tmp/nb-data \
npm run dev
```

Mock mode'da worker `notebooklm` CLI'yi gerçekten çağırmaz, sahte JSON döndürür.
Generation hızlıca "completed" olur ama gerçek dosya üretilmez (S3 upload step'i
mock değildir, gerçek presigned URL gerektirir — onu da kapatmak istersen
`MOCK_S3_UPLOAD=1` ekleyebilirsin ama şu an worker kodu bunu desteklemiyor;
ileride genişletilebilir).

## 5. Hospital LMS dev başlat

```bash
cd hospital-lms
pnpm dev
```

## 6. Manuel test akışı

1. Admin olarak login: `http://localhost:3000/auth/login`
2. Sidebar → "AI İçerik Stüdyosu" tıkla → `/admin/ai-content-studio`
3. "Hesap bağlı değil" banner'ı görünmeli → "Hesap Bağla" butonuna bas
4. **Yerel makinede ayrı terminal'de:**
   ```bash
   pip install notebooklm-py  # veya pipx install notebooklm-py
   notebooklm login
   # tarayıcıda Google girişi yap, NotebookLM ana sayfasını gör, ENTER bas
   ```
5. `~/.notebooklm/storage_state.json` dosyasının içeriğini kopyala:
   ```bash
   cat ~/.notebooklm/storage_state.json | pbcopy   # macOS
   ```
6. Connect sayfasındaki textarea'ya yapıştır → "Bağla ve Doğrula"
7. Başarılı bağlantı sonrası `/admin/ai-content-studio` → form aktifleşmeli
8. Test EY.FR.40 dosyasını yükle (kaynak), prompt: "Hemşirelik eğitimi için
   profesyonel infografik", tip: İnfografik → "Üret"
9. History tablosunda "Üretiliyor" badge ile satır görünmeli, 5sn'de bir progress güncellenir
10. 5-15 dk sonra "Tamamlandı" → "İndir" tuşu ile PNG açılmalı

## 7. Multi-tenant izolasyon testi

İki farklı hastanedeki admin hesabıyla giriş yap; biri diğerinin generation
ID'sine `/api/admin/ai-content-studio/[id]/download` çağırınca **404** dönmeli
(RLS + manual filter).

## 8. CLAUDE.md doğrulama protokolü

```bash
pnpm tsc --noEmit
pnpm lint
pnpm test
# PR öncesi: pnpm build
```

## 9. Bilinen Sınırlamalar (MVP)

- **Storage state expiration:** ~30 günde dolar. UI banner uyarır, admin yeniden bağlar.
- **Rate limit:** Google tarafında bazen audio/video/quiz fail eder. UI'da "Tekrar Dene" eklenecek (Faz 3).
- **Worker SPOF:** Tek instance, down olursa tüm orgs etkilenir. MVP'de kabul.
- **Storage quota:** Var olan `checkStorageQuota` reuse ediliyor; AI çıktıları aynı limite dahil. Faz 3'te ayrı quota.
- **Training entegrasyonu (Faz 2):** Training detail page'de "AI Quiz Üret" butonu henüz yok — şu an admin manuel olarak studio'ya gidip kaynak olarak training video'sunu seçer.

## 10. Production deploy (Faz 1 sonrası)

Fly.io worker:
```bash
cd packages/notebook-worker
flyctl auth login
flyctl launch --no-deploy   # fly.toml zaten var
flyctl volumes create notebook_data --size 3 --region fra
flyctl secrets set WORKER_HMAC_SECRET=$(openssl rand -hex 32)
flyctl deploy
```

Vercel env'leri:
```bash
vercel env add NOTEBOOK_WORKER_URL production  # https://hospital-lms-notebook-worker.fly.dev
vercel env add WORKER_HMAC_SECRET production    # aynı secret
```

`scripts/check-vercel-env.js`'e bu iki env'i prod-required olarak ekle.
