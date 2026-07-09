# KlinoVax Hospital LMS — On-Premise Kurulum

Bu paket, KlinoVax LMS'i **müşterinin kendi sunucusunda** çalıştırır. Tüm veri
(hasta/personel/eğitim) müşteri sunucusunda kalır; dışarıya **tek** bağlantı
Klinovax lisans doğrulamasıdır. Lisans olmadan sistem kullanılamaz.

## Mimari (tek `docker compose`)

| Servis | Görev |
|---|---|
| `app` | Next.js uygulaması (standalone) |
| `postgres` | Veritabanı + auth şeması (verinin tamamı burada) |
| `auth` (GoTrue) | Kimlik doğrulama (self-hosted Supabase Auth) |
| `realtime` | Bildirim/presence/sınav kanalları |
| `gateway` (Kong) | `/auth/v1/*` + `/realtime/v1/*` yönlendirme |
| `redis` + `srh` | Rate-limit, sınav sayaçları, önbellek (Upstash-REST uyumlu proxy) |
| `minio` | S3 uyumlu nesne deposu (video/belge) |
| `scheduler` | Cron işleri (Vercel Cron yerine, supercronic) |
| `mailpit` | Yerel SMTP (test); prod'da müşteri e-posta relay'i |

## Gereksinimler

- Linux sunucu (x86_64 veya arm64), Docker Engine 24+ ve `docker compose` v2
- 4 vCPU / 8 GB RAM / 50 GB disk (başlangıç önerisi; video hacmine göre artar)
- `node` (yalnız `install.sh`'ın JWT üretimi için; sunucuda kurulu değilse
  imajdan `docker run --rm klinovax/hospital-lms:onprem node ...` ile de yapılabilir)

## Kurulum (online — registry erişimi var)

```bash
cd deploy/onprem
# İmajı registry'den çek (erişim token'ı lisansla verilir)
docker pull klinovax/hospital-lms:onprem
./install.sh          # sırları üretir, .env yazar, stack'i başlatır
```

`install.sh` size public URL, ilk süper-admin e-postası ve lisans sunucusu
adresini sorar; kalan tüm sırları (DB şifresi, JWT, anahtarlar) rastgele üretir
ve `.env`'e yazar (`chmod 600`). İlk süper-admin şifresi ekrana basılır —
**güvenli saklayın, ilk girişte değiştirin**.

## Kurulum (offline — kapalı ağ)

Klinovax'ta paketleyip müşteriye tarball taşıyın:

```bash
# Klinovax tarafında (internet var):
deploy/onprem/build-offline-bundle.sh
# → deploy/onprem/dist/ altında imaj tarball'ı + compose + config

# Müşteri sunucusunda (internet yok):
docker load < klinovax-onprem-images.tar.gz
./install.sh
```

## Lisansı Etkinleştirme

1. `install.sh` sonrası uygulamaya girin (ilk süper-admin ile).
2. Sistem lisanssızsa otomatik `/license` ekranına düşersiniz.
3. Klinovax'tan aldığınız **`license.klv`** içeriğini yapıştırıp
   "Lisansı Etkinleştir"e basın.
4. İnternet varsa lisans sunucusuna otomatik bağlanır (periyodik doğrulama).
   İnternet yoksa Klinovax'ın gönderdiği **`receipt.klr`** (offline makbuz)
   dosyasını "Offline Makbuz Yükle" ile içeri alın.

### Kademeli kilit

- Bitişe **≤30 gün**: uyarı bandı + e-posta.
- Bitişte: **7 gün salt-okunur** (mevcut kayıtlar görünür, yeni eğitim/sınav yok;
  başlamış sınavlar tamamlanabilir).
- Sonrasında: **tam kilit** — yalnız `/license` ekranı açılır.
- İnternetsiz kurulumda makbuz yenilenmezse **tolerans süresi** (varsayılan 14 gün)
  sonunda kilit devreye girer.

## Güncelleme

> **Kapalı container kendini güncellemez** (imaj değişmez — air-gap için doğru). Güncelleme
> operatör-tetiklidir ve `update.sh` ile geri-dönülebilir yapılır.

**Önerilen yol — `update.sh` (yedek-önce + sağlık + oto-rollback):**

