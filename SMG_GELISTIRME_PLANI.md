# SMG Takip Modülü — SKS Uyumlu Genişletme

> Bu dosya, mevcut SMG modülünü Türkiye Sağlık Bakanlığı SKS (Sağlıkta Kalite Standartları)
> denetimlerine tam uyumlu hale getirmek için **adım adım uygulama rehberi** ve
> **VS Code Claude prompt'larını** içerir.
>
> Her adımı sırayla uygula. Bir adım tamamlanmadan sonrakine geçme.

---

## Mevcut Sistem Durumu

### ✅ Zaten Çalışıyor

- `SmgActivity` modeli: userId, activityType (enum), title, provider, completionDate, smgPoints, certificateUrl, approvalStatus (PENDING/APPROVED/REJECTED), approvedBy, rejectionReason
- `SmgPeriod` modeli: organizationId, name, startDate, endDate, requiredPoints, isActive
- API: `/api/admin/smg/periods`, `/api/admin/smg/activities`, `/api/admin/smg/activities/[id]/approve`, `/api/admin/smg/report`
- API: `/api/staff/smg/activities`, `/api/staff/smg/my-points`
- Admin SMG sayfası: "Personel İlerlemesi" + "Bekleyen Onaylar" tabları
- Staff SMG sayfası: donut chart, aktivite listesi, aktivite ekleme modali

### ❌ Eksik (Bu Plan Kapsamında Eklenecek)

1. `smg_categories` tablosu — TTB Kredili Kongre, Kurum İçi Eğitim gibi SKS kategorileri
2. `smg_targets` tablosu — unvana göre farklı yıllık hedef puan (hekim ≠ hemşire)
3. Admin onay ekranında sertifika PDF/görsel görüntüleyici
4. SKS Denetim Raporu — denetçi geldiğinde kanıt belgesi olarak sunulacak
5. Kategori yönetimi UI (admin)
6. Hedef yönetimi UI (admin, unvana göre)

---

## Teknoloji Yığını

- **Frontend:** Next.js 14 App Router, TypeScript, shadcn/ui, Tailwind CSS
- **Backend:** Next.js API Routes (App Router)
- **ORM:** Prisma
- **Veritabanı:** PostgreSQL (Supabase)
- **Dosya Depolama:** S3 + CloudFront
- **Auth:** Supabase Auth (roller: admin, staff)
- **Validasyon:** Zod
- **UI Bileşenleri:** shadcn/ui (Dialog, Table, Button, Badge, Progress, Select, Form...)

---

## SKS Arka Plan Bilgisi

Türkiye Sağlık Bakanlığı'nın **Sağlıkta Kalite Standartları (SKS)** denetimlerinde:
- Her personelin yılda belirli puan toplaması zorunludur
- Toplanan puanların **belge kanıtı** (sertifika, katılım belgesi) olması gerekir
- Denetçiler hastanede bizzat inceler, sistem bu kanıtları dijital ortamda saklamalı
- Farklı meslek grupları için farklı puan hedefleri olabilir (hekim, hemşire, ebe vb.)

**7 Standart SKS Aktivite Kategorisi:**
| Kod | Ad |
|---|---|
| `KURUM_ICI_EGITIM` | Kurum İçi Eğitim |
| `TTB_KREDILI_KONGRE` | TTB Kredili Kongre/Sempozyum |
| `MESLEKI_DERNK_KURSU` | Mesleki Dernek Kursu |
| `UNIVERSITE_SERTIFIKA` | Üniversite Sertifika Programı |
| `ONLINE_EGITIM` | Online/Uzaktan Eğitim |
| `YAYIN_MAKALE` | Yayın/Makale |
| `SIMULASYON_EGITIMI` | Simülasyon Eğitimi |

---

---

# ADIM 1 — Veritabanı Şema Değişiklikleri

## Açıklama

Bu adımda `prisma/schema.prisma` dosyasına iki yeni model eklenecek ve
`SmgActivity` modeline `categoryId` alanı eklenecek.

**ÖNEMLİ:** `activityType` alanı silinmiyor — geçiş süreci için korunuyor.

---

## ADIM 1 İÇİN VS CODE CLAUDE PROMPT'U

