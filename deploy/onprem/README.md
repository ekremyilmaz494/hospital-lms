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

**Önce yedek al** (migration'lar ileri-yönlüdür; kötü sürümden dönüş için gerekir):

```bash
cd deploy/onprem
./backup-volumes.sh /mnt/nas/klinovax-backups   # DB + dosyalar (aşağıya bkz.)
docker compose pull        # yeni imaj (offline'da: docker load < yeni-tarball)
docker compose up -d       # migration'lar entrypoint'te otomatik uygulanır
```

Migration'lar konteyner açılışında `prisma migrate deploy` ile idempotent çalışır.

**Sürüm sabitleme (önerilir).** Varsayılan `:onprem` tag'i değişkendir (her `pull` en sonu
getirir). Hangi sürümde olduğunuzu bilmek + geri dönebilmek için `.env`'de sabit sürüm pinleyin:

```bash
# .env
APP_IMAGE=klinovax/hospital-lms:onprem-1.4.2   # sabit sürüm tag'i
```

**Geri alma (rollback).** Şema değiştiren bir güncelleme sonrası:

1. Sorun yalnız uygulama kodundaysa (şema aynı): `.env`'de `APP_IMAGE`'i önceki sürüme
   çevir → `docker compose up -d`.
2. Migration da geldiyse: eski imaja dönmek TANIMSIZDIR (Prisma ileri-yönlü). Güncelleme
   ÖNCESİ alınan yedeğe **Geri Yükleme** (aşağı) yap → sonra eski imajı başlat.
   Bu yüzden her güncelleme öncesi yedek ŞARTTIR.

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

**Senaryo B — tam sunucu kaybı (off-site yedekten yeni sunucuya).**

```bash
# 1) Yeni sunucuda stack'i kur ama ESKİ .env'i geri koy (yeni üretME):
cd deploy/onprem
cp /güvenli/yer/.env .env        # ESKİ anahtarlarla — install.sh'ı .env varken çalıştırma
docker compose up -d postgres minio    # önce veri servisleri
sleep 20

# 2) PostgreSQL dump'ını geri yükle:
gunzip -c /mnt/nas/klinovax/db-YYYYMMDD-HHMMSS.sql.gz \
  | docker compose exec -T postgres psql -U postgres -d postgres

# 3) MinIO nesne deposunu geri yükle (dosyalar/videolar):
docker run --rm -v klinovax-onprem_miniodata:/data \
  -v /mnt/nas/klinovax:/backup alpine \
  sh -c 'cd /data && tar xzf /backup/minio-YYYYMMDD-HHMMSS.tar.gz'

# 4) Tüm stack'i başlat + doğrula:
docker compose up -d
docker compose ps                         # 10/10 healthy?
curl -s http://localhost:3000/api/health  # license.state + servisler
```

> Restore'u satıştan sonra DEĞİL, ilk kurulumda bir kez **tatbik edin** — test edilmemiş
> yedek = yedek yok. Örnek dosya adlarını (`YYYYMMDD-HHMMSS`) gerçek yedeğinizle değiştirin.

## TLS ile kurulum (reverse proxy)

Tarayıcı 3 endpoint'e erişir: **app** (3000), **gateway** (8000, auth+realtime/ws),
**MinIO** (9000, presigned). Hepsini TLS sonlandıran bir reverse proxy arkasına alın ve
`.env`'de PUBLIC URL'leri **https** yapın (`PUBLIC_APP_URL`, `PUBLIC_STORAGE_URL`).

> **Mixed-content tuzağı:** app https, `PUBLIC_STORAGE_URL` http kalırsa video/dosya
> sessizce yüklenmez. İkisini birlikte https yapın.

Örnek nginx (tek domain, path-tabanlı — CSP on-prem'de şema-bazlı olduğundan çalışır):

```nginx
server {
  listen 443 ssl;
  server_name lms.hastane.local;
  ssl_certificate     /etc/ssl/hastane/fullchain.pem;   # kurum sertifikası
  ssl_certificate_key /etc/ssl/hastane/privkey.pem;

  location /auth/     { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; }
  location /realtime/ {                                   # WebSocket (realtime bildirimler)
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
  location /storage/  { proxy_pass http://127.0.0.1:9000; proxy_set_header Host $host; client_max_body_size 512m; }
  location /          { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; client_max_body_size 512m; }
}
```

Self-signed kurum CA kullanıyorsanız istemci makinelerin bu CA'ya güvenmesi gerekir.

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
