#!/usr/bin/env bash
# KlinoVax on-prem kurulum — sırları üretir, .env yazar, stack'i başlatır.
# Kullanım: ./install.sh   (deploy/onprem/ içinden)
set -euo pipefail
cd "$(dirname "$0")"
umask 077   # .env sır içerir → yaratılış anından itibaren yalnız sahibi okusun (0600)

log()  { printf '\033[0;36m[install]\033[0m %s\n' "$*"; }
err()  { printf '\033[0;31m[install] HATA:\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[0;33m[install] UYARI:\033[0m %s\n' "$*"; }

# Pinli imaj tag'i — bundle'daki VERSION dosyasının ilk satırından (build-offline-bundle.sh
# damgalar); yoksa hareketli :onprem'e düş. Hem node-from-image fallback'i hem .env APP_IMAGE bunu kullanır.
if [ -f VERSION ]; then
  APP_IMAGE_REF="$(head -1 VERSION)"
else
  APP_IMAGE_REF="klinovax/hospital-lms:onprem"
fi

# ── Önkoşullar ──
command -v docker >/dev/null 2>&1 || { err "docker bulunamadı."; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose (v2) bulunamadı."; exit 1; }
command -v openssl >/dev/null 2>&1 || { err "openssl bulunamadı (sır üretimi için gerekli)."; exit 1; }
# NOT: node yalnızca .env İLK üretilirken (ANON/SERVICE JWT mint) gerekir. Host'ta yoksa
# app imajından çalıştırılır (air-gap: imaj 'docker load' ile yüklü) → burada HARD-FAIL YOK.

# ── Host ön-kontrolü (Docker daemon, bundle bütünlüğü, NTP/saat, disk, at-rest) ──
preflight_host() {
  docker info >/dev/null 2>&1 || { err "Docker daemon çalışmıyor (ör. 'sudo systemctl start docker')."; exit 1; }

  # Bundle bütünlüğü — SHA256SUMS varsa transfer bozulmasını docker load ÖNCESİ yakala.
  if [ -f SHA256SUMS ] && command -v sha256sum >/dev/null 2>&1; then
    log "Bundle bütünlüğü doğrulanıyor (SHA256SUMS)…"
    sha256sum -c SHA256SUMS >/dev/null 2>&1 || { err "SHA256 doğrulaması BAŞARISIZ — bundle transferi bozuk/eksik. Tekrar kopyalayın, yüklemeyin."; exit 1; }
    log "  → bundle bütünlüğü tamam."
  fi

  # NTP/saat senkronu — lisans saat-geri tespiti (>24s) sistem saatine dayanır; senkronsuz
  # sunucuda saat sıçraması lisansı 'clock_tampering' ile LOCKED yapar = TOPYEKÛN KESİNTİ.
  if command -v timedatectl >/dev/null 2>&1; then
    if [ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null)" = "yes" ]; then
      log "NTP senkronu: tamam."
    else
      warn "Sistem saati NTP ile senkron DEĞİL. Kapalı ağda YEREL bir NTP sunucusuna bağlayın —"
      warn "  aksi halde saat kayması lisansı 'clock_tampering' ile kilitleyip TÜM sistemi durdurabilir."
    fi
  else
    warn "timedatectl yok — saat/NTP senkronu doğrulanamadı. Sunucu saatinin doğru+senkron olduğundan EMİN olun (lisans saat-geri kilidi riski)."
  fi

  # Disk (video-ağırlıklı LMS; ≥50GB önerilir).
  local free_gb
  free_gb="$(df -Pk . 2>/dev/null | awk 'NR==2{printf "%d", $4/1024/1024}')"
  if [ -n "$free_gb" ] && [ "$free_gb" -lt 50 ] 2>/dev/null; then
    warn "Boş disk ~${free_gb}GB (<50GB önerilir). MinIO video büyümesi diski doldurursa postgres kesintiye girer."
  fi

  # RAM (≥8GB önerilir — 11 servis + Next.js).
  local ram_gb
  ram_gb="$(awk '/MemTotal/{printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo '')"
  if [ -n "$ram_gb" ] && [ "$ram_gb" -lt 8 ] 2>/dev/null; then
    warn "Toplam RAM ~${ram_gb}GB (<8GB önerilir); yük altında yetersiz kalabilir."
  fi

  # Port çakışması — YALNIZ fresh kurulumda (re-install'da kendi stack'imiz zaten dinler → false-positive).
  if [ ! -f .env ] && command -v ss >/dev/null 2>&1; then
    local p
    for p in 3000 8000 9000; do
      ss -ltnH "sport = :$p" 2>/dev/null | grep -q LISTEN && warn "Port $p zaten kullanımda — kurulum çakışabilir (başka servis mi çalışıyor?)."
    done
  fi

  # KVKK at-rest hatırlatması (güvenilir otomatik tespit yok → uyarı).
  warn "KVKK: veri diskinin (Docker volume'leri + off-site yedek) at-rest ŞİFRELİ (LUKS/dm-crypt) olduğundan emin olun."
}
preflight_host

if [ -f .env ]; then
  log ".env zaten var — üzerine yazılmayacak. Yeniden üretmek için .env'i silin."
  chmod 600 .env  # elle 'cp .env.example .env' ile 0644 kopyalanmış olabilir — izinleri düzelt
else
  log "Sırlar üretiliyor ve .env yazılıyor…"

  rand()   { openssl rand -hex 24; }
  randb64() { openssl rand -base64 32 | tr -d '\n'; }

  # Aşağıdaki atamalar rastgele ÜRETİM (literal sır DEĞİL) — scanner false positive.
  # DİKKAT: her sırrın TÜKETİCİSİNİN beklediği KESİN format farklıdır — üreticiyi ona göre seç:
  #   ENCRYPTION_KEY   → base64(32 byte)  (crypto.ts: Buffer.from(k,'base64').length===32)
  #   BACKUP_ENC_KEY   → 64 hex karakter  (backup-crypto.ts: k.length===64, Buffer.from(k,'hex'))
  #   REALTIME_ENC_KEY → TAM 16 karakter  (Realtime DB_ENC_KEY AES-128)
  POSTGRES_PASSWORD="$(rand)"                     # secret-scanner-disable-line
  JWT_SECRET="$(openssl rand -hex 32)"           # secret-scanner-disable-line (64 hex = 32 byte)
  MINIO_ROOT_PASSWORD="$(rand)"                  # secret-scanner-disable-line
  SRH_TOKEN="$(rand)"                            # secret-scanner-disable-line
  CRON_SECRET="$(rand)"                          # secret-scanner-disable-line
  ENCRYPTION_KEY="$(randb64)"                    # secret-scanner-disable-line (base64 → 32 byte)
  BACKUP_ENCRYPTION_KEY="$(openssl rand -hex 32)" # secret-scanner-disable-line (64 hex ZORUNLU — backup-crypto.ts base64 KABUL ETMEZ)
  HEALTH_CHECK_SECRET="$(rand)"                  # secret-scanner-disable-line
  REALTIME_ENC_KEY="$(openssl rand -base64 12 | tr '+/' '-_')" # secret-scanner-disable-line (TAM 16 char, 96-bit; Realtime AES-128)
  REALTIME_SECRET_KEY_BASE="$(openssl rand -hex 32)" # secret-scanner-disable-line
  ONPREM_ADMIN_PASSWORD="$(rand)"                # secret-scanner-disable-line

  # node: host'ta varsa onu, yoksa app imajından çalıştır (air-gap: imaj docker load ile yüklü).
  # ÖNEMLİ: imajın ENTRYPOINT'i entrypoint.sh olduğundan --entrypoint node ile ezilir.
  if command -v node >/dev/null 2>&1; then
    run_node() { node "$@"; }
  elif docker image inspect "$APP_IMAGE_REF" >/dev/null 2>&1; then
    log "host'ta node yok → JWT'ler app imajından üretilecek ($APP_IMAGE_REF)."
    run_node() { docker run --rm --entrypoint node "$APP_IMAGE_REF" "$@"; }
  else
    err "node bulunamadı VE app imajı ($APP_IMAGE_REF) yüklü değil — JWT üretilemez."
    err "Önce 'docker load -i klinovax-onprem-images.tar.gz' ile imajı yükleyin, sonra tekrar çalıştırın."
    exit 1
  fi

  # Supabase anon/service_role JWT'leri (HS256, JWT_SECRET ile imzalı).
  gen_jwt() {
    run_node -e '
      const c=require("crypto");
      const secret=process.argv[1], role=process.argv[2];
      const b64=(o)=>Buffer.from(JSON.stringify(o)).toString("base64url");
      const now=Math.floor(Date.now()/1000);
      const h=b64({alg:"HS256",typ:"JWT"});
      const p=b64({role,iss:"supabase",iat:now,exp:now+60*60*24*3650});
      const s=c.createHmac("sha256",secret).update(h+"."+p).digest("base64url");
      process.stdout.write(h+"."+p+"."+s);
    ' "$JWT_SECRET" "$1"
  }
  ANON_KEY="$(gen_jwt anon)"
  SERVICE_ROLE_KEY="$(gen_jwt service_role)"

  # ── TLS (HTTPS) — KVKK: düz HTTP LAN'da PII/oturum sızdırır; ayrıca realtime proxy'siz KIRIK ──
  SERVICE_BIND="0.0.0.0"; COMPOSE_PROFILES=""; CADDY_MAIN_SITE=""; CADDY_STORAGE_SITE=""
  HTTPS_PORT=443; HTTPS_STORAGE_PORT=9443
  read -rp "TLS/HTTPS (gömülü Caddy reverse-proxy) kurulsun mu? [E/h]: " TLS_ANS
  if [ "${TLS_ANS:-E}" != "h" ] && [ "${TLS_ANS:-E}" != "H" ]; then
    read -rp "  HTTPS hostname (ör. lms.hastane.local): " TLS_HOST
    while [ -z "${TLS_HOST:-}" ]; do read -rp "  Hostname zorunlu (ör. lms.hastane.local): " TLS_HOST; done
    read -rp "  Storage HTTPS portu [9443]: " HTTPS_STORAGE_PORT; HTTPS_STORAGE_PORT="${HTTPS_STORAGE_PORT:-9443}"
    PUBLIC_APP_URL="https://${TLS_HOST}"
    PUBLIC_STORAGE_URL="https://${TLS_HOST}:${HTTPS_STORAGE_PORT}"
    CADDY_MAIN_SITE="${TLS_HOST}"
    CADDY_STORAGE_SITE="${TLS_HOST}:${HTTPS_STORAGE_PORT}"
    SERVICE_BIND="127.0.0.1"   # doğrudan 3000/8000/9000 LAN'a KAPALI; erişim yalnız Caddy (HTTPS)
    COMPOSE_PROFILES="tls"
    log "  → TLS: ${PUBLIC_APP_URL} (Caddy self-signed iç-CA — ilk erişimde tarayıcı sertifika uyarısı verebilir)."
    log "     Kurum/kamu SM sertifikası için: Caddyfile 'tls internal'ı cert+key ile değiştirin (README > TLS)."
  else
    warn "TLS ATLANDI — düz HTTP. Hastane LAN'ında PII/oturum çerezleri AÇIK akar (KVKK riski) + realtime kırık kalabilir."
    read -rp "Public uygulama URL'i [http://localhost:3000]: " PUBLIC_APP_URL
    PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:3000}"
    read -rp "Public nesne-deposu (MinIO) URL'i [http://localhost:9000]: " PUBLIC_STORAGE_URL
    PUBLIC_STORAGE_URL="${PUBLIC_STORAGE_URL:-http://localhost:9000}"
  fi
  read -rp "İlk süper-admin e-postası [admin@hastane.local]: " ONPREM_ADMIN_EMAIL
  ONPREM_ADMIN_EMAIL="${ONPREM_ADMIN_EMAIL:-admin@hastane.local}"
  read -rp "Lisans sunucusu URL'i [https://app.klinovax.com]: " LICENSE_SERVER_URL
  LICENSE_SERVER_URL="${LICENSE_SERVER_URL:-https://app.klinovax.com}"

  # Yedek/alarm bildirimleri — yedek başarısız olursa bu adrese e-posta gider
  # (aksi halde 44 gün fark edilmeyen yedek-arızası riski). Boş bırakılırsa alarm
  # e-postası GİTMEZ (yalnız log/Sentry backstop kalır).
  read -rp "Yedek/alarm bildirim e-postası [${ONPREM_ADMIN_EMAIL}]: " ADMIN_ALERT_EMAIL
  ADMIN_ALERT_EMAIL="${ADMIN_ALERT_EMAIL:-$ONPREM_ADMIN_EMAIL}"

  # SMTP relay — varsayılan 'mailpit' e-postaları YAKALAR ama GÖNDERMEZ (yalnız dev/demo).
  # Gerçek e-posta (yedek-alarm, davet, şifre-sıfırlama) için kurum relay'i girilmeli.
  log "SMTP relay yapılandırması (Enter=mailpit; bu modda e-postalar GERÇEKTEN gönderilmez):"
  read -rp "  SMTP host [mailpit]: " SMTP_HOST
  SMTP_HOST="${SMTP_HOST:-mailpit}"
  if [ "$SMTP_HOST" = "mailpit" ]; then
    SMTP_PORT=1025; SMTP_SECURE=false; SMTP_USER=""; SMTP_PASS=""
    FROM_EMAIL="noreply@klinovax.local"
    log "  → mailpit: alarm/davet/şifre-sıfırlama e-postaları GÖNDERİLMEZ (sadece yakalanır). Prod'da gerçek relay girin."
  else
    read -rp "  SMTP port [587]: " SMTP_PORT; SMTP_PORT="${SMTP_PORT:-587}"
    read -rp "  SMTP TLS/secure (true/false) [false]: " SMTP_SECURE; SMTP_SECURE="${SMTP_SECURE:-false}"
    read -rp "  SMTP kullanıcı adı: " SMTP_USER
    read -rsp "  SMTP parola: " SMTP_PASS; echo
    read -rp "  Gönderen (From) e-posta [${ADMIN_ALERT_EMAIL}]: " FROM_EMAIL
    FROM_EMAIL="${FROM_EMAIL:-$ADMIN_ALERT_EMAIL}"
  fi

  BASE_DOMAIN="$(printf '%s' "$PUBLIC_APP_URL" | sed -E 's#^https?://##')"

  cat > .env <<EOF
