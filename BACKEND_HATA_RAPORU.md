# Hospital LMS — Backend & Supabase Hata Raporu

> **Tarih:** 25 Mart 2026 | **İncelenen:** Tüm API route'ları (37 endpoint), auth katmanı, Supabase entegrasyonu, Prisma/DB, Redis, S3, Email
> **Düzenleme yapılmamıştır.** Bu rapor salt inceleme amaçlıdır.

---

## ÖZET PUAN KARTI

| Katman | Durum | Not |
|---|---|---|
| Supabase Auth İstemcisi | ✅ Sorunsuz | SSR doğru uygulanmış |
| Middleware / Yönlendirme | ⚠️ 1 Risk | Sessiz hata yutma |
| API Güvenlik Katmanı | ⚠️ 2 Sorun | Kritik eksikler var |
| Prisma / Veritabanı | ⚠️ 3 Sorun | Atomiklik ve veri sızıntısı |
| Redis / Sınav Zamanlayıcısı | ✅ Sorunsuz | — |
| AWS S3 / CloudFront | ⚠️ 1 Sorun | Erken kayıt riski |
| E-posta | ⚠️ 1 Sorun | Bağlantı yönetimi |
| Cron Job | ⚠️ 2 Sorun | Veri kaybı ve yanlış mantık |
| Çevre Değişkenleri | ⚠️ 2 Eksik | Eksik key, doğrulama yok |
| AuthProvider (Client) | ⚠️ 2 Sorun | Stale veri, bağımlılık |
| Genel Mimari | ⚠️ 3 Sorun | N+1, tip uyumsuzluğu, kilit yok |

---

## 1. KRİTİK HATALAR 🔴

### 1.1 `CRON_SECRET` Çevre Değişkeni Tanımsız

**Dosya:** `src/app/api/cron/cleanup/route.ts`

```ts
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Sorun:** `.env.example` ve `CLAUDE.md` dosyalarında `CRON_SECRET` ortam değişkeni tanımlı değil. Üretim ortamında bu değişken boş (`undefined`) kalırsa, `Bearer undefined` şeklinde bir karşılaştırma yapılır. Bu durumda `Authorization: Bearer undefined` başlığıyla gelen her istek cron endpoint'ine yetkisiz erişim kazanır ve 90 gün önceki bildirimler, takılı kalmış sınav denemeleri ile 1 yıl önceki audit logları silinir.

**Etki:** Kötü niyetli bir kişi bu endpoint'i tetikleyerek veri silme işlemi gerçekleştirebilir.

---

### 1.2 Supabase Kullanıcısı Oluşturulunca DB'ye Yazma Başarısız Olursa Rollback Yok

**Dosya:** `src/app/api/admin/staff/route.ts` (satır 64–93) ve `src/app/api/super-admin/users/route.ts` (satır 20–49)

```ts
// 1. Supabase Auth'da kullanıcı oluşturulur
const { data: authUser, error: authError } = await supabase.auth.admin.createUser(...)

