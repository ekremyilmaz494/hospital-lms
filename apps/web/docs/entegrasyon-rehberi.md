# İK/HBYS Personel Entegrasyonu — Partner Rehberi

Hastanenizin kendi İK / HBYS / bordro yazılımından KlinoVax LMS'e personel
ekleme, güncelleme ve çıkarma işlemlerini **otomatikleştirme** rehberi. Hedef
okur: hastanenin BT ekibi veya İK/HBYS yazılım sağlayıcısı.

Personel bilgilerini artık elle girmek yerine, mevcut sisteminizle KlinoVax'i
bağlayarak işe alım/ayrılışları otomatik yansıtabilirsiniz.

---

## 1. Genel bakış — 3 kanal

Aynı senkron çekirdeğini besleyen üç yöntem vardır; hastanenizin altyapısına
göre birini (veya birkaçını) seçersiniz.

| Kanal | Nasıl çalışır | Ne zaman uygun |
|---|---|---|
| **Dosya** | İK'nız gecelik CSV/Excel dışa-aktarımını API ile yükler | Kapalı/eski HBYS — API açamayan sistemler (en düşük eşik) |
| **Push API** | Sisteminiz personel değişikliğini anında bize gönderir | Gerçek zamanlı istenen, geliştirici kaynağı olan kurumlar |
| **Pull** | Biz sizin İK API'nizi periyodik sorgularız | Sorgulanabilir REST API'si olan İK/bordro sistemleri |

Üçü de aynı **kayıt formatını** (bkz. §3) ve aynı **eşleştirme/senkron
semantiğini** (bkz. §6) kullanır. Kanal seçimi yalnız "veri bize nasıl ulaşıyor"
sorusunu değiştirir.

> **Öneri:** Belirsizseniz **Dosya** kanalıyla başlayın — hiçbir sistem
> entegrasyonu gerektirmez, İK'nızın gecelik Excel çıktısı yeterlidir.

---

## 2. Başlarken

### 2.1. API anahtarı alma

1. KlinoVax yönetici panelinde **Ayarlar → Entegrasyon → API Anahtarları**.
2. **Yeni Anahtar** → ad verin (örn. "HBYS Gecelik Senkron"), isterseniz bitiş
   tarihi belirleyin.
3. Üretilen anahtar `klx_live_...` biçimindedir ve **yalnızca bir kez gösterilir.**
   Hemen güvenli bir yere (secret manager / vault) kaydedin.

Her istekte bu anahtarı `Authorization` başlığında gönderirsiniz:

```
Authorization: Bearer klx_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2.2. Anahtar güvenliği ve rotasyon

- Anahtar bir **parola gibidir** — koda gömmeyin, log'lamayın, e-postayla paylaşmayın.
- Sunucuda ortam değişkeni / secret manager'da tutun.
- **Rotasyon:** yeni bir anahtar üretin, sistemlerinizi ona geçirin, sonra eskisini
  panelden **iptal edin** (revoke). Aynı anda birden çok aktif anahtar olabilir —
  kesintisiz rotasyon yapabilirsiniz. Sızıntı şüphesinde derhal iptal edin.

### 2.3. Önce deneme (dry-run) yapın

Her toplu işlemden önce **deneme modu** kullanın: hiçbir değişiklik yazılmadan,
kayıtlarınızın nasıl işleneceğini (kaç ekleme/güncelleme/çakışma) raporlar.
- Push/sync: gövdeye `"dryRun": true`
- Dosya: URL'ye `?mode=preview`

---

## 3. Kayıt formatı (StaffRecord)

Her personel bir JSON nesnesi (veya dosya satırı) olarak temsil edilir.

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `externalId` | string | Push tekil/PATCH'te ✓ | Sizin sistemdeki personel/sicil no. **Kararlı eşleştirme anahtarı** — değişmemeli. |
| `firstName` | string | ✓ | Ad |
| `lastName` | string | ✓ | Soyad |
| `email` | string | — | E-posta. Yoksa personel **TC + şifre** ile giriş yapar (sentetik e-posta otomatik üretilir). |
| `phone` | string | — | Telefon |
| `tcKimlik` | string | — | TC Kimlik No — kontrol haneli doğrulanır; şifreli saklanır (KVKK). |
| `departmentName` | string | — | Departman adı — sistemdeki departmanla eşleştirilir; yoksa oluşturulabilir. |
| `departmentId` | string | — | Departman ID'si (biliyorsanız; `departmentName`'e tercih edilir) |
| `title` | string | — | Unvan (örn. "Hemşire") |
| `hireDate` | string | — | İşe giriş tarihi (ISO 8601) |
| `active` | boolean | — | `false` → personel deaktive edilir (işten ayrılma). Varsayılan `true`. |

### Alan eşleme (kendi kolon adlarınız)

Kendi sisteminizin kolon adlarını değiştirmek zorunda değilsiniz. Yönetici
panelinde **Entegrasyon → Alan Eşleme**'den, kaynak alanlarınızı bizim
alanlarımıza eşleyin (örn. `SICIL_NO → externalId`, `AD → firstName`). Bu
eşlemeyi tanımladığınızda ham verinizi olduğu gibi gönderebilirsiniz.

---

## 4. Push API uçları

Taban URL: `https://app.klinovax.com`
Tümü `Authorization: Bearer klx_live_...` gerektirir.

