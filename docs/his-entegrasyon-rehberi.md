# HIS (Hastane Bilgi Sistemi) Entegrasyon Rehberi

Bu rehber, Hastane LMS platformunun HBYS (Hastane Bilgi Yonetim Sistemi) entegrasyonunu teknik olarak aciklamaktadir. Hedef kitle: hastane IT yoneticileri, HBYS entegrasyon muhendisleri ve LMS sistem yoneticileridir.

---

## 1. Genel Bakis

Hastane LMS, REST API tabanli cift yonlu entegrasyon destekler:

- **HBYS → LMS (Pull):** LMS, HBYS'nin personel/departman API'sine belirli araliklarla istek atar ve verileri senkronize eder.
- **HBYS → LMS (Push/Webhook):** HBYS, personel veya departman degisikliklerinde LMS'nin webhook endpoint'ine bildirim gonderir.
- **Otomatik Cron Sync:** Vercel Cron tarafindan saatlik olarak tetiklenen zamanlanmis senkronizasyon.

### Mimari Ozet

```
+-------------------+          REST API           +-------------------+
|                   | --------------------------> |                   |
|   Hastane HBYS    |          Webhook            |   Hastane LMS     |
|   (Probel, vb.)   | --------------------------> |   (Next.js API)   |
|                   | <-------------------------- |                   |
+-------------------+     Pull Sync (Cron)        +-------------------+
```

### Desteklenen Kimlik Dogrulama Yontemleri

| Yontem       | Aciklama                                           |
|-------------|-----------------------------------------------------|
| `API_KEY`   | HTTP header ile API anahtari gonderimi               |
| `BASIC_AUTH`| HTTP Basic Authentication (kullanici adi + sifre)    |
| `OAUTH2`    | Client Credentials Grant ile token alimi             |

---

## 2. Desteklenen Entegrasyonlar

### 2.1 Personel Senkronizasyonu (HBYS → LMS)

HBYS'deki personel kayitlari LMS'ye aktarilir. Islem sirasi:

1. HBYS API'sinden personel listesi cekilir
2. Alan eslestirme (field mapping) uygulanir
3. Mevcut personel guncellenir, yeni personel olusturulur
4. Deaktif edilen personel isaretlenir
5. Islem sonucu `SyncLog` tablosuna kaydedilir

**Sync tipleri:**
- `STAFF_IMPORT` — Yalnizca personel
- `DEPARTMENT_IMPORT` — Yalnizca departmanlar
- `FULL_SYNC` — Once departmanlar, sonra personel (sirali)

**Limitler:**
- Tek bir sync isleminde en fazla **500 personel kaydi** islenir
- HTTP istekleri icin **30 saniye timeout** uygulanir

### 2.2 Departman Senkronizasyonu

HBYS'deki departman (birim) bilgileri LMS'ye aktarilir. Departman endpoint'i, ana URL'nin sonuna `/departments` eklenerek turetilir.

### 2.3 Webhook Bildirimleri (HBYS → LMS)

HBYS, personel veya departman degisikliklerinde asagidaki event'leri gondererek anlik senkronizasyon tetikler:

| Event                  | Tetiklenen Islem          |
|------------------------|---------------------------|
| `staff.created`        | Personel senkronizasyonu  |
| `staff.updated`        | Personel senkronizasyonu  |
| `staff.deactivated`    | Personel senkronizasyonu  |
| `department.created`   | Departman senkronizasyonu |
| `department.updated`   | Departman senkronizasyonu |

---

## 3. Personel Senkronizasyonu — Teknik Detay

### 3.1 Webhook Endpoint

```
POST /api/integrations/webhook/{token}
```

- `{token}`: 64 karakter hexadecimal webhook token (admin panelinden otomatik olusturulur)
- Session veya cookie gerekmez; token URL icinde kimlik dogrulama gorevi gorur

### 3.2 Ornek Istek (Webhook Push)

```bash
curl -X POST \
  https://lms.hastane.com/api/integrations/webhook/abc123...def789 \
  -H "Content-Type: application/json" \
  -d '{
    "event": "staff.created",
    "data": {
      "personelId": "P-1042",
      "ad": "Ayse",
      "soyad": "Yilmaz",
      "eposta": "ayse.yilmaz@hastane.gov.tr",
      "telefon": "05551234567",
      "birim": "Kardiyoloji",
      "unvan": "Hemsire",
      "baslangicTarihi": "2025-03-15",
      "aktif": true
    }
  }'
```