APP_IMAGE=${APP_IMAGE_REF}
PUBLIC_APP_URL=${PUBLIC_APP_URL}
BASE_DOMAIN=${BASE_DOMAIN}
PUBLIC_STORAGE_URL=${PUBLIC_STORAGE_URL}
SERVICE_BIND=${SERVICE_BIND}
COMPOSE_PROFILES=${COMPOSE_PROFILES}
CADDY_MAIN_SITE=${CADDY_MAIN_SITE}
CADDY_STORAGE_SITE=${CADDY_STORAGE_SITE}
HTTPS_PORT=${HTTPS_PORT}
HTTPS_STORAGE_PORT=${HTTPS_STORAGE_PORT}
APP_PORT=3000
GATEWAY_PORT=8000
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MAILPIT_UI_PORT=8025
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
REALTIME_ENC_KEY=${REALTIME_ENC_KEY}
REALTIME_SECRET_KEY_BASE=${REALTIME_SECRET_KEY_BASE}
MINIO_ROOT_USER=klinovax
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
S3_BUCKET=klinovax-media
SRH_TOKEN=${SRH_TOKEN}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
FROM_EMAIL=${FROM_EMAIL}
ADMIN_ALERT_EMAIL=${ADMIN_ALERT_EMAIL}
CRON_SECRET=${CRON_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}
HEALTH_CHECK_SECRET=${HEALTH_CHECK_SECRET}
LICENSE_SERVER_URL=${LICENSE_SERVER_URL}
ONPREM_ADMIN_EMAIL=${ONPREM_ADMIN_EMAIL}
ONPREM_ADMIN_PASSWORD=${ONPREM_ADMIN_PASSWORD}
EOF
  chmod 600 .env
  log ".env yazıldı (chmod 600)."
  # Parolayı stdout'a BASMA (scrollback/SSH-log/install.log'da düz-metin kalır). .env'de durur.
  log "İlk süper-admin e-postası: ${ONPREM_ADMIN_EMAIL}"
  log "  → İlk parola için:  grep '^ONPREM_ADMIN_PASSWORD=' .env"  # secret-scanner-disable-line (grep talimatı, sır değil)
  log "  → İlk girişten SONRA parolayı MUTLAKA değiştirin."