### 4.1. Tekil personel ekle/güncelle (upsert)

```bash
curl -X POST https://app.klinovax.com/api/integration/v1/staff \
  -H "Authorization: Bearer klx_live_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: upsert-EMP-1042-v1" \
  -d '{"externalId":"EMP-1042","firstName":"Ali","lastName":"Yılmaz",
       "departmentName":"Acil Servis","title":"Hemşire","active":true}'
```

Yanıt (`201` yeni kayıt / `200` güncelleme):
```json
{ "runId": "…", "action": "create", "userId": "…" }
```

### 4.2. Kısmi güncelleme

```bash
curl -X PATCH https://app.klinovax.com/api/integration/v1/staff/EMP-1042 \
  -H "Authorization: Bearer klx_live_..." \
  -H "Content-Type: application/json" \
  -d '{"title":"Sorumlu Hemşire","phone":"05551112233"}'
```
Personel bulunamazsa `404`.

### 4.3. İşten ayrılma (deaktivasyon)

```bash
curl -X DELETE https://app.klinovax.com/api/integration/v1/staff/EMP-1042 \
  -H "Authorization: Bearer klx_live_..."
```
Personel pasifleştirilir (silinmez — sertifika/sınav geçmişi korunur). Zaten
pasifse `action: "skip"` döner.

### 4.4. Toplu senkron

```bash
curl -X POST https://app.klinovax.com/api/integration/v1/sync \
  -H "Authorization: Bearer klx_live_..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: nightly-2026-07-03" \
  -d '{"mode":"snapshot","dryRun":true,
       "records":[{"externalId":"EMP-1","firstName":"Ali","lastName":"Yılmaz"}]}'
```
- `mode`: `delta` (yalnız gönderilenler) veya `snapshot` (tam liste — bkz. §6).
- En fazla **2000 kayıt** / istek. Daha fazlası için birden çok istek.

Yanıt:
```json
{ "runId": "…", "status": "completed",
  "counts": { "totalRows": 1, "createdRows": 1, "updatedRows": 0,
              "deactivatedRows": 0, "skippedRows": 0, "failedRows": 0 },
  "errors": [] }
```

---

## 5. Dosya kanalı

İK'nızın dışa-aktardığı **xlsx** veya **csv** dosyasını yükleyin.

```bash
# Önizleme (hiçbir yazma yapılmaz)
curl -X POST 'https://app.klinovax.com/api/integration/v1/files?mode=preview' \
  -H 'Authorization: Bearer klx_live_...' \
  -F 'file=@personel-2026-07-03.csv'

# Gerçek yükleme
curl -X POST 'https://app.klinovax.com/api/integration/v1/files?syncMode=snapshot' \
  -H 'Authorization: Bearer klx_live_...' \
  -H 'Idempotency-Key: hbys-2026-07-03-nightly' \
  -F 'file=@personel.xlsx'
```

- **Başlık adları** Türkçe/İngilizce esnektir: `ad`, `soyad`, `e-posta`,
  `telefon`, `departman`, `unvan`, `tc/tckn` (ve İngilizce karşılıkları).
- **Türkçe Excel CSV** (`;` ayırıcılı) otomatik algılanır.
- En fazla **2000 satır**, **10 MB**.
- Önce `?mode=preview` ile deneyin; hata yoksa gerçek yüklemeyi yapın.

---

