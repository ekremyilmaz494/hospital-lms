# Hospital LMS — Güvenlik Açığı Raporu (Dış Tehdit Analizi)

> **Tarih:** 25 Mart 2026 | **Kapsam:** Tüm backend API'leri, Auth katmanı, Middleware, RLS, Ortam Değişkenleri, Dosya Yükleme, S3, HTTP Güvenlik Başlıkları
> **Not:** Hiçbir dosya değiştirilmemiştir. Yalnızca inceleme yapılmıştır.
> **Metodoloji:** OWASP Top 10 2021 + Uygulama katmanı manuel kod incelemesi

---

## 🚨 ACİL UYARI — ÖNCE BUNU OKU

`.env` dosyasında **gerçek üretim kimlik bilgileri** tespit edilmiştir:

```
NEXT_PUBLIC_SUPABASE_URL=https://bzvunibntyewobkdsoow.supabase.co  ← GERÇEK URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...                           ← AKTİF JWT
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...                               ← AKTİF SERVICE ROLE
DATABASE_URL=postgresql://postgres:14521452Aa.14521452@db...         ← GERÇEK DB ŞİFRESİ
```

`SERVICE_ROLE_KEY` ile Supabase'in tüm RLS politikaları devre dışı bırakılabilir ve tüm verilere tam erişim sağlanabilir. `.gitignore`'da `.env*` bloklansa da, bu dosya herhangi bir şekilde paylaşılmışsa veya sızmışsa tüm veriler tehlikede demektir.

**Yapılması gereken:** Supabase Dashboard'dan tüm key'leri hemen döndür (rotate et) ve DB şifresini değiştir.

---

## ÖZET — CVSS BAZLI RİSK TABLOSU

| # | Açık | OWASP | Seviye | CVSS (tahmini) |
|---|---|---|---|---|
| 1 | Gerçek kimlik bilgileri `.env`'de açık | A02 Cryptographic Failures | 🔴 KRİTİK | 9.8 |
| 2 | Middleware hiç çalışmıyor (`proxy.ts`) | A01 Broken Access Control | 🔴 KRİTİK | 9.1 |
| 3 | Soru silme IDOR — org kontrolü yok | A01 Broken Access Control | 🔴 KRİTİK | 8.8 |
| 4 | Login'de brute-force koruması yok | A07 Auth Failures | 🟠 YÜKSEK | 7.5 |
| 5 | Open Redirect — `redirectTo` doğrulanmıyor | A03 Injection | 🟠 YÜKSEK | 7.4 |
| 6 | HTTP Güvenlik başlıkları yok (CSP, HSTS, X-Frame) | A05 Misconfig | 🟠 YÜKSEK | 7.2 |
| 7 | S3 presigned URL — ContentType kısıtlaması yok | A08 Software Integrity | 🟠 YÜKSEK | 7.0 |
| 8 | TC Kimlik numarası Excel'de düz metin ihracı | A02 Cryptographic Failures | 🟠 YÜKSEK | 6.8 |
| 9 | `$queryRawUnsafe` kullanımı (SQL injection riski) | A03 Injection | 🟡 ORTA | 5.9 |
| 10 | CORS politikası tanımsız | A05 Misconfig | 🟡 ORTA | 5.3 |
| 11 | Abonelik planları herkese açık (RLS bypass) | A01 Broken Access Control | 🟡 ORTA | 4.3 |
| 12 | `checkRateLimit` hiç kullanılmıyor | A07 Auth Failures | 🟡 ORTA | 4.3 |
| 13 | `super_admin` silinince orphan data | A04 Insecure Design | 🔵 DÜŞÜK | 3.1 |

---

## 1. 🔴 KRİTİK — Gerçek Kimlik Bilgileri `.env` Dosyasında

**Dosya:** `.env`

Proje kök dizinindeki `.env` dosyasında aktif, üretim ortamına ait kimlik bilgileri yer almaktadır:

