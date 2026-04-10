# Veri Güvenliği Teknik Özet

> **Belge Türü:** Hastane IT Güvenlik Ekibi İçin Teknik Özet
> **Son Güncelleme:** Nisan 2026
> **Sistem:** Hastane Personel Eğitim ve Sınav Yönetim Sistemi (LMS)
> **Sürüm:** 1.0.0

---

## 1. Veri Depolama Altyapısı

| Bileşen | Sağlayıcı | Konum | Şifreleme |
|---------|-----------|-------|-----------|
| **Veritabanı** | Supabase (PostgreSQL 15) | EU-Central-1 (Frankfurt, Almanya) | AES-256 disk şifreleme + TLS 1.3 transit |
| **Dosya Depolama** | AWS S3 + CloudFront CDN | EU-Central-1 (Frankfurt) | SSE-S3 (AES-256) + CloudFront signed URL |
| **Önbellek** | Upstash Redis (Serverless) | EU bölgesi | TLS şifreli transit, at-rest AES-256 |
| **Uygulama** | Vercel Edge Network | Frankfurt (fra1) | HTTPS zorunlu (HSTS preload) |
| **E-posta** | SMTP (yapılandırılabilir) | Müşteri tercihi | TLS/STARTTLS |

**Veri yerleşimi:** Tüm veriler Avrupa Birliği bölgesinde saklanır. Türkiye dışına veri aktarımı yapılmaz. KVKK Madde 9 kapsamında yurt dışı aktarım gereksinimleri karşılanmaktadır.

---

## 2. Erişim Kontrolü

### Rol Tabanlı Yetkilendirme (RBAC)
| Rol | Erişim Kapsamı | Örnek Yetkiler |
|-----|---------------|----------------|
| **Super Admin** | Tüm hastaneler | Hastane oluşturma/askıya alma, abonelik yönetimi |
| **Hastane Admin** | Yalnızca kendi hastanesi | Personel, eğitim, sınav, rapor, sertifika yönetimi |
| **Personel** | Yalnızca kendi verileri | Atanan eğitimler, sınavlar, sertifikalar, profil |

### Çok Kiracılı (Multi-Tenant) İzolasyon
- Her veritabanı sorgusu `organizationId` ile filtrelenir
- **42 tabloda** Supabase Row Level Security (RLS) aktif — **99 ayrı güvenlik politikası**
- Hastane A'nın verileri Hastane B tarafından hiçbir koşulda görüntülenemez
- Otomatik güvenlik testi: 23 IDOR + izolasyon testi sürekli çalışır

### Kimlik Doğrulama
- Supabase Auth (JWT tabanlı)
- Oturum cookie'leri: `HttpOnly`, `Secure`, `SameSite=Lax`
- MFA desteği: TOTP (Google Authenticator uyumlu)
- Oturum zaman aşımı: Hastane bazında yapılandırılabilir (varsayılan 30 dk)
- Başarısız giriş koruması: 20 deneme / 5 dakika, ardından geçici kilitleme

---

## 3. Şifreleme

| Katman | Yöntem | Detay |
|--------|--------|-------|
| **Transit** | TLS 1.3 | HSTS preload aktif (max-age: 1 yıl) |
| **Veritabanı** | AES-256 (Supabase managed) | Disk düzeyinde şifreleme |
| **Hassas Alanlar** | AES-256-GCM | TC Kimlik No uygulama katmanında şifrelenir |
| **Şifreler** | bcrypt (Supabase Auth) | Salt + hash, düz metin saklanmaz |
| **Dosyalar** | SSE-S3 (AES-256) | S3 tarafında otomatik şifreleme |
| **Video Erişimi** | CloudFront signed URL | 4 saat geçerli, her oturum için benzersiz |

### Uygulama Katmanı Şifreleme
```
TC Kimlik No → AES-256-GCM (12-byte IV, auth tag) → DB'de şifreli saklanır
Format: iv_hex:authTag_hex:ciphertext_hex
Anahtar: ENCRYPTION_KEY ortam değişkeni (Base64, 256-bit)
```

---

## 4. Güvenlik Başlıkları