## 6. Senkron semantiği (önemli)

### Eşleştirme önceliği
Gönderdiğiniz her kayıt mevcut personelle şu sırayla eşleştirilir:
**`externalId` → `tcKimlik` → `email`**. İlk kararlı anahtar `externalId`
olduğundan, mümkünse her zaman gönderin.

### delta vs snapshot
- **delta**: yalnızca gönderdiğiniz kayıtlar işlenir; listede olmayanlara dokunulmaz.
- **snapshot**: gönderdiğiniz liste **tam personel listesi** kabul edilir. Kurumunuz
  **"eksikleri deaktive et"** seçeneğini açtıysa, listede **olmayan** ve
  entegrasyonla yönetilen (`externalId`'si olan) personel deaktive edilir.

### Güvenlik eşiği (toplu deaktivasyon koruması)
Snapshot modda deaktive edilecek personel sayısı **max(5, aktif personelin %20'si)**
eşiğini aşarsa koşu **`aborted`** olur ve hiçbir değişiklik uygulanmaz. Bu, eksik
veya bozuk bir gece dosyasının yanlışlıkla yüzlerce kişiyi pasifleştirmesini
engeller. Bilinçli büyük değişiklik için yönetici panelinden **Şimdi Çalıştır →
zorla** kullanılır (API'den zorlanamaz).

### Neye dokunulmaz
- **Yönetici (admin) hesapları** entegrasyonla yönetilemez → satır `conflict`.
- **Elle eklenmiş** (`externalId`'si olmayan) personel snapshot'ta asla deaktive edilmez.

### TC çakışması (iki hastanede çalışan personel)
Bir TC Kimlik No **tek bir kuruma** bağlanır. Gönderdiğiniz kayıttaki TC başka
bir kurumda kayıtlıysa satır `conflict` olur ve yönetici panelinde **manuel
çözüm** bekler — otomatik taşınmaz.

### Idempotency (tekrar güvenliği)
Yeniden denenen istekler çift kayıt üretmesin diye yazma uçlarına
`Idempotency-Key` başlığı ekleyin (örn. gecelik iş için
`Idempotency-Key: nightly-2026-07-03`). Aynı anahtarla 24 saat içinde tekrarlanan
istek ilk yanıtı döndürür (`Idempotency-Replayed: true` başlığıyla).

---

## 7. Hata kodları ve limitler

| Kod | Anlam |
|---|---|
| `401` | Geçersiz/eksik API anahtarı |
| `403` | Entegrasyon planınızda etkin değil / erişim kısıtlı |
| `404` | Personel (externalId) bulunamadı |
| `409` | Devam eden bir senkron var veya aynı Idempotency-Key işlemi sürüyor |
| `413` | Dosya çok büyük (>10 MB) |
| `422` | Kayıt işlenemedi (doğrulama hatası / çakışma) — `message` alanında neden |
| `429` | Hız limiti aşıldı |

**Hız limitleri:** IP başına 60/dk · anahtar başına 120/dk · toplu senkron
10/saat/kurum · dosya 6/saat/kurum.

`aborted` / `completed_with_errors` durumlarında satır bazlı ayrıntı için
sonraki bölüme bakın.

---

## 8. İzleme

Her koşu bir `runId` döndürür. Satır bazlı sonuçları sorgulayın:

```bash
curl "https://app.klinovax.com/api/integration/v1/sync-runs/<runId>?action=error&page=1&limit=100" \
  -H "Authorization: Bearer klx_live_..."
```
`action` filtresi: `create|update|deactivate|reactivate|skip|conflict|error`.

Görsel takip için yönetici panelinde **Entegrasyon → Geçmiş** sekmesi: her koşunun
tarihi, kanalı, sayaçları ve hata satırları Türkçe açıklamalarıyla listelenir.

---

## 9. KVKK notu

- **TC Kimlik No** AES-256-GCM ile şifreli saklanır; log'lara hiçbir zaman düz
  yazılmaz.
- Senkron satır kayıtlarındaki kişisel iz **90 gün** sonra otomatik imha edilir
  (veri minimizasyonu).
- İK verisini bize aktarırken kendi tarafınızdaki **aydınlatma/rıza**
  yükümlülüklerinizin karşılandığından emin olun.

---

## İletişim

Entegrasyon desteği için:
**ekremyilmaz@klinovax.info · 0553 953 06 96**
