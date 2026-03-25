# Hospital LMS - Kapsamli Hata Raporu

> **Tarih:** 25 Mart 2026
> **Kapsam:** Tum proje dosyalari (API, Frontend, Auth, Guvenlik, Performans)
> **Toplam Tespit:** ~30 hata

---

## OZET TABLO

| Kategori | Sayi | Oncelik |
|----------|------|---------|
| Kritik Guvenlik | 7 | ACIL |
| Veri Butunlugu | 5 | YUKSEK |
| Frontend Hatalari | 10 | ORTA |
| Erisilebilirlik (A11Y) | 3 | ORTA |
| Performans / Mimari | 4 | DUSUK |

---

## 1. KRITIK GUVENLIK HATALARI

### 1.1 `.env` Dosyasinda Gercek Kimlik Bilgileri

**Dosya:** `.env`
**Seviye:** KRITIK

`.env` dosyasinda aktif Supabase URL, service role key ve veritabani sifresi acik olarak bulunuyor. Bu dosya baskasinin eline gecerse tum verilere tam erisim saglanabilir.

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  ← Bu key ile tum RLS devre disi
DATABASE_URL=postgresql://postgres:SIFRE@db...  ← Gercek DB sifresi
```

**Cozum:** Supabase Dashboard'dan tum key'leri rotate et. DB sifresini degistir. `.env` dosyasini asla git'e commit etme.

---

### 1.2 Middleware Auth Bypass

**Dosya:** `src/lib/supabase/middleware.ts` (satir 72-74)
**Seviye:** KRITIK

Supabase sunucusu erisilemez oldugunda, middleware catch blogu tum `/api/` route'larini kimlik dogrulamasi olmadan gecirir.

```typescript
// HATALI KOD:
catch (e) {
  // Supabase unreachable - allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return response  // /api/ public route oldugu icin TUMU gecer!
  }
}
```

**Sorun:** `/api/` public route listesinde oldugu icin Supabase down oldugunda tum API'ler korumasiz kalir.

**Cozum:** Catch blogunda `/api/` route'larini public olarak kabul etme. Sadece `/login` ve `/auth/callback` gibi gercekten public olan route'lari gecir.

---

### 1.3 Soru Silme IDOR (Insecure Direct Object Reference)

**Dosya:** `src/app/api/admin/trainings/[id]/questions/[questionId]/route.ts`
**Seviye:** KRITIK

Soru silinirken, sorunun admin'in kendi hastanesine ait olup olmadigini kontrol eden organizasyon filtresi eksik. Bir admin, baska bir hastanenin egitim sorusunu silebilir.

**Cozum:** Soru silinmeden once `training.organizationId === user.organizationId` kontrolu ekle.

---

### 1.4 Kullanici Olusturma Rollback Eksik

**Dosya:** `src/app/api/super-admin/users/route.ts` (satir 20-49)
**Seviye:** YUKSEK

Supabase Auth'da kullanici basariyla olusturulur ama Prisma DB'ye yazma basarisiz olursa, Supabase tarafinda orphan (yetim) kullanici kalir. Admin route'unda (`/admin/staff/route.ts`) rollback mevcut ama super-admin route'unda yok.

```typescript
// 1. Supabase'de user olusturulur - BASARILI
const { data: authUser } = await supabase.auth.admin.createUser(...)