- **Supabase Service Role Key:** Bu key Supabase'in tüm Row Level Security politikalarını atlar. Bu key'e sahip biri veritabanındaki tüm organizasyonların tüm verilerini (kullanıcı bilgileri, TC numaraları, sınav sonuçları, abonelik detayları) okuyabilir, yazabilir ve silebilir.
- **PostgreSQL bağlantı şifresi:** `14521452Aa.14521452` ile Supabase PostgreSQL'e doğrudan bağlantı sağlanabilir. Bu, tüm tabloları DROP etme, veri exfiltration yapma yetkisi verir.
- **Supabase Anon Key:** Bu key kamuya açık olabilir ancak kötüye kullanım vektörü oluşturur.

**Saldırı senaryosu:** `.env` dosyası herhangi bir paylaşımlı depolama alanında (Slack, e-posta, GitHub private repo bile olsa yanlış erişim ayarlarıyla) varsa saldırgan tüm sistemi ele geçirebilir.

---

## 2. 🔴 KRİTİK — Middleware Hiç Çalışmıyor (`proxy.ts`)

**Dosya:** `src/proxy.ts`

Next.js framework'ü middleware'i yalnızca `src/middleware.ts` veya proje kökünde `middleware.ts` dosyasından yükler. Projede bu dosya **`src/proxy.ts`** olarak adlandırılmış ve içindeki fonksiyonun adı da `middleware` değil `proxy`.

```ts
// src/proxy.ts — Next.js BU DOSYAYI ASLA ÇALIŞTIRMAZ
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}
```

Bu iki hata nedeniyle (`proxy.ts` adı + `proxy` fonksiyon adı) kimlik doğrulama ve rol tabanlı yönlendirme katmanı **tamamen devre dışıdır.**

**Dışardan bir saldırganın yapabilecekleri:**

