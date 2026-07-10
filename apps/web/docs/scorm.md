# SCORM Desteği

Harici authoring araçlarıyla (Articulate, iSpring, Adapt vb.) üretilmiş SCORM
paketlerinin hastane LMS'ine yüklenmesi, saklanması, oynatılması ve raporlanması
için mimari + operasyon rehberi.

## Genel bakış

- **SCORM 1.2 + SCORM 2004** desteklenir; sürüm `imsmanifest.xml`'den otomatik
  tespit edilir (`src/lib/scorm/manifest.ts`).
- Yüklenen paket **normal bir `Training`'e** dönüşür (`category='scorm'`) — bu
  sayede standart atama, ilerleme, sertifika ve bakanlık rapor akışına aynen girer;
  ayrı bir "SCORM modülü" değil, mevcut eğitim modelinin bir varyantıdır.
- Klasik video+sınav eğitimlerinden farkı: içerik kendi kendini yürütür ve durumunu
  (geçti/kaldı, skor, süre) SCORM runtime üzerinden bildirir.

## İngest pipeline (yükleme)

Vercel fonksiyon gövdesi 4.5MB ile sınırlı; SCORM zip'leri bunu kolayca aşar. Bu
yüzden yükleme **iki adımlı presign** ile fonksiyondan geçmeden yapılır:

1. **Presign** — `POST /api/admin/scorm/presign` (body `{fileName, fileSize}`):
   `.zip` uzantısı + boyut tavanı + depolama kotası doğrulanır; `scorm/{orgId}/_tmp/{uuid}.zip`
   için presigned PUT URL döner (`uploadUrl`, `tempKey`).
2. **Doğrudan S3 PUT** — tarayıcı zip'i doğrudan S3'e yükler (fonksiyon baypas).
3. **Process** — `POST /api/admin/scorm/upload` (body `{tempKey, title}`): zip'i indirir,
   `jszip` ile açar, `imsmanifest.xml`'i `fast-xml-parser` ile parse eder (sürüm +
   launch href + masteryscore), dosyaları `scorm/{orgId}/{trainingId}/` altına çıkarır,
   `Training`'i SCORM alanlarıyla yayınlar (`isActive=true`, `publishStatus='published'`).
   Herhangi bir hatada kısmi objeler + taslak Training + geçici zip **geri alınır**.

- Bu route uzun sürebildiği için `maxDuration=300`.
- Boyut tavanı env `SCORM_MAX_PACKAGE_MB` (default **150**; on-prem'de artırılabilir,
  `src/lib/scorm/config.ts`).
- `masteryscore` varsa `Training.passingScore`'a yazılır (1.2 `adlcp:masteryscore`;
  2004 `minNormalizedMeasure`×100).

## Depolama düzeni (S3)

| Amaç | Anahtar |
|---|---|
| Geçici zip (presign) | `scorm/{orgId}/_tmp/{uuid}.zip` |
| Çıkarılmış içerik | `scorm/{orgId}/{trainingId}/...` |

`Training` satırındaki SCORM alanları:
- `scormManifestPath` — `imsmanifest.xml`'in **tam S3 anahtarı** (içerik base'i buradan türetilir).
- `scormEntryPoint` — launch href, **manifest dizinine göreli** (ör. `index.html`).
- `scormVersion` — `'1.2'` | `'2004'`.

Zip-slip guard (`sanitizeEntryPath`) hem ingest'te hem serving'de uygulanır; `..`,
mutlak yol ve sürücü harfi reddedilir. Zip-bomb guard: ≤5000 girdi ve ≤1GB açılmış boyut.

## Çalışma zamanı (player + tracking)

- Player: `/exam/{trainingId}/scorm`. SCORM içeriği bir iframe içinde çalışır ve
  `window.API` (1.2) ya da `window.API_1484_11` (2004) global'ini arar — adaptör
  `src/lib/scorm/api-factory.ts`'te (CMI eşlemesi saf, test edilebilir fonksiyonlarda).
- İçerik **aynı origin'den** `/api/exam/{trainingId}/scorm/content/[...path]` üzerinden
  sunulur (S3'ten stream, **Range/206 destekli** — gömülü mp4/mp3 seek için).
- Tracking: `/api/exam/{trainingId}/scorm/tracking` (GET son attempt · POST oturum başlat ·
  PATCH CMI commit). Tamamlama tamamen istemci-raporlu olduğundan **30sn anti-cheat**
  eşiği vardır (`MIN_SCORM_ENGAGEMENT_SECONDS`): eşik altında geçiş + sertifika ÜRETİLMEZ,
  yalnız log bırakılır. Geçince `TrainingAssignment` state machine ile `passed`'e taşınır
  ve `Certificate` üretilir (ExamAttempt varsa ona, yoksa `ScormAttempt`'e bağlanır).

## Güvenlik / güven sınırı

SCORM içeriği **admin tarafından yüklenen HTML/JS**'tir ve SCORM API keşfi için
uygulamayla **aynı origin'de** çalışmak zorundadır — bu bilinçli, kabul edilmiş bir
risktir. Azaltıcılar:

- Yükleme **yalnız admin** + **org-scope** + kota + feature-gate.
- İngest'te zip-slip / zip-bomb guard + dosya-tipi allowlist (`scormContentType`).
- Serving'de org izolasyonu + **atama sahipliği** (IDOR koruması: aynı org'daki ama
  atanmamış personel dosya çekemez; `staff` için zorunlu, admin/super_admin önizler).
- Framing header'ları **yalnız content path'inde** gevşetilir (`next.config.ts`:
  `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'` → yalnız kendi player
  sayfamız çerçeveler). Uygulamanın geri kalanı `DENY` + `frame-ancestors 'none'`.
- Bulut çok-kiracılı ortamda ileride izole-origin (ayrı content domain) düşünülebilir.

## Feature gate

`SubscriptionPlan.hasScormSupport` → `checkFeature(orgId, 'scormSupport')`
(`src/lib/feature-gate.ts`). Kapalıysa presign / upload / content / tracking route'ları
403 döner ve **sidebar menüsü** (`Admin → SCORM Eğitimleri`, `/admin/scorm`) gizlenir
(`sidebar-config.ts` `requiresFeature: 'scormSupport'`).

## Doğrulama

- Kod: `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` temiz olmalı.
- Uçtan uca: `/admin/scorm`'dan paket yükle → personele ata → player'ı aç → tamamla →
  `ScormAttempt` + `Certificate` üretimini ve bakanlık ihracını doğrula.