// 2. Prisma'da kayıt oluşturulur — HATA olursa auth kullanıcısı havada kalır
const user = await prisma.user.create(...)
```

**Sorun:** Supabase Auth başarılı olduktan sonra Prisma `user.create` işlemi başarısız olursa (örn. TC No duplikasyonu, DB bağlantısı kesilmesi), kullanıcı Supabase'de oturum açabilir ancak DB'de kaydı yoktur. `getAuthUser()` fonksiyonu bu durumda 403 döner çünkü `dbUser` bulunamaz. Kullanıcı sisteme giremez, admin de silindiğini bilmez.

**Etki:** Hayalet Auth kullanıcısı oluşur; temizlenmesi için manuel müdahale gerekir.

---

### 1.3 Cron: Takılı Deneme Kapatma Mantığı Hatalı

**Dosya:** `src/app/api/cron/cleanup/route.ts` (satır 21–27)

```ts
const staleAttempts = await prisma.examAttempt.updateMany({
  where: {
    status: { in: ['pre_exam', 'watching_videos', 'post_exam'] },
    createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  },
  data: { status: 'completed' },
})
```

**Sorun:** `status` `completed` yapılırken `isPassed` alanı `false` olarak kalır, ancak ilgili `TrainingAssignment.status` güncellenmez. Yani personelin assignment'ı hâlâ `in_progress` veya `assigned` olarak durur. Personel kaldı mı, geçti mi belli olmaz. Dashboard'da tutarsız veriler görünür.

---

## 2. ÖNEMLİ HATALAR 🟠

### 2.1 AuthProvider: DB Profili Yerine `user_metadata` Kullanılıyor

**Dosya:** `src/components/providers/auth-provider.tsx`

```ts
setUser({
  id: user.id,
  firstName: user.user_metadata?.first_name ?? '',
  organizationId: user.user_metadata?.organization_id ?? null,
  isActive: true, // sabit kodlanmış, kontrol edilmiyor
  ...
})
```

**Sorun 1:** `isActive` her zaman `true` olarak set ediliyor. Admin tarafından deaktive edilen bir personel, Supabase oturumu devam ettiği sürece sisteme girmeye devam eder. (API güvenlik katmanında kontrol var ama client state doğruları yansıtmıyor, UI mantığını etkileyebilir.)

**Sorun 2:** `user_metadata` admin tarafından güncellenmez. Kullanıcının adı, departmanı veya `organizationId`'si değiştirildiğinde metadata güncellenmediğinden, oturumu kapatıp tekrar açana kadar eski bilgiler gösterilir.

---

### 2.2 Middleware: Hata Sessizce Yutularak Erişim İzni Veriliyor

**Dosya:** `src/lib/supabase/middleware.ts`

```ts
} catch {
  // Supabase unreachable — allow request to proceed
  return NextResponse.next({ request })
}
```

**Sorun:** Supabase'e bağlanılamayan her durumda (ağ hatası, servis kesintisi, yanlış env) kullanıcı kimlik doğrulaması yapılmadan geçiş hakkı tanınıyor. Bu, fail-open (güvensiz tarafta hata) davranışıdır. Güvenlik açısından fail-closed (giriş engelleme) tercih edilmeli.

---

### 2.3 Video Kaydı S3'e Yüklenmeden Önce DB'ye Yazılıyor

**Dosya:** `src/app/api/admin/trainings/[id]/videos/route.ts` (satır 49–56)

```ts
const key = videoKey(...)
const uploadUrl = await getUploadUrl(key, body.contentType)