```bash
cd deploy/onprem
sha256sum -c SHA256SUMS                          # yeni bundle'ı doğrula (sneakernet bütünlüğü)
./update.sh klinovax-onprem-images.tar.gz        # AIR-GAP: yeni tarball
#   veya  ./update.sh --pull                     # KISITLI-ÇIKIŞ: registry'den çek
```

`update.sh` sırasıyla: **güncelleme-öncesi off-site yedeği ZORLAR** → yeni imajı yükler →
`docker compose up -d` (migration'lar entrypoint'te `prisma migrate deploy` ile otomatik) →
`/api/health` ile **sağlık poll** → **başarısızsa oto-rollback**:
- **Yeni migration YOKSA** → eski `APP_IMAGE`'e döner (`.env`'i geri yazar) + `up -d`.
- **Yeni migration UYGULANDIYSA** (şema ileri-yönlü, imaj geri alınamaz) → güncelleme-öncesi
  yedekten `restore-offsite.sh` ile otomatik geri yükler.

Sürüm bundle'daki `VERSION` dosyasından pinlenir (`:onprem-<ver>`); kurulu sürüm
`.installed-version`'da tutulur (müşteri-başına takip).

**Elle (ileri düzey).** `update.sh` kullanamıyorsanız: önce `./backup-volumes.sh`, sonra
`docker load < yeni-tarball` (veya `docker compose pull`), `.env`'de `APP_IMAGE`'i yeni pinli
tag'e çevir, `docker compose up -d`. Rollback için yukarıdaki iki durumu elle uygulayın —
**her güncelleme öncesi yedek ŞARTTIR** (şema-değiştiren güncellemede tek geri-dönüş yoludur).

## Yedekleme

Uygulama-içi cron (`/api/cron/backup`) MinIO'ya **şifreli** yazar — ama AYNI sunucuda.
Sunucu arızası/ransomware'de veri + yedek birlikte gider. Gerçek koruma için **off-site**:

```bash
cd deploy/onprem
./backup-volumes.sh /mnt/nas/klinovax-backups   # DEST: harici disk / NFS / rsync hedefi
```