| Başlık | Değer |
|--------|-------|
| `Strict-Transport-Security` | max-age=31536000; includeSubDomains; preload |
| `X-Frame-Options` | DENY |
| `X-Content-Type-Options` | nosniff |
| `Content-Security-Policy` | script-src 'self'; connect-src Supabase + CloudFront + Sentry |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Permissions-Policy` | camera=(), microphone=(), geolocation=() |
| `X-XSS-Protection` | 1; mode=block |

---

## 5. Denetim ve İzleme

### Audit Log (Değiştirilemez Zincir)
- Tüm işlemler (oluşturma, güncelleme, silme, giriş, çıkış) kayıt altında
- **SHA-256 hash zinciri**: Her kayıt önceki kaydın hash'ini içerir — bir kayıt değiştirilirse tüm zincir bozulur
- Admin panelinden "Zinciri Doğrula" butonu ile bütünlük kontrolü
- 1 yıl saklama, ardından otomatik arşivleme

### Hata İzleme
- Sentry entegrasyonu: Gerçek zamanlı hata bildirimi
- PII filtreleme: Kişisel veriler (şifre, TC no, e-posta) Sentry'ye gönderilmez
- Request ID: Her API isteğine benzersiz takip numarası atanır

### Rate Limiting
- Login: 20 deneme / 5 dakika (IP + e-posta bazlı)
- API: Endpoint bazında yapılandırılabilir limitler
- Export: 5 istek / dakika (sunucu aşırı yüklenme koruması)

---

## 6. KVKK Uyumluluk Özeti

| KVKK Maddesi | Uygulama |
|-------------|----------|
| **Madde 5** (İşleme Şartları) | Açık rıza + meşru menfaat bazlı işleme |
| **Madde 7** (Silme/Yok Etme) | `/api/admin/kvkk/delete-user-data` — 30 gün içinde tam anonimleştirme |
| **Madde 11** (Veri Sahibi Hakları) | Personel panelinde 9 farklı KVKK talep tipi |
| **Madde 12** (Teknik Tedbirler) | RLS, şifreleme, audit log, erişim kontrolü |

**KVKK detaylı teknik rapor:** `docs/kvkk-teknik-uyum.md`

---

## 7. Yedekleme ve Felaket Kurtarma

| Metrik | Hedef | Mevcut |
|--------|-------|--------|
| **RPO** (Maks. veri kaybı) | < 1 saat | Supabase Pro: dakika bazında PITR |
| **RTO** (Kurtarma süresi) | < 4 saat | En kötü senaryo: 3.5 saat |

- **Otomatik yedekleme**: Her gün 03:15 UTC → AWS S3'e şifreli JSON
- **Doğrulama**: Her yedek upload sonrası S3 HeadObject ile boyut kontrolü
- **Saklama süresi**: 90 gün
- **Haftalık kontrol**: `pnpm verify:backup` ile DB + Redis + S3 sağlık testi

---

## 8. Güvenlik Testi ve Denetim

### OWASP Top 10 Analizi (Mart 2026)
| Kategori | Durum |
|----------|-------|
| A01 Broken Access Control | ✅ Düzeltildi — RLS + RBAC + IDOR testleri |
| A02 Cryptographic Failures | ✅ Düzeltildi — AES-256-GCM şifreleme |
| A03 Injection | ✅ Korumalı — Prisma ORM + Zod validasyon |
| A04 Insecure Design | ✅ Multi-tenant izolasyon |
| A05 Security Misconfiguration | ✅ Düzeltildi — Tüm güvenlik başlıkları aktif |
| A06 Vulnerable Components | ⚠️ Düzenli bağımlılık güncellemesi gerekli |
| A07 Auth Failures | ✅ Rate limiting + MFA desteği |
| A08 Software Integrity | ✅ S3 content-type kısıtlaması |
| A09 Logging Failures | ✅ Audit log hash zinciri |
| A10 SSRF | ✅ URL validasyonu + open redirect koruması |

### Otomatik Güvenlik Testleri
- **39 güvenlik testi** sürekli çalışır (CI/CD pipeline)
  - SQL injection koruması (10 test)
  - IDOR / cross-org izolasyon (5 test)
  - Rol bazlı erişim matrisi (8 test)
  - Chaos testleri: Redis/DB/Email çökmesi (13 test)
  - Performance: Rate limit + büyük veri (3 test)

---

## 9. Üçüncü Taraf Servisleri

| Servis | Amaç | Veri Erişimi | SLA |
|--------|------|-------------|-----|
| Supabase | Veritabanı + Auth | Tüm uygulama verileri | %99.9 |
| AWS S3 | Video/dosya depolama | Eğitim içerikleri | %99.99 |
| Upstash | Önbellek + zamanlayıcı | Oturum verileri (geçici) | %99.9 |
| Vercel | Uygulama barındırma | İstek/yanıt (transit) | %99.99 |
| Sentry | Hata izleme | Hata logları (PII filtrelenmiş) | %99.9 |

---

**İletişim:** Teknik sorular için sistem yöneticisi ile iletişime geçin.
**Detaylı dokümanlar:** `docs/kvkk-teknik-uyum.md`, `docs/disaster-recovery.md`, `docs/his-entegrasyon-rehberi.md`
