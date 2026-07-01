# KVKK Veri İşleme Envanteri, Yurt Dışı Aktarım ve Hukuki Aksiyon Listesi

> Güncelleme: 2026-07-01. Bu doküman teknik envanteri ve **hukuki aksiyon checklist'ini** kapsar.
> Kod tarafı remediation `docs/kvkk-teknik-uyum.md`'de; bu doküman özellikle **yurt dışı aktarım
> (KVKK Md. 9)** ve organizasyonel yükümlülükleri (VERBİS, standart sözleşme, DPA) izler.
> Hukuki metin/imza için avukat teyidi gerekir — bu doküman teknik altyapıyı ve takibi sağlar.

## 1. Güncel mevzuat çerçevesi (2024–2026)

- **Yurt dışına aktarım (Md. 9, 7499 s. Kanun ile 01.06.2024):** Hiyerarşi — (1) yeterlilik kararı,
  (2) uygun güvenceler (standart sözleşme / bağlayıcı şirket kuralları), (3) arızi istisnalar.
  **Türkiye bugüne kadar hiçbir ülke için yeterlilik kararı VERMEDİ; ABD listede yok.** Açık rızaya
  dayalı yurt dışı aktarım 01.09.2024'ten beri yapılamaz.
- **Standart sözleşme:** imzadan sonra **5 iş günü içinde Kurul'a bildirilmeli** (Standart Sözleşme
  Bildirim Modülü / KEP / fiziki). Yönetmelik: RG 10.07.2024, 32598.
- **2026 idari para cezaları (üst sınır 17.092.242 TL):** veri güvenliği (Md. 12) 256.357–17.092.242;
  aydınlatma (Md. 10) 85.437–1.709.200; VERBİS (Md. 16) 341.809–17.092.242; standart sözleşme
  bildirmeme 90.308–1.806.177.
- **Veri ihlali bildirimi:** öğrenilmesinden itibaren **72 saat** içinde Kurul'a.

## 2. Veri işleyen / dış servis envanteri (bölge + aktarım mekanizması)