```
Sen uzman bir Full-Stack Geliştirici ve Veritabanı Mimarısın.

Bu proje bir hastane LMS sistemidir. Tech stack:
- Next.js 14 App Router, TypeScript
- Prisma ORM + Supabase (PostgreSQL)
- Multi-tenant: her şeyde organizationId var
- Auth rolleri: admin, staff

## Görev: prisma/schema.prisma Güncellemesi

Mevcut dosyayı oku, sonra şu değişiklikleri yap:

### 1. Yeni Model: SmgCategory

SmgPeriod modelinin hemen altına ekle:

model SmgCategory {
  id                   String   @id @default(uuid()) @db.Uuid
  organizationId       String   @map("organization_id") @db.Uuid
  name                 String   @db.VarChar(255)
  code                 String   @db.VarChar(50)
  description          String?  @db.Text
  maxPointsPerActivity Int?     @map("max_points_per_activity")
  isActive             Boolean  @default(true) @map("is_active")
  sortOrder            Int      @default(0) @map("sort_order")
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  activities   SmgActivity[]

  @@unique([organizationId, code], map: "idx_smg_categories_org_code")
  @@index([organizationId], map: "idx_smg_categories_org")
  @@map("smg_categories")
}

### 2. Yeni Model: SmgTarget

SmgCategory modelinin hemen altına ekle:

model SmgTarget {
  id             String   @id @default(uuid()) @db.Uuid
  organizationId String   @map("organization_id") @db.Uuid
  periodId       String   @map("period_id") @db.Uuid
  unvan          String?  @db.VarChar(100)
  userId         String?  @map("user_id") @db.Uuid
  requiredPoints Int      @map("required_points")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz

  organization Organization @relation("SmgTargetOrg", fields: [organizationId], references: [id], onDelete: Cascade)
  period       SmgPeriod    @relation(fields: [periodId], references: [id], onDelete: Cascade)
  user         User?        @relation("SmgTargetOverrides", fields: [userId], references: [id], onDelete: SetNull)

  @@unique([periodId, unvan, userId], map: "idx_smg_targets_unique")
  @@index([periodId], map: "idx_smg_targets_period")
  @@index([organizationId], map: "idx_smg_targets_org")
  @@map("smg_targets")
}

### 3. SmgActivity Modeline Ekle

Mevcut SmgActivity modelinde approvalStatus alanından önce şunu ekle:
  categoryId String? @map("category_id") @db.Uuid

Ve model içindeki relations bölümüne ekle:
  category SmgCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

### 4. SmgPeriod Modeline Ekle

Mevcut SmgPeriod modelinin relations kısmına ekle:
  targets SmgTarget[]

### 5. Organization Modeline Ekle

Mevcut Organization modelinin relations kısmına ekle:
  smgCategories SmgCategory[]
  smgTargetsList SmgTarget[] @relation("SmgTargetOrg")

### 6. User Modeline Ekle

Mevcut User modelinin relations kısmına ekle:
  smgTargetOverrides SmgTarget[] @relation("SmgTargetOverrides")

Değişiklikleri yaptıktan sonra prisma validate çalıştırarak hata olmadığını kontrol et.
Sonra şunu söyle: "Schema hazır, migration SQL'i yazmaya geçelim mi?"
```

---

## ADIM 1B — Migration SQL

```
Prisma schema değişikliklerini yaptık. Şimdi migration dosyasını oluşturacağız.

prisma/migrations/ klasöründeki en yeni migration'ın adlandırma formatını bak,
sonra aynı formatta yeni bir migration dosyası oluştur:
prisma/migrations/YYYYMMDDXXXXXX_add_smg_categories_targets/migration.sql

İçeriği:

-- CreateTable smg_categories
CREATE TABLE "smg_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "max_points_per_activity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "smg_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable smg_targets
CREATE TABLE "smg_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "unvan" VARCHAR(100),
    "user_id" UUID,
    "required_points" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "smg_targets_pkey" PRIMARY KEY ("id")
);

-- AlterTable smg_activities: category_id ekle
ALTER TABLE "smg_activities" ADD COLUMN "category_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "idx_smg_categories_org_code" ON "smg_categories"("organization_id", "code");
CREATE UNIQUE INDEX "idx_smg_targets_unique" ON "smg_targets"("period_id", "unvan", "user_id");
CREATE INDEX "idx_smg_categories_org" ON "smg_categories"("organization_id");
CREATE INDEX "idx_smg_targets_period" ON "smg_targets"("period_id");
CREATE INDEX "idx_smg_targets_org" ON "smg_targets"("organization_id");
CREATE INDEX "idx_smg_activities_category" ON "smg_activities"("category_id");

-- AddForeignKey
ALTER TABLE "smg_categories" ADD CONSTRAINT "smg_categories_org_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_org_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_period_fkey"
    FOREIGN KEY ("period_id") REFERENCES "smg_periods"("id") ON DELETE CASCADE;

ALTER TABLE "smg_targets" ADD CONSTRAINT "smg_targets_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "smg_activities" ADD CONSTRAINT "smg_activities_category_fkey"
    FOREIGN KEY ("category_id") REFERENCES "smg_categories"("id") ON DELETE SET NULL;

Dosyayı oluşturduktan sonra Supabase SQL Editor'de bu SQL'i çalıştırmam gerekecek.
Ayrıca supabase-rls.sql dosyasını aç ve sonuna şu RLS policy'leri ekle:

-- SMG Categories RLS
ALTER TABLE smg_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_smg_categories_all" ON smg_categories FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "staff_smg_categories_select" ON smg_categories FOR SELECT
  USING (
    organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND is_active = true
  );

-- SMG Targets RLS
ALTER TABLE smg_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_smg_targets_all" ON smg_targets FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "staff_smg_targets_select" ON smg_targets FOR SELECT
  USING (
    organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );
```

---

---

# ADIM 2 — Veri Göçü (Seed Script)

## Açıklama