// Video kaydı HEMEN oluşturuluyor — ama S3'e henüz yüklenmedi
const video = await prisma.trainingVideo.create({ data: { ... videoUrl, videoKey: key ... } })
```

**Sorun:** Presigned URL oluşturulduktan sonra DB kaydı yazılıyor fakat admin yükleme işlemini tamamlamayabilir (sekme kapanması, ağ hatası). Bu durumda `trainingVideo` kaydı DB'de var ancak S3'te dosya yok. Personel o videoyu izlemeye çalıştığında CloudFront imzalı URL döner fakat video oynatılamaz.

---

### 2.4 `departmentId` Güncellenince `department` Alanı Senkronize Edilmiyor

**Dosya:** `src/app/api/admin/staff/[id]/route.ts`

Prisma şemasında `User` modelinde hem `department` (string) hem `departmentId` (UUID FK) alanı var. Staff güncelleme endpoint'i `updateUserSchema` ile her ikisini de güncellemeye izin veriyor fakat birini güncellediğinde diğerini otomatik senkronize etmiyor. Veri tutarsızlığına yol açar.

---

### 2.5 Sınav Soruları Personel API'sinde Düzgün Sanitize Edilmiyor

**Dosya:** `src/app/api/staff/my-trainings/[id]/route.ts`

```ts
options: q.options.map(o => ({ ...o, isCorrect: undefined })),
```

**Sorun:** `{ ...o, isCorrect: undefined }` ifadesi JSON serileştirildiğinde `isCorrect` alanını kaldırmaz, `undefined` değeri JSON'da ya atlanır ya da bazı serializasyon kütüphanelerinde korunur. TypeScript derleme zamanında hata vermez çünkü spread sonrası `undefined` atama geçerlidir. Doğru yaklaşım destructuring ile çıkarmaktır. Bazı JSON serializer'larda `isCorrect: false` yerine alan hiç gitmeyebilir, bazılarında ise `null` gidebilir — client tarafında beklenmedik davranışlar oluşabilir.

---

### 2.6 `super-admin/users` Endpoint'inde `departmentId` Güncelleme Eksikliği

**Dosya:** `src/app/api/super-admin/users/route.ts`

Super Admin yalnızca kullanıcı oluşturabilir (POST). Kullanıcı güncelleme veya silme endpoint'i yok. Ancak şu anda bu eksiklik kodlanmış bir özellik sınırı gibi görünmektedir — ancak dokümanda belirtilmemiş.

---

## 3. ORTA SEVİYE SORUNLAR 🟡

### 3.1 N+1 Sorgu: Reports Endpoint Staff Sekmesi

**Dosya:** `src/app/api/admin/reports/route.ts` (satır 60–66)

```ts
const staff = await prisma.user.findMany({
  include: {
    assignments: { include: { examAttempts: { orderBy: { attemptNumber: 'desc' }, take: 1 } } },
  },
})
```

**Sorun:** Tüm personel Prisma ile çekilip her biri için `assignments` ve `examAttempts` verisi yükleniyor. 100 personel varsa bu çok büyük bir sorgu yükü oluşturabilir. Pagination ya da toplu istatistik sorgusu tercih edilmeli.

---

### 3.2 `checkRateLimit` Race Condition

**Dosya:** `src/lib/redis.ts`

```ts
const current = await redis.incr(`ratelimit:${key}`)
if (current === 1) {
  await redis.expire(`ratelimit:${key}`, windowSeconds)
}
```

**Sorun:** `INCR` ve `EXPIRE` ayrı işlemlerdir. Eğer `INCR` başarılı olup `EXPIRE` başarısız olursa (Redis yeniden başlatma, ağ kesintisi), anahtar hiç expire olmaz ve rate limit kalıcı hale gelir. Atomik `SET key 1 EX windowSeconds NX` veya Lua script kullanılması gerekir.

---

### 3.3 Backup Endpoint'i Dosyayı Gerçekten S3'e Yüklemiyor

**Dosya:** `src/app/api/admin/backups/route.ts`

```ts
// In production, upload to S3. For now, store reference.
const backup = await prisma.dbBackup.create({
  data: {
    fileUrl: `backups/${orgId}/${Date.now()}.json`,
    status: 'completed',
    ...
  },
})
```

**Sorun:** Yorum satırına göre "production'da S3'e upload edilmeli" yazıyor ama kod bunu yapmıyor. Sadece DB'ye `fileUrl` referansı yazılıyor, dosya hiçbir yere kaydedilmiyor. Backup `status: 'completed'` olarak görünmesine rağmen gerçekte bir yedek alınmamış oluyor. Veriler kaybolma riski taşır.

---

### 3.4 `isCorrect` Alanı Tip Uyuşmazlığı

**Dosya:** `src/app/api/exam/[id]/submit/route.ts`

`filter(Boolean)` ve `as {...}[]` cast işlemi kullanılarak `null` değerlerin filtreleneceği varsayılıyor. Ancak sorgunun başarılı olması `questionMap.get(a.questionId)` null dönebilir (eğer soru silinmişse) ve bu durumda filtreleme doğru çalışsa da `createMany` için gönderilen cevap listesi eksik kalır, hata mesajı üretilmez.

---

### 3.5 `exam/timer` GET — `watching_videos` Fazında Süre Yönetimi Eksik

**Dosya:** `src/app/api/exam/[id]/timer/route.ts`

```ts
where: { id: attemptId, userId: dbUser!.id, status: { in: ['pre_exam', 'post_exam'] } },
```

Timer otomatik kapanma kontrolü yalnızca `pre_exam` ve `post_exam` fazında yapılıyor, `watching_videos` fazı dahil edilmemiş. Video izleme fazında da zamanlayıcı çalışıyorsa ve süre dolarsa attempt güncellenmez.

---

### 3.6 PDF Export: Türkçe Karakter Desteği Yok

**Dosya:** `src/app/api/admin/export/pdf/route.ts`

`jsPDF` varsayılan Helvetica fontu Türkçe karakterleri (ş, ğ, ı, ö, ü, ç) desteklemez. Kod zaten Türkçe karaktersiz yazılmış (`Egitimler`, `Gecti`, `Kaldi` vb.) ancak eğitim başlıkları ve kullanıcı adları veritabanından Türkçe gelecektir. Bu karakterler PDF'de bozuk (**?** veya **□**) görünür.

---

## 4. DÜŞÜK SEVİYE / KODLAMA KALİTESİ 🔵

### 4.1 `setLoading` Bağımlılık Dizisinde Kullanılıyor Ama Çağrılmıyor

**Dosya:** `src/components/providers/auth-provider.tsx`

```ts
}, [setUser, setLoading, router]);
```

`setLoading` bağımlılık dizisine eklenmiş fakat `useEffect` içinde hiç çağrılmıyor. Bu gereksiz bağımlılık olup React linter uyarısı üretir ve potansiyel re-render döngülerine neden olabilir.

---

### 4.2 `nodemailer` Transporter Modül Seviyesinde Oluşturuluyor

**Dosya:** `src/lib/email.ts`

Transporter sabit bir bağlantı olarak modül yüklendiğinde oluşturuluyor. Serverless ortamda (Vercel) her çağrıda yeni instance oluşacak; bu normal. Ancak SMTP sunucusu cevap vermiyorsa modülü import eden her işlev askıda kalabilir. `verify()` çağrısı ya da bağlantı timeout'u tanımlanmalı.

---

### 4.3 `prisma.config.ts` İçin `dotenv/config` Import'u Gereksiz

**Dosya:** `prisma.config.ts`

```ts
import "dotenv/config";
```

Bu dosya Next.js runtime'ında değil, Prisma CLI tarafından çalıştırılıyor. Next.js kendi ortam değişkeni yönetimini yapıyor. Sadece migration komutlarında `.env` okunması için bu gerekli olabilir, fakat `DATABASE_URL` zaten `process.env` üzerinden erişilebilir. Karışıklığa yol açabilir.

---

### 4.4 `src/app/api/admin/export/route.ts` — `super_admin` İçin `orgId` Null Olabilir

**Dosya:** `src/app/api/admin/export/route.ts`

```ts
const orgId = dbUser!.organizationId  // Super Admin'in organizationId'si null!
```

Route'un izin listesi `['admin', 'super_admin']` olarak tanımlı. Super Admin'in `organizationId` değeri `null` olduğundan tüm sorgular `null` olan orgId ile çalışır ve boş sonuç döner. Sessizce hata vermeksizin boş Excel dosyası indirilir.

---

### 4.5 `src/app/api/admin/export/pdf/route.ts` — Aynı `orgId` Null Sorunu

**Dosya:** `src/app/api/admin/export/pdf/route.ts`

```ts
const orgId = dbUser!.organizationId!  // Non-null assertion kullanılmış ama null olabilir
```

`!` (non-null assertion) kullanılmış. Super Admin erişiminde `organizationId` null olduğundan `org` değişkeni `null` gelir, sonraki `org?.name` güvenli ama `orgId` ile yapılan Prisma sorguları `WHERE organizationId = null` çalışır — bu PostgreSQL'de `= null` (eşitlik değil `IS NULL`) anlamına gelmez.

---

## 5. EKSİK ÇEVRE DEĞİŞKENLERİ

`.env.example` dosyasında aşağıdaki değişkenler eksik:

| Değişken | Kullanıldığı Yer | Risk |
|---|---|---|
| `CRON_SECRET` | `api/cron/cleanup/route.ts` | KRİTİK — yukarıda açıklandı |
| `NEXT_PUBLIC_APP_URL` | `src/lib/email.ts` e-posta şablonları | Orta — link kırık kalabilir |

Not: `NEXT_PUBLIC_APP_URL` `.env.example`'da var ancak varsayılan değeri `http://localhost:3000`. Üretimde güncellenmezse e-postalardaki bağlantılar localhost'a yönlendirir.

