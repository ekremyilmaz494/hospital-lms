# Hizmet Seviyesi Anlaşması (SLA)

**Hospital LMS — Hastane Personel Eğitim ve Sınav Yönetim Sistemi**

> Sürüm: 1.0
> Yürürlük tarihi: [İmza tarihi]
> Geçerlilik: Sözleşme süresi boyunca
> İlişkili dokümanlar: Ana Hizmet Sözleşmesi, KVKK Veri İşleyen Sözleşmesi

---

## 1. Taraflar

**Hizmet Sağlayıcı (bundan sonra "SAĞLAYICI" olarak anılacaktır):**
[Şirket Unvanı]
[Adres]
[Vergi No]
[İletişim e-posta]

**Hizmet Alan (bundan sonra "MÜŞTERİ" olarak anılacaktır):**
[Müşteri Hastane Adı]
[Adres]
[Vergi No]
[Esas Yönetici (Org Owner) iletişim bilgileri]

---

## 2. Tanımlar

| Terim | Tanım |
|-------|-------|
| **Uptime** | Sistemin erişilebilir ve işler durumda olduğu zaman oranı (yüzde olarak) |
| **Bakım Penceresi** | Önceden bildirilen ve hizmet kesintisinin kabul edildiği zaman aralığı |
| **Olay (Incident)** | Sistemin beklenen şekilde çalışmamasına yol açan herhangi bir durum |
| **P0 / P1 / P2** | Olay öncelik seviyeleri (aşağıda detaylı) |
| **Yanıt Süresi** | SAĞLAYICI'nın olay bildiriminden sonra ilk anlamlı yanıtı verme süresi |
| **Çözüm Süresi** | Olayın tam olarak çözüldüğü ve hizmetin normale döndüğü süre |
| **RTO** | Recovery Time Objective — sistemin yeniden ayağa kalkma hedef süresi |
| **RPO** | Recovery Point Objective — kabul edilen maksimum veri kaybı süresi |
| **Esas Yönetici** | Müşteri hastane bünyesindeki sistem yöneticisi (Org Owner) |

---

## 3. Hizmet Kapsamı

SAĞLAYICI, MÜŞTERİ'ye aşağıdaki hizmetleri sunar:

- **Çekirdek Sistem:** Hospital LMS web tabanlı eğitim ve sınav yönetim platformu
- **Multi-tenant Mimari:** Müşteri verilerinin diğer organizasyonlardan tamamen izole edilmesi
- **Bulut Altyapı:** Vercel (uygulama), Supabase (veritabanı), AWS S3 (dosya depolama), AWS CloudFront (video dağıtım)
- **Ek Hizmetler:** Otomatik yedekleme, sertifika oluşturma, raporlama, sürekli güvenlik güncellemeleri

---

## 4. Uptime Taahhüdü

### 4.1 Hedef Uptime

SAĞLAYICI, sistemi **aylık %99.5 uptime** ile çalışır halde tutmayı taahhüt eder.

| Uptime % | Aylık tolerans (kesinti) |
|----------|--------------------------|
| %99.5 | ~3 saat 36 dakika |
| %99.9 | ~43 dakika |
| %99.99 | ~4 dakika 22 saniye |

### 4.2 Uptime Hesabına Dahil Olmayanlar

Aşağıdaki süreler uptime hesabından **DÜŞÜLÜR** (kesinti sayılmaz):

- Önceden bildirilmiş bakım pencereleri (madde 5)
- MÜŞTERİ'nin hatalı kullanımından kaynaklanan kesintiler (yanlış konfigürasyon, yetkisiz yazılım vb.)
- Üçüncü taraf hizmetlerinin (Vercel, Supabase, AWS) kendi SLA'larıyla bildirilen genel arızaları
- Mücbir sebepler (doğal afet, savaş, salgın hastalık, yasal düzenleme değişiklikleri)
- MÜŞTERİ'nin internet bağlantısı veya kendi yerel altyapısından kaynaklanan sorunlar

### 4.3 Uptime İhlali Telafi Mekanizması

