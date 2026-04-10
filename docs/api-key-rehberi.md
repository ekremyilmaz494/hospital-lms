# API Key ve Webhook Token Rehberi

Bu rehber, Hastane LMS platformunda HIS entegrasyonu icin kullanilan API Key ve Webhook Token mekanizmalarini aciklamaktadir.

---

## 1. API Key / Webhook Token Nedir

Hastane LMS, HBYS (Hastane Bilgi Yonetim Sistemi) ile entegrasyon icin iki farkli kimlik dogrulama mekanizmasi kullanir:

- **Webhook Token:** HBYS'nin LMS'ye bildirim gondermesi icin kullanilan 64 karakterlik hexadecimal anahtar. URL icinde tasindigi icin ayrica header gonderimi gerekmez.
- **HBYS API Kimlik Bilgileri:** LMS'nin HBYS API'sine erisimi icin kullanilan kimlik bilgileri (API Key, Basic Auth veya OAuth2). Bu bilgiler sifrelenerek veritabaninda saklanir.

Her hastane (organizasyon) kendi entegrasyon yapilandirmasini ve token'ini olusturur. Farkli hastanelerin token'lari birbirinden tamamen izoledir.

---

## 2. API Key / Token Olusturma

### 2.1 Admin Panelinden Yapilandirma

1. **Admin Paneli → Ayarlar → Entegrasyonlar** sayfasina gidin
2. **HIS Yapilandirmasi** bolumundeki formu doldurun:
   - **Entegrasyon Adi:** Tanimlayici bir isim (orn. "Probel Entegrasyonu")
   - **Base URL:** HBYS personel API endpoint'i
   - **Kimlik Dogrulama Tipi:** Asagidakilerden birini secin
3. **Kaydet** butonuna basin

### 2.2 Kimlik Dogrulama Tipleri

#### API Key
- **API Key:** HBYS tarafindan size verilen anahtar
- **Header Adi:** Anahtarin gonderilecegi HTTP header adi (varsayilan: `X-API-Key`)

#### Basic Auth
- **Kullanici Adi:** HBYS erisim kullanici adi
- **Sifre:** HBYS erisim sifresi

#### OAuth2 (Client Credentials)
- **Token URL:** OAuth2 token endpoint'i
- **Client ID:** OAuth2 istemci kimlik bilgisi
- **Client Secret:** OAuth2 istemci sifresi

### 2.3 Webhook Token Otomatik Uretimi