### 3.3 Basarili Yanit

```json
{
  "success": true,
  "event": "staff.created"
}
```

### 3.4 Hata Yanitlari

| HTTP Kodu | Aciklama                                         |
|-----------|--------------------------------------------------|
| 401       | Gecersiz veya eksik webhook token                |
| 403       | Organizasyon askiya alinmis veya deaktif         |
| 400       | Gecersiz istek verisi veya webhook sema hatasi   |
| 500       | Senkronizasyon sirasinda sunucu hatasi           |

### 3.5 Alan Eslestirme (Field Mapping)

HBYS'nin alan adlari LMS'nin beklentileriyle farkli olabilir. Admin panelinden ozellestirilir.

**Varsayilan eslestirme:**

| HBYS Alani         | LMS Alani      | Zorunlu |
|--------------------|----------------|---------|
| `personelId`       | `externalId`   | Evet    |
| `ad`               | `name`         | Evet    |
| `soyad`            | `surname`      | Evet    |
| `eposta`           | `email`        | Hayir   |
| `telefon`          | `phone`        | Hayir   |
| `birim`            | `department`   | Hayir   |
| `unvan`            | `title`        | Hayir   |
| `baslangicTarihi`  | `startDate`    | Hayir   |
| `aktif`            | `isActive`     | Hayir   |

> Eslestirme tanimlanmamissa, sistem `externalId`, `name`, `surname`, `ad`, `soyad`, `birim`, `unvan` gibi yaygin alan adlarini otomatik tanimaya calisir.

### 3.6 Pull Sync (Zamanlanmis)

LMS, HBYS API'sine dogrudan HTTP istegi atarak personel listesini ceker.

```
GET {baseUrl}
Authorization: {authType'a gore degisir}
Content-Type: application/json
```

HBYS'den beklenen yanit formati:

```json
{
  "data": [
    {
      "personelId": "P-1042",
      "ad": "Ayse",
      "soyad": "Yilmaz",
      "birim": "Kardiyoloji",
      "unvan": "Hemsire",
      "aktif": true
    }
  ]
}
```

veya dogrudan dizi:

```json
[
  { "personelId": "P-1042", "ad": "Ayse", ... }
]
```

---

## 4. Webhook Kurulumu

### 4.1 Admin Paneli Uzerinden Yapilandirma

1. **Admin Paneli → Ayarlar → Entegrasyonlar** sayfasina gidin
2. **HIS Yapilandirmasi** bolumunde:
   - **Entegrasyon Adi:** Tanimlayici bir isim girin (orn. "Probel HBYS")
   - **Base URL:** HBYS personel API endpoint'ini girin (orn. `https://hbys.hastane.gov.tr/api/v1/staff`)
   - **Kimlik Dogrulama Tipi:** API Key, Basic Auth veya OAuth2 secin
   - **Kimlik Bilgileri:** Secilen tipe gore gerekli alanlari doldurun
   - **Sync Araligi:** Otomatik senkronizasyon periyodu (dakika, 1-1440 arasi, varsayilan 60)
3. **Kaydet** butonuna basin
4. Sistem otomatik olarak bir **Webhook Token** olusturur (64 karakter hex)
5. Olusturulan webhook URL'sini HBYS tarafina iletin:
   ```
   https://lms.hastane.com/api/integrations/webhook/{olusturulan-token}
   ```

### 4.2 Baglanti Testi

1. Yapilandirmayi kaydettikten sonra **Baglanti Test Et** butonuna basin
2. Sistem, HBYS API'sine `?limit=1&page=1` parametreleriyle test istegi atar
3. Basarili ise ornk veri ve "Baglanti basarili" mesaji gorursunuz
4. Basarisiz ise HTTP durum kodu ve hata aciklamasi gosterilir

### 4.3 Manuel Senkronizasyon

1. **Senkronizasyonu Baslat** butonuna basin
2. Sync tipi secin: Personel, Departman veya Tam Sync
3. Islem sonucu ekranda ozetlenir (eklenen, guncellenen, hata sayilari)

### 4.4 Sync Loglari