- `/admin/dashboard`, `/super-admin/dashboard`, `/staff/dashboard` sayfalarına **oturum açmadan** erişebilir
- Panel sayfalarını ve UI yapısını keşfedebilir
- Rol bazlı sayfa kısıtlamaları uygulanmıyor (`staff` rolüyle `/admin/*` URL'lerini ziyaret edebilir)

**Önemli Not:** API route'ları (`/api/*`) hâlâ `getAuthUser()` ile korunmaktadır. Sayfa içeriği gerçek veri göstermeyebilir (frontend mock veri kullandığından) ama bu kritik bir yapısal güvenlik açığıdır.

---

## 3. 🔴 KRİTİK — Soru Silme IDOR (Insecure Direct Object Reference)

**Dosya:** `src/app/api/admin/trainings/[id]/questions/[questionId]/route.ts`

```ts
export async function DELETE(request: Request, { params }) {
  const { questionId } = await params
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  // ⚠️ ORGANİZASYON KONTROLÜ YOK!
  await prisma.question.delete({ where: { id: questionId } })
  return jsonResponse({ success: true })
}
```

`PATCH` endpoint'i organizasyon kontrolü yaparken `DELETE` endpoint'i yapmıyor. Herhangi bir hastanedeki `admin` rolüne sahip kişi, başka bir hastaneye ait herhangi bir soruyu `questionId`'sini tahmin ederek veya bilerek silebilir.

**Saldırı senaryosu:** Sistemde iki hastane varsa (Hastane A ve Hastane B), Hastane A'nın admin'i Hastane B'deki eğitimlerin soru ID'lerini tahmin ederek (UUID v4 olsa da başka yollarla öğrenilebilir) `DELETE /api/admin/trainings/{herhangi_id}/questions/{hedef_soru_id}` isteği atabilir.

---

## 4. 🟠 YÜKSEK — Login'de Brute-Force / Kimlik Bilgisi Doldurma Saldırısına Karşı Koruma Yok

**Dosya:** `src/app/auth/login/page.tsx`, `src/lib/redis.ts`

`checkRateLimit` fonksiyonu Redis'te implemente edilmiş ancak **hiçbir API route'unda kullanılmıyor** — özellikle de login işlemini gerçekleştiren Supabase `signInWithPassword` çağrısında yok.

```ts
// src/lib/redis.ts — Tanımlı ama kullanılmıyor
export async function checkRateLimit(key, maxRequests, windowSeconds): Promise<boolean>
```

**Saldırı senaryosu (Credential Stuffing):** Bir saldırgan sızdırılmış kullanıcı adı/şifre listeleriyle saniyede yüzlerce giriş denemesi yapabilir. Supabase'in kendi rate limiting'i varsayılan ayarlarla çok gevşektir. IP tabanlı veya e-posta tabanlı kilitleme yok.

---

## 5. 🟠 YÜKSEK — Open Redirect: `redirectTo` Parametresi Doğrulanmıyor

**Dosya:** `src/app/auth/callback/route.ts`

```ts
const redirectTo = searchParams.get('redirectTo') ?? '/'

if (code) {
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error) {
    return NextResponse.redirect(`${origin}${redirectTo}`) // ← TEHLİKELİ
  }
}
```

`redirectTo` parametresi hiçbir doğrulamaya tabi tutulmadan `${origin}${redirectTo}` şeklinde birleştirilip yönlendirme yapılıyor.

**Saldırı senaryosu (Phishing):** Saldırgan şu URL'i oluşturur:
```
https://hastanelms.com/auth/callback?code=GERÇEK_KOD&redirectTo=//evil.com/sahte-login
```
Kullanıcı gerçek kimlik doğrulama akışını geçer, ardından `evil.com`'a yönlendirilir. Sahte bir login sayfasıyla kimlik bilgileri çalınabilir.

**Login sayfasında da benzer sorun:**
```ts
const target = redirectTo && redirectTo !== '/'
  ? redirectTo   // ← Dış domain kontrolü yok
  : ROLE_ROUTES[role]
```

---

## 6. 🟠 YÜKSEK — HTTP Güvenlik Başlıkları Tamamen Eksik

**Dosya:** `next.config.ts`

```ts
const nextConfig: NextConfig = {
  webpack: (config, { dev }) => { ... }
  // Güvenlik başlığı YOK
}
```

Hiçbir HTTP güvenlik başlığı tanımlı değil:

| Başlık | Risk |
|---|---|
| `Content-Security-Policy` yok | XSS saldırılarına karşı koruma yok. Kötü niyetli script enjeksiyonuna izin verilir. |
| `X-Frame-Options` yok | Clickjacking: site bir iframe içinde gizlice yüklenip kullanıcı tıklamaları çalınabilir. |
| `Strict-Transport-Security (HSTS)` yok | HTTPS downgrade saldırısı mümkün. |
| `X-Content-Type-Options` yok | MIME sniffing: tarayıcı yüklenen dosyanın tipini değiştirebilir. |
| `Referrer-Policy` yok | Hassas URL'ler (eğitim ID'leri, token'lar) 3. parti sitelere sızabilir. |
| `Permissions-Policy` yok | Kamera, mikrofon, konum izinleri kısıtlanmamış. |

---

## 7. 🟠 YÜKSEK — S3 Presigned URL: İçerik Türü (ContentType) Kısıtlaması Yok

**Dosya:** `src/app/api/admin/trainings/[id]/videos/route.ts`

```ts
const body = await parseBody<{
  filename: string
  contentType: string  // ← Doğrulanmıyor
  ...
}>(request)

const uploadUrl = await getUploadUrl(key, body.contentType) // ← S3'e doğrudan iletiliyor
```

`contentType` alanı istemciden gelen değerle doğrudan S3'e gönderiliyor. Herhangi bir `video/*` kontrolü yok.

**Saldırı senaryosu:** Admin rolündeki bir saldırgan:
1. `contentType: "text/html"` veya `application/javascript` ile presigned URL ister
2. Kötü niyetli HTML/JS dosyası yükler
3. CloudFront üzerinden bu dosya `text/html` content-type'ı ile servis edilir
4. Kullanıcılar bu URL'i açtığında XSS saldırısına maruz kalır

---

## 8. 🟠 YÜKSEK — TC Kimlik Numarası Excel'de Düz Metin Olarak İhraç Ediliyor

**Dosya:** `src/app/api/admin/export/route.ts`

```ts
ws.columns = [
  { header: 'TC No', key: 'tcNo', width: 15 },  // ← 11 haneli TC maskelenmemiş
  ...
]
staff.forEach(s => ws.addRow({ ...s, ... })) // tcNo düz metin
```

TC Kimlik Numarası (TCKN) Türkiye'de kişisel veri ve kimlik doğrulama amacıyla kullanılan kritik PII'dir. KVKK kapsamında işlenmesi ve ihraç edilmesi özel önlem gerektirir.

**Risk:** İndirilen Excel dosyası yanlış kişiye ulaşırsa veya e-postayla paylaşılırsa, tüm personelin TC numaraları ifşa olur. TC numarası ile kimlik hırsızlığı, banka hesabı açma ve SGK sistemine erişim yapılabilir.

---

## 9. 🟡 ORTA — `$queryRawUnsafe` Kullanımı (SQL Injection Riski Zemini)

**Dosya:** `src/app/api/super-admin/reports/route.ts`

```ts
prisma.$queryRawUnsafe<{ month: string; count: bigint }[]>(`
  SELECT to_char(created_at, 'YYYY-MM') as month, count(*)::bigint as count
  FROM organizations
  WHERE created_at > now() - interval '12 months'
  GROUP BY month
  ORDER BY month
`)
```

Şu anki sorgu kullanıcı girdisi içermediği için doğrudan SQL injection açığı yok. Ancak `$queryRawUnsafe` kullanımı tehlikeli bir pattern. İleride bir geliştirici bu sorguya bir filtre parametresi eklerse — ve `$queryRaw` (parametreli) yerine `$queryRawUnsafe` kullanmaya devam ederse — SQL injection açığı doğar.

**Örnek gelecek hata:**
```ts
// Bir geliştirici sonradan şunu yaparsa:
prisma.$queryRawUnsafe(`... AND organization_id = '${orgId}'`)
// Eğer orgId kontrolsüz kullanıcıdan geliyorsa → SQL injection
```

---

## 10. 🟡 ORTA — CORS Politikası Tanımsız

**Dosya:** `next.config.ts`

Next.js App Router'da route handler'lar için varsayılan CORS politikası `same-origin`'dir, ancak bu açıkça tanımlanmamış. Özellikle `NEXT_PUBLIC_*` ortam değişkenleri istemciye gönderilenler için ve Supabase anon key browser'da açığa çıktığında, farklı origin'lerden yapılan isteklere karşı koruma eksik.

**Risk:** Kötü niyetli bir site, oturum açmış bir kullanıcının tarayıcısı üzerinden API çağrıları yapabilir (CSRF saldırısı zemini).

---

## 11. 🟡 ORTA — Abonelik Planları Tüm Kimliği Doğrulanmış Kullanıcılara Açık (RLS)

**Dosya:** `supabase-rls.sql`

```sql
CREATE POLICY "anyone_plans_select" ON subscription_plans
  FOR SELECT USING (is_active = true);
```

`staff` dahil sistemdeki herhangi bir kimliği doğrulanmış kullanıcı tüm abonelik planlarını (fiyatlar dahil) görebilir. Bu bilgi iç/dış rakiplere iş zekâsı sağlar.

---

## 12. 🟡 ORTA — `checkRateLimit` Fonksiyonu Hiç Kullanılmıyor

Sadece login değil; video upload, sınav başlatma, bildirim gönderme, personel oluşturma gibi kritik endpoint'lerin hiçbirinde rate limiting uygulanmıyor. Saldırgan:

- Sınırsız sınav denemesi başlatma isteği gönderebilir (sunucu yükü)
- Sınırsız kullanıcı oluşturma girişiminde bulunabilir
- Bildirim endpoint'ini spam için kullanabilir

---

## 13. 🔵 DÜŞÜK — `super_admin` Rolü Oluşturulurken `organizationId` Eksik Kontrolü

**Dosya:** `src/app/api/super-admin/users/route.ts`

```ts
const parsed = createUserSchema.safeParse(body)
// Şema organizationId'ye izin veriyor
// role: 'admin' ve organizationId: null kombinasyonu geçebilir
```

`organizationId` olmayan `admin` rolünde bir kullanıcı oluşturulursa bu kullanıcı hiçbir organizasyona ait olmaz ve admin panel'e girerken `dbUser.organizationId` null döner. Tüm admin endpointlerinde `!` (non-null assertion) kullanıldığından bu runtime hatası üretir.

---

## 14. GÖZLEMLENMEYEN TEHDİT VEKTÖRLERİ (Kodda Yok, Öneri)

Aşağıdaki güvenlik mekanizmaları projede hiç implemente edilmemiş:

| Mekanizma | Risk |
|---|---|
| MFA (Çok Faktörlü Kimlik Doğrulama) | Tek şifre sızdırıldığında tam erişim |
| Şifre güç politikası | Zayıf şifre oluşturulabilir |
| Oturum sonlandırma (force logout) | Admin pasif yapılsa bile aktif session devam eder |
| Audit log için değişmezlik | Audit loglar silinebilir (1 yıl sonra cron ile) |
| İki aşamalı video erişim kontrolü (watermark/fingerprint) | Video sızdırılmasını takip etme imkânı yok |

---

## 15. OLUMLU GÜVENLİK BULGULARI ✅

Zayıf noktalara rağmen kodda iyi uygulanan güvenlik pratikleri:

- **Sınav cevapları server-side hesaplanıyor** — İstemci manipülasyonu imkânsız
- **RLS + uygulama katmanı çift güvenlik** — API ve DB katmanında iki ayrı yetkilendirme
- **Service Role Key** yalnızca kullanıcı oluşturma işleminde kullanılıyor, geri kalanlar anon key ile
- **Audit log** IP ve User-Agent kaydediyor
- **Video streaming** CloudFront imzalı URL ile 4 saatlik TTL — doğrudan S3 erişimi yok
- **Soru cevapları** personel API'sinde `isCorrect` gizleniyor (uygulama kusurlu ama niyet doğru)
- **Soft delete** — Personel silinmiyor, deaktive ediliyor
- **TCKN** unique constraint ile duplikasyon önleniyor
- **XSS riski yok** — `dangerouslySetInnerHTML` hiç kullanılmıyor
- **Prisma ORM** — Standart sorgularda parameterized query otomatik

---

## ACİL AKSIYON SIRASI

```
1. [HEMEN]  → Supabase'de tüm API key'leri rotate et + DB şifresini değiştir
2. [BUGÜN]  → src/proxy.ts → src/middleware.ts olarak yeniden adlandır, fonksiyon adını düzelt
3. [BUGÜN]  → Soru DELETE endpoint'ine organizasyon sahiplik kontrolü ekle
4. [BUGÜN]  → redirectTo parametresine domain validation ekle (yalnızca /ile başlayan path'ler)
5. [BU HAFTA] → Login'e checkRateLimit entegre et (IP + e-posta bazlı)
6. [BU HAFTA] → next.config.ts'e HTTP güvenlik başlıkları ekle (CSP, X-Frame-Options, HSTS)
7. [BU HAFTA] → S3 upload'da contentType'ı video/* ile kısıtla
8. [BU HAFTA] → TC No ihracını maskele (123****789 formatı)
9. [BU AY]  → $queryRawUnsafe'i parametreli $queryRaw ile değiştir
10. [BU AY]  → Abonelik planları RLS politikasını yalnızca admin/super_admin'e kısıtla
```

---

*Bu rapor tamamen inceleme amaçlıdır. Hiçbir dosya değiştirilmemiştir.*
*OWASP Top 10 2021 referans alınmıştır: https://owasp.org/www-project-top-ten/*