- Entegrasyon ilk kez kaydedildiginde **webhook token otomatik olarak olusturulur**
- Token: `crypto.randomBytes(32)` ile uretilir (256-bit, 64 hex karakter)
- Token, sonraki guncellemelerde degismez (HBYS tarafindaki URL'nin bozulmasini onler)
- Olusturulan webhook URL formati:
  ```
  https://lms.hastane.com/api/integrations/webhook/{token}
  ```

---

## 3. API Key / Token Kullanimi

### 3.1 Webhook Token ile Bildirim Gonderme (HBYS → LMS)

Webhook token, URL yolunda (`path parameter`) tasinir. Ayrica header gerekmez:

```bash
curl -X POST \
  https://lms.hastane.com/api/integrations/webhook/a1b2c3d4e5f6...64karakter \
  -H "Content-Type: application/json" \
  -d '{
    "event": "staff.created",
    "data": {
      "personelId": "P-2001",
      "ad": "Mehmet",
      "soyad": "Demir",
      "birim": "Acil Servis",
      "unvan": "Uzman Doktor",
      "aktif": true
    }
  }'
```

### 3.2 HBYS API'sine Erisim (LMS → HBYS)

LMS, HBYS API'sine otomatik olarak dogru kimlik dogrulama header'ini ekler:

**API Key ornegi:**
```
GET https://hbys.hastane.gov.tr/api/v1/staff
X-API-Key: hbys-tarafindan-verilen-anahtar
```

**Basic Auth ornegi:**
```
GET https://hbys.hastane.gov.tr/api/v1/staff
Authorization: Basic base64(kullaniciAdi:sifre)
```

**OAuth2 ornegi:**
```
GET https://hbys.hastane.gov.tr/api/v1/staff
Authorization: Bearer {otomatik-alinan-access-token}
```

> OAuth2 token'lari LMS tarafindan otomatik olarak cache'lenir ve suresi dolmadan yenilenir.

---

## 4. Guvenlik Onerileri

### 4.1 Kimlik Bilgilerini Guvende Saklayin

- API Key ve sifrelerinizi duz metin dosyalarinda, e-postalarda veya anlık mesajlasma uygulamalarinda **saklamayin**
- HBYS tarafindan alinan kimlik bilgileri LMS'de AES ile **sifrelenerek** saklanir
- API yanitlarinda kimlik bilgileri asla acik metin olarak dondurulmez

### 4.2 Duzenlı Token Rotasyonu

- Webhook token'ini **90 gunde bir** yenilemek onerilir
- Yenileme icin: mevcut entegrasyonu silip yeniden olusturun
- Yenileme sonrasi HBYS tarafindaki webhook URL'sini guncellemeyi unutmayin
- Rotasyon takvimini IT departmani olarak planlayin

### 4.3 Erisim Loglarini Kontrol Edin

- **Sync loglari:** Admin Paneli → Ayarlar → Entegrasyonlar → Senkronizasyon Gecmisi
- **Audit loglari:** Entegrasyon olusturma/guncelleme islemleri otomatik kaydedilir
- Beklenmedik senkronizasyon girisimlerini duzenlice kontrol edin
- Basarisiz denemeler guvenlik ihlali isareti olabilir

### 4.4 IP Kisitlamasi Uygulayin

- HBYS tarafinda LMS sunucu IP adresini whitelist'e ekleyin
- LMS tarafinda webhook endpoint'ine gelen isteklerin kaynak IP'sini loglayin
- Mumkunse HBYS API erisimini belirli IP araligina sinirlandirin

### 4.5 HTTPS Zorunlulugu

- Tum API iletisimi **yalnizca HTTPS** uzerinden yapilmalidir
- HTTP kullaniminda:
  - Webhook token URL icinde acik metin olarak iletilir
  - API Key ve sifre header'larda acik metin olarak tasininr
  - Bu durum man-in-the-middle saldirilarina acik bir guvenlik acigi olusturur

### 4.6 En Az Yetki Prensibi

- HBYS API Key'ine yalnizca **okuma yetkisi** verin (personel ve departman listeleme)
- Yazma, silme veya yonetim yetkileri vermekten kacinin
- OAuth2 kullaniyorsaniz scope'lari minimumda tutun

---

## 5. Sorun Giderme

| Sorun                                 | Kontrol Edilecek                                      |
|---------------------------------------|-------------------------------------------------------|
| Webhook 401 Unauthorized              | Token dogru mu? 64 hex karakter mi? Entegrasyon aktif mi? |
| Webhook 403 Forbidden                 | Organizasyon askiya alinmis veya deaktif olabilir      |
| Sync basarisiz: HTTP 401              | HBYS kimlik bilgileri dogru mu? Suresi dolmus olabilir |
| OAuth2 token alinamiyor               | tokenUrl, clientId, clientSecret degerlerini dogrulayin |
| Baglanti testi basarisiz              | Base URL erisilebilir mi? Firewall/VPN kisitlamasi var mi? |
| Alan donusumu basarisiz               | Field mapping yapilandirmasini kontrol edin            |

---

## 6. Onemli Notlar

- Webhook token, entegrasyonla birlikte otomatik olusturulur; elle uretim gerektirmez.
- Token guncelleme islemi mevcut entegrasyonun silinip yeniden olusturulmasini gerektirir.
- Tum kimlik bilgileri sunucu tarafinda sifrelenir, istemciye (tarayiciya) asla iletilmez.
- Entegrasyon ayarlari yalnizca `admin` rolundeki kullanicilar tarafindan yonetilebilir.
- Her organizasyonun tek bir HIS entegrasyonu olabilir.