- Entegrasyon sayfasinin alt bolumunde **Senkronizasyon Gecmisi** tablosu bulunur
- Her log kaydinda: tarih, sync tipi, durum, toplam/islenen kayit sayisi, hata sayisi gorulur
- Detay icin satira tiklanarak hata listesi incelenebilir

**API Endpoint'leri:**
- `GET /api/admin/integrations/his/logs` — Sayfalanmis log listesi
- `GET /api/admin/integrations/his/logs/{id}` — Tekil log detayi (hata listesi dahil)

---

## 5. Sik Karsilasilan HBYS Sistemleri

### 5.1 Probel

- **Entegrasyon Tipi:** REST API
- **Kimlik Dogrulama:** Genellikle API Key
- **Uyumluluk:** Dogrudan entegrasyon mumkun
- **Notlar:** Alan adlari Turkce olabilir; field mapping yapilandirmasi gerekir

### 5.2 Avicenna

- **Entegrasyon Tipi:** HL7 FHIR + REST API
- **Kimlik Dogrulama:** OAuth2 (Client Credentials)
- **Uyumluluk:** FHIR Patient/Practitioner kaynaklari kullaniliyorsa adapter katmani gerekebilir
- **Notlar:** FHIR Bundle yanitini duz listeye donusturecek bir middleware onerisi yapilabilir

### 5.3 Nucleus

- **Entegrasyon Tipi:** SOAP Web Servisleri
- **Kimlik Dogrulama:** SOAP Header ile WS-Security
- **Uyumluluk:** SOAP-to-REST donusum katmani gerekir
- **Notlar:** Araciya (middleware/proxy) SOAP → JSON donusumu yaptirip LMS'ye REST olarak iletin

### 5.4 Fonet

- **Entegrasyon Tipi:** REST API
- **Kimlik Dogrulama:** API Key veya Basic Auth
- **Uyumluluk:** Dogrudan entegrasyon mumkun
- **Notlar:** Personel endpoint yapisini Fonet teknik dokumantasyonundan dogrulayin

---

## 6. Hata Yonetimi

### 6.1 Sync Loglarini Kontrol Etme

- **Admin Paneli:** Ayarlar → Entegrasyonlar → Senkronizasyon Gecmisi
- **API:** `GET /api/admin/integrations/his/logs`
- Her log kaydinda `status` alani: `SUCCESS`, `FAILED` veya `RUNNING`

### 6.2 Yaygin Hatalar ve Cozumleri

| Hata                                          | Olasi Neden                                      | Cozum                                                   |
|-----------------------------------------------|--------------------------------------------------|----------------------------------------------------------|
| `HIS HTTP hatasi: 401 Unauthorized`           | Kimlik bilgileri gecersiz veya suresi dolmus      | Admin panelinden kimlik bilgilerini guncelleyin          |
| `HIS HTTP hatasi: 403 Forbidden`              | IP kisitlamasi veya yetki eksikligi               | HBYS tarafinda LMS sunucu IP'sini whitelist'e ekleyin    |
| `HIS HTTP hatasi: 404 Not Found`              | Base URL yanlis                                   | HBYS API endpoint URL'sini dogrulayin                    |
| `HIS HTTP hatasi: 500`                        | HBYS sunucusunda ic hata                          | HBYS teknik ekibiyle iletisime gecin                     |
| `OAuth2 token alinamadi`                      | OAuth2 kimlik bilgileri hatali                    | `tokenUrl`, `clientId`, `clientSecret` degerlerini kontrol edin |
| `externalId alani zorunlu`                    | Alan eslestirmesi eksik veya HBYS verisi bos      | Field mapping'i kontrol edin, HBYS verisinde ID alani oldugundan emin olun |
| `E-posta adresi baska bir organizasyona ait`  | Ayni e-posta farkli bir hastanede kayitli         | HBYS'de e-posta adresinin dogru oldugunu teyit edin      |
| `Supabase auth hatasi`                        | Auth servisi erisim sorunu                        | Supabase servis durumunu kontrol edin                    |
| Timeout (30 saniye)                           | HBYS yanit suresi cok uzun                        | HBYS tarafinda sorgu optimizasyonu veya sayfalama uygulayin |

### 6.3 Rollback Mekanizmasi