Mevcut `SmgActivity` kayıtlarında `activityType` var ama `categoryId` yok.
Bu script her organizasyon için:
1. 7 standart SKS kategorisini ekler
2. Mevcut aktivitelerin `category_id`'sini doldurur

---

## ADIM 2 İÇİN VS CODE CLAUDE PROMPT'U

```
Bu proje bir hastane LMS. Prisma + Supabase kullanıyor.

scripts/ klasörüne bir TypeScript dosyası yaz: scripts/seed-smg-categories.ts

Bu script şunları yapacak:

1. Tüm organizasyonları al (prisma.organization.findMany)

2. Her organizasyon için smg_categories tablosuna 7 standart SKS kategorisi ekle
   (zaten varsa atla — upsert mantığı):
   
   const categories = [
     { code: 'KURUM_ICI_EGITIM', name: 'Kurum İçi Eğitim', sortOrder: 1 },
     { code: 'TTB_KREDILI_KONGRE', name: 'TTB Kredili Kongre/Sempozyum', sortOrder: 2, maxPointsPerActivity: 20 },
     { code: 'MESLEKI_DERNK_KURSU', name: 'Mesleki Dernek Kursu', sortOrder: 3, maxPointsPerActivity: 15 },
     { code: 'UNIVERSITE_SERTIFIKA', name: 'Üniversite Sertifika Programı', sortOrder: 4 },
     { code: 'ONLINE_EGITIM', name: 'Online/Uzaktan Eğitim', sortOrder: 5, maxPointsPerActivity: 10 },
     { code: 'YAYIN_MAKALE', name: 'Yayın/Makale', sortOrder: 6 },
     { code: 'SIMULASYON_EGITIMI', name: 'Simülasyon Eğitimi', sortOrder: 7 },
   ]

3. Mevcut SmgActivity kayıtlarının activityType değerini category_id'ye çevir:
   
   const mapping: Record<string, string> = {
     'EXTERNAL_TRAINING': 'KURUM_ICI_EGITIM',
     'CONFERENCE': 'TTB_KREDILI_KONGRE',
     'PUBLICATION': 'YAYIN_MAKALE',
     'COURSE_COMPLETION': 'ONLINE_EGITIM',
   }
   
   Her organizasyondaki aktiviteler için:
   - activityType'a göre yukarıdaki mapping'den category code bul
   - O organizasyondaki o code'a sahip SmgCategory'nin id'sini al
   - SmgActivity.categoryId'yi güncelle (zaten set değilse)

4. Mevcut SmgPeriod kayıtları için SmgTarget varsayılanı oluştur:
   Her SmgPeriod için unvan=null, userId=null olan bir SmgTarget ekle,
   requiredPoints = period.requiredPoints olarak (zaten varsa atla)

Script sonunda her adım için kaç kayıt işlendiğini console.log ile göster.

Script'i package.json'a ekle:
"seed:smg": "tsx scripts/seed-smg-categories.ts"
```

---

---

# ADIM 3 — Paylaşılan Helper ve Validasyon Güncellemeleri

---

## ADIM 3A İÇİN VS CODE CLAUDE PROMPT'U (Helper)

```
Bu proje Next.js 14 + Prisma + Supabase LMS sistemi.

src/lib/ klasörüne yeni bir dosya oluştur: src/lib/smg-helpers.ts

Bu dosya SMG hedef puan hesaplaması için paylaşılan bir helper içerecek.

Şu fonksiyonu yaz:

/**
 * Bir personel için geçerli SMG hedef puanını hesaplar.
 * Öncelik sırası:
 * 1. Kişiye özel SmgTarget (userId eşleşen)
 * 2. Unvana özel SmgTarget (unvan eşleşen)
 * 3. Dönem varsayılanı SmgTarget (unvan=null, userId=null)
 * 4. period.requiredPoints (legacy fallback)
 */
export async function resolveRequiredPoints(params: {
  prisma: PrismaClient
  periodId: string
  organizationId: string
  userId: string
  userTitle: string | null
  periodFallback: number
}): Promise<number>

İçeride üç Promise.all ile paralel sorgu at:
- SmgTarget where userId = params.userId AND periodId = params.periodId
- SmgTarget where unvan = params.userTitle AND userId = null AND periodId = params.periodId
- SmgTarget where unvan = null AND userId = null AND periodId = params.periodId

Öncelik sırasına göre ilk bulunanı döndür, hiçbiri yoksa periodFallback döndür.

TypeScript tip güvenliğine dikkat et. Prisma import'u parametre olarak al (injection pattern),
böylece farklı Prisma client instance'larıyla çalışabilsin.
```

---

## ADIM 3B İÇİN VS CODE CLAUDE PROMPT'U (Validasyonlar)