| Servis | Gördüğü veri | Bölge | KVKK | Gerekli mekanizma |
|---|---|---|---|---|
| **Supabase** (DB/Auth/Storage) | Tüm PII (ad, e-posta, telefon, TC şifreli, parola hash) | eu-central-1 (Frankfurt) | Yurt dışı (AB) | Standart sözleşme (VS→Vİ) + Kurul bildirimi |
| **AWS S3 + CloudFront** | Video/PDF/sertifika/branding + şifreli DB yedekleri | eu-central-1 | Yurt dışı (AB) | Standart sözleşme + Kurul bildirimi |
| **Upstash Redis** | Timer, rate-limit, OTP/cache; e-posta rate-limit anahtarları | eu-central-1 | Yurt dışı (AB) | Standart sözleşme + Kurul bildirimi |
| **Vercel** (hosting) | Tüm istek/yanıt + structured loglar | fra1 (Frankfurt) | Yurt dışı (AB) | Standart sözleşme + Kurul bildirimi |
| **Brevo** (e-posta) | Alıcı e-posta+ad, geçici şifreler, fatura PDF | Fransa (AB) | Yurt dışı (AB) | Standart sözleşme + Kurul bildirimi |
| **Crisp** (canlı destek chat) | Ziyaretçi chat + tarayıcı verisi | Fransa (AB) | Yurt dışı (AB) | Standart sözleşme + çerez aydınlatması |
| **Sentry** (hata izleme) | Hata olayları (PII redakte) | **AB DSN kullan** (`ingest.de.sentry.io`) | Yurt dışı | AB-bölge DSN + standart sözleşme |
| **OpenRouter** (AI soru üretimi) | Eğitim dokümanı metinleri (personel PII'si değil) | **ABD** | Yurt dışı (ABD) | Standart sözleşme; alt-model sağlayıcı zinciri değerlendir |
| **Expo Push** (mobil bildirim) | Bildirim başlık/gövde + cihaz push token'ı | **ABD** | Yurt dışı (ABD) | Standart sözleşme + Kurul bildirimi |
| **NetGSM** (SMS/OTP) | Telefon + OTP | **Türkiye** | ✅ Yurt içi | — |
| **Iyzico** (ödeme) | Ödeme (kart Iyzico hosted; yalnız son 4 hane döner) | **Türkiye** | ✅ Yurt içi | — |

> Not: TC Kimlik ve sağlık-sektörü personel verisi de Frankfurt'ta (AB) tutulur → AB dahil "yurt
> dışı" sayılır. Sağlık **tanı/hasta** verisi sistemde İŞLENMEZ (personel eğitim/sınav LMS'i).

## 3. Tier 0 — Hukuki/organizasyonel aksiyon listesi (kullanıcı + avukat)

- [ ] **Standart sözleşme** imzala: Supabase, AWS, Vercel, Upstash, Brevo, Crisp, Sentry, OpenRouter,
      Expo — her biri için uygun model (çoğu VS→Vİ). Kurul'un 4 standart sözleşme metninden uygun olanı.
- [ ] Her imzadan sonra **5 iş günü içinde Kurul'a bildir** (Standart Sözleşme Bildirim Modülü).
- [ ] **VERBİS kaydını tamamla** (privacy sayfasındaki "Başvuru sürecinde" placeholder'ı gerçek numarayla
      değiştir). Aydınlatma ↔ VERBİS beyanı uyumlu olsun.
- [ ] **DPA (veri işleyen sözleşmesi)** dokümanlarını topla/imzala ve repoda referansla.
- [ ] Sentry projesini **AB bölgesine** taşı (EU-region DSN) — kod tarafı hazır (CSP + env dokümanı).
- [ ] Crisp için **çerez/izleme aydınlatması** ekle (tüm ziyaretçilere yükleniyor).
- [ ] Veri ihlali müdahale prosedürü (72 saat Kurul bildirimi) yaz.

## 4. Uygulanan kod tarafı remediation (2026-07) — özet

| Alan | Durum |
|---|---|
| Unutulma hakkı (m.7) — UI'dan gerçek anonimleştirme + imza/IP/cihaz/davet PII temizliği | ✅ `lib/kvkk/anonymize-user.ts` |
| KVKK hak talebi yanıtlama iş akışı (m.13, 30 gün) | ✅ `admin/kvkk-requests` |
| Otomatik saklama-süresi imhası (m.7) | ✅ cron `deactivatedAt` + retention purge |
| Loglarda PII maskeleme (m.12) | ✅ `lib/pii-mask.ts` |
| Rıza versiyonlama + self-register açık rıza | ✅ `kvkkNoticeVersion` + register checkbox |
| TC anahtar rotasyonu / HKDF rehash | ✅ `scripts/rotate-tc-key.ts` |
| TC şifreleme (AES-256-GCM) + audit'te yalnız hash | ✅ (mevcut) |

## 5. Yönetişim notları / açık öneriler

- **Saklama süresi alt sınırı:** `settings/security-policy` `dataRetentionDays` alt sınırı 30 gün.
  Bir admin 30'a çekerse "üyelik+1 yıl" beyanından kısa otomatik imha olur — politika metniyle
  tutarlılık için alt sınırı (örn. 365) yükseltmeyi veya beyanı güncellemeyi değerlendir.
- **Aydınlatma metni sürümü:** metin (`app/kvkk/page.tsx`) esaslı değişince
  `lib/kvkk/notice-version.ts` `KVKK_NOTICE_VERSION`'ı ARTIR → tüm kullanıcılar yeniden onaya
  yönlendirilir (middleware, public + protected iki yol).
- **İmza görseli (`ExamAttempt.signatureData`):** eğitim tamamlama kanıtı; biyometrik TANIMA amacıyla
  işlenmediği için özel nitelikli sayılmaz. Yine de at-rest şifreleme (`crypto.ts encrypt`) önerilir;
  bugün anonimleştirmede temizleniyor. Uygularsa sign route (yaz) + signature-report (oku) güncellenmeli.
- **Legacy plaintext:** `safeDecrypt*` eski şifresiz değerleri tolere eder; `rotate-tc-key.ts` çözülemeyen
  kayıtları raporlar — backfill tamamlığını periyodik doğrula.
