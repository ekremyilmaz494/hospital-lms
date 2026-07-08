#!/usr/bin/env bash
# KlinoVax on-prem konteyner giriş noktası.
# Sıra: sır sağlığı → Postgres bekle → migrate deploy → gateway bekle → bootstrap → server.
set -euo pipefail

log() { echo "[entrypoint] $*"; }
err() { echo "[entrypoint] HATA: $*" >&2; }

# ── 0) Sır sağlığı (FAIL-CLOSED) ──
# .env.example verbatim kopyalanırsa CHANGE_ME placeholder'ları PUBLİK'tir (her bundle'da
# aynı) → bilinen JWT_SECRET ile service_role forge + RLS bypass. Kritik sır placeholder/
# boş/kısa ise başlatmayı DURDUR.
check_secret() {
  # $1=isim $2=değer $3=min-uzunluk(varsayılan 16)
  local name="$1" val="${2:-}" min="${3:-16}"
  if [ -z "$val" ]; then
    err "Kritik sır boş: ${name}. .env'i install.sh ile üretin."
    return 1
  fi
  case "$val" in
    *CHANGE_ME*|*change_me*|*changeme*)
      err "Kritik sır placeholder değerinde: ${name} (CHANGE_ME…). install.sh ile gerçek sır üretin."
      return 1 ;;
  esac
  if [ "${#val}" -lt "$min" ]; then
    err "Kritik sır çok kısa (<${min} karakter): ${name}."
    return 1
  fi
  return 0
}

secrets_bad=0
check_secret "SUPABASE_JWT_SECRET"          "${SUPABASE_JWT_SECRET:-}"          32 || secrets_bad=1
check_secret "ENCRYPTION_KEY"               "${ENCRYPTION_KEY:-}"               16 || secrets_bad=1
check_secret "BACKUP_ENCRYPTION_KEY"        "${BACKUP_ENCRYPTION_KEY:-}"        16 || secrets_bad=1
check_secret "CRON_SECRET"                  "${CRON_SECRET:-}"                  16 || secrets_bad=1
check_secret "HEALTH_CHECK_SECRET"          "${HEALTH_CHECK_SECRET:-}"          16 || secrets_bad=1
# App container'ının ZATEN aldığı diğer kritik sırlar (compose app env) — placeholder/boş bırakılırsa
# stack "sağlıklı ama ele geçirilebilir" boot eder (örn. MINIO 0.0.0.0:9000'de klinovax/CHANGE_ME,
# ya da CHANGE_ME ile süper-admin girişi). Guard'ın amacı (verbatim .env.example = publik sır) bunları da kapsar.
check_secret "DATABASE_URL"                 "${DATABASE_URL:-}"                 24 || secrets_bad=1
check_secret "SUPABASE_SERVICE_ROLE_KEY"    "${SUPABASE_SERVICE_ROLE_KEY:-}"    40 || secrets_bad=1
check_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" 40 || secrets_bad=1
check_secret "AWS_SECRET_ACCESS_KEY"        "${AWS_SECRET_ACCESS_KEY:-}"        16 || secrets_bad=1
check_secret "REDIS_TOKEN"                  "${REDIS_TOKEN:-}"                  16 || secrets_bad=1

# ── Format kilitleri (yanlış format = SESSİZ arıza; tüketicinin beklediği KESİN biçim) ──
# BACKUP_ENCRYPTION_KEY: backup-crypto.ts TAM 64 hex ister → yanlışsa yedek HER seferinde throw = 0 yedek.
if ! [[ "${BACKUP_ENCRYPTION_KEY:-}" =~ ^[0-9a-fA-F]{64}$ ]]; then
  err "BACKUP_ENCRYPTION_KEY 64 karakter hex olmalı (openssl rand -hex 32) — yoksa hiçbir yedek oluşmaz."
  secrets_bad=1
fi
# ENCRYPTION_KEY: crypto.ts base64→32 byte ister → yanlışsa ilk TC/şifreleme kullanımında 500 (İK/HBYS senkron sessiz yarım kalır).
if ! node -e 'process.exit(Buffer.from(process.env.ENCRYPTION_KEY||"","base64").length===32?0:1)' 2>/dev/null; then
  err "ENCRYPTION_KEY base64 çözümü tam 32 byte olmalı (node -e \"crypto.randomBytes(32).toString('base64')\")."
  secrets_bad=1
fi