| Aylık Uptime | Telafi |
|--------------|--------|
| < %99.5 ve ≥ %99.0 | Sonraki ayın aboneliğinden %5 indirim |
| < %99.0 ve ≥ %95.0 | Sonraki ayın aboneliğinden %15 indirim |
| < %95.0 | Sonraki ayın aboneliğinden %30 indirim + neden raporu |

Telafi talebi MÜŞTERİ tarafından ilgili ayın bitiminden itibaren 30 gün içinde yazılı olarak yapılmalıdır.

---

## 5. Bakım Pencereleri

### 5.1 Düzenli Bakım

- **Zaman:** Hafta içi her gün 23:00 – 02:00 (Türkiye saati, UTC+3)
- **Bildirim:** Düzenli bakımlar için ön bildirim **gerekmez**
- **Etki:** Genelde 0–10 dakika kısa kesintiler. Bazen kesinti yaşanmayabilir.

### 5.2 Aylık Büyük Bakım

- **Zaman:** Her ayın ilk Pazar günü 02:00 – 06:00 (Türkiye saati)
- **Bildirim:** En az **7 gün öncesinden** e-posta ile
- **Etki:** Sistem bu süre boyunca tamamen erişilemeyebilir
- **Amaç:** Bağımlılık güncellemeleri, büyük migration'lar, altyapı değişiklikleri

### 5.3 Acil Bakım

- **Tetikleyici:** Güvenlik açığı, kritik hata, üçüncü taraf zorunlu güncellemeler
- **Bildirim:** Mümkün olan en kısa sürede; en az **4 saat öncesinden** (yeterli süre olursa)
- **Onay:** P0 seviyesi acillerde MÜŞTERİ onayı aranmadan uygulanabilir; durum sonradan raporlanır

### 5.4 Bakım Penceresi Dışında Değişiklik Yapma Yasağı

SAĞLAYICI, müşteri çalışma saatleri (08:00 – 18:00, hafta içi) içinde rutin deploy yapmamayı taahhüt eder. Sadece P0 seviyesi acil hata düzeltmeleri bu kısıtın dışındadır.

---

## 6. Olay (Incident) Yönetimi

### 6.1 Öncelik Seviyeleri

| Seviye | Tanım | Örnek |
|--------|-------|-------|
| **P0 — Kritik** | Sistem tamamen erişilemez; tüm kullanıcılar etkileniyor | Login çalışmıyor; site açılmıyor; veri kaybı tespit edildi |
| **P1 — Yüksek** | Önemli özellik bozuk; çoğu kullanıcı etkileniyor | Sınav başlatılamıyor; sertifika üretilemiyor; rapor indirilmiyor |
| **P2 — Orta** | İkincil özellik sorunlu; bazı kullanıcılar etkileniyor | Bildirim e-postaları gecikmeli; UI'da görsel hata |
| **P3 — Düşük** | İyileştirme talebi; iş akışını engellemiyor | Renk değişikliği talebi; ek rapor formatı |

### 6.2 Yanıt ve Çözüm Süreleri

| Seviye | İlk Yanıt | Hedef Çözüm Süresi | Çözüm Çalışma Saatleri |
|--------|-----------|---------------------|------------------------|
| **P0** | 1 saat içinde | 4 saat içinde | 7/24 |
| **P1** | 4 saat içinde | 24 saat içinde | Hafta içi 09:00–18:00 |
| **P2** | 24 saat içinde | 5 iş günü içinde | Hafta içi 09:00–18:00 |
| **P3** | 5 iş günü içinde | Sprint takvimine göre | — |

**Not:** "İlk yanıt" = sorunun alındığının ve incelemeye başlandığının teyit edildiği bildirim. Çözümün kendisi değil.

### 6.3 Olay Bildirim Yöntemleri

MÜŞTERİ olay bildirimini aşağıdaki yöntemlerle yapabilir:

1. **P0 / P1:** Telefon (öncelikli) veya e-posta — [Acil iletişim e-posta]
2. **P2:** E-posta — [Standart destek e-posta]
3. **P3:** Sistem içi geri bildirim formu

### 6.4 Olay Çözüm Sonrası Bildirim

P0 ve P1 olayları için SAĞLAYICI, olay çözümünden sonra **48 saat içinde** yazılı bir post-mortem raporu paylaşır. Rapor içeriği:
- Olay zaman çizelgesi
- Kök neden analizi
- Etkilenen veri ve kullanıcı sayısı
- Tekrar etmemesi için alınan önlemler