fi

# ── Sır ön-kontrolü (preflight) ──
# Kötü/eksik sır stateful servislere (postgres/minio) ULAŞMADAN durdur. Aksi halde pgdata
# yanlış/placeholder parolayla kalıcı init olur → .env düzeltilip rerun edilince GoTrue/Realtime
# 28P01 crash-loop'a girer; tek kurtarma veri-silen 'down -v' olur. Elle düzenlenmiş .env'i de tarar.
preflight_secrets() {
  local bad=0 v
  ev()   { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
  is_ph() { case "$1" in ""|*CHANGE_ME*|*change_me*|*changeme*) return 0;; *) return 1;; esac; }
  for k in POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY MINIO_ROOT_PASSWORD \
           SRH_TOKEN CRON_SECRET HEALTH_CHECK_SECRET ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY \
           REALTIME_ENC_KEY REALTIME_SECRET_KEY_BASE ONPREM_ADMIN_PASSWORD; do
    if is_ph "$(ev "$k")"; then err "Sır placeholder/boş: ${k} — .env'i düzeltin (veya silip install.sh'ı tekrar çalıştırın)."; bad=1; fi
  done
  # Tüketicinin beklediği KESİN format kilitleri (yanlış format = SESSİZ arıza):
  v="$(ev JWT_SECRET)";            [ "${#v}" -ge 32 ] || { err "JWT_SECRET < 32 karakter."; bad=1; }
  v="$(ev REALTIME_ENC_KEY)";      [ "${#v}" -eq 16 ] || { err "REALTIME_ENC_KEY TAM 16 karakter olmalı (Realtime AES-128) — şu an ${#v}."; bad=1; }
  v="$(ev BACKUP_ENCRYPTION_KEY)"; printf '%s' "$v" | grep -qE '^[0-9a-fA-F]{64}$' || { err "BACKUP_ENCRYPTION_KEY 64 karakter hex olmalı (openssl rand -hex 32) — yedek şifreleme aksi halde her seferinde hata verir."; bad=1; }
  if [ "$bad" -ne 0 ]; then
    err "Kurulum durduruldu — .env'deki sır(lar) düzeltilmeli. Stateful servisler BAŞLATILMADI."
    exit 1
  fi
  log "Sır ön-kontrolü (preflight): geçti."
}
preflight_secrets