if [ "$secrets_bad" -ne 0 ]; then
  err "Güvensiz/eksik sır(lar) tespit edildi — başlatma durduruldu. (install.sh sırları üretir.)"
  exit 1
fi
log "Sır sağlığı: geçti."

# ── 1) Postgres'i bekle ──
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
log "Postgres bekleniyor: ${DB_HOST}:${DB_PORT}"
for i in $(seq 1 60); do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    log "Postgres hazır."
    break
  fi
  if [ "$i" -eq 60 ]; then
    err "Postgres 60 sn içinde hazır olmadı."
    exit 1
  fi
  sleep 1
done

# ── 2) Şema migrasyonu (idempotent — YALNIZ tamamlanmış migration'lar için her boot güvenli) ──
# İzole /app/migrate dizininden (lokal prisma + config; datasource url DIRECT_URL/
# DATABASE_URL env'inden).
log "prisma migrate deploy çalıştırılıyor…"
set +e
migrate_out="$( cd /app/migrate && ./node_modules/.bin/prisma migrate deploy 2>&1 )"
migrate_rc=$?
set -e
printf '%s\n' "$migrate_out"
if [ "$migrate_rc" -ne 0 ]; then
  err "migrate deploy başarısız (rc=${migrate_rc})."
  # Yarıda kesilen migration (elektrik/OOM) _prisma_migrations'ta 'failed' kayıt bırakır → sonraki
  # HER deploy P3009/P3018 ile durur → restart:unless-stopped sonsuz crash-loop. Restart ÇÖZMEZ;
  # operatöre somut kurtarma yolu göster (aksi halde 'site açılmıyor' + prisma bilmeyen BT = uzun kesinti).
  case "$migrate_out" in
    *P3009*|*P3018*)
      err "→ Yarıda kalmış/başarısız migration (P3009/P3018). RESTART TEK BAŞINA ÇÖZMEZ."
      err "  1) Durumu gör:  docker compose exec app sh -c 'cd /app/migrate && ./node_modules/.bin/prisma migrate status'"
      err "  2) İlgili migration'ı çöz:  ... prisma migrate resolve --rolled-back <migration_adı>   sonra konteyneri restart et."
      err "  UYARI: otomatik çözülmez (yanlış resolve veri bozar). Emin değilseniz yedekten geri yükleyin (README > Geri Yükleme)."
      ;;
  esac
  exit 1
fi
log "Şema migrasyonu tamam."

# ── 3) İlk boot bootstrap (idempotent — süper-admin yoksa oluşturur) ──
# Kendi node_modules'ı olan /app/bootstrap dizininden çalışır (pg + supabase-js).
if [ "${ONPREM_BOOTSTRAP:-true}" = "true" ]; then
  # Gateway (GoTrue) hazır olsun — bootstrap auth admin API'sini çağırır. Best-effort
  # bekleme (health yolu değişirse boot'u kilitleme; asıl fail-closed bootstrap adımında).
  GW_URL="${SUPABASE_URL:-http://gateway:8000}"
  log "Auth gateway bekleniyor: ${GW_URL}/auth/v1/health"
  for i in $(seq 1 60); do
    if curl -fsS "${GW_URL}/auth/v1/health" >/dev/null 2>&1; then
      log "Auth gateway hazır."
      break
    fi
    if [ "$i" -eq 60 ]; then
      log "UYARI: gateway health 60 sn'de yanıt vermedi — bootstrap yine de denenecek."
    fi
    sleep 1
  done

  log "İlk-boot bootstrap kontrolü…"
  # onprem-bootstrap.mjs sözleşmesi: süper-admin zaten varsa exit 0 (idempotent-atlama);
  # GERÇEK hata (eksik sır/DB izni/GoTrue erişilemez) exit≠0. Bu yüzden non-zero =
  # gerçek hata → FAIL-CLOSED (restart policy yeniden dener; sessizce admin'siz açma).
  if ! ( cd /app/bootstrap && node onprem-bootstrap.mjs ); then
    err "Bootstrap GERÇEK hata verdi (idempotent-atlama değil) — süper-admin oluşturulamadı."
    err "Başlatma durduruldu; konteyner yeniden denenecek (logları kontrol edin)."
    exit 1
  fi
fi

# ── 4) Standalone server ──
log "Uygulama başlatılıyor (port ${PORT:-3000})…"
exec node /app/apps/web/server.js
