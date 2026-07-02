# On-Premise Dağıtım & Lisanslama

KlinoVax LMS'i müşterinin kendi sunucusunda çalıştırma + Klinovax lisansı
olmadan kullanımı engelleme sisteminin mimari ve operasyon rehberi.

## Genel bakış

- **Bulut (varsayılan)**: `DEPLOYMENT_MODE` bayrağı yok → mevcut SaaS davranışı,
  lisans katmanı tamamen no-op.
- **On-prem**: `NEXT_PUBLIC_DEPLOYMENT_MODE=onprem` (imaj build'ine gömülür,
  runtime'da değiştirilemez). Lisans zorlaması aktif; hardcoded bulut Supabase
  ref guard'ları atlanır; ödeme/self-register kapalı; e-posta SMTP; Sentry kapalı;
  storage MinIO.

## Lisans modeli

- **İmza**: Ed25519 (jose). İki anahtar çifti:
  - *İhraç* — lisans dosyasını imzalar. Private key HİÇBİR sunucuda durmaz
    (offline CLI, soğuk saklama). Public key `src/lib/license/keys.ts`'e gömülü.
  - *Makbuz* — heartbeat yanıtlarını imzalar. Private key SaaS env'inde
    (`LICENSE_RECEIPT_PRIVATE_KEY`). Public key gömülü. Ayrım: SaaS ele geçse
    bile saldırgan en fazla ~35 günlük makbuz basar, yeni lisans üretemez.
- **Lisans dosyası** (`license.klv` = ham JWT) claim'leri: `jti` (licenseId),
  `customerName`, `licenseType`, `validUntil|null` (null=süresiz), `limits
  {maxOrganizations, maxStaff}`, `graceDays`, `schemaVersion`.
- **Bağlama**: dosya unbound; kurulumda rastgele `instanceId` üretilir,
  activate/heartbeat'te gönderilir. SaaS aynı lisansın >1 instance'tan
  heartbeat'ini anomali olarak işaretler. Tam offline kopyalama tespit edilemez
  — **DRM değil, caydırıcılık**; asıl koruma sözleşmedir.

## Kademeli kilit (durum makinesi)

`src/lib/license/state.ts` — saf fonksiyon, `NO_LICENSE | VALID | WARN |
READONLY | LOCKED`:

| Durum | Koşul | Davranış |
|---|---|---|
| VALID | geçerli | tam çalışma |
| WARN | bitişe ≤30 gün / offline grace yarısı | uyarı bandı + e-posta |
| READONLY | bitiş → +7 gün | okuma serbest, yazma 403 (aktif sınav ilerlemesi muaf) |
| LOCKED | bitiş+7g / iptal / offline grace aşımı / saat-geri-alma | yalnız `/license` |
| NO_LICENSE | lisans yok / imza geçersiz (DB tamper) | yalnız `/license` |

**Saat-geri-alma**: `clockWatermark` (görülen en ileri zaman + makbuz iat'i ile
ratchet). `now < watermark − 24h` → `clock_tampering` kilidi (her şeyden önce).

## Zorlama katmanları (derinlemesine savunma)

1. **API kapısı (otorite)** — `licenseApiGate`, `withApiHandler` içinde auth'tan
   sonra: LOCKED/NO_LICENSE → herkese 403 (super_admin DAHİL). 219 route tek nokta.
2. **READONLY yazma bloğu** — mevcut `checkWritePermission` (subscription-guard
   on-prem dalı); `/api/exam/*` ilerleme yolları muaf.
3. **Sayfa guard'ı** — exam layout server-side `/license` redirect; diğer
   panellerde `LicenseBanner` client redirect.
4. **Middleware sentinel** — `hlms-license-state` çerezi (advisory; asıl zorlama
   API+layout).
5. **Login** — LOCKED'ta staff girişi 403; admin/super_admin girip `/license`'a.
6. **Boot + cron** — `instrumentation` açılışta watermark ratchet;
   `/api/cron/license-heartbeat` (6 saatte bir) online doğrulama.

## Anahtar töreni (üretim — YAYINDAN ÖNCE ZORUNLU)

> `src/lib/license/keys.ts` ŞU AN DEV anahtarları içerir. Üretime çıkmadan önce:

1. `tools/license-cli` ile iki anahtar çifti üret (bkz. `tools/license-cli/README.md`):
   ```bash
   pnpm --filter @klinovax/license-cli keygen -- --out ~/.config/klinovax/issuer.jwk
   pnpm --filter @klinovax/license-cli keygen -- --out ~/.config/klinovax/receipt.jwk
   ```
2. Her komutun stdout'undaki **PUBLIC JWK**'yi `keys.ts`'teki ilgili sabite yapıştır.
3. `receipt.jwk` çıktısındaki base64'ü SaaS'ta `LICENSE_RECEIPT_PRIVATE_KEY` yap.
4. `issuer.jwk` → USB + fiziksel kasa (soğuk saklama). Sunucuya ASLA koyma.
5. Private JWK dosyalarını ASLA commit/e-posta/sohbete koyma.

## Telemetri & KVKK notu

Heartbeat, SaaS lisans sunucusuna şunları gönderir: `orgCount`, `staffCount`,
`appVersion`, `instanceId`, `hostname`. **Kişisel veri (hasta/personel PII)
GÖNDERİLMEZ** — yalnız toplam sayaçlar. Bu telemetri sözleşmede açıkça
belirtilmeli (kullanım denetimi + lisans uyum takibi amacı).

## Manuel uçtan-uca doğrulama (gerçek deploy kapısı)

Otomatik testler (durum makinesi/imza/enforcement/lisans-sunucusu, 89 test) +
`onprem-build` CI job kod tarafını kilitler. Gerçek compose deploy'unda elle:

1. `deploy/onprem/install.sh` → tüm servisler ayağa kalkar, `migrate deploy` geçer.
2. İlk süper-admin ile giriş → lisanssız → `/license`'a düşer.
3. `license.klv` yapıştır → aktivasyon → VALID → panel açılır.
4. Video yükle (MinIO) → oynat (presigned) → sınav akışı → PDF sertifika
   (Türkçe fontlar!) → mailpit'te e-posta.
5. Fixture lisanslarla: yakın-bitiş → WARN bandı; süresi dolmuş → yazma 403 /
   okuma OK; +8 gün → tam kilit, staff giremez, admin `/license`'a düşer,
   yenileme ≤60s'de açar.
6. `docker compose down && up` → veri kalıcı. Migration'lı yeni imajla yükseltme.

### Bilinen manuel-doğrulama gereken riskler
- **GoTrue self-host paritesi** (şifre/MFA/SSO akışları): tam auth smoke gerekir;
  SAML SSO on-prem v1'de kapalı.
- **Realtime self-host**: bildirim/presence/sınav kanalları smoke edilmeli
  (bildirimde polling fallback var).
- **Video dönüştürme**: on-prem'de atlanır, orijinal oynatılır (ffmpeg worker = v2).