```
src/lib/validations.ts dosyasını aç.

Dosyanın sonuna (export bölümü varsa önce) şu Zod şemalarını ekle:

// ─── SMG KATEGORİ ŞEMALARI ───────────────────────────────────────────────────

export const createSmgCategorySchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(255),
  code: z.string().min(2).max(50).regex(/^[A-Z_]+$/, 'Sadece büyük harf ve alt çizgi'),
  description: z.string().max(1000).optional(),
  maxPointsPerActivity: z.coerce.number().int().min(1).max(9999).optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
})

export const updateSmgCategorySchema = createSmgCategorySchema.partial()

// ─── SMG HEDEF ŞEMALARI ──────────────────────────────────────────────────────

export const createSmgTargetSchema = z.object({
  periodId: z.string().uuid(),
  unvan: z.string().max(100).optional(),
  userId: z.string().uuid().optional(),
  requiredPoints: z.coerce.number().int().min(1).max(9999),
}).refine(
  data => !(data.unvan && data.userId),
  { message: 'Unvan veya kullanıcı belirtilebilir, ikisi birden olamaz' }
)

export const updateSmgTargetSchema = z.object({
  requiredPoints: z.coerce.number().int().min(1).max(9999),
})

// ─── SKS DENETİM RAPORU ŞEMASI ───────────────────────────────────────────────

export const inspectionReportQuerySchema = z.object({
  periodId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  departmentId: z.string().uuid().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
})

Ayrıca mevcut createSmgActivitySchema'yı bul ve şu alanı ekle (opsiyonel, geriye uyumlu):
  categoryId: z.string().uuid().optional(),

Sonra schema'ya bir refine ekle:
  .refine(
    data => data.categoryId || data.activityType,
    { message: 'Kategori veya aktivite tipi belirtilmelidir' }
  )

Mevcut alanları değiştirme, sadece categoryId ekle ve refine'ı güncelle.
```

---

---

# ADIM 4 — Backend API Rotaları

## Açıklama

Yeni 6 rota + 3 mevcut rotanın güncellenmesi.

---

## ADIM 4A İÇİN VS CODE CLAUDE PROMPT'U (Kategori API)

```
Bu proje Next.js 14 App Router + Prisma + Supabase LMS.

Mevcut SMG API rotalarını incele: src/app/api/admin/smg/
Aynı pattern ve auth helper'ları kullanarak şu iki dosyayı oluştur:

### 1. src/app/api/admin/smg/categories/route.ts

GET handler:
- requireAdmin() ile auth kontrol
- organizationId'ye göre tüm kategorileri getir (sortOrder ASC)
- Cache-Control: private, max-age=60, stale-while-revalidate=120

POST handler:
- requireAdmin() ile auth kontrol
- createSmgCategorySchema ile validate
- organizationId + code unique kontrolü (409 döndür varsa)
- prisma.smgCategory.create
- Audit log: action='CREATE_SMG_CATEGORY'
- Cache revalidate

### 2. src/app/api/admin/smg/categories/[id]/route.ts

PATCH handler:
- requireAdmin() ile auth kontrol
- Kategori var mı ve org'a ait mi kontrol
- updateSmgCategorySchema ile validate
- prisma.smgCategory.update
- Audit log: action='UPDATE_SMG_CATEGORY'

DELETE handler:
- requireAdmin() ile auth kontrol
- Bu kategoriye bağlı SmgActivity var mı kontrol (count > 0 ise 409: "Bu kategoriye bağlı aktiviteler var")
- prisma.smgCategory.delete
- Audit log: action='DELETE_SMG_CATEGORY'

Mevcut rotalardaki auth pattern, error handling ve audit log pattern'ini birebir taklit et.
```

---

## ADIM 4B İÇİN VS CODE CLAUDE PROMPT'U (Hedef API)

```
Bu proje Next.js 14 App Router + Prisma + Supabase LMS.

Mevcut SMG API rotalarını incele: src/app/api/admin/smg/
Aynı pattern ve auth helper'ları kullanarak şu iki dosyayı oluştur:

### 1. src/app/api/admin/smg/targets/route.ts

GET handler:
- requireAdmin() ile auth kontrol
- Query param: periodId (zorunlu)
- O döneme ait tüm hedefleri getir (user bilgisiyle birlikte)
- Cache-Control: private, max-age=60

POST handler:
- requireAdmin() ile auth kontrol
- createSmgTargetSchema ile validate
- (periodId, unvan, userId) unique kontrolü
- Hedef dönem bu organizasyona ait mi kontrol
- prisma.smgTarget.create
- Audit log: action='CREATE_SMG_TARGET'

### 2. src/app/api/admin/smg/targets/[id]/route.ts

PUT handler:
- updateSmgTargetSchema ile validate
- prisma.smgTarget.update (sadece requiredPoints)
- Audit log: action='UPDATE_SMG_TARGET'

DELETE handler:
- prisma.smgTarget.delete
- Audit log: action='DELETE_SMG_TARGET'
```

---

## ADIM 4C İÇİN VS CODE CLAUDE PROMPT'U (Sertifika API)

