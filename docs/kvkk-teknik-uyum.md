# KVKK Teknik Uyum Raporu

**Sistem:** Hastane Personel Egitim ve Sinav Yonetim Sistemi (Hospital LMS)
**Versiyon:** 1.0
**Tarih:** 09 Nisan 2026
**Hazirlayan:** DEVA Yazilim — Teknik Ekip
**Gizlilik Seviyesi:** Kurumsal — Hukuk Departmani Icin

---

## Icindekiler

1. [Genel Bakis](#1-genel-bakis)
2. [Saklanan Kisisel Veriler](#2-saklanan-kisisel-veriler)
3. [Teknik Guvenlik Onlemleri](#3-teknik-guvenlik-onlemleri)
4. [Veri Sahibi Haklari (KVKK Madde 11)](#4-veri-sahibi-haklari-kvkk-madde-11)
5. [Veri Ihlali Proseduru (KVKK Madde 12)](#5-veri-ihlali-proseduru-kvkk-madde-12)
6. [Veri Aktarimi ve Ucuncu Taraflar](#6-veri-aktarimi-ve-ucuncu-taraflar)
7. [Veri Saklama ve Imha Politikasi](#7-veri-saklama-ve-imha-politikasi)
8. [Teknik Mimari Ozeti](#8-teknik-mimari-ozeti)

---

## 1. Genel Bakis

### 1.1 Sistem Tanimi

Hospital LMS, hastane personelinin mesleki egitim ve sinav sureclerini dijital ortamda yonetmek amaciyla gelistirilmis cok kiracili (multi-tenant) bir SaaS platformudur. Sistem; egitim icerigi yonetimi, video tabanli egitim, sinav ve degerlendirme, sertifika yonetimi, yetkinlik degerlendirmesi, akreditasyon takibi ve SMG (Surekli Mesleki Gelisim) modullerini icermektedir.

Her hastane (organizasyon) birbirinden tamamen izole edilmis veri alanlarina sahiptir. Bir hastaneye ait veriler, baska bir hastane tarafindan hicbir kosulda erisime acilamaz.

### 1.2 Hukuki Cerceve

Bu dokuman, 6698 sayili Kisisel Verilerin Korunmasi Kanunu (KVKK) kapsaminda alinan teknik ve idari tedbirleri detaylandirmaktadir. Ozellikle:

- **KVKK Madde 12** — Veri guvenligine iliskin teknik ve idari tedbirler
- **KVKK Madde 11** — Ilgili kisinin haklari
- **KVKK Madde 7** — Kisisel verilerin silinmesi, yok edilmesi veya anonim hale getirilmesi
- **KVKK Madde 8** — Kisisel verilerin aktarilmasi
- **KVKK Madde 12/5** — Veri ihlali bildirim yukumlulugu

### 1.3 Veri Sorumlusu

Hospital LMS platformunu kullanan her hastane, kendi personel verilerinin **veri sorumlusu** konumundadir. Platform saglayici (DEVA Yazilim), **veri isleyen** sifatiyla hareket etmektedir.

---

## 2. Saklanan Kisisel Veriler

### 2.1 Kullanici Veri Tablosu

Asagidaki tablo, sistemde saklanan tum kisisel veri alanlarini, sifreleme durumlarini ve hukuki dayanaklarini gostermektedir.

| Veri | Alan Adi | Sifreleme | Saklama Suresi | Hukuki Dayanak |
|------|----------|-----------|----------------|----------------|
| TC Kimlik Numarasi | `tcNo` | AES-256-GCM | Is iliskisi suresince | KVKK md. 5/2-c (Sozlesmenin ifasi) |
| Ad | `firstName` | Duz metin | Is iliskisi suresince | KVKK md. 5/2-c |
| Soyad | `lastName` | Duz metin | Is iliskisi suresince | KVKK md. 5/2-c |
| E-posta adresi | `email` | Duz metin | Is iliskisi suresince | KVKK md. 5/2-c |
| Telefon numarasi | `phone` | Duz metin | Is iliskisi suresince | KVKK md. 5/2-c |
| Unvan / Gorev | `title` | Duz metin | Is iliskisi suresince | KVKK md. 5/2-c |
| Departman bilgisi | `departmentId` | Referans (UUID) | Is iliskisi suresince | KVKK md. 5/2-c |
| Profil fotografi | `avatarUrl` | URL (S3 signed) | Is iliskisi suresince | KVKK md. 5/1 (Acik riza) |
| HIS Dis Sistem ID | `hisExternalId` | Duz metin | Is iliskisi suresince | KVKK md. 5/2-c |
| KVKK Onam Durumu | `kvkkConsent` | Boolean | Surekli | KVKK md. 5/1 |
| KVKK Onam Tarihi | `kvkkConsentDate` | Tarih/saat | Surekli | KVKK md. 5/1 |
| Kullanim Sartlari Onayi | `termsAccepted` | Boolean | Surekli | KVKK md. 5/2-c |
| Hesap Aktiflik Durumu | `isActive` | Boolean | Surekli | KVKK md. 5/2-c |
| Rol (Yetki Seviyesi) | `role` | Duz metin | Is iliskisi suresince | KVKK md. 5/2-c |
| Olusturma Tarihi | `createdAt` | Tarih/saat | Surekli | KVKK md. 5/2-e (Bir hakkin kullanilmasi) |
| Son Guncelleme | `updatedAt` | Tarih/saat | Surekli | KVKK md. 5/2-e |

### 2.2 Iliskili Tablolardaki Kisisel Veriler

| Veri Kategorisi | Iliskili Tablo | Aciklama |
|-----------------|----------------|----------|
| Egitim gecmisi | `training_assignments` | Atanan egitimler ve tamamlanma durumlari |
| Sinav sonuclari | `exam_attempts`, `exam_answers` | Sinav notlari ve cevap detaylari |
| Video ilerleme | `video_progress` | Izlenen video sureleri |
| Sertifikalar | `certificates` | Kazanilan sertifika kodlari |
| Yetkinlik degerlendirmeleri | `competency_evaluations`, `competency_answers` | Yetkinlik puanlari |
| SMG aktiviteleri | `smg_activities` | Surekli mesleki gelisim kayitlari |
| Bildirimler | `notifications` | Kisiye ozel bildirim icerikleri |
| KVKK talepleri | `kvkk_requests` | Veri sahibi talep kayitlari |
| Denetim izleri | `audit_logs` | IP adresi, User-Agent, islem kayitlari |
| Push bildirimleri | `push_subscriptions` | Tarayici bildirim abonelikleri |

### 2.3 Ozel Nitelikli Kisisel Veriler

Sistemde **ozel nitelikli kisisel veri** (saglik verisi, biyometrik veri vb.) islenmemektedir. TC Kimlik Numarasi, ozel nitelikli veri kategorisinde olmamasina ragmen hassas veri olarak degerlendirilmis ve AES-256-GCM ile sifrelenmistir.

---

## 3. Teknik Guvenlik Onlemleri

### 3.1 Sifreleme

#### 3.1.1 TC Kimlik Numarasi Sifreleme (AES-256-GCM)

TC Kimlik Numarasi veritabaninda sifrelenmis olarak saklanmaktadir:

- **Algoritma:** AES-256-GCM (Advanced Encryption Standard, Galois/Counter Mode)
- **Anahtar Boyutu:** 256-bit (32 byte), Base64 kodlanmis ortam degiskeni olarak saklanir
- **IV (Initialization Vector):** 12 byte (96-bit) — her sifreleme isleminde rastgele uretilir
- **Authentication Tag:** 16 byte — veri butunlugu dogrulamasi icin
- **Saklama Formati:** `iv_hex:authTag_hex:ciphertext_hex`
- **Geriye Uyumluluk:** Eski sifrelenmemis degerler icin `safeDecryptTcNo()` fonksiyonu, `:` icermeyen degerleri legacy olarak kabul eder ve duz metin olarak dondurur

GCM modu, sifreleme ile birlikte veri butunlugu dogrulamasi (authentication) saglar. Sifrelenmis veri uzerinde herhangi bir degisiklik yapilmasi durumunda cozme islemi basarisiz olur ve hata firlatilir.

#### 3.1.2 Aktarim Sifrelemesi (TLS/HTTPS)

- **HSTS (HTTP Strict Transport Security):** `max-age=31536000; includeSubDomains; preload` — tum baglantilarin HTTPS uzerinden yapilmasini zorunlu kilar
- **TLS Versiyonu:** Minimum TLS 1.2 (hosting saglayici Vercel tarafindan zorlanir)

#### 3.1.3 Veritabani Sifrelemesi

- Supabase PostgreSQL, disk uzerinde **AES-256 sifreleme** (encryption at rest) uygular
- Veritabani baglantilari SSL/TLS ile sifrelidir (`ssl: { rejectUnauthorized: false }`)

### 3.2 Erisim Kontrolu

#### 3.2.1 Satir Duzeyi Guvenlik (Row Level Security — RLS)

Supabase PostgreSQL uzerinde **42 tablonun tamami** icin Row Level Security (RLS) aktiflestirilmistir. Toplam **99 RLS politikasi** tanimlanmistir. Bu politikalar su rollere gore veri erisimini sinirlandirir:

- **Super Admin:** Tum organizasyonlarin verilerine tam erisim
- **Admin (Hastane Yoneticisi):** Yalnizca kendi organizasyonunun verilerine erisim
- **Staff (Personel):** Yalnizca kendisine atanmis verilere erisim

RLS politikalari veritabani seviyesinde uygulanir. Uygulama katmaninda bir guvenlik acigi olsa bile, bir organizasyonun verileri baska bir organizasyon tarafindan erisilemez.

**RLS Yardimci Fonksiyonlari:**
- `get_user_role()` — Kimlik dogrulanmis kullanicinin rolunu dondurur
- `get_user_org_id()` — Kimlik dogrulanmis kullanicinin organizasyon ID'sini dondurur

#### 3.2.2 JWT Tabanli Kimlik Dogrulama

- Supabase Auth ile JWT (JSON Web Token) tabanli kimlik dogrulama
- Oturum tokenlari HTTP-only cookie olarak saklanir (XSS korumasli)
- Middleware katmaninda her istekte oturum dogrulamasi yapilir
- API katmaninda `getAuthUser()` fonksiyonu ile yerel JWT parse islemi (ek HTTP round-trip yok)

#### 3.2.3 Rol Bazli Erisim Kontrolu (RBAC)

Uc katmanli rol yapisi uygulanmaktadir:

| Rol | Erisim Alani | Ornek Islemler |
|-----|-------------|----------------|
| `super_admin` | Tum platform | Hastane olusturma, abonelik yonetimi, platform raporlari |
| `admin` | Kendi hastanesi | Personel yonetimi, egitim olusturma, raporlar |
| `staff` | Kendi verileri | Egitim izleme, sinav girme, sertifika goruntuleme |

Rol kontrolu hem middleware (sayfa erisimi) hem de API katmaninda (`requireRole()` / `assertRole()`) uygulanir.

#### 3.2.4 Cok Kiracili (Multi-Tenant) Veri Izolasyonu

- Her veritabani sorgusunda `organizationId` filtresi zorunludur
- RLS politikalari veritabani seviyesinde organizasyonlar arasi veri sizintisini onler
- Admin kullanicilar yalnizca kendi `organizationId`'lerine ait kayitlari gorebilir
- KVKK silme islemlerinde bile cross-organization kontrol mevcuttur

### 3.3 Hiz Sinirlandirma (Rate Limiting)

Brute-force saldirilarina karsi tum kritik API endpointlerinde hiz sinirlandirmasi uygulanmaktadir:

- **Birincil:** Upstash Redis ile dagitik hiz sinirlandirmasi (Pipeline + INCR + TTL)
- **Yedek:** Redis erisilemedigi durumlarda in-memory fallback mekanizmasi
- **Anahtar Sanitizasyonu:** Rate limit anahtarlarinda guvenli olmayan karakterler reddedilir (enjeksiyon onleme: `^[a-zA-Z0-9:._@-]+$`)
- **Sliding Window:** Zaman penceresi bazli istekler sinirlandirilir

### 3.4 Denetim Izi (Audit Log) — Hash Zinciri

Tum kritik islemler icin degistirilemez denetim izi olusturulmaktadir:

- **Hash Algoritmasi:** SHA-256
- **Zincir Yapisi:** Her log kaydinin hash degeri, bir onceki kaydin hash degerini icerir (blockchain benzeri zincir)
- **Hash Icerigi:** `prevHash | action | entityType | entityId | userId | createdAt`
- **Kayit Edilen Bilgiler:** Islem turu, eski veri, yeni veri, IP adresi, User-Agent, zaman damgasi
- **PII Sanitizasyonu:** Audit log verilerinde kisisel bilgiler (tcNo, phone, email, firstName, lastName, address, password) otomatik olarak `[REDACTED]` ile maskelenir
- **JCI/SKS Uyumu:** Hash zinciri, kayitlarin sonradan degistirilmedigini kanitlar

### 3.5 Guvenlik Basliklari

Tum HTTP yanitlarinda asagidaki guvenlik basliklari uygulanmaktadir:

| Baslik | Deger | Amac |
|--------|-------|------|
| `X-Frame-Options` | `DENY` | Clickjacking saldirilarina karsi koruma |
| `X-Content-Type-Options` | `nosniff` | MIME type sniffing engelleme |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer bilgisi kontrolu |
| `X-XSS-Protection` | `1; mode=block` | XSS saldiri tespit ve engelleme |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Cihaz izinlerini kisitlama |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | HTTPS zorunlulugu |
| `Content-Security-Policy` | Detayli CSP kurallari | Icerik kaynak kisitlamalari |

### 3.6 Ek Guvenlik Onlemleri

- **Gizli Bilgi Tarayicisi:** Her git commit isleminden once `scripts/secret-scanner.js` ile API anahtarlari ve tokenlar tarailir; tespit edildiginde commit engellenir
- **CORS Kisitlamasi:** API rotalarinda (`/api/*`) yalnizca `NEXT_PUBLIC_APP_URL` domaininden gelen istekler kabul edilir
- **Oturum Zamani Asimi:** Organizasyon bazinda yapilandirilabilir (varsayilan 30 dakika)
- **Input Validasyonu:** Tum API girislerinde Zod sema dogrulamasi uygulanir
- **Service Role Key Izolasyonu:** Supabase `service_role_key` yalnizca sunucu tarafinda kullanilir, istemci tarafina asla acilmaz

---

## 4. Veri Sahibi Haklari (KVKK Madde 11)

6698 sayili Kanun'un 11. maddesi kapsaminda veri sahiplerine taninan haklar ve sistemdeki teknik karsiliklari asagidadir:

### 4.1 Bilgi Alma Hakki

> *Kisisel verilerin islenip islenmedigini ogrenme hakki*

- **Teknik Karsilik:** `/staff/kvkk` sayfasi uzerinden veri isleme sorgusu (talep tipi: `access`)
- **Islem Sureci:** Personel, KVKK talep formunu doldurur; admin 30 gun icinde yanitlar
- **Kullanici Arayuzu:** 9 farkli talep tipi desteklenmektedir (veri isleme sorgusu, veri detay talebi, isleme amaci sorgusu, ucuncu kisi aktarim sorgusu, duzeltme talebi, silme/yok etme talebi, ucuncu kisi bildirim talebi, otomatik karar itiraz, zarar giderim talebi)

### 4.2 Islenen Verileri Ogrenme Hakki

> *Islenmisse buna iliskin bilgi talep etme hakki*

- **Teknik Karsilik:** `/staff/kvkk` sayfasi uzerinden veri detay talebi (talep tipi: `detail`)
- **Islem Sureci:** Admin, kullanicinin tum kisisel verilerini raporlar ve yanit notu olarak iletir

### 4.3 Isleme Amacini Ogrenme Hakki

> *Kisisel verilerin isleme amacini ve amacina uygun kullanilip kullanilmadigini ogrenme hakki*

- **Teknik Karsilik:** `/staff/kvkk` sayfasi uzerinden isleme amaci sorgusu (talep tipi: `purpose`)
- **Yanitlama:** Veri isleme amaclari bu dokumandaki Bolum 2'de detaylandirilmistir

### 4.4 Ucuncu Kisilere Aktarim Bilgisi

> *Yurt icinde veya yurt disinda aktarildigi ucuncu kisileri bilme hakki*

- **Teknik Karsilik:** `/staff/kvkk` sayfasi uzerinden ucuncu kisi aktarim sorgusu (talep tipi: `third_party`)
- **Yanitlama:** Veri aktarimi yapilan ucuncu taraflar bu dokumandaki Bolum 6'da listelenmistir

### 4.5 Duzeltme Hakki

> *Eksik veya yanlis islenen kisisel verilerin duzeltilmesini isteme hakki*

- **Teknik Karsilik:** 
  - `/staff/profile` sayfasi uzerinden profil bilgilerini dogrudan guncelleme
  - `/staff/kvkk` sayfasi uzerinden duzeltme talebi (talep tipi: `correction`)
- **Denetim:** Tum profil degisiklikleri audit log'a kaydedilir

### 4.6 Silme / Yok Etme Hakki

> *Kisisel verilerin silinmesini veya yok edilmesini isteme hakki*

- **Teknik Karsilik:** `/api/admin/kvkk/delete-user-data` API endpointi
- **Anonimlestime Sureci:**
  1. Kullanici adi `Silinmis Kullanici` olarak degistirilir
  2. E-posta `deleted_{uuid}@anonymized.local` ile degistirilir
  3. TC Kimlik Numarasi `null` yapilir
  4. Telefon numarasi `null` yapilir
  5. Profil fotografi `null` yapilir
  6. Hesap durumu `isActive: false` olarak guncellenir
  7. Iliskili audit log kayitlarindaki eski/yeni veri alanlari `{ redacted: true, reason: 'KVKK_DATA_DELETION' }` ile degistirilir
  8. Kullanicinin olusturdugu audit log kayitlarindaki IP adresi ve User-Agent bilgileri `null` yapilir
  9. Sertifika kodlari `CERT-REDACTED-{userId}` ile degistirilir
  10. Kisiye ozel bildirimler tamamen silinir
- **Yetkilendirme:** Yalnizca `admin` ve `super_admin` rolleri bu islemi gerceklestirebilir
- **Guvenlik Kontrolleri:**
  - Super admin kullanicilarin verileri bu yontemle silinemez
  - Admin yalnizca kendi organizasyonundaki kullanicilari silebilir
  - Super admin icin hedef organizasyon ID'si zorunludur (yanlis organizasyonda silmeyi onler)
- **Kayit:** Silme islemi, islem yapan kullanicinin bilgileriyle birlikte audit log'a kaydedilir (`KVKK_DATA_DELETION` aksiyonu)

### 4.7 Itiraz Hakki

> *Islenen verilerin munhasiran otomatik sistemler vasitasiyla analiz edilmesi suretiyle aleyhine bir sonucun ortaya cikmasina itiraz etme hakki*

- **Teknik Karsilik:** `/staff/kvkk` sayfasi uzerinden otomatik karar itiraz talebi (talep tipi: `objection`)

### 4.8 Zarar Giderim Hakki

> *Kanuna aykiri olarak islenmesi sebebiyle zarara ugranilmasi halinde zararin giderilmesini talep etme hakki*

- **Teknik Karsilik:** `/staff/kvkk` sayfasi uzerinden zarar giderim talebi (talep tipi: `damage`)

### 4.9 Talep Takip Sistemi

- Her talep `pending`, `in_progress`, `completed` veya `rejected` durumlarinda izlenebilir
- Personel, taleplerine verilen yanitlari sistem uzerinden goruntuleyebilir
- Tum talepler 30 gunluk yasal sure icinde degerlendirilir
- KVKK talepleri RLS ile korunur — personel yalnizca kendi taleplerini gorebilir

---

## 5. Veri Ihlali Proseduru (KVKK Madde 12)

6698 sayili Kanun'un 12. maddesinin 5. fikrasi uyarinca, kisisel verilerin ucuncu kisilerce hukuka aykiri olarak elde edilmesi halinde asagidaki prosedur uygulanir:

### 5.1 Ihlal Tespit Mekanizmalari

1. **Sentry Hata Izleme:** Uygulama hatalarinin ve olagan disi durumlarin gercek zamanli izlenmesi
2. **Audit Log Izleme:** Hash zinciri butunluk kontrolu — zincirde kirilma tespit edilmesi durumunda alarm
3. **Otomatik Uyarilar:** Basarisiz giris denemeleri ve hiz siniri asimi tespiti
4. **Sunucu Loglari:** Yapilandirilmis JSON formatta guvenlik olaylari kaydedilir

### 5.2 Ihlal Mudahale Adimlari

| Adim | Sure | Sorumluluk | Islem |
|------|------|-----------|-------|
| 1. Tespit ve Ilk Degerlendirme | 0-4 saat | Teknik Ekip | Ihlalin kapsamini, etkilenen veri turlerini ve kullanici sayisini belirleme |
| 2. Ihlali Durdurma | 0-8 saat | Teknik Ekip | Etkilenen sistemleri izole etme, erisim tokenlarini iptal etme, sifreleme anahtarlarini rotasyona alma |
| 3. Etki Analizi | 8-24 saat | Teknik Ekip + Hukuk | Hangi kisisel verilerin etkilendigini, verilerin sifrelenmis olup olmadigini, etkilenen veri sahibi sayisini tespit etme |
| 4. KVKK Kurulu Bildirimi | En gec 72 saat | Hukuk Departmani | Kisisel Verileri Koruma Kurulu'na yazili bildirimde bulunma (ihlal tarihi, etkilenen kisi sayisi, alinan onlemler) |
| 5. Ilgili Kisilere Bildirim | 72 saat icerisinde | Hukuk + Teknik | Etkilenen veri sahiplerine e-posta ve sistem ici bildirim ile bilgilendirme |
| 6. Kok Neden Analizi ve Onlem | 1-2 hafta | Teknik Ekip | Ihlalin kok nedenini analiz etme, tekrarini onleyecek teknik tedbirleri uygulama, sureci dokumante etme |

### 5.3 Bildirim Icerigi

KVKK Kurulu'na yapilacak bildirimde asagidaki bilgiler yer alir:

- Ihlalin ne zaman gerceklestigi
- Ihlalin nasil tespit edildigi
- Etkilenen kisisel veri kategorileri
- Etkilenen veri sahibi sayisi (tahmini/kesin)
- Ihlalin olasi sonuclari
- Ihlalin olumsuz etkilerini azaltmak icin alinan veya alinacak onlemler
- Iletisim bilgileri

---

## 6. Veri Aktarimi ve Ucuncu Taraflar

### 6.1 Ucuncu Taraf Hizmet Saglayicilar

| Hizmet Saglayici | Hizmet Turu | Veri Lokasyonu | Islenen Veriler | Guvenlik Onlemleri |
|------------------|-------------|----------------|-----------------|-------------------|
| **Supabase** | PostgreSQL veritabani, kimlik dogrulama, gercek zamanli bildirimler | EU bolgesi | Tum uygulama verileri | AES-256 at rest, TLS in transit, RLS |
| **AWS S3 + CloudFront** | Video ve dosya depolama, CDN | EU-Central-1 (Frankfurt) | Egitim videolari, sertifika dosyalari, profil fotograflari | Signed URL erisim, AES-256 at rest |
| **Upstash Redis** | Sinav zamanlayici, hiz sinirlandirma, onbellek | EU bolgesi | Gecici oturum verileri, onbellek | TLS sifreleme, TTL bazli otomatik silme |
| **Vercel** | Uygulama barindirma | Frankfurt (fra1) bolgesi | Uygulama kodu, statik dosyalar | HTTPS zorunlu, Edge Network |
| **SMTP Saglayici** | E-posta gonderimi | Degisken | E-posta adresleri, bildirim icerikleri | TLS sifreleme |
| **Sentry** | Hata izleme ve performans | EU bolgesi | Hata kayitlari (PII icerebilir) | Veri maskeleme |

### 6.2 Veri Aktarim Guvencesi

- Tum ucuncu taraf saglayicilari ile **veri isleyen sozlesmeleri** (Data Processing Agreement) imzalanmistir
- AB/AEA bolgesinde veri isleme tercih edilmistir — Frankfurt (Almanya) birincil bolge olarak belirlenmistir
- Veri aktarimlarinda TLS 1.2+ sifreleme zorunludur
- Ucuncu taraf erisim yetkileri minimum yetki ilkesine (principle of least privilege) gore yapilandirilmistir

### 6.3 Yurt Disi Veri Aktarimi

Secilen tum altyapi saglayicilari EU bolgelerinde yapilandirilmistir. Yurt disi veri aktarimi yapilmasi durumunda KVKK Madde 9 kapsaminda gerekli onlemler (yeterli koruma bulunan ulke karari, taahhutname, acik riza) alinir.

---

## 7. Veri Saklama ve Imha Politikasi

### 7.1 Saklama Sureleri

| Veri Kategorisi | Saklama Suresi | Imha Yontemi | Otomatik/Manuel |
|-----------------|----------------|-------------|-----------------|
| Kullanici profil bilgileri | Is iliskisi suresince | KVKK anonimlestime | Manuel (admin talep uzerine) |
| Egitim gecmisi ve sinav sonuclari | Is iliskisi suresince + 1 yil | Veritabani silme | Manuel |
| Sertifika kayitlari | Sertifika gecerlilik suresi + 1 yil | Veritabani silme | Manuel |
| Audit log kayitlari | 1 yil (365 gun) | Otomatik silme | **Otomatik** (gunluk cron) |
| Okunan bildirimler | 90 gun | Otomatik silme | **Otomatik** (gunluk cron) |
| Veritabani yedekleri | 90 gun | S3 nesne silme + veritabani kayit silme | **Otomatik** (gunluk cron) |
| Tamamlanmamis sinav girisimleri | 24 saat | Durumu `expired` olarak guncelleme | **Otomatik** (gunluk cron) |
| Redis gecici verileri | TTL bazli (dakikalar-saatler) | Otomatik expire | **Otomatik** (TTL) |

### 7.2 Otomatik Temizlik Mekanizmasi

Sistem, gunluk olarak calisan bir cron gorevi (`/api/cron/cleanup`) ile asagidaki temizlik islemlerini otomatik olarak gerceklestirir:

1. **90 gunluk okunan bildirimler** — Tamamen silinir
2. **24 saatten eski tamamlanmamis sinav girisimleri** — `expired` durumuna alinir, not `0` olarak isaretlenir
3. **1 yildan eski audit log kayitlari** — Tamamen silinir
4. **90 gunluk eski yedekler** — Oncelikle S3 uzerindeki dosyalar, ardindan veritabani kayitlari silinir

Bu cron gorevi her gun 03:00 UTC'de Vercel Cron altyapisi tarafindan otomatik olarak tetiklenir ve `CRON_SECRET` ile yetkilendirme dogrulamasi yapar.

### 7.3 KVKK Silme Talebi Sureci

Veri sahibinin silme/yok etme talebinde:

1. Talep `/staff/kvkk` sayfasindan olusturulur (talep tipi: `deletion`)
2. Admin, talebi degerlendirerek `/api/admin/kvkk/delete-user-data` endpointini calistirir
3. Kullanici verileri **30 gun icinde** anonimlestirilir (yasal sure)
4. Anonimlestime islemi tek bir veritabani transaction'i icinde atomik olarak gerceklestirilir
5. Islem, audit log'a `KVKK_DATA_DELETION` aksiyonu ile kaydedilir
6. Anonimlestirilmis kayitlar, is iliskisi suresince saklanir (istatistiksel veriler anonim olarak korunur)

### 7.4 Imha Yontemleri

| Yontem | Uygulama Alani | Detay |
|--------|----------------|-------|
| **Anonimlestime** | Kullanici profilleri | Ad, soyad, e-posta, TC No, telefon anonim degerlerle degistirilir |
| **Veritabani Silme** | Bildirimler, audit loglar, yedekler | `DELETE` komutu ile kalici silme |
| **S3 Nesne Silme** | Yedek dosyalari | `deleteObject()` fonksiyonu ile S3'ten kalici silme |
| **TTL Bazli Expire** | Redis gecici verileri | Otomatik suresi dolma mekanizmasi |
| **PII Redaction** | Audit log icerikleri | Kisisel bilgiler `[REDACTED]` ile maskelenir |

---

## 8. Teknik Mimari Ozeti

```
Kullanici (HTTPS/TLS 1.2+)
    |
    v
[Vercel Edge Network — Frankfurt]
    |-- HSTS, CSP, X-Frame-Options, XSS Protection
    |-- Middleware: JWT dogrulama, rol bazli yonlendirme
    |
    v
[Next.js 16 Uygulama Sunucusu]
    |-- API Rate Limiting (Redis + in-memory fallback)
    |-- Input Validasyonu (Zod)
    |-- RBAC (super_admin / admin / staff)
    |-- Audit Log Hash Zinciri (SHA-256)
    |
    +---> [Supabase PostgreSQL — EU]
    |         |-- 42 tablo RLS aktif
    |         |-- 99 RLS politikasi
    |         |-- AES-256 disk sifreleme
    |         |-- organizationId bazli veri izolasyonu
    |
    +---> [Upstash Redis — EU]
    |         |-- Sinav zamanlayici
    |         |-- Hiz sinirlandirma
    |         |-- API onbellek (L1: memory, L2: Redis)
    |
    +---> [AWS S3 + CloudFront — Frankfurt]
    |         |-- Video depolama (signed URL)
    |         |-- AES-256 at rest
    |
    +---> [SMTP — E-posta]
              |-- TLS sifreleme
              |-- Sertifika hatirlatmalari
              |-- KVKK bildirimleri
```

---

## Ek: Iletisim Bilgileri

KVKK kapsamindaki talepler ve sorular icin:

- **Veri Sorumlusu:** [Hastane Adi] — platform uzerinden `admin` kullanicisi araciligiyla
- **Veri Isleyen:** DEVA Yazilim
- **Teknik Destek:** destek@hastanelms.com
- **KVKK Talep Kanali:** Platform ici `/staff/kvkk` sayfasi

---

*Bu dokuman, Hospital LMS platformunun KVKK uyumlulugunun teknik boyutunu aciklamaktadir. Hukuki degerlendirme icin kurumunuzun hukuk danismanina basvurulmaldir.*

*Son guncelleme: 09 Nisan 2026*
