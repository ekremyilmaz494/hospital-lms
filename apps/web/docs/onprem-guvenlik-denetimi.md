# On-Prem Lisans Sistemi — Güvenlik Denetimi (2026-07-02)

Çok-ajanlı bağımsız denetim (8 boyut bulucu → 6 saldırı zinciri → adversaryal çürütme →
adjudikasyon). Amaç: paket hastane müşterilerine **kendi sunucularında barındırılan hizmet**
olarak satılmadan önce güvenli mi? İki eksen: (a) gelir koruma (lisanssız çalıştırılamasın),
(b) hastane veri güvenliği + KVKK.

## Karar: **GO_WITH_FIXES**

**S0 (kritik/anında-sömürülür) YOK.** Koşulsuz lisans-bypass yok. Kripto çekirdeği sağlam.
Onaylanan bulguların çoğu **güvenli-varsayılan deploy sertleştirmesi** + **derinlemesine-savunma**
boşlukları + zaten-bilinen üretim anahtar töreni TODO'su. Yayın için: aşağıdaki S1/S2 sertleştirmeler
+ üretim anahtar töreni tamamlanmalı; "klon/reset" sınırı sözleşmeyle + sunucu-taraf izlemeyle
yönetilmeli.

Sayılar: 23 ham bulgu · 6 saldırı zinciri · 29 aday · adversaryal doğrulamadan **23 hayatta**
(13 CONFIRMED). Sentez oturum-limiti nedeniyle elle yapıldı.

## Temiz çıkanlar (bağımsız yeniden doğrulandı — GÜÇLÜ)
- **İmza:** `compactVerify` + çift-pinli EdDSA (`importJWK(...,'EdDSA')` + `algorithms:['EdDSA']`),
  alg-confusion (HS256/none) kapalı ve testli (`verify.ts:44`, `verify.test.ts:94-101`).
- **Gömülü özel anahtar YOK** (`grep '"d":'` boş); test anahtarları runtime üretiliyor.
- **DB tamper → NO_LICENSE:** lisans/makbuz JWT'si her okumada yeniden imza-doğrulanıyor
  (`store.ts:31,41`).
- **Makbuz→lisans bağı** çift katman (`state.ts:96-98`, `store.ts:110-112`) — başka kurulumun
  makbuzu ne açar ne kilitler.
- **Bulut paritesi:** `isOnPrem()` false iken lisans katmanı no-op (`cache.ts:32`), state.ts'e
  girmiyor. Bulut regresyonu bulunmadı.
- **API kapısı:** `licenseApiGate` `withApiHandler` içinde, super_admin dahil; 0 Server Action
  (bypass yüzeyi dar).

---

## Bulgular (severity × verdict)

### S1 — Yüksek
| # | Bulgu | Dosya | Verdict |
|---|---|---|---|
| A | Mailpit UI (8025) host'a (0.0.0.0) **kimlik-doğrulamasız** açık + varsayılan mail hedefi → LAN'daki herkes **parola-sıfırlama linklerini** ve personel PII'sini okur (KVKK) | `deploy/onprem/docker-compose.yml:238` | **CONFIRMED** |
| L | Air-gap kurulumda offline-grace + saat-watermark **kutu sahibince sıfırlanabilir** (fresh-volume / eski-backup restore / saat-geri) → süresi geçmiş lisansla çalışma + uzaktan iptali atlatma | `store.ts:75` | PLAUSIBLE (tasarım sınırı) |

### S2 — Orta (derinlemesine savunma / güvensiz-varsayılan)
| # | Bulgu | Dosya | Verdict |
|---|---|---|---|
| J | On-prem build hâlâ **DEV/TEST public anahtarlarını** güven-çıpası taşıyor; dev-key'i reddeden build/runtime guard yok → üretim töreni atlanırsa dev private anahtarlı lisans kabul edilir | `keys.ts:25` | CONFIRMED |
| K | Saat-geri tespitinin dayanağı `clockWatermark`/`activatedAt` **imzasız düz kolon**; tek SQL UPDATE ile backstop etkisiz. store.ts yorumu bunu yanlış anlatıyor | `store.ts:10` | CONFIRMED |
| O | admin & staff layout'ları LOCKED'ta **sunucu-tarafı `/license` redirect'i yapmıyor** (yalnız exam yapıyor) — kilitli panel kabuğu render olur (veri API gate'te 403) | `admin/layout.tsx:16` | CONFIRMED |
| M | **Sunucu-tarafı seat/instance limiti yok** — tek lisans N kuruluma aktive/heartbeat edilebilir; klon tespiti yalnız pasif log (aktif alarm/blok yok) | `activate/route.ts:65` | CONFIRMED |
| N | Rate-limit anahtarı **spoof-edilebilir XFF**'in en solundan türüyor → 10/s, 30/s tavanları aşılır; imza-doğrulaması rate-limit'ten önce koştuğu için CPU-DoS | `activate/route.ts:32` | CONFIRMED |
| B | MinIO **yönetim konsolu (9001)** varsayılan host'a (0.0.0.0) açık; README aksini iddia eder | `docker-compose.yml:201` | CONFIRMED |
| C | Hiçbir konteynerde sertleştirme yok — tümü root, `no-new-privileges`/`read_only`/`cap_drop`/kaynak-limit yok | `docker-compose.yml` | CONFIRMED |
| D | Airgap paketinde **4 imaj pinlenmemiş `:latest`** (minio, mc, mailpit, srh) — tekrarlanamaz + tedarik-zinciri riski | `docker-compose.yml:190` | CONFIRMED |
| E | `.dockerignore` `.env.example`/`.env.production.reference`/`*.klv`/`*.pem` hariç tutmuyor; `COPY . .` build context'e alıyor | `.dockerignore` | PLAUSIBLE |
| F | `.env.example` verbatim kopyalanırsa `CHANGE_ME` sırları **boot'u durduran runtime guard yok** → bilinen JWT_SECRET ile service_role forge + RLS bypass | `.env.example:25` | PLAUSIBLE |