```
Bu proje Next.js 14 App Router + Prisma + S3/CloudFront LMS.

src/lib/s3.ts dosyasını aç ve mevcut helper fonksiyonları gör (getUploadUrl, getDownloadUrl vb.).

Şu iki API dosyasını oluştur:

### 1. src/app/api/admin/smg/activities/[id]/certificate/route.ts

GET handler:
- requireAdmin() ile auth kontrol
- Aktiviteyi bul, organizasyona ait mi kontrol
- certificateUrl yoksa: { url: null, type: null } döndür
- certificateUrl varsa:
  - Eğer 'smg/' ile başlıyorsa → S3 key, getDownloadUrl(certificateUrl) çağır → presigned URL al
  - Eğer https:// ile başlıyorsa → doğrudan döndür
  - Content type belirle: .pdf → 'pdf', (.jpg/.jpeg/.png) → 'image'
- Response: { url: string, type: 'pdf' | 'image' | null }
- Cache-Control: private, max-age=30

### 2. src/app/api/admin/smg/activities/[id]/upload-url/route.ts

POST handler:
- requireAdmin() ile auth kontrol
- Body: { filename: string, contentType: string }
- contentType sadece 'application/pdf', 'image/jpeg', 'image/png' olabilir (diğerleri 400)
- S3 key oluştur: smg/{organizationId}/{activityId}/{timestamp}-{filename}
- getUploadUrl(key, contentType) ile presigned PUT URL al
- Aktivitenin certificateUrl'ini key ile güncelle (dosya yüklenmeden önce key kaydedilir)
- Response: { uploadUrl: string, key: string }
- Cache-Control: no-store

Mevcut src/lib/s3.ts'deki helper adlarını ve kullanım pattern'ini birebir taklit et.
```

---

## ADIM 4D İÇİN VS CODE CLAUDE PROMPT'U (SKS Denetim Raporu API)

```
Bu proje Next.js 14 App Router + Prisma + Supabase multi-tenant LMS.

src/app/api/admin/smg/inspection-report/route.ts dosyasını oluştur.

Bu rota SKS denetçileri için kapsamlı uyum raporu üretir.

GET handler:
1. requireAdmin() ile auth kontrol
2. inspectionReportQuerySchema ile query params validate: periodId?, startDate?, endDate?, departmentId?
3. Dönem belirle:
   - periodId varsa o dönemi al
   - Yoksa aktif dönemi al (SmgPeriod.isActive = true)
   - İkisi de yoksa startDate/endDate kullan (custom range)
4. O organizasyondaki tüm aktif personeli çek:
   - user.id, firstName, lastName, title (unvan), departmentRel.name
   - departmentId filtresi uygulanabilir
5. Tarih aralığındaki APPROVED aktiviteleri çek (category bilgisiyle)
6. Her personel için resolveRequiredPoints() çağır (src/lib/smg-helpers.ts)
7. Her personelin toplam earnedPoints hesapla (approved aktiviteler)
8. Response shape:

{
  generatedAt: string (ISO),
  period: { name, startDate, endDate } | null,
  organizationName: string,
  summary: {
    totalStaff: number,
    compliantStaff: number,
    complianceRate: number,      // yüzde
    byUnvan: Array<{ unvan, total, compliant, rate }>,
    byDepartment: Array<{ department, total, compliant, rate }>
  },
  staffDetail: Array<{
    userId, name, unvan, department,
    earnedPoints, requiredPoints, progress,  // 0-100
    isCompliant,
    activities: Array<{ title, categoryName, provider, completionDate, smgPoints, approvedAt }>
  }>
}

Cache-Control: private, max-age=60, stale-while-revalidate=120

Mevcut src/app/api/admin/smg/report/route.ts dosyasını incele, aynı auth ve Prisma pattern'ini kullan.
```

---

## ADIM 4E İÇİN VS CODE CLAUDE PROMPT'U (Mevcut Rotaları Güncelle)

```
Bu proje Next.js 14 App Router + Prisma LMS.

3 mevcut dosyayı güncelle:

### 1. src/app/api/admin/smg/report/route.ts

Mevcut dosyayı aç. requiredPoints hesaplamasını bul.
Şu anda period.requiredPoints kullanıyor.

Bunu resolveRequiredPoints() ile değiştir (src/lib/smg-helpers.ts).
Her staff satırı için:
  requiredPoints = await resolveRequiredPoints({
    prisma,
    periodId: period.id,
    organizationId,
    userId: staff.id,
    userTitle: staff.title ?? null,
    periodFallback: period.requiredPoints,
  })

StaffRow tipine unvan: string | null alanı ekle.

### 2. src/app/api/staff/smg/my-points/route.ts

Aynı şekilde: requiredPoints hesaplamasını resolveRequiredPoints() ile değiştir.
Kullanıcının kendi userId ve title'ını kullan.

### 3. src/app/api/staff/smg/activities/route.ts (POST)

Body'den categoryId alabilmeli.
Eğer categoryId varsa:
  - SmgActivity.categoryId = categoryId
  - activityType = await prisma.smgCategory.findUnique({where:{id:categoryId}}).code ?? activityType (backward compat)
Eğer sadece activityType varsa eski gibi çalışsın (categoryId null).
```

---

---

# ADIM 5 — Frontend: Admin Bileşenleri

---

## ADIM 5A İÇİN VS CODE CLAUDE PROMPT'U (Sertifika Görüntüleyici Modal)

