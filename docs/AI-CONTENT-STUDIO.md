# AI İçerik Stüdyosu — Kapsamlı Teknik Şartname

> **Versiyon:** 2.0
> **Tarih:** 2026-04-04
> **Durum:** Sıfırdan inşa edilecek
> **Python Kütüphanesi:** [notebooklm-py](https://github.com/teng-lin/notebooklm-py)

---

## 1. VİZYON & AMAÇ

Hastane admin'i NotebookLM üzerinden eğitim içerikleri üretir. Sistem; belge yükleme, içerik üretimi, otomatik aktarım, önizleme, değerlendirme ve kütüphaneye kaydetme akışlarını uçtan uca yönetir.

### Temel Prensipler
- **Gerçek zamanlı aktarım:** İçerik NotebookLM'de üretildiği an sisteme düşer
- **Arka plan üretimi:** Kullanıcı başka sayfalarda gezebilir, üretim devam eder
- **Her format desteklenir:** Audio, video, quiz, flashcard, slayt, infografik, rapor, zihin haritası, veri tablosu
- **İçerik geçmişi:** Tüm üretimler listelenir, istenen an görüntülenebilir
- **Kütüphane entegrasyonu:** Beğenilen içerik doğrudan ContentLibrary'ye eklenir
- **Premium UI:** frontend-design skill kullanılarak profesyonel, hastane/sağlık temasına uygun tasarım

---

## 2. MİMARİ GENEL BAKIŞ

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16)                     │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Stüdyo   │  │ Üretim   │  │ Detay/   │  │  Sidebar    │ │
│  │ Ana      │  │ Wizard   │  │ Önizleme │  │  Badge +    │ │
│  │ Sayfa    │  │ (4 adım) │  │ Sayfası  │  │  Toast      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │              │              │               │        │
│  ┌────┴──────────────┴──────────────┴───────────────┴──────┐ │
│  │              Zustand Global Store (localStorage)         │ │
│  │     activeJobs + completedNotifications + polling        │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────────┐ │
│  │            Global Poller (AiGenerationPoller)            │ │
│  │  - Progressive polling (2s → 5s → 10s)                  │ │
│  │  - Toast bildirim (tıklanabilir, yönlendirmeli)         │ │
│  │  - Paralel status check (Promise.all)                   │ │
│  └──────────────────────┬──────────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTP API
┌─────────────────────────┼────────────────────────────────────┐
│                    BACKEND (Next.js API)                      │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────┐       │
│  │ /generate  │  │ /status    │  │ /result          │       │
│  │ /documents │  │ /list      │  │ /evaluate        │       │
│  │ /auth/*    │  │ /latest    │  │ /approve /discard│       │
│  └─────┬──────┘  └─────┬──────┘  └────────┬─────────┘       │
│        │               │                   │                 │
│  ┌─────┴───────────────┴───────────────────┴───────────────┐ │
│  │              Python Sidecar Service (FastAPI)            │ │
│  │              notebooklm-py async client                  │ │
│  │              Port: 8100                                  │ │
│  └─────────────────────┬───────────────────────────────────┘ │
│                        │                                     │
│  ┌─────────────────────┴───────────────────────────────────┐ │
│  │    Prisma (PostgreSQL)  +  AWS S3  +  Redis Cache       │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                          │
                   Google NotebookLM
                   (undocumented RPC API)
```

---

## 3. VERİTABANI MODELLERİ (Prisma)

### 3.1 AiNotebook
Organizasyon başına NotebookLM notebook kaydı.

```prisma
model AiNotebook {
  id               String   @id @default(uuid()) @db.Uuid
  organizationId   String   @db.Uuid @map("organization_id")
  notebookLmId     String   @map("notebooklm_id") @db.VarChar(100)  // NotebookLM'deki gerçek ID
  title            String   @db.VarChar(500)
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz

  organization     Organization       @relation(fields: [organizationId], references: [id])
  sources          AiNotebookSource[]
  generations      AiGeneration[]

  @@index([organizationId])
  @@map("ai_notebooks")
}
```

### 3.2 AiNotebookSource
Notebook'a yüklenen kaynaklar.

```prisma
model AiNotebookSource {
  id             String   @id @default(uuid()) @db.Uuid
  notebookId     String   @db.Uuid @map("notebook_id")
  sourceLmId     String?  @map("source_lm_id") @db.VarChar(100)  // NotebookLM'deki source ID
  fileName       String   @map("file_name") @db.VarChar(500)
  fileType       String   @map("file_type") @db.VarChar(50)
  fileSize       Int      @map("file_size")
  s3Key          String?  @map("s3_key") @db.Text
  sourceType     String   @map("source_type") @db.VarChar(30)  // file, url, text, youtube
  sourceUrl      String?  @map("source_url") @db.Text
  status         String   @default("uploading") @db.VarChar(30)  // uploading, processing, ready, error
  summary        String?  @db.Text
  keyTopics      Json?    @map("key_topics")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  notebook       AiNotebook @relation(fields: [notebookId], references: [id], onDelete: Cascade)

  @@index([notebookId])
  @@map("ai_notebook_sources")
}
```

### 3.3 AiGeneration
Her bir içerik üretim kaydı.

```prisma
model AiGeneration {
  id              String    @id @default(uuid()) @db.Uuid
  organizationId  String    @db.Uuid @map("organization_id")
  userId          String    @db.Uuid @map("user_id")
  notebookId      String    @db.Uuid @map("notebook_id")
  title           String    @db.VarChar(500)
  artifactType    String    @map("artifact_type") @db.VarChar(30)
  // audio, video, slide_deck, quiz, flashcards, report, infographic, data_table, mind_map
  artifactLmId    String?   @map("artifact_lm_id") @db.VarChar(100)  // NotebookLM artifact ID
  taskLmId        String?   @map("task_lm_id") @db.VarChar(100)      // NotebookLM task ID (polling)
  instructions    String?   @db.Text
  settings        Json      @default("{}")   // format, style, length, difficulty, quantity vs.
  status          String    @default("pending") @db.VarChar(30)
  // pending → queued → processing → downloading → completed → failed
  progress        Int       @default(0)       // 0-100
  // Sonuç dosyası
  outputS3Key     String?   @map("output_s3_key") @db.Text
  outputFileType  String?   @map("output_file_type") @db.VarChar(20)  // mp3, mp4, pdf, pptx, png, json, csv, md
  outputSize      Int?      @map("output_size")
  // İçerik meta
  transcript      String?   @db.Text
  contentData     Json?     @map("content_data")  // Quiz soruları, flashcard'lar, mind map JSON vs.
  metadata        Json      @default("{}")
  errorMessage    String?   @map("error_message") @db.Text
  // Değerlendirme
  evaluation      String?   @db.VarChar(20)   // approved | rejected
  evaluationNote  String?   @map("evaluation_note") @db.Text
  evaluatedAt     DateTime? @map("evaluated_at") @db.Timestamptz
  evaluatedById   String?   @db.Uuid @map("evaluated_by_id")
  // Kütüphane
  savedToLibrary    Boolean   @default(false) @map("saved_to_library")
  contentLibraryId  String?   @db.Uuid @map("content_library_id")
  savedAt           DateTime? @map("saved_at") @db.Timestamptz
  // Zaman
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  organization    Organization  @relation(fields: [organizationId], references: [id])
  user            User          @relation("UserAiGenerations", fields: [userId], references: [id])
  notebook        AiNotebook    @relation(fields: [notebookId], references: [id])
  evaluatedBy     User?         @relation("AiEvaluator", fields: [evaluatedById], references: [id])
  contentLibrary  ContentLibrary? @relation("AiToLibrary", fields: [contentLibraryId], references: [id])

  @@index([organizationId])
  @@index([userId])
  @@index([status])
  @@index([artifactType])
  @@index([evaluation])
  @@map("ai_generations")
}
```

### 3.4 AiGoogleConnection
Organizasyon bazında Google NotebookLM kimlik bilgileri.

```prisma
model AiGoogleConnection {
  id              String    @id @default(uuid()) @db.Uuid
  organizationId  String    @unique @db.Uuid @map("organization_id")
  userId          String    @db.Uuid @map("user_id")
  email           String
  status          String    @default("pending")  // pending, connected, error, expired
  encryptedCookie String?   @db.Text @map("encrypted_cookie")
  lastVerifiedAt  DateTime? @map("last_verified_at") @db.Timestamptz
  lastUsedAt      DateTime? @map("last_used_at") @db.Timestamptz
  expiresAt       DateTime? @map("expires_at") @db.Timestamptz
  errorMessage    String?   @map("error_message")
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  organization    Organization @relation(fields: [organizationId], references: [id])
  user            User         @relation(fields: [userId], references: [id])

  @@map("ai_google_connections")
  @@index([status])
}
```

### 3.5 Mevcut Modellere Eklenecek İlişkiler

```prisma
// Organization modeline ekle:
  aiNotebooks          AiNotebook[]
  aiGenerations        AiGeneration[]
  aiGoogleConnection   AiGoogleConnection?

// User modeline ekle:
  aiGenerations        AiGeneration[]       @relation("UserAiGenerations")
  aiEvaluations        AiGeneration[]       @relation("AiEvaluator")
  aiGoogleConnections  AiGoogleConnection[]

// ContentLibrary modeline ekle:
  aiGenerations        AiGeneration[]       @relation("AiToLibrary")
```

---

## 4. PYTHON SIDECAR SERVİSİ (FastAPI)

### 4.1 Neden Python?
`notebooklm-py` kütüphanesi tamamen Python + async. Node.js'den doğrudan çağrılamaz. Ayrı bir FastAPI servisi olarak çalışır.

### 4.2 Proje Konumu & Klasör Yapısı

> **ÖNEMLİ:** Python sidecar servisi, Next.js projesinden **tamamen ayrı bir klasörde** yaşar.
> Next.js projesi ile aynı seviyede (kardeş klasör) olmalıdır.

```
Yeni klasör/                          # Ana çalışma dizini
├── hospital-lms/                     # Next.js projesi (mevcut)
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── ...
│
└── ai-content-service/               # Python sidecar servisi (YENİ — AYRI PROJE)
    ├── main.py                       # FastAPI app, CORS, lifecycle, startup/shutdown
    ├── config.py                     # Environment variables, settings
    ├── routes/
    │   ├── __init__.py
    │   ├── auth.py                   # /api/auth/* — login, verify, disconnect
    │   ├── notebooks.py              # /api/notebooks/* — CRUD
    │   ├── sources.py                # /api/sources/* — add, list, status, wait
    │   ├── generate.py               # /api/generate — tüm artifact üretimi
    │   ├── status.py                 # /api/status/{task_id} — polling
    │   ├── download.py               # /api/download/{artifact_id} — binary download
    │   └── health.py                 # /api/health — health check
    ├── services/
    │   ├── __init__.py
    │   ├── notebooklm_client.py      # NotebookLM client wrapper (singleton)
    │   └── storage.py                # Cookie/auth storage management
    ├── middleware/
    │   ├── __init__.py
    │   └── internal_auth.py          # X-Internal-Key doğrulama
    ├── models/
    │   ├── __init__.py
    │   └── schemas.py                # Pydantic request/response modelleri
    ├── utils/
    │   ├── __init__.py
    │   └── logger.py                 # Structured logging
    ├── temp/                         # Geçici dosyalar (indirilen artifact'ler)
    │   └── .gitkeep
    ├── requirements.txt              # Python bağımlılıkları
    ├── Dockerfile                    # Production container
    ├── docker-compose.yml            # Local development
    ├── .env.example                  # Örnek environment variables
    ├── .gitignore
    └── README.md                     # Servis dokümantasyonu
```

### 4.3 Çalıştırma

```bash
# Local development
cd ai-content-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install "notebooklm-py[browser]"
playwright install chromium
uvicorn main:app --host 0.0.0.0 --port 8100 --reload

# Docker
docker-compose up -d

# İlk kez Google login (browser açılır)
# POST http://localhost:8100/api/auth/login
```

### 4.4 Environment Variables (ai-content-service/.env)

```env
# Servis ayarları
PORT=8100
HOST=0.0.0.0
INTERNAL_KEY=supersecretinternalkey    # Next.js ile paylaşılan gizli anahtar
LOG_LEVEL=INFO

# NotebookLM
NOTEBOOKLM_PROFILE=default
NOTEBOOKLM_HOME=./data                # Cookie/auth verileri burada saklanır

# CORS
ALLOWED_ORIGINS=http://localhost:3000   # Next.js dev server
```

### 4.5 API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/health` | Servis durumu + NotebookLM bağlantı kontrolü |
| POST | `/api/auth/login` | Browser login başlat (Playwright) |
| POST | `/api/auth/verify` | Mevcut cookie doğrula |
| POST | `/api/auth/disconnect` | Cookie temizle |
| POST | `/api/notebooks/create` | Yeni notebook oluştur |
| POST | `/api/sources/add` | Notebook'a kaynak ekle (file/url/text/youtube) |
| GET | `/api/sources/status/{id}` | Kaynak işlenme durumu |
| POST | `/api/generate` | Artifact üretimi başlat |
| GET | `/api/status/{task_id}` | Üretim durumu poll |
| GET | `/api/download/{artifact_id}` | Üretilen dosyayı indir (binary) |

### 4.6 Üretim Akışı (Python Tarafı)

```python
# 1. Notebook oluştur veya mevcut olanı kullan
notebook = await client.notebooks.create(title)

# 2. Kaynakları ekle
source = await client.sources.add_file(notebook.id, file_path)
await client.sources.wait_until_ready(notebook.id, source.id, timeout=120)

# 3. Artifact üret (format'a göre)
task_id = await client.artifacts.generate_audio(
    notebook.id,
    instructions="...",
    format="deep-dive",
    length="default",
    language="tr"
)

# 4. Tamamlanmasını bekle
artifact = await client.artifacts.wait_for_completion(
    notebook.id, task_id, timeout=600, poll_interval=5
)

# 5. Dosyayı indir
await client.artifacts.download_audio(notebook.id, output_path)
```

### 4.7 Desteklenen Artifact Tipleri ve Parametreleri

| Artifact | Metot | Parametreler | İndirme Formatı |
|----------|-------|-------------|-----------------|
| **Audio** | `generate_audio` | format (deep-dive/brief/critique/debate), length (short/default/long), language | MP3 |
| **Video** | `generate_video` | format (explainer/brief/cinematic), style (auto/classic/whiteboard/kawaii/anime/watercolor/retro-print/heritage/paper-craft), language | MP4 |
| **Slayt** | `generate_slide_deck` | format (detailed/presenter), length (default/short), language | PDF / PPTX |
| **Quiz** | `generate_quiz` | quantity (fewer/standard/more), difficulty (easy/medium/hard), language | JSON / MD / HTML |
| **Flashcard** | `generate_flashcards` | quantity, difficulty, language | JSON / MD / HTML |
| **Rapor** | `generate_report` | format (briefing-doc/study-guide/blog-post/custom), language | Markdown |
| **İnfografik** | `generate_infographic` | orientation, detail, style, language | PNG |
| **Veri Tablosu** | `generate_data_table` | language | CSV |
| **Zihin Haritası** | `generate_mind_map` | (senkron, parametre yok) | JSON |

---

## 5. NEXT.JS API ROUTE'LARI

### 5.1 Dosya Yapısı

```
src/app/api/admin/ai-content-studio/
├── auth/
│   ├── connect/route.ts      # POST — Google bağlantısı başlat
│   ├── disconnect/route.ts   # POST — Bağlantıyı kes
│   ├── status/route.ts       # GET  — Bağlantı durumu
│   └── verify/route.ts       # POST — Bağlantıyı doğrula
├── documents/route.ts        # POST — Belge yükle (S3 + analiz)
├── generate/route.ts         # POST — Üretim başlat
├── status/[jobId]/route.ts   # GET  — Üretim durumu poll
├── result/[jobId]/route.ts   # GET  — Üretilen dosyayı getir (stream + range)
├── evaluate/[jobId]/route.ts # PATCH — Değerlendir (approve/reject)
├── approve/[jobId]/route.ts  # POST — Kütüphaneye kaydet
├── discard/[jobId]/route.ts  # DELETE — Sil
├── list/route.ts             # GET  — Tüm üretimler (paginated + filter + sort)
├── latest/route.ts           # GET  — Son aktif üretim
└── templates/route.ts        # GET  — Prompt şablonları
```

### 5.2 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/documents` | 20 belge/saat/organizasyon |
| `/generate` | 10 üretim/saat/organizasyon |
| `/auth/connect` | 5 deneme/saat/organizasyon |

### 5.3 Güvenlik

- Tüm endpoint'lerde `getAuthUser()` + `requireRole('admin')` kontrolü
- `organizationId` filtresi her sorguda zorunlu (multi-tenant izolasyon)
- Python servisi ile iletişimde `X-Internal-Key` header
- Google cookie'leri AES-256-GCM ile şifrelenmiş saklanır
- Audit log her kritik operasyonda

---

## 6. FRONTEND YAPISI

### 6.1 Sayfa Haritası

```
src/app/admin/ai-content-studio/
├── page.tsx                          # Ana sayfa — üretim geçmişi listesi
├── new/page.tsx                      # 4 adımlı wizard — yeni içerik oluştur
├── [jobId]/page.tsx                  # Detay/önizleme/değerlendirme sayfası
├── settings/page.tsx                 # Google hesap ayarları
├── components/
│   ├── content-card.tsx              # İçerik kartı (liste grid)
│   ├── content-preview.tsx           # Format bazlı önizleme renderer
│   ├── document-uploader.tsx         # Drag-drop belge yükleme
│   ├── format-selector.tsx           # 9 format kartı + ayarlar
│   ├── prompt-composer.tsx           # Talimat yazma alanı
│   ├── generation-progress.tsx       # Üretim ilerleme göstergesi
│   ├── evaluation-panel.tsx          # Onayla/Reddet paneli
│   ├── save-to-library-modal.tsx     # Kütüphaneye kaydetme formu
│   ├── connection-required-banner.tsx
│   └── google-connect-*.tsx          # Google bağlantı component'leri
├── hooks/
│   ├── use-generation.ts             # Üretim lifecycle yönetimi
│   ├── use-evaluation.ts             # Değerlendirme işlemleri
│   └── use-document-upload.ts        # Belge yükleme mantığı
├── lib/
│   ├── ai-service-client.ts          # Python servisi HTTP client
│   ├── format-config.ts              # 9 format konfigürasyonu
│   └── prompt-templates.ts           # Hazır şablonlar
├── types/
│   └── index.ts                      # TypeScript tip tanımları
└── constants.ts                      # Sabitler (dosya limitleri, polling vs.)
```

### 6.2 Format Renderer Haritası

Her artifact tipi farklı şekilde render edilir:

| Artifact | resultType | Önizleme Yöntemi |
|----------|-----------|-------------------|
| Audio | `audio` | HTML5 `<audio>` player + dalga formu görselleştirme |
| Video | `video` | HTML5 `<video>` player (no fast-forward) |
| Slayt (PDF) | `presentation` | PDF.js embed viewer |
| Slayt (PPTX) | `presentation` | PPTX → sayfa görselleri |
| Quiz | `json` | Soru kartları, seçenekler, doğru cevap gösterimi |
| Flashcard | `json` | Çevrilebilir kart (ön/arka) |
| Rapor | `document` | Markdown → HTML render |
| İnfografik | `image` | Zoomable image viewer |
| Veri Tablosu | `json` | TanStack Table ile tablo görünümü |
| Zihin Haritası | `json` | Ağaç/grafik görselleştirme (react-flow veya d3) |

### 6.3 State Management (Zustand Store)

```typescript
interface AiGenerationState {
  // Aktif üretimler
  activeJobs: Record<string, ActiveJob>
  addJob: (job: ActiveJob) => void
  updateJob: (id: string, updates: Partial<ActiveJob>) => void
  removeJob: (id: string) => void

  // Tamamlanmış bildirimler (henüz görüntülenmemiş)
  completedNotifications: CompletedNotification[]
  addNotification: (n: CompletedNotification) => void
  markAsViewed: (id: string) => void
  clearNotifications: () => void

  // Toplam bildirim sayısı (sidebar badge için)
  unviewedCount: number
}

// localStorage persistence + 24 saat TTL
```

### 6.4 Global Poller

```typescript
// Progressive polling aralıkları:
// - İlk 30 saniye: 2 saniye (yeni başlamış)
// - 30s — 5 dakika: 5 saniye
// - 5+ dakika: 10 saniye

// Özellikler:
// - Paralel status check (Promise.all)
// - Tıklanabilir toast bildirim (İncele butonu → detay sayfasına yönlendir)
// - notifiedRef ile tekrar bildirim engeli
// - Tamamlanan job store'da kalır (silinmez), durumu güncellenir
```

---

## 7. KULLANICI AKIŞLARI

### 7.1 Yeni İçerik Oluşturma (4 Adımlı Wizard)

```
[Adım 1: Belge Yükle]
  → Drag-drop veya dosya seçici
  → Desteklenen formatlar: PDF, DOCX, PPTX, TXT, MD
  → Dosya S3'e yüklenir
  → Python servisi belgeyi analiz eder (özet, anahtar konular, önerilen formatlar)
  → Birden fazla belge yüklenebilir (maks 5, maks 20MB/dosya)
  → URL ile kaynak da eklenebilir (web sayfası, YouTube)

[Adım 2: Talimat Yaz]
  → Hazır şablonlardan seçim (6 hastane eğitim şablonu)
  → Özel talimat yazma (1000 karakter limit)
  → Analiz sonuçlarından konu önerileri gösterilir

[Adım 3: Format Seç]
  → 9 format kartı (emoji ikon, açıklama, tahmini süre)
  → Her formata özel ayarlar (audio stili, video stili, quiz zorluk vs.)
  → Ortak ayarlar (süre, ton, hedef kitle, dil)
  → "Önerilen" badge'i (belge analizine göre)

[Adım 4: Üret & Değerlendir]
  → "Üretimi Başlat" tıklanınca → API POST /generate
  → Anında detay sayfasına yönlendir: /admin/ai-content-studio/{jobId}
  → Üretim arka planda devam eder
  → Kullanıcı istediği sayfaya gidebilir
```

### 7.2 Üretim Takibi (Arka Plan)

```
Üretim başladığında:
  → Job Zustand store'a eklenir (localStorage persist)
  → Global poller aktif job'ları poll eder
  → Sidebar'da "AI İçerik Stüdyosu" yanında turuncu badge (aktif sayı)

Üretim tamamlandığında:
  → Toast bildirim: "X içeriği hazır!" + [İncele] butonu
  → Store'daki job durumu 'completed' olarak güncellenir (silinmez)
  → completedNotifications'a eklenir
  → Liste sayfası otomatik yenilenir

Kullanıcı detay sayfasına döndüğünde:
  → Dosya NotebookLM'den indirilmiş ve S3'e yüklenmiştir
  → Önizleme, değerlendirme ve kütüphaneye kaydetme panelleri hazır
```

### 7.3 Değerlendirme & Kütüphaneye Kaydetme

```
İçerik tamamlandığında:
  → Önizleme render edilir (format'a göre)
  → Onayla / Reddet butonları
  → Opsiyonel değerlendirme notu

Onaylandıysa:
  → "Kütüphaneye Ekle" butonu aktif
  → Modal: başlık, açıklama, kategori, zorluk, hedef roller, süre
  → POST /approve → ContentLibrary kaydı oluşturulur
  → İçerik kütüphane sayfasında görünür

Reddedildiyse:
  → "Tekrar Üret" veya "Sil" seçenekleri
  → Tekrar üret: aynı belge/format ile yeni generate
  → Sil: S3 dosyası + DB kaydı temizlenir
```

### 7.4 İçerik Geçmişi (Ana Sayfa)

```
/admin/ai-content-studio → Tüm üretimler grid halinde
  → Durum sekmeleri: Tümü | Üretiliyor | Tamamlanan | Başarısız | Kütüphanede
  → Arama: başlık içinde
  → Format filtresi: dropdown
  → Sıralama: En yeni, En eski, Başlık A-Z/Z-A
  → Sayfalama: 12 kart/sayfa
  → Her kart: format ikonu, başlık, durum badge, tarih, değerlendirme sonucu
  → Aktif üretimler: canlı progress bar
  → Karta tıkla → /admin/ai-content-studio/{jobId} detay sayfası
```

---

## 8. İÇERİK AKTARIM MEKANİZMASI

### 8.1 NotebookLM → Sistem Aktarım Akışı

```
1. generate API çağrılır → Python servisi NotebookLM'de artifact üretimi başlatır
2. Next.js API task_id'yi DB'ye kaydeder (status: queued)
3. Global poller 2-10s aralıkla /status/{jobId} poll eder
4. Backend /status, Python servisini çağırır → NotebookLM'den durum alır
5. NotebookLM tamamlandığında → Python servisi dosyayı indirir
6. İndirilen dosya S3'e yüklenir → DB güncellenir (status: completed, outputS3Key)
7. Quiz/Flashcard/MindMap gibi JSON çıktılar → contentData alanına parse edilir
8. Frontend artık /result/{jobId} ile S3'den dosyayı stream edebilir
```

### 8.2 Format Bazlı Aktarım Detayları

| Format | NotebookLM Çıktısı | S3'e Yüklenen | contentData |
|--------|-------------------|---------------|-------------|
| Audio | MP3 binary | `ai-studio/{orgId}/{jobId}.mp3` | — |
| Video | MP4 binary | `ai-studio/{orgId}/{jobId}.mp4` | — |
| Slayt (PDF) | PDF binary | `ai-studio/{orgId}/{jobId}.pdf` | — |
| Slayt (PPTX) | PPTX binary | `ai-studio/{orgId}/{jobId}.pptx` | — |
| Quiz | JSON | `ai-studio/{orgId}/{jobId}.json` | `{ questions: [...] }` |
| Flashcard | JSON | `ai-studio/{orgId}/{jobId}.json` | `{ cards: [...] }` |
| Rapor | Markdown | `ai-studio/{orgId}/{jobId}.md` | — |
| İnfografik | PNG | `ai-studio/{orgId}/{jobId}.png` | — |
| Veri Tablosu | CSV | `ai-studio/{orgId}/{jobId}.csv` | parse edilmiş JSON array |
| Zihin Haritası | JSON | `ai-studio/{orgId}/{jobId}.json` | `{ nodes: [...], edges: [...] }` |

---

## 9. FRONTEND TASARIM PRENSİPLERİ

### 9.1 Genel Kurallar
- **frontend-design skill** kullanılarak premium UI
- Hastane/sağlık temasına uygun renk paleti (yeşil tonları, temiz beyaz)
- BlurFade animasyonları ile sayfa geçişleri
- CSS variables ile tema desteği (light/dark)
- Responsive: mobile → tablet → desktop
- Tüm metinler Türkçe

### 9.2 Card Tasarımı
- `rounded-2xl` köşeler
- Hover'da gölge artışı + hafif yukarı kayma
- Format ikonu (emoji) + renkli badge
- Progress bar (aktif üretimler için)
- Durum göstergesi (renkli nokta + etiket)

### 9.3 Wizard Tasarımı
- Sol panel: adım göstergesi (masaüstü), dot indicators (mobil)
- Ana panel: adım içeriği
- Adımlar arası geçiş animasyonu
- İlerleme çubuğu

### 9.4 Önizleme Tasarımı
- Tam genişlik medya player (audio/video)
- Etkileşimli quiz/flashcard kartları
- Zoom kontrolü (infografik)
- Markdown render (rapor)
- Tablo görünümü (veri tablosu)

---

## 10. HATA YÖNETİMİ

### 10.1 Python Servisi Hataları
| Hata | Kullanıcı Mesajı | Aksiyon |
|------|-----------------|---------|
| `AuthError` | "Google oturumunuz sona erdi. Lütfen yeniden bağlanın." | Auth sayfasına yönlendir |
| `RateLimitError` | "Çok fazla istek. {retry_after} saniye sonra tekrar deneyin." | Otomatik retry (exponential backoff) |
| `SourceProcessingError` | "Belge işlenirken hata oluştu." | Belge silme + tekrar yükleme önerisi |
| `ArtifactNotReadyError` | — | Polling devam eder |
| `NetworkError` | "Bağlantı hatası. İnternet bağlantınızı kontrol edin." | Retry butonu |
| 15 dakika timeout | "Üretim zaman aşımına uğradı." | Status: failed, tekrar dene önerisi |

### 10.2 Frontend Hataları
- Toast ile anlık bildirim
- Detay sayfasında ayrıntılı hata mesajı
- ContentCard'da kısa hata özeti (satır 85-89)
- Retry mekanizması

---

## 11. ENV DEĞİŞKENLERİ

```env
# Python Sidecar Service
AI_CONTENT_SERVICE_URL=http://localhost:8100
AI_CONTENT_INTERNAL_KEY=supersecretinternalkey

# Google Cookie Encryption
AI_COOKIE_ENCRYPTION_KEY=32-byte-hex-key

# S3 (mevcut .env'den)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_S3_BUCKET=...
```

---

## 12. PROMPT OLUŞTURMA SIRASI

Aşağıdaki sırayla parça parça inşa edilecek:

### Prompt 1: Veritabanı Modelleri
- Prisma schema'ya 4 model ekle (AiNotebook, AiNotebookSource, AiGeneration, AiGoogleConnection)
- Mevcut modellere ilişkiler ekle
- Migration oluştur + generate

### Prompt 2: Python Sidecar Servisi
- FastAPI uygulaması oluştur
- notebooklm-py client wrapper
- Auth, generate, status, download endpoint'leri
- Dockerfile

### Prompt 3: Next.js API Route'ları — Auth & Belgeler
- /auth/* (connect, disconnect, status, verify)
- /documents (upload, S3, analiz)
- Rate limiting, güvenlik

### Prompt 4: Next.js API Route'ları — Üretim & Sonuç
- /generate (start job)
- /status/{jobId} (polling)
- /result/{jobId} (stream, range support)
- /list, /latest, /templates

### Prompt 5: Next.js API Route'ları — Değerlendirme & Kütüphane
- /evaluate/{jobId}
- /approve/{jobId} (ContentLibrary entegrasyonu)
- /discard/{jobId}
- Audit logging

### Prompt 6: Zustand Store & Global Poller
- ai-generation-store.ts (localStorage, TTL, completedNotifications)
- ai-generation-poller.tsx (progressive polling, toast, paralel)
- Sidebar badge entegrasyonu

### Prompt 7: Types, Constants, Lib Dosyaları
- types/index.ts
- constants.ts
- format-config.ts (9 format)
- prompt-templates.ts (hastane şablonları)
- ai-service-client.ts

### Prompt 8: Frontend — Hooks
- use-generation.ts
- use-evaluation.ts
- use-document-upload.ts

### Prompt 9: Frontend — Wizard Components
- document-uploader.tsx
- prompt-composer.tsx
- format-selector.tsx (9 format kartı)
- generation-progress.tsx
- connection-required-banner.tsx + google-connect-*.tsx

### Prompt 10: Frontend — Önizleme & Değerlendirme Components
- content-preview.tsx (9 format renderer)
- evaluation-panel.tsx
- save-to-library-modal.tsx
- content-card.tsx

### Prompt 11: Frontend — Sayfalar (frontend-design skill ile)
- page.tsx (ana sayfa — içerik geçmişi listesi)
- new/page.tsx (4 adımlı wizard)
- [jobId]/page.tsx (detay/önizleme sayfası)
- settings/page.tsx (Google bağlantı ayarları)

### Prompt 12: Sidebar & Layout Entegrasyonu
- sidebar-config.ts'e menü öğesi ekle
- app-sidebar.tsx'e badge ekle
- admin/layout.tsx'e poller ekle

### Prompt 13: Test & Doğrulama
- TypeScript + Lint + Build kontrolü
- Vitest unit testleri (API routes, hooks)
- Uçtan uca akış testi

---

## 13. PERFORMANS HEDEFLERİ

| Metrik | Hedef |
|--------|-------|
| Sayfa yüklenme (LCP) | < 2 saniye |
| İçerik listesi API yanıt süresi | < 500ms |
| Status poll round-trip | < 200ms |
| S3'den dosya stream başlangıcı | < 1 saniye |
| Toast bildirim gecikmesi | < 500ms (poll sonrası) |
| Wizard adım geçişi | < 100ms (animasyon dahil) |

---

## 14. GÜVENLİK KONTROL LİSTESİ

- [ ] Tüm API route'larda `getAuthUser()` + `requireRole('admin')`
- [ ] Tüm DB sorgularında `organizationId` filtresi
- [ ] Google cookie'leri AES-256-GCM ile şifrelenmiş
- [ ] Python servisi internal key ile korumalı
- [ ] S3 key'leri tahmin edilemez UUID ile
- [ ] Rate limiting aktif (Redis)
- [ ] Dosya boyutu/tipi validasyonu (20MB, belirli MIME tipleri)
- [ ] XSS koruması (Markdown render'da sanitize)
- [ ] CORS sadece uygulama domain'i
- [ ] Audit log tüm kritik operasyonlarda

---

## 15. GELECEK GELİŞTİRMELER (v2.1+)

- [ ] Toplu içerik üretimi (batch mode)
- [ ] İçerik şablonları (kaydet ve tekrar kullan)
- [ ] İçerik versiyonlama (aynı belge farklı formatlar)
- [ ] İçerik paylaşımı (organizasyonlar arası)
- [ ] AI asistan (chat bazlı içerik düzenleme)
- [ ] İçerik analytics (görüntülenme, indirme, değerlendirme istatistikleri)
- [ ] Otomatik çeviri (çoklu dil desteği)
- [ ] İçerik takvimi (zamanlanmış üretim)