---

## 6. GENEL DEĞERLENDİRME

### Çalışan ve Doğru Uygulanan Kısımlar ✅

- Supabase SSR (`@supabase/ssr`) kullanımı Next.js App Router ile uyumlu ve doğru uygulanmış. Cookie yönetimi hem middleware hem server component için ayrı handle edilmiş.
- JWT doğrulama akışı (`auth.exchangeCodeForSession`) doğru.
- `getAuthUser()` ile her endpoint'te çift doğrulama (JWT + DB aktiflik kontrolü) yapılıyor.
- Role-based access control middleware ile uygulama katmanında çift katmanlı.
- Redis sınav zamanlayıcısı sunucu taraflı — client manipülasyonu mümkün değil.
- Veri izolasyonu (her sorgu `organizationId` filtreliyor) genel olarak doğru uygulanmış.
- Audit logging tüm kritik işlemlerde mevcut ve IP + userAgent kaydediliyor.
- Supabase Realtime bildirimleri doğru yapılandırılmış.
- Sınav sonuçları hesaplama mantığı doğru (server-side puan hesabı).
- Soft delete pattern personel için doğru uygulanmış.
- Presigned URL yaklaşımı S3 yükleme için güvenli.

### Özet Risk Tablosu

| Öncelik | Sorun | İlgili Dosya |
|---|---|---|
| 🔴 KRİTİK | CRON_SECRET eksik → yetkisiz veri silme | `cron/cleanup/route.ts` |
| 🔴 KRİTİK | Auth/DB oluşturma atomik değil → hayalet kullanıcı | `admin/staff/route.ts`, `super-admin/users/route.ts` |
| 🔴 KRİTİK | Cron stale attempt kapatma TrainingAssignment güncellenmiyor | `cron/cleanup/route.ts` |
| 🟠 ÖNEMLİ | Middleware fail-open → Supabase kesintisinde tüm kullanıcılara geçiş | `middleware.ts` |
| 🟠 ÖNEMLİ | Video DB kaydı S3 upload öncesi yazılıyor → boş video | `trainings/[id]/videos/route.ts` |
| 🟠 ÖNEMLİ | Backup gerçekten S3'e yüklenmiyor → sahte yedek | `admin/backups/route.ts` |
| 🟠 ÖNEMLİ | AuthProvider isActive=true sabit kodlanmış | `auth-provider.tsx` |
| 🟡 ORTA | N+1 sorgu (reports/staff) | `admin/reports/route.ts` |
| 🟡 ORTA | Race condition rate limiting | `redis.ts` |
| 🟡 ORTA | Super Admin export orgId=null sorunsuz hata vermiyor | `export/route.ts`, `export/pdf/route.ts` |
| 🟡 ORTA | Timer watching_videos fazında auto-close yok | `exam/[id]/timer/route.ts` |
| 🔵 DÜŞÜK | isCorrect sanitize yöntemi potansiyel | `staff/my-trainings/[id]/route.ts` |
| 🔵 DÜŞÜK | PDF Türkçe karakter bozukluğu | `export/pdf/route.ts` |
| 🔵 DÜŞÜK | setLoading gereksiz bağımlılık | `auth-provider.tsx` |

---

*Bu rapor kod incelemesi sonucu üretilmiştir. Hiçbir dosya değiştirilmemiştir.*