`backup-volumes.sh` pg_dump + MinIO nesne deposunu DEST'e alır. **HOST crontab'ına** ekleyin
(konteyner-içi scheduler'a değil — Docker soketi gerekir), DEST'i sunucu-DIŞI bir mount yapın:

```
30 2 * * *  cd /opt/klinovax/deploy/onprem && ./backup-volumes.sh /mnt/nas/klinovax >> /var/log/klinovax-offsite.log 2>&1
```

**Alarm.** Yedek/yedek-doğrulama cron'u başarısız olursa `ADMIN_ALERT_EMAIL`'e e-posta atar
(install.sh sorar). Gerçek SMTP relay tanımlı DEĞİLSE (mailpit) alarm gitmez — prod'da
mutlaka kurum relay'i girin (aksi halde bozuk yedek fark edilmez).

**`.env`'i AYRI yedekleyin** — `ENCRYPTION_KEY`/`BACKUP_ENCRYPTION_KEY` kaybı **kalıcı veri
kaybıdır** (şifreli TC Kimlik alanları + şifreli yedekler açılamaz).

## Geri Yükleme (Restore)

**Senaryo A — uygulama-içi yedekten (aynı sunucu ayakta).** Süper-admin → `/super-admin/backups`
→ yedeği seç → geri yükle. `BACKUP_ENCRYPTION_KEY` `.env`'de aynı olmalı.

**Senaryo B — tam sunucu kaybı (off-site yedekten yeni sunucuya).** Betikli yol:

```bash
# 1) Yeni sunucuda ESKİ .env'i geri koy (install.sh'ı .env varken ÇALIŞTIRMA):
cd deploy/onprem
cp /güvenli/yer/.env .env                 # ESKİ anahtarlarla (BACKUP_ENCRYPTION_KEY şifreli yedeği çözer)

# 2) Off-site yedekten otomatik restore (şifre çözme + postgres + minio + sağlık):
OFFSITE_BACKUP_DIR=/mnt/nas/klinovax ./restore-offsite.sh
#   veya belirli dosyalar:  ./restore-offsite.sh db-YYYYMMDD-HHMMSS.sql.gz.enc minio-YYYYMMDD-HHMMSS.tar.gz.enc
```

`restore-offsite.sh` en yeni (veya verilen) yedeği bulur, `BACKUP_ENCRYPTION_KEY` ile çözer,
bütünlüğü ön-doğrular, PostgreSQL + MinIO'yu geri yükler ve `/api/health` ile doğrular.

> **Restore'u satıştan sonra DEĞİL, ilk kurulumda bir kez tatbik edin** — test edilmemiş
> yedek = yedek yok. Aktif sınav timer'ları/streak Redis'te tutulur, off-site yedeğe DAHİL DEĞİL.

## TLS ile kurulum (HTTPS)

Düz HTTP hastane LAN'ında oturum çerezleri + PII'yi AÇIK akıtır (KVKK) ve realtime/token-refresh
proxy'siz SESSİZCE kırıktır. **`install.sh` "TLS kurulsun mu?" diye sorar** (varsayılan Evet).

**Gömülü Caddy (önerilen — tamamen offline).** TLS seçilirse:
- Hostname sorulur (ör. `lms.hastane.local`) → `.env`: `PUBLIC_APP_URL=https://<host>`,
  `PUBLIC_STORAGE_URL=https://<host>:9443`, `COMPOSE_PROFILES=tls`, `SERVICE_BIND=127.0.0.1`.
- Caddy (`gateway/Caddyfile`) `tls internal` ile sertifikayı OFFLINE üretir (ACME/internet YOK).
- **443**: uygulama + `/auth/v1` + `/realtime/v1` (WebSocket) → gateway. **9443**: MinIO presigned
  (ayrı site; SigV4 imzası Host+path'e bağlı → path-prefix YOK, Host korunur).
- `SERVICE_BIND=127.0.0.1` → doğrudan 3000/8000/9000 portları LAN'a KAPALI; erişim yalnız HTTPS.
- İlk erişimde tarayıcı **iç-CA sertifika uyarısı** verebilir; kurum içinde Caddy iç-CA kök
  sertifikasını (`caddydata` volume: `/data/caddy/pki/authorities/local/root.crt`) istemci
  makinelere güvenilir olarak dağıtın.

**Kurum/kamu SM sertifikası.** `gateway/Caddyfile`'da `tls internal` yerine
`tls /etc/caddy/cert.pem /etc/caddy/key.pem` yapıp cert+key'i proxy servisine bind-mount edin.

> **Mixed-content tuzağı:** `PUBLIC_APP_URL` https, `PUBLIC_STORAGE_URL` http kalırsa video/dosya
> sessizce yüklenmez — install.sh TLS modunda ikisini de https yapar.

**Alternatif (harici proxy).** Kurumun kendi nginx/HAProxy'sini kullanacaksanız TLS'i "hayır"
yapıp `PUBLIC_*` URL'leri elle https ayarlayın; `/auth/`+`/realtime/` (WS upgrade) → :8000,
`/storage/` (Host korunur) → :9000, `/` → :3000 yönlendirin.

## Log rotasyonu

Uzun süre çalışan sunucuda konteyner logları diski doldurabilir. `.env` yanında bir
`daemon.json` (Docker) ile döndürün ya da compose'a servis-bazlı ekleyin:

```yaml
    logging:
      driver: json-file
      options: { max-size: "20m", max-file: "5" }
```

## Güvenlik notları

- `postgres`, `redis`, `minio(API)` yalnız iç ağdadır — dışa port AÇMAYIN.
- Uygulamayı TLS sonlandıran bir reverse proxy (nginx/Caddy) arkasına koyun.
- `.env` sırlarını versiyon kontrolüne EKLEMEYİN.
- Kaynak koruması: imaj minified/derlenmiş sunucu bundle'ı taşır, okunur `src/`
  göndermez — ancak bu **DRM değildir**, caydırıcılıktır. Asıl koruma lisans +
  sözleşmedir.

## Sorun giderme

```bash
docker compose logs -f app        # uygulama logları
docker compose logs -f app | grep license   # lisans durumu
curl -s http://localhost:3000/api/health     # sağlık (public özet)
```

Lisans durumu `/api/health` yanıtında (yetkili istekte) `license.state` alanında
görünür. Sorun için Klinovax destek ekibiyle iletişime geçin.

**Sağlık izleme:** ayrıntılı servis durumu için yetkili istek kullanın
(`curl -s -H "x-health-secret: <HEALTH_CHECK_SECRET>" http://localhost:3000/api/health`).
Secret'sız public uç artık **DB erişilebilirliğini** kontrol eder (Docker healthcheck bunu
kullanır; DB düşerse 503 → konteyner restart) ama servis ayrıntısı sızdırmaz.

## Operasyon notları (ZORUNLU — atlanırsa sessiz arıza)

- **Alarm zinciri:** Yedek/verify-backup arızası e-postası **yalnızca** `ADMIN_ALERT_EMAIL`
  dolu **ve** GERÇEK bir SMTP relay girildiğinde çıkar. Varsayılan `mailpit` postaları YAKALAR
  ama GÖNDERMEZ → arıza sessiz kalır (44-günlük sessiz-yedek olayı). Prod'da mutlaka kurum
  relay'i + alarm e-postası girin. Ek güvence: host cron'unda ölü-adam kontrolü —
  `find <offsite> -name 'db-*.sql.gz' -mtime -1 | grep -q . || <uyar>`.
- **NTP / saat:** Lisans saat-oynatma tespiti sistem saatine dayanır. Sunucu saatinin >24 saat
  geriye/ileriye sıçraması lisansı yanlışlıkla LOCKED yapabilir → **NTP senkron açık** olsun
  (kapalı ağda yerel NTP sunucusu).
- **Parola rotasyonu:** `POSTGRES_PASSWORD` ilk boot'ta alt-rollere (GoTrue/Realtime) yazılır
  (db-init tek-seferlik). Sonradan `.env`'de değiştirmek TEK BAŞINA yetmez → GoTrue/Realtime
  28P01 verir. Rotasyon: `.env`'i güncelle, sonra çalışan postgres'te alt-rolleri de senkronla:
  `docker compose exec postgres psql -U supabase_admin -c "ALTER USER supabase_auth_admin PASSWORD '<yeni>'; ALTER USER supabase_admin PASSWORD '<yeni>'; ALTER USER authenticator PASSWORD '<yeni>'; ..."`
  ardından `docker compose up -d --force-recreate`.
- **Disk şifreleme (at-rest):** Nesne deposu (video/belge) `miniodata` volume'ünde **şifresiz**
  durur (MinIO KMS'siz). Hasta verisi için **disk-seviyesi şifreleme** (LUKS/dm-crypt) önerilir.
  Yedekler zaten uygulama katmanında AES-256-GCM ile şifreli. (MinIO KMS kurup `S3_SSE=AES256`
  ile object-SSE de açılabilir — ama KMS anahtarı kaybı = nesne kaybı, ayrı DR yükü.)
- **Realtime (bildirim/canlı-sınav) + reverse proxy:** Tarayıcı realtime/token-yenileme, `/auth/v1`
  ve `/realtime/v1` yollarının **aynı origin'den gateway:8000'e proxy'lenmesini** gerektirir
  (README'deki nginx örneği). Proxy'siz düz `localhost:3000` kurulumunda bu kanallar sessizce
  çalışmaz; üretimde reverse proxy ŞARTTIR.

## Geri yükleme (restore) uyarıları

- **MinIO tar'ını DURDURULMUŞ minio'ya aç:** `docker compose stop minio` → tar'ı `miniodata`
  volume'üne aç → `docker compose start minio`. Çalışan minio'ya açmak veri bozar.
- **redisdata yedek DIŞIDIR:** tam-restore'da açık sınav timer'ları ve streak sayaçları sıfırlanır
  (DB'deki attempt'ler korunur). Personel "sınavım uçtu" derse restore'a bağlı olabilir.
- **Anahtar custody:** `ENCRYPTION_KEY`/`BACKUP_ENCRYPTION_KEY` kaybı = kalıcı veri/yedek kaybı —
  `.env`'i sırlardan AYRI, güvenli yerde saklayın.