log "Stack başlatılıyor (docker compose up -d)…"
docker compose up -d

# ── Kurulum-sonrası SAĞLIK KAPISI ──
# Prisma/Docker bilmeyen operatöre net "sağlıklı + URL" doğrulaması ver; sessiz yarım-boot'u yakala.
# .env'den oku (hem taze hem mevcut-.env yolunda çalışsın).
APP_PORT_V="$(grep -E '^APP_PORT=' .env | head -1 | cut -d= -f2-)"; APP_PORT_V="${APP_PORT_V:-3000}"
HEALTH_SECRET_V="$(grep -E '^HEALTH_CHECK_SECRET=' .env | head -1 | cut -d= -f2-)"  # secret-scanner-disable-line (.env'den OKUR, literal değil)
HEALTH_WAIT="${HEALTH_WAIT:-240}"
log "Sağlık bekleniyor (≤${HEALTH_WAIT}sn; ilk migrate/bootstrap uzun sürebilir)…"
healthy=0
for i in $(seq 1 "$HEALTH_WAIT"); do
  if curl -fsS "http://localhost:${APP_PORT_V}/api/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 1
done
echo
docker compose ps
if [ "$healthy" -ne 1 ]; then
  err "Uygulama ${HEALTH_WAIT}sn içinde sağlıklı olmadı. 'docker compose logs -f app' ile inceleyin."
  exit 1