```
Bu proje Next.js 14 + shadcn/ui + Tailwind CSS LMS.

Mevcut src/app/admin/smg/page.tsx dosyasını ve bileşen yapısını incele.
Aynı import/kullanım pattern'ini taklit ederek şu dosyayı oluştur:

src/app/admin/smg/components/certificate-viewer-modal.tsx

Props:
  interface Props {
    activityId: string
    open: boolean
    onOpenChange: (open: boolean) => void
  }

Davranış:
1. Dialog açıldığında GET /api/admin/smg/activities/{activityId}/certificate çağır
2. Loading state göster (Skeleton)
3. response.type === 'pdf' ise:
   <iframe src={response.url} className="w-full h-[65vh] border-0 rounded" title="Sertifika" />
4. response.type === 'image' ise:
   <img src={response.url} className="max-w-full max-h-[65vh] object-contain mx-auto" alt="Sertifika" />
5. url yoksa:
   <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
     <FileX className="h-12 w-12" />
     <p>Bu aktivite için sertifika yüklenmemiş</p>
   </div>
6. Modal footer'da "Dışarıda Aç" butonu: window.open(url, '_blank') — url varsa göster
7. Dialog sm:max-w-4xl olsun

shadcn/ui Dialog, Button, Skeleton kullan.
useFetch hook varsa onu kullan, yoksa useState+useEffect ile fetch yap.
```

---

## ADIM 5B İÇİN VS CODE CLAUDE PROMPT'U (Kategoriler Tab)

```
Bu proje Next.js 14 + shadcn/ui + Tailwind CSS LMS.

src/app/admin/smg/page.tsx ve mevcut tab yapısını incele.
Sonra şu bileşeni oluştur:

src/app/admin/smg/components/categories-tab.tsx

Bu bileşen admin SMG sayfasında "Kategoriler" tab'ının içeriği.

Özellikler:
1. GET /api/admin/smg/categories ile kategorileri çek
2. Tablo kolonları: Ad, Kod, Maks. Puan/Aktivite, Durum, Sıra, Aksiyonlar (Düzenle, Sil)
3. Tablo üstünde "Kategori Ekle" butonu
4. Eğer kategoriler boşsa → "Standart SKS Kategorilerini Ekle" butonu göster
   Bu butona tıklanınca 7 standart kategoriyi POST ile sırayla eklesin:
   [
     {code:'KURUM_ICI_EGITIM', name:'Kurum İçi Eğitim', sortOrder:1},
     {code:'TTB_KREDILI_KONGRE', name:'TTB Kredili Kongre/Sempozyum', sortOrder:2, maxPointsPerActivity:20},
     {code:'MESLEKI_DERNK_KURSU', name:'Mesleki Dernek Kursu', sortOrder:3, maxPointsPerActivity:15},
     {code:'UNIVERSITE_SERTIFIKA', name:'Üniversite Sertifika Programı', sortOrder:4},
     {code:'ONLINE_EGITIM', name:'Online/Uzaktan Eğitim', sortOrder:5, maxPointsPerActivity:10},
     {code:'YAYIN_MAKALE', name:'Yayın/Makale', sortOrder:6},
     {code:'SIMULASYON_EGITIMI', name:'Simülasyon Eğitimi', sortOrder:7},
   ]
5. "Kategori Ekle" ve "Düzenle" aynı modal form kullanır
   Form alanları: Ad (zorunlu), Kod (zorunlu, büyük harf+alt çizgi), Açıklama, Maks. Puan, Aktif mi
6. Silme: onay dialog → DELETE /api/admin/smg/categories/[id]
7. Durum badge: isActive → yeşil "Aktif", değilse gri "Pasif"

shadcn/ui Table, Dialog, Form, Badge, Switch, Button kullan.
Mevcut admin SMG sayfasındaki pattern'leri birebir taklit et (toast, loading state, vb.).
```

---

## ADIM 5C İÇİN VS CODE CLAUDE PROMPT'U (Hedefler Tab)

```
Bu proje Next.js 14 + shadcn/ui + Tailwind CSS LMS.

src/app/admin/smg/page.tsx ve mevcut SmgPeriod yönetimini incele.
Sonra şu bileşeni oluştur:

src/app/admin/smg/components/targets-tab.tsx

Bu bileşen admin SMG sayfasında "Hedefler" tab'ının içeriği.

Özellikler:
1. Dönem seçici dropdown (mevcut SmgPeriod listesi kullanılır — parent'dan prop olarak alabilir)
2. Seçili dönem için GET /api/admin/smg/targets?periodId=xxx çağır

3. "Unvana Göre Hedefler" bölümü:
   - Her satır bir unvan türü + requiredPoints
   - Standart unvanlar: Uzman Hekim, Pratisyen Hekim, Hemşire, Ebe, Sağlık Teknikeri, Sağlık Memuru, Fizyoterapist, Eczacı
   - "Varsayılan (Tüm Personel)" satırı en üstte
   - Puan alanı: inline düzenlenebilir input (onBlur'da save)
   - Kayıt yoksa "Hedef Ekle" butonu göster → POST
   - Kayıt varsa puan direkt düzenlenebilir → PUT

4. "Bireysel Hedef Override" bölümü:
   - Küçük bir personel arama (debounced GET /api/admin/staff?search=xxx)
   - Seçilen personel + puan → POST /api/admin/smg/targets
   - Mevcut bireysel hedefler listesi (sil butonu)

5. Loading, error ve boş state'ler

shadcn/ui Input, Button, Select, Separator kullan.
Toast ile başarı/hata bildir.
```