// 2. DB'ye yazilir - BASARISIZ olursa Supabase user silinmez!
await prisma.user.create(...)
```

**Cozum:** DB insert basarisiz olursa `supabase.auth.admin.deleteUser(authUser.user.id)` ile rollback yap.

---

### 1.5 CRON_SECRET Undefined Riski

**Dosya:** `src/app/api/cron/cleanup/route.ts`
**Seviye:** YUKSEK

`CRON_SECRET` ortam degiskeni tanimsizsa, karsilastirma `Bearer undefined` olur. Saldirgan `Authorization: Bearer undefined` header'i ile endpoint'e erisip veri silebilir.

```typescript
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  // CRON_SECRET undefined ise: "Bearer undefined" ile eslesir!
}
```

**Cozum:** `if (!process.env.CRON_SECRET || authHeader !== ...)` kontrolu ekle.

---

### 1.6 Rate Limiting Kullanilmiyor

**Dosya:** `src/lib/redis.ts` + tum API route'lari
**Seviye:** YUKSEK

`checkRateLimit()` fonksiyonu `redis.ts`'de tanimli ama hicbir API endpoint'inde cagrilmiyor. Login endpoint'inde brute-force korumasiz.

**Cozum:** En azindan `/api/auth/login`, `/api/exam/*/submit` ve `/api/admin/staff` (POST) endpoint'lerine rate limiting ekle.

---

### 1.7 CORS Politikasi Tanimsiz

**Dosya:** `next.config.ts`
**Seviye:** ORTA-YUKSEK

API'lere herhangi bir origin'den istek gonderilebilir. CORS header'lari tanimli degil.

**Cozum:** `next.config.ts` veya middleware'de CORS politikasi tanimla, sadece kendi domain'ine izin ver.

---

## 2. VERI BUTUNLUGU HATALARI

### 2.1 Sinav Cevap Validasyonu Eksik

**Dosya:** `src/app/api/exam/[id]/submit/route.ts` (satir 40)
**Seviye:** YUKSEK

Gecersiz `questionId` gonderilirse sessizce filtreleniyor. Ogrenci tum sorulari cevaplamadan sinav submit edebilir.

```typescript
// HATALI: Gecersiz questionId sessizce atlanir
if (!question) return null  // Bu satir sorunlu
```

**Cozum:** Tum sorularin cevaplandigini ve gonderilen questionId'lerin gercek oldugunu dogrula.

---

### 2.2 Video Sayisi 0 Olan Egitim Bug'i

**Dosya:** `src/app/api/exam/[id]/videos/progress/route.ts` (satir 58)
**Seviye:** ORTA

Bir egitime hic video eklenmemisse, `completedVideos.length >= allVideos.length` kontrolu (0 >= 0) her zaman true doner ve sinav video izleme asamasini atlayarak otomatik tamamlanir.

**Cozum:** `allVideos.length === 0` kontrolu ekle, video yoksa hata dondur.

---

### 2.3 Pagination Parametreleri Dogrulanmiyor

**Dosyalar:**
- `src/app/api/super-admin/hospitals/route.ts` (satir 13-14)
- `src/app/api/admin/trainings/route.ts` (satir 13-14)
- `src/app/api/admin/staff/route.ts` (satir 14-15)
- `src/app/api/admin/notifications/route.ts` (satir 13-14)

**Seviye:** ORTA

`page` ve `limit` parametreleri dogrulanmiyor. `page=999999` veya `limit=100000` gondererek performans sorunu yaratilabilir.

**Cozum:** `limit = Math.min(Math.max(Number(limit) || 20, 1), 100)` gibi sinirlar ekle.

---

### 2.4 Search Parametresine Max Uzunluk Yok

**Dosya:** `src/app/api/admin/trainings/route.ts`
**Seviye:** DUSUK

Arama parametresine uzunluk siniri yok. Cok uzun string gondererek veritabani sorgusunu yavaslatma riski var.

**Cozum:** `search = search?.slice(0, 200)` gibi max uzunluk siniri ekle.

---

### 2.5 IP Adresi Spoofing

**Dosya:** `src/lib/api-helpers.ts` (satir 59)
**Seviye:** DUSUK

Audit log'lara yazilan IP adresi `x-forwarded-for` header'indan aliniyor. Bu header client tarafindan sahte deger gonderilebilir.

**Cozum:** Vercel'de deployment yapiliyorsa Vercel'in dogrulanmis IP header'ini kullan.

---

## 3. FRONTEND HATALARI

### 3.1 Hardcoded Hastane Adi

**Dosya:** `src/app/admin/dashboard/page.tsx` (satir 70)
**Seviye:** YUKSEK

Dashboard'da "Devakent Hastanesi" sabit olarak yazilmis. Multi-tenant bir sistemde her hastane kendi adini gormeli.

**Cozum:** Hastane adini auth context'ten veya API'den al.

---

### 3.2 Hardcoded Login Istatistikleri

**Dosya:** `src/app/auth/login/page.tsx` (satir 142-151)
**Seviye:** ORTA

Login sayfasinda "24+", "2.4K", "98%" gibi sabit istatistikler gosteriliyor.

**Cozum:** Bu degerleri API'den cek veya tamamen kaldir.

---

### 3.3 Hardcoded Egitim Kategorileri

**Dosya:** `src/app/admin/trainings/new/page.tsx` (satir 22-30)
**Seviye:** ORTA

Egitim kategorileri emojilerle birlikte sabit liste olarak tanimli.

**Cozum:** Kategorileri veritabanindan veya konfigurasyondan al.

---

### 3.4 Native alert() Kullanimi (11+ Yer)

**Dosyalar:**
- `src/app/admin/dashboard/page.tsx:293`
- `src/app/admin/staff/page.tsx:126, 510`
- `src/app/admin/reports/page.tsx`
- `src/app/admin/trainings/page.tsx:77`
- ve diger sayfalar

**Seviye:** ORTA

Hata ve basari mesajlari icin browser'in native `alert()` fonksiyonu kullanilmis. Bu kullanici deneyimini bozar.

**Cozum:** Toast/notification sistemi ekle (sonner veya react-hot-toast).

---

### 3.5 Client-Side Form Validasyonu Eksik

**Dosya:** `src/app/admin/staff/page.tsx` (satir 93-130)
**Seviye:** ORTA

Yeni personel formunda:
- TC Kimlik No formati dogrulanmiyor (11 haneli olmali)
- Telefon formati dogrulanmiyor
- Unvan alani kontrol edilmiyor

**Cozum:** Client tarafinda da Zod sema validasyonu kullan.

---

### 3.6 Zod Client Tarafinda Kullanilmiyor

**Dosyalar:** Tum form iceren sayfalar
**Seviye:** ORTA

API tarafinda `src/lib/validations.ts`'de Zod semalari tanimli ama client tarafinda kullanilmiyor. Manuel ve tutarsiz validasyon yapiliyor.

**Cozum:** `react-hook-form` + `@hookform/resolvers/zod` ile ayni semalari client'ta da kullan.

---

### 3.7 Loading Skeleton Eksik

**Dosyalar:**
- `src/app/exam/[id]/videos/page.tsx`
- Dashboard sayfalari
- Reports sayfasi

**Seviye:** DUSUK

Veri yuklenirken sadece "Yukleniyor..." metni gosteriliyor. Skeleton UI ile daha iyi kullanici deneyimi saglanabilir.

**Cozum:** Skeleton componentleri ekle.

---

### 3.8 Tutarsiz Hata Gosterimi

**Dosyalar:** Tum sayfalar
**Seviye:** ORTA

Hata mesajlari farkli yerlerde farkli sekillerde gosteriliyor:
- Kirmizi text div
- Alert banner
- Native `alert()`
- Bazen hic gosterilmiyor

**Cozum:** Standart bir hata gosterim componenti olustur ve her yerde kullan.

---

### 3.9 Unsafe Params Cast

**Dosya:** `src/app/admin/trainings/[id]/page.tsx` (satir 48-50)
**Seviye:** DUSUK

```typescript
const id = params?.id as string  // undefined olabilir!
```

**Cozum:** `if (!id) return <NotFound />` kontrolu ekle.

---

### 3.10 Video Heartbeat Hata Yutma

**Dosya:** `src/app/exam/[id]/videos/page.tsx` (satir 73-77)
**Seviye:** ORTA

Video izleme progress kaydi icin yapilan fetch istegi hata verirse sessizce yutuluyor. Ogrencinin izleme ilerlemesi kaybolabilir.

```typescript
fetch(...).catch(() => {})  // Tum hatalar sessizce yutulur!
```

**Cozum:** Hatalari say, belirli bir sayiya ulasinca kullaniciya uyari goster ve tekrar dene.

---

## 4. ERISILEBILIRLIK (A11Y) HATALARI

### 4.1 Klavye Erisimi Yok

**Dosya:** `src/app/admin/staff/page.tsx` (satir 380-387)
**Seviye:** ORTA

Departman kartlarinda `onClick` var ama `onKeyDown` handler'i yok. `role="button"` ve `tabIndex={0}` ile klavye ile odaklanilabilir ama aktive edilemiyor.

**Cozum:** `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}` ekle.

---

### 4.2 Loading Spinner Aria-Label Eksik

**Dosya:** `src/app/admin/reports/page.tsx`
**Seviye:** DUSUK

Yukleme animasyonunda ekran okuyucu icin etiket yok.

**Cozum:** `aria-label="Yukleniyor"` ekle.

---

### 4.3 Sifre Toggle Aria-Label Eksik

**Dosya:** `src/app/auth/login/page.tsx` (satir 220)
**Seviye:** DUSUK

Sifre goster/gizle butonu icin erisilebilirlik etiketi yok.

**Cozum:** `aria-label={showPassword ? "Sifreyi gizle" : "Sifreyi goster"}` ekle.

---

## 5. PERFORMANS VE MIMARI SORUNLARI

### 5.1 N+1 Query Riski

**Dosyalar:** Bazi API route'larinda
**Seviye:** DUSUK

Bazi sorgularda iliskili veriler icin `include` yerine ayri sorgular yapilmis.

**Cozum:** Prisma `include` veya `select` ile tek sorguda cek.

---

### 5.2 Kullanilmayan Import

**Dosya:** `src/app/admin/auth-provider.tsx` (satir 9)
**Seviye:** DUSUK

`setLoading` import edilmis ama hic kullanilmiyor. Loading state yonetimi eksik.

**Cozum:** Kullanilmayan importlari temizle veya loading state'i implement et.

---

### 5.3 Optimistic Update Yok

**Dosyalar:** Tum form submit islemlerinde
**Seviye:** DUSUK

Her form gonderimi sunucu cevabini bekliyor. Kullanici yavas performans hissediyor.

**Cozum:** Kritik islemler icin optimistic update pattern'i ekle.

---

### 5.4 Coklu useState Anti-Pattern

**Dosya:** `src/app/admin/staff/page.tsx` (satir 234-239)
**Seviye:** DUSUK

Birbiriyle iliskili 6 ayri `useState` cagrisi var. Tek bir compound state objesi olmali.

**Cozum:** Iliskili state'leri tek objede birles veya useReducer kullan.

---

## DUZELTME ONCELIK SIRASI

1. **ACIL** - Guvenlik hatalari (1.1 - 1.7)
2. **YUKSEK** - Veri butunlugu (2.1 - 2.5) + Hardcoded degerler (3.1)
3. **ORTA** - Frontend hatalari (3.2 - 3.10) + A11Y (4.1 - 4.3)
4. **DUSUK** - Performans (5.1 - 5.4)

---

> **Not:** Bu rapor salt inceleme amaclidir. Hicbir dosyada degisiklik yapilmamistir.