fi
# Kurulu sürüm manifesti (müşteri-başına takip) + sağlık/lisans özeti.
grep -E '^APP_IMAGE=' .env | head -1 | cut -d= -f2- > .installed-version 2>/dev/null || true
if [ -n "$HEALTH_SECRET_V" ]; then
  summary="$(curl -fsS -H "x-health-secret: ${HEALTH_SECRET_V}" "http://localhost:${APP_PORT_V}/api/health" 2>/dev/null || true)"
  log "Sağlık: $(printf '%s' "$summary" | grep -oE '"status":"[^"]*"' | head -1)"
  lic="$(printf '%s' "$summary" | grep -oE '"state":"[^"]*"' | head -1)"
  [ -n "$lic" ] && log "Lisans durumu: $lic"
fi
log "✅ Kurulum tamam — uygulama sağlıklı."

# ── Off-site yedek cron'u (opt-in) — konteyner-içi supercronic Docker soketine erişemez ──
read -rp "Off-site yedek dizini (harici disk/NAS; boş=atla): " OFFSITE_DIR
if [ -n "$OFFSITE_DIR" ]; then
  INSTALL_DIR="$(pwd)"
  CRON_BK="30 2 * * *  cd ${INSTALL_DIR} && OFFSITE_BACKUP_DIR=${OFFSITE_DIR} ./backup-volumes.sh >> /var/log/klinovax-offsite.log 2>&1  # klinovax-offsite-backup"
  CRON_DM="30 3 * * *  cd ${INSTALL_DIR} && OFFSITE_BACKUP_DIR=${OFFSITE_DIR} ./dead-man-check.sh >> /var/log/klinovax-offsite.log 2>&1  # klinovax-deadman"
  if command -v crontab >/dev/null 2>&1; then
    # Marker-idempotent: eski klinovax satırlarını çıkar, yenilerini ekle.
    new="$( { crontab -l 2>/dev/null || true; } | grep -v 'klinovax-offsite-backup' | grep -v 'klinovax-deadman' )"
    printf '%s\n%s\n%s\n' "$new" "$CRON_BK" "$CRON_DM" | crontab - \
      && log "Host crontab kuruldu: 02:30 off-site yedek + 03:30 ölü-adam kontrolü ($OFFSITE_DIR)."
    warn "  → ${OFFSITE_DIR} SUNUCU-DIŞI bir mount (NAS/harici disk) OLMALI; aynı diskteyse off-site kopya YOKTUR."
  else
    warn "crontab komutu yok — off-site yedeği elle kurun (README > Yedekleme)."
  fi
else
  warn "Off-site yedek cron'u ATLANDI. Felaket kurtarma için MUTLAKA elle kurun (README > Yedekleme)."
fi

# ── Disk-dolum guard cron'u (off-site'tan BAĞIMSIZ — disk dolması #1 kesinti nedeni) ──
if command -v crontab >/dev/null 2>&1; then
  DG_DIR="$(pwd)"
  CRON_DG="17 * * * *  cd ${DG_DIR} && ./disk-guard.sh >> /var/log/klinovax-disk.log 2>&1  # klinovax-diskguard"
  dg_new="$( { crontab -l 2>/dev/null || true; } | grep -v 'klinovax-diskguard' )"
  printf '%s\n%s\n' "$dg_new" "$CRON_DG" | crontab - \
    && log "Host crontab: saatlik disk-dolum kontrolü kuruldu (./status.sh ile görün)."
fi

log "Uygulama:  $(grep '^PUBLIC_APP_URL=' .env | cut -d= -f2-)"
log "Durum özeti için: ./status.sh"
log "Lisansı etkinleştirmek için giriş yapıp /license ekranına gidin."