Yeni personel olusturulurken veritabani hatasi alinirsa, sistem otomatik olarak Supabase Auth'ta olusturulmus kullanici kaydini siler (orphan kayit onleme).

---

## 7. Guvenlik

### 7.1 Webhook Token Guvenligi

- Token, `crypto.randomBytes(32)` ile olusturulur (64 karakter hex, 256-bit entropi)
- Token, veritabaninda `hisIntegration` tablosunda saklanir
- Entegrasyon guncellendiginde mevcut token korunur (HBYS tarafinda URL degisikligi gerektirmez)
- Token, URL icinde tasindigi icin **HTTPS kullanimi zorunludur**

### 7.2 Kimlik Bilgisi Sifrelemesi

- HBYS kimlik bilgileri (API Key, sifre, client secret) AES ile sifrelenerek saklanir
- Sifreleme `src/lib/crypto.ts` modulu ile yapilir (`encrypt` / `decrypt`)
- API yanitlarinda kimlik bilgileri asla acik metin olarak donmez (`credentials: '[ENCRYPTED]'`)

### 7.3 IP Whitelist Onerisi

HBYS tarafinda LMS sunucu IP adresini whitelist'e ekleyin. Vercel kullaniminda:
- Vercel'in statik IP hizmeti (Enterprise plan) veya
- Bir proxy/gateway uzerinden sabit IP yonlendirmesi oneriyoruz

### 7.4 HTTPS Zorunlulugu

- Webhook URL'leri **yalnizca HTTPS** uzerinden calistirilmalidir
- HBYS Base URL'si de HTTPS olmalidir
- HTTP kullaniminda kimlik bilgileri acik metin olarak ag uzerinde iletilir — bu kesinlikle kabul edilemez

### 7.5 Denetim Kayitlari (Audit Log)

- Entegrasyon olusturma ve guncelleme islemleri otomatik olarak audit log'a kaydedilir
- Log icerigi: islem tipi, kullanici, tarih, degisen alanlar (kimlik bilgileri `[ENCRYPTED]` olarak maskelenir)

### 7.6 Organizasyon Izolasyonu

- Her entegrasyon bir organizasyona aittir (`organizationId` filtresi zorunlu)
- Webhook token dogrulandiginda organizasyonun aktif ve askiya alinmamis oldugu kontrol edilir
- Sync loglarina erisimde cross-tenant koruma uygulanir

### 7.7 Guvenlik Kontrol Listesi

- [ ] HBYS API endpoint'leri HTTPS kullaniyor
- [ ] Webhook URL HTTPS uzerinden tanimli
- [ ] HBYS tarafinda LMS IP whitelist'e eklenmis
- [ ] Kimlik bilgileri guvende (API Key, sifre vb.)
- [ ] Webhook token yalnizca yetkili kisilerle paylasilmis
- [ ] Sync loglari duzenlice inceleniyor
- [ ] Token rotasyonu plani mevcut (90 gun onerisi)

---

## 8. Cron Tabanli Otomatik Senkronizasyon

LMS, Vercel Cron uzerinden saatlik olarak (`0 * * * *`) calisir:

1. Tum aktif entegrasyonlar sorgulanir
2. Her entegrasyon icin `lastSyncAt + syncInterval` hesaplanir
3. Suresi gelen entegrasyonlar icin `syncStaffFromHis` tetiklenir
4. Sonuclar JSON olarak dondurulur

**Endpoint:** `GET /api/cron/his-sync`
**Kimlik Dogrulama:** `Authorization: Bearer {CRON_SECRET}` (environment variable)

> Bu endpoint disaridan erisilemez; yalnizca Vercel Cron tarafindan tetiklenir.

---

## 9. Hizli Baslangic Kontrol Listesi

1. Admin paneline giris yapin
2. Ayarlar → Entegrasyonlar sayfasina gidin
3. HBYS adi, API URL'si ve kimlik dogrulama bilgilerini girin
4. Alan eslestirmesini HBYS'nize gore yapilandirin
5. Kaydet butonuna basin
6. Baglanti testi yapin
7. Olusturulan webhook URL'sini HBYS teknik ekibine iletin
8. Manuel senkronizasyon ile ilk veri aktarimini gerceklestirin
9. Sync loglarindan sonuclari dogrulayin
10. Otomatik sync araligini ayarlayin (varsayilan: 60 dakika)