---

## ADIM 5D İÇİN VS CODE CLAUDE PROMPT'U (SKS Denetim Raporu Tab)

```
Bu proje Next.js 14 + shadcn/ui + Tailwind CSS LMS.

src/app/admin/smg/page.tsx ve mevcut raporlama bileşenlerini incele (varsa exportExcel, exportPDF helper'ları).
Sonra şu bileşeni oluştur:

src/app/admin/smg/components/inspection-report-tab.tsx

Bu bileşen SKS denetçisi geldiğinde kullanılacak tam uyum raporu ekranı.

Özellikler:

1. FİLTRE BARI:
   - Dönem seçici (veya özel tarih aralığı toggle)
   - Departman filtresi (opsiyonel)
   - "Raporu Güncelle" butonu

2. ÖZET KARTLAR (4 kart):
   - Toplam Personel
   - Uyumlu Personel (100% tamamladı)
   - Uyum Oranı % (büyük font, renk: <50 kırmızı, 50-99 sarı, ≥100 yeşil)
   - Bekleyen Onaylar

3. UNVANA GÖRE ÖZET TABLOSU:
   Kolonlar: Unvan, Toplam Personel, Uyumlu, Oran %
   Her satırda oran için renkli progress bar

4. DEPARTMANA GÖRE ÖZET TABLOSU:
   Aynı yapı

5. PERSONEL DETAY TABLOSU:
   Kolonlar: Ad Soyad, Unvan, Departman, Puan (kazanılan/hedef), İlerleme, Durum
   Her satır expandable → o personelin aktivite listesi (başlık, kategori, puan, tarih)
   Durum badge: 🟢 Uyumlu / 🟡 Devam Ediyor / 🔴 Yetersiz

6. EXPORT BARI:
   - "Excel İndir" butonu (mevcut exportExcel helper varsa kullan)
   - "Yazdır" butonu (window.print())
   - Butonlar sağ üstte

Renkler:
- progress < 50: text-red-600, bg-red-100
- progress 50-99: text-yellow-600, bg-yellow-100
- progress >= 100: text-green-600, bg-green-100

API çağrısı: GET /api/admin/smg/inspection-report?periodId=xxx

Denetçi için profesyonel, temiz bir tasarım olsun. Print media query için gereksiz UI elementlerini @media print gizle.

shadcn/ui Card, Table, Badge, Progress, Collapsible, Button kullan.
```

---

## ADIM 5E İÇİN VS CODE CLAUDE PROMPT'U (Admin SMG Sayfasını Güncelle)

```
Bu proje Next.js 14 + shadcn/ui + Tailwind CSS LMS.

src/app/admin/smg/page.tsx dosyasını aç.

Şu değişiklikleri yap:

1. Mevcut tabları koru ("Personel İlerlemesi", "Bekleyen Onaylar")

2. 3 yeni tab ekle:
   - "Kategoriler" → <CategoriesTab /> (src/app/admin/smg/components/categories-tab.tsx)
   - "Hedefler" → <TargetsTab periods={periods} /> (src/app/admin/smg/components/targets-tab.tsx)
   - "SKS Denetim Raporu" → <InspectionReportTab /> (src/app/admin/smg/components/inspection-report-tab.tsx)
   Tab sırası: Personel İlerlemesi | Bekleyen Onaylar | Kategoriler | Hedefler | SKS Denetim Raporu

3. "Bekleyen Onaylar" tablosuna yeni bir kolon ekle: "Sertifika"
   - Sadece certificateUrl olan satırlarda göster
   - Küçük bir "Görüntüle" butonu (FileText icon)
   - Tıklandığında <CertificateViewerModal activityId={row.id} /> açsın

4. Gerekli import'ları ekle.

Mevcut hiçbir kodu silme veya değiştirme, sadece ekle.
```

---

---

# ADIM 6 — Frontend: Staff Sayfası Güncellemesi

---

## ADIM 6 İÇİN VS CODE CLAUDE PROMPT'U