---

## 7. Veri Koruma ve Yedekleme

### 7.1 RPO ve RTO Hedefleri

| Metrik | Hedef | Mevcut Mekanizma |
|--------|-------|------------------|
| **RPO** | < 24 saat | Günlük otomatik yedekleme (her gece 03:15 UTC) |
| **RTO** | < 4 saat | Yedekten geri yükleme prosedürü doğrulanmış |

### 7.2 Yedekleme Mekanizması

- **Sıklık:** Her gün otomatik (03:15 UTC)
- **Depolama:** AWS S3 (Frankfurt, eu-central-1), AES-256-GCM şifreleme
- **Saklama Süresi:** 90 gün
- **Doğrulama:** Her yedek upload sonrası bütünlük kontrolü; haftalık otomatik restore drill testi

### 7.3 Veri Kaybı Durumunda Sorumluluk

- **24 saatten az veri kaybı** (RPO içinde): Standart yedekten geri yükleme; SLA ihlali sayılmaz
- **24 saatten fazla veri kaybı** (RPO ihlali): SAĞLAYICI tarafından detaylı inceleme; ilgili maddeler 4.3 kapsamında değerlendirme

### 7.4 Veri Lokasyonu

Tüm MÜŞTERİ verileri AB Genel Veri Koruma Tüzüğü (GDPR) ve KVKK uyumlu Frankfurt (eu-central-1) bölgesinde saklanır. ABD veya AB dışında veri transferi yapılmaz.

---

## 8. Versiyon Güncellemeleri ve Değişiklik Yönetimi

### 8.1 Güncelleme Türleri

| Tür | Tanım | Bildirim Süresi | Onay |
|-----|-------|-----------------|------|
| **Güvenlik Yaması** | Kritik güvenlik açığı düzeltmesi | Mümkünse önceden, mümkün değilse sonradan | Onay aranmaz |
| **Bug Fix** | Mevcut özellikteki hatalar | Düzenli sürüm notunda | Onay aranmaz |
| **Yeni Özellik** | Mevcut akışı etkilemeyen eklemeler | Sürüm notunda | Onay aranmaz |
| **Breaking Change** | Mevcut kullanıma etki edecek değişiklik | **48 saat öncesinden** yazılı | Onay aranır |
| **API Sözleşme Değişikliği** | MÜŞTERİ entegrasyonlarını etkileyebilir | **30 gün öncesinden** yazılı | Onay aranır |

### 8.2 Sürüm Notları

SAĞLAYICI, her ay **aylık sürüm notu** yayınlar. İçeriği:
- Geçen ayın güncellemeleri
- Düzeltilen hatalar
- Yeni özellikler
- Bilinen sorunlar
- Önümüzdeki ayın planları

---

## 9. Performans Taahhütleri

| Metrik | Hedef Değer | Ölçüm |
|--------|-------------|-------|
| Sayfa açılma süresi (p95) | < 2 saniye | İlgili dashboard'larda izlenir |
| API yanıt süresi (p95) | < 500ms | Vercel + Sentry transactions |
| Sınav başlatma süresi | < 1 saniye | Test senaryoları |
| Eş zamanlı kullanıcı kapasitesi | ≥ 200 kullanıcı | k6 yük testi ile doğrulanmış |

Bu taahhütler düzenli kullanım koşulları altında geçerlidir; MÜŞTERİ tarafından beklenen ölçeği aşan kullanımda yeniden değerlendirme yapılır.

---

## 10. MÜŞTERİ Sorumlulukları

### 10.1 Kullanım

- Sisteme erişen tüm kullanıcıların yetkilendirmesini yapmak
- Kullanıcı parolalarının güvenli yönetimini sağlamak
- Esas Yönetici (Org Owner) iletişim bilgilerini güncel tutmak
- KVKK kapsamındaki Veri Sorumlusu yükümlülüklerini yerine getirmek

### 10.2 Bildirim

