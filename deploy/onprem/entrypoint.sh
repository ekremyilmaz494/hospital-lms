#!/usr/bin/env bash
# KlinoVax on-prem konteyner giriş noktası.
# Sıra: Postgres'i bekle → migrate deploy → (ilk boot) bootstrap → server başlat.
set -euo pipefail

log() { echo "[entrypoint] $*"; }

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
    log "HATA: Postgres 60 sn içinde hazır olmadı."
    exit 1
  fi
  sleep 1
done

# ── 2) Şema migrasyonu (idempotent — her boot'ta güvenli) ──
# prisma CLI global kurulu (schema-engine gömülü). schema.prisma apps/web/prisma'da.
log "prisma migrate deploy çalıştırılıyor…"
cd /app/apps/web
prisma migrate deploy || {
  log "HATA: migrate deploy başarısız."
  exit 1
}
cd /app

# ── 3) İlk boot bootstrap (idempotent — süper-admin yoksa oluşturur) ──
# Kendi node_modules'ı olan /app/bootstrap dizininden çalışır (pg + supabase-js).
if [ "${ONPREM_BOOTSTRAP:-true}" = "true" ]; then
  log "İlk-boot bootstrap kontrolü…"
  ( cd /app/bootstrap && node onprem-bootstrap.mjs ) || {
    log "UYARI: bootstrap adımı hata verdi (süper-admin zaten var olabilir) — devam."
  }
fi

# ── 4) Standalone server ──
log "Uygulama başlatılıyor (port ${PORT:-3000})…"
exec node /app/apps/web/server.js