```
Bu proje Next.js 14 + shadcn/ui + Tailwind CSS LMS.

src/app/staff/smg/page.tsx dosyasını aç.

Aktivite ekleme modalini bul. İçinde "Aktivite Tipi" dropdown var, hardcoded değerlerle.

Bunu dinamik hale getir:

1. Component mount'ta GET /api/admin/smg/categories çağır
   (NOT: Bu endpoint staff'a da açık olmalı — 4A adımında oluştururken staff için de READ izni vardı)

2. Kategoriler yüklendiyse: response.data ile dropdown seçenekleri oluştur
   { value: category.id, label: category.name }

3. Kategoriler boşsa veya API hata verirse: eski hardcoded seçeneklere fallback
   { value: 'EXTERNAL_TRAINING', label: 'Dış Eğitim' }
   { value: 'CONFERENCE', label: 'Kongre/Sempozyum' }
   { value: 'PUBLICATION', label: 'Yayın' }
   { value: 'COURSE_COMPLETION', label: 'Kurs Tamamlama' }

4. Bir kategori seçildiğinde:
   - O kategorinin maxPointsPerActivity'si varsa
   - "Puan" alanının altında küçük bir hint göster:
     "Bu kategori için maksimum {maxPointsPerActivity} puan girilebilir"

5. Form gönderiminde:
   - Kategori ID seçildiyse → categoryId alanını POST body'e ekle
   - activityType da ekle (backward compat için kategori code veya eski değer)

Mevcut form yapısını, validation'ı ve toast'ları değiştirme. Sadece dropdown datasource'unu güncelle.
```

---

---

# ADIM 7 — Standalone Denetim Raporu Sayfası (Opsiyonel)

---

## ADIM 7 İÇİN VS CODE CLAUDE PROMPT'U

```
Bu proje Next.js 14 App Router LMS.

Şu dosyayı oluştur: src/app/admin/smg/inspection/page.tsx

Bu sayfa SKS denetçisi geldiğinde direkt açılacak, yer imine eklenebilecek standalone bir rapor sayfası.

İçerik:
- Breadcrumb: "SMG Takibi > SKS Denetim Raporu"
- "← Geri" linki: /admin/smg
- Büyük başlık: "SKS Denetim Raporu"
- Alt başlık: "Sağlık Bakanlığı SKS Denetimi için Personel Uyum Belgesi"
- <InspectionReportTab /> bileşenini tam genişlikte render et
  (import from '../components/inspection-report-tab')

Ayrıca src/components/layouts/sidebar/sidebar-config.ts dosyasını aç.
Admin nav'da mevcut SMG Takibi entry'sini bul:
{ title: 'SMG Takibi', href: '/admin/smg', icon: Star }

Bunu sub-item'lı bir yapıya çevir:
{
  title: 'SMG Takibi',
  href: '/admin/smg',
  icon: Star,
  items: [
    { title: 'Genel Bakış', href: '/admin/smg' },
    { title: 'SKS Denetim Raporu', href: '/admin/smg/inspection' },
  ]
}

Sidebar bu yapıyı destekliyorsa (diğer multi-item entry'leri incele) uygula.
Desteklemiyorsa sadece /inspection sayfasını oluştur, sidebar'a dokunma.
```

---

---

# Tamamlanma Kontrol Listesi

```
□ Adım 1A: prisma/schema.prisma — SmgCategory, SmgTarget eklendi, SmgActivity.categoryId eklendi
□ Adım 1B: Migration SQL oluşturuldu ve Supabase'de çalıştırıldı
□ Adım 2:  scripts/seed-smg-categories.ts çalıştırıldı
□ Adım 3A: src/lib/smg-helpers.ts oluşturuldu
□ Adım 3B: src/lib/validations.ts güncellendi
□ Adım 4A: /api/admin/smg/categories route'ları oluşturuldu
□ Adım 4B: /api/admin/smg/targets route'ları oluşturuldu
□ Adım 4C: /api/admin/smg/activities/[id]/certificate ve upload-url oluşturuldu
□ Adım 4D: /api/admin/smg/inspection-report oluşturuldu
□ Adım 4E: report, my-points, staff activities rotaları güncellendi
□ Adım 5A: certificate-viewer-modal.tsx oluşturuldu
□ Adım 5B: categories-tab.tsx oluşturuldu
□ Adım 5C: targets-tab.tsx oluşturuldu
□ Adım 5D: inspection-report-tab.tsx oluşturuldu
□ Adım 5E: admin/smg/page.tsx güncellendi (3 yeni tab + sertifika butonu)
□ Adım 6:  staff/smg/page.tsx güncellendi (dinamik kategori dropdown)
□ Adım 7:  /admin/smg/inspection page.tsx oluşturuldu (opsiyonel)
```

---

# Önemli Notlar

1. **`activityType` silme** — Bu planda hiçbir yerde `activityType` silinmiyor. 2-4 hafta her iki alan da yazılır (çift yazma). Sistem stabil olunca ayrı bir migration ile silinir.

2. **Geriye uyumluluk** — Mevcut tüm aktiviteler çalışmaya devam eder. `categoryId = null` olan aktiviteler raporlarda "Kategorisiz" olarak gösterilir.

3. **Performans** — `resolveRequiredPoints()` üç paralel query atıyor (`Promise.all`). Büyük raporlarda N+1 sorunu yaşamamak için inspection-report API'de tüm targetları tek seferde çekip bellekte resolve et.

4. **SKS Denetimi için kritik** — Denetçiler özellikle şunlara bakar:
   - Belge kanıtı var mı? (certificateUrl)
   - Kim onayladı, ne zaman? (approvedBy, approvedAt)
   - Tüm personelin hedefi var mı? (SmgTarget)
   - Kategoriler SKS standartlarına uyuyor mu? (SmgCategory.code)