- Personel ayrılışlarını derhal sisteme yansıtmak (KVKK silme talebi prosedürü)
- Anormal aktivite, güvenlik şüphesi veya veri sızıntısı şüphesini SAĞLAYICI'ya bildirmek
- İletişim e-postalarının düzenli kontrol edilmesi

### 10.3 Eğitim

- Esas Yönetici'nin SAĞLAYICI tarafından verilen eğitime katılması
- Yeni Esas Yönetici atamasında SAĞLAYICI'nın bilgilendirilmesi

---

## 11. Mücbir Sebepler

Aşağıdaki durumlar SAĞLAYICI'nın yükümlülüklerinden muafiyet sağlar:

- Doğal afetler (deprem, sel, yangın)
- Savaş, terör, isyan, halk ayaklanması
- Salgın hastalıklar (resmi karantina kararları dahil)
- Telekomünikasyon altyapı kesintileri (TT, ISP düzeyinde)
- Yasal düzenleme değişiklikleri
- Üçüncü taraf bulut sağlayıcılarının (Vercel, Supabase, AWS) öngörülemeyen genel arızaları

Bu durumlar yaşandığında SAĞLAYICI, durumu mümkün olan en kısa sürede MÜŞTERİ'ye bildirir.

---

## 12. SLA İhlali Bildirimi ve Telafi Süreci

### 12.1 İhlal Bildirimi

MÜŞTERİ, SLA ihlali tespit ettiğinde:

1. İhlalin yaşandığı tarihten itibaren **30 gün içinde** yazılı bildirimde bulunur
2. Bildirimde aşağıdaki bilgiler bulunur:
   - İhlalin başlama ve bitiş zamanı
   - İhlalin türü (uptime / yanıt süresi / veri kaybı vb.)
   - Etkilenen kullanıcı / işlem sayısı
   - Talep edilen telafi

### 12.2 Telafi Onayı

SAĞLAYICI, ihlal bildirimini aldıktan sonra **15 gün içinde** doğrulayıp telafi kararını bildirir.

### 12.3 Toplam Telafi Üst Sınırı

Yıllık toplam telafi tutarı, MÜŞTERİ'nin yıllık abonelik bedelinin **%30'unu geçemez**.

---

## 13. SLA Güncellemeleri

SAĞLAYICI bu SLA dokümanını **30 gün öncesinden yazılı bildirim** ile güncelleyebilir. MÜŞTERİ, güncellemeyi kabul etmediği takdirde sözleşmeyi feshetme hakkına sahiptir (peşin ödenmiş bedel iade edilir).

---

## 14. Uyuşmazlıkların Çözümü

Bu SLA'nın uygulanmasında doğacak uyuşmazlıklar:

1. **Birinci aşama:** Tarafların iyi niyetle 30 günlük müzakeresi
2. **İkinci aşama:** [Tahkim merkezi adı, örn. İstanbul Tahkim Merkezi] tahkim
3. **Yargı yetkisi:** [İstanbul] mahkemeleri ve icra daireleri

---

## 15. Geçerlilik ve İmza

Bu SLA, ana hizmet sözleşmesinin ayrılmaz bir parçasıdır.

| Taraf | Adı / Unvanı | Tarih | İmza |
|-------|--------------|-------|------|
| SAĞLAYICI | [Yetkili adı / unvanı] | __ / __ / 20__ | __________ |
| MÜŞTERİ | [Esas Yönetici adı / unvanı] | __ / __ / 20__ | __________ |

---

## Ek A — İletişim Bilgileri

### SAĞLAYICI Tarafı

| Konu | İletişim |
|------|----------|
| P0 Acil Destek (7/24) | [Telefon] |
| P1/P2 Standart Destek | [E-posta] |
| Faturalama | [E-posta] |
| Sözleşme / Yasal | [E-posta] |
| KVKK / Veri Koruma | [DPO e-posta] |

### MÜŞTERİ Tarafı

| Konu | İletişim |
|------|----------|
| Esas Yönetici | [Ad / Telefon / E-posta] |
| Yedek İletişim | [Ad / Telefon / E-posta] |
| Faturalama | [E-posta] |

---

## Ek B — Sürüm Tarihçesi

| Sürüm | Tarih | Değişiklik |
|-------|-------|-----------|
| 1.0 | 2026-05-08 | İlk yayın |