### S3 — Düşük (doğruluk / operasyon)
| # | Bulgu | Dosya | Verdict |
|---|---|---|---|
| P | `READONLY_WRITE_EXEMPT` regex'i sona-sabitlenmemiş — ileride eklenecek `/api/exam/*` alt-rotaları istemeden yazma-muaf olabilir | `enforcement.ts:38` | CONFIRMED |
| I | Kong gateway auth-plugin'siz — GoTrue admin API (`/auth/v1/admin/*`) 8000 üzerinden ulaşılabilir; yalnız GoTrue'nun kendi service_role kontrolüne güveniliyor | `gateway/kong.yml:5` | CONFIRMED |
| H | `install.sh` anon/service_role JWT'lerini **10 yıllık** exp ile üretiyor — uzun ömürlü, iptali JWT_SECRET rotasyonu gerektirir | `install.sh:44` | CONFIRMED |
| G | `entrypoint.sh` bootstrap hatasını **yutuyor** (fail-open) — gerçek hata idempotent-atlamadan ayırt edilemez, süper-admin'siz sessiz boot | `entrypoint.sh:38` | CONFIRMED |

---

## Bu turda düzeltilenler (CONFIRMED S1/S2 + net güvenli-varsayılan; bulut-nötr)
- **A/B** Mailpit UI + MinIO konsolu → `127.0.0.1`'e bind (LAN'a kapalı; erişim SSH tüneli).
- **D** `:latest` imajlar sabit sürüme pinlendi (minio `RELEASE.2025-09-07T16-13-09Z`,
  mc `RELEASE.2025-08-13T08-35-41Z`, mailpit `v1.30.3`, srh `0.0.10`).
- **C** Tüm servislere `security_opt: [no-new-privileges:true]` (YAML anchor).
- **E** `.dockerignore` `.env.*` + `*.klv`/`*.klr`/`*.pem`/`*.jwk`/`*.key` kapsadı.
- **F** `entrypoint.sh` boot'ta `CHANGE_ME*`/boş/kısa kritik sırları reddediyor (fail-closed).
- **G** `entrypoint.sh` gerçek bootstrap hatasında fail-closed + gateway-ready best-effort bekleme.
- **J** `keys.ts` `usingDevLicenseKeys()` + `verify.ts` guard: üretim+on-prem'de DEV placeholder
  anahtarlarla doğrulamayı reddeder (fail-closed → NO_LICENSE). CI/dev kaçışı: `ALLOW_DEV_LICENSE_KEYS=true`.
- **K** `store.ts` yanıltıcı yorum düzeltildi (watermark/activatedAt imza kapsamı DIŞINDA; sınır dürüstçe yazıldı).
- **P** `READONLY_WRITE_EXEMPT` regex'i alt-segment sınırına sabitlendi (`(?:$|[/?])`).

## Sonraki tur / karar gerektiren (raporlandı, bu turda DEĞİL)
- **O** admin/staff layout'ları **client component** — exam gibi sunucu-`redirect('/license')`
  eklemek layout'ları server'a taşımayı (riskli refactor) gerektirir. Mevcut kontroller yeterli
  ve fix bekletilebilir: (1) API kapısı kilitliyken TÜM veriyi 403'ler (asıl kontrol), (2)
  `LicenseBanner` LOCKED/NO_LICENSE'ta client redirect yapar, (3) middleware sentinel çerezi.
  Kalan boşluk yalnız kozmetik kabuk render'ı; veri sızıntısı yok.
- **M (gelir koruma önceliği)** Sunucu-taraf seat/instance tavanı + super-admin aktif alarm.
  `License` modeline `maxInstances` + heartbeat'te aşım politikası (blok mu alarm mı — ticari karar).
- **N** Rate-limit anahtarını güvenilir IP'den türet + `jti` bazlı ikinci tavan (SaaS-taraf, dikkatli).
- **L** Fresh-volume/backup-restore/saat-reset kutu sahibine karşı **tam engellenemez** (DRM değil);
  gerçek kontrol M (online seat izleme) + sözleşme. Dürüstçe dokümante et.
- **I** Kong admin uçlarını gateway'de key-auth ile kısıtla veya iç ağa hapset.
- **H** JWT ömrünü makullendir veya dokümante rotasyon prosedürü ekle.
- **K-derin** Watermark'ı dış-imzalı zaman tabanına bağla (kutu sahibi tüm sırları tuttuğu için
  sınırlı fayda — M ile birlikte değerlendir).

## Kod-dışı üretim kapıları (ZORUNLU)
1. **Üretim anahtar töreni** — `keys.ts` DEV anahtarlı; offline üret, public'i göm, receipt private'ı
   SaaS env'e, issuer private'ı soğuk saklamaya (`apps/web/docs/onprem-lisans.md`).
2. **KVKK/telemetri sözleşme maddesi** — heartbeat `orgCount/staffCount/instanceId/hostname` gönderir
   (PII/PHI YOK); sözleşmede açıkça belirtilmeli.
3. **Gerçek-makine compose smoke** — GoTrue auth paritesi + Realtime + video/PDF/e-posta.
