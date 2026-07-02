#!/usr/bin/env bash
# KlinoVax on-prem kurulum — sırları üretir, .env yazar, stack'i başlatır.
# Kullanım: ./install.sh   (deploy/onprem/ içinden)
set -euo pipefail
cd "$(dirname "$0")"

log()  { printf '\033[0;36m[install]\033[0m %s\n' "$*"; }
err()  { printf '\033[0;31m[install] HATA:\033[0m %s\n' "$*" >&2; }

# ── Önkoşullar ──
command -v docker >/dev/null 2>&1 || { err "docker bulunamadı."; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose (v2) bulunamadı."; exit 1; }
command -v node >/dev/null 2>&1 || { err "node bulunamadı (JWT üretimi için gerekli)."; exit 1; }

if [ -f .env ]; then
  log ".env zaten var — üzerine yazılmayacak. Yeniden üretmek için .env'i silin."
else
  log "Sırlar üretiliyor ve .env yazılıyor…"

  rand()   { openssl rand -hex 24; }
  randb64() { openssl rand -base64 32 | tr -d '\n'; }

  # Aşağıdaki atamalar rastgele ÜRETİM (literal sır DEĞİL) — scanner false positive.
  POSTGRES_PASSWORD="$(rand)"                     # secret-scanner-disable-line
  JWT_SECRET="$(openssl rand -hex 32)"           # secret-scanner-disable-line (64 hex = 32 byte)
  MINIO_ROOT_PASSWORD="$(rand)"                  # secret-scanner-disable-line
  SRH_TOKEN="$(rand)"                            # secret-scanner-disable-line
  CRON_SECRET="$(rand)"                          # secret-scanner-disable-line
  ENCRYPTION_KEY="$(randb64)"                    # secret-scanner-disable-line
  BACKUP_ENCRYPTION_KEY="$(randb64)"             # secret-scanner-disable-line
  HEALTH_CHECK_SECRET="$(rand)"                  # secret-scanner-disable-line
  REALTIME_ENC_KEY="$(openssl rand -hex 16)"     # secret-scanner-disable-line (32 char)
  REALTIME_SECRET_KEY_BASE="$(openssl rand -hex 32)" # secret-scanner-disable-line
  ONPREM_ADMIN_PASSWORD="$(rand)"                # secret-scanner-disable-line

  # Supabase anon/service_role JWT'leri (HS256, JWT_SECRET ile imzalı).
  gen_jwt() {
    node -e '
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
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=noreply@klinovax.local
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
  log "İlk süper-admin şifresi: ${ONPREM_ADMIN_PASSWORD}"
  log "  → Bu şifreyi güvenli saklayın; ilk girişten sonra değiştirin."
fi

log "Stack başlatılıyor (docker compose up -d)…"
docker compose up -d

log "Tamamlandı. Durumu izlemek için: docker compose logs -f app"
log "Uygulama:  $(grep '^PUBLIC_APP_URL=' .env | cut -d= -f2-)"
log "Lisansı etkinleştirmek için giriş yapıp /license ekranına gidin."
