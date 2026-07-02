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

```bash
cd deploy/onprem
docker compose pull        # yeni imaj (offline'da: docker load < yeni-tarball)
docker compose up -d       # migration'lar entrypoint'te otomatik uygulanır
```

Migration'lar konteyner açılışında `prisma migrate deploy` ile idempotent çalışır.

## Yedekleme

- Uygulama içi otomatik yedek cron'u MinIO'ya şifreli yazar (`/api/cron/backup`).
- Kalıcı diskler: `pgdata` (Postgres), `miniodata` (dosyalar), `redisdata`.
  Docker volume yedeği alın:
  ```bash
  docker run --rm -v klinovax-onprem_pgdata:/data -v "$PWD":/backup alpine \
    tar czf /backup/pgdata-$(date +%F).tar.gz -C /data .
  ```
- `.env` dosyasını da yedekleyin — `ENCRYPTION_KEY` kaybı **kalıcı veri kaybıdır**
  (şifreli TC Kimlik alanları açılamaz).

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
