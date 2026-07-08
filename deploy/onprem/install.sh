#!/usr/bin/env bash
# KlinoVax on-prem kurulum — sırları üretir, .env yazar, stack'i başlatır.
# Kullanım: ./install.sh   (deploy/onprem/ içinden)
set -euo pipefail
cd "$(dirname "$0")"
umask 077   # .env sır içerir → yaratılış anından itibaren yalnız sahibi okusun (0600)

log()  { printf '\033[0;36m[install]\033[0m %s\n' "$*"; }
err()  { printf '\033[0;31m[install] HATA:\033[0m %s\n' "$*" >&2; }

APP_IMAGE_REF="klinovax/hospital-lms:onprem"

# ── Önkoşullar ──
command -v docker >/dev/null 2>&1 || { err "docker bulunamadı."; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose (v2) bulunamadı."; exit 1; }
command -v openssl >/dev/null 2>&1 || { err "openssl bulunamadı (sır üretimi için gerekli)."; exit 1; }
# NOT: node yalnızca .env İLK üretilirken (ANON/SERVICE JWT mint) gerekir. Host'ta yoksa
# app imajından çalıştırılır (air-gap: imaj 'docker load' ile yüklü) → burada HARD-FAIL YOK.

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

  # Kullanıcıdan erişim bilgileri (varsayılanlar localhost).
  read -rp "Public uygulama URL'i [http://localhost:3000]: " PUBLIC_APP_URL
  PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:3000}"
  read -rp "Public nesne-deposu (MinIO) URL'i [http://localhost:9000]: " PUBLIC_STORAGE_URL
  PUBLIC_STORAGE_URL="${PUBLIC_STORAGE_URL:-http://localhost:9000}"
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
APP_IMAGE=klinovax/hospital-lms:onprem
PUBLIC_APP_URL=${PUBLIC_APP_URL}
BASE_DOMAIN=${BASE_DOMAIN}
PUBLIC_STORAGE_URL=${PUBLIC_STORAGE_URL}
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

log "Tamamlandı. Durumu izlemek için: docker compose logs -f app"
log "Uygulama:  $(grep '^PUBLIC_APP_URL=' .env | cut -d= -f2-)"
log "Lisansı etkinleştirmek için giriş yapıp /license ekranına gidin."
