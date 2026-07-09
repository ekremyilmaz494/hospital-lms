#!/usr/bin/env bash
# Tam-sunucu-kaybı GERİ YÜKLEME (Senaryo B) — off-site yedekten yeni/temiz sunucuya.
# backup-volumes.sh'ın şifreli (.enc) veya düz çıktısını otomatik çözer, PostgreSQL + MinIO'yu
# geri yükler, stack'i başlatıp sağlığını doğrular. README > "Geri Yükleme (Senaryo B)"ın betiği.
#
# ÖNKOŞUL: ESKİ `.env` yerinde olmalı (aynı anahtarlar) — install.sh'ı .env varken çalıştırMAyın.
#
# Kullanım (deploy/onprem/ içinden):
#   ./restore-offsite.sh [DB_DOSYA] [MINIO_DOSYA]    # verilmezse DEST'teki EN YENİ çift kullanılır
#   OFFSITE_BACKUP_DIR=/mnt/nas/klx ./restore-offsite.sh
#   FORCE=1 ./restore-offsite.sh ...                 # onay sormadan (otomasyon/drill)
set -euo pipefail
cd "$(dirname "$0")"

DEST="${OFFSITE_BACKUP_DIR:-./offsite-backups}"
PROJECT="klinovax-onprem"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

log()  { printf '\033[0;36m[restore]\033[0m %s\n' "$*"; }
err()  { printf '\033[0;31m[restore] HATA:\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[0;33m[restore] UYARI:\033[0m %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || { err "docker bulunamadı."; exit 1; }
[ -f .env ] || { err ".env yok — ESKİ .env'i (aynı anahtarlarla) buraya koyun. install.sh'ı ÇALIŞTIRMAYIN."; exit 1; }

# ── Kaynak dosyaları çöz (arg veya DEST'teki en yeni) ──
DB_FILE="${1:-}"; MINIO_FILE="${2:-}"
newest() { find "$1" -maxdepth 1 -type f -name "$2" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-; }
if [ -z "$DB_FILE" ]; then
  [ -d "$DEST" ] || { err "DEST yok: $DEST (OFFSITE_BACKUP_DIR ile verin veya dosyaları argüman geçin)."; exit 1; }
  DB_FILE="$(newest "$DEST" 'db-*.sql.gz*')"
  MINIO_FILE="$(newest "$DEST" 'minio-*.tar.gz*')"
fi
[ -n "$DB_FILE" ] && [ -f "$DB_FILE" ]       || { err "DB yedeği bulunamadı: '${DB_FILE:-<yok>}'"; exit 1; }
[ -n "$MINIO_FILE" ] && [ -f "$MINIO_FILE" ] || { err "MinIO yedeği bulunamadı: '${MINIO_FILE:-<yok>}'"; exit 1; }

# ── Şifre çözme (dosya .enc ile bitiyorsa) ──
BK_KEY=""
case "$DB_FILE" in
  *.enc)
    command -v openssl >/dev/null 2>&1 || { err "openssl yok (şifreli yedek çözülemez)."; exit 1; }
    BK_KEY="$(grep -E '^BACKUP_ENCRYPTION_KEY=' .env | head -1 | cut -d= -f2- || true)"
    [ -n "$BK_KEY" ] || { err ".env'de BACKUP_ENCRYPTION_KEY yok — şifreli yedek çözülemez (KALICI kayıp riski)."; exit 1; }
    ;;
esac
dec_in() { if [ -n "$BK_KEY" ]; then BK_KEY="$BK_KEY" openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BK_KEY; else cat; fi; }

log "DB yedeği   : $(basename "$DB_FILE")"
log "MinIO yedeği: $(basename "$MINIO_FILE")"
log "Şifreleme   : $([ -n "$BK_KEY" ] && echo 'AES-256 (BACKUP_ENCRYPTION_KEY ile çözülecek)' || echo 'yok (düz)')"

# ── Bütünlük ön-doğrulaması (yükleme YAPMADAN önce yedek açılıyor mu?) ──
log "Yedek bütünlüğü ön-doğrulanıyor…"
dec_in < "$DB_FILE" | gunzip -t 2>/dev/null    || { err "DB yedeği açılamıyor (yanlış anahtar veya bozuk dosya). İptal."; exit 1; }
dec_in < "$MINIO_FILE" | tar tz >/dev/null 2>&1 || { err "MinIO yedeği açılamıyor. İptal."; exit 1; }
log "  → doğrulandı."

# ── Yıkıcı işlem onayı ──
if [ "${FORCE:-0}" != "1" ]; then
  warn "Bu işlem mevcut PostgreSQL ve MinIO verisinin ÜZERİNE yazar (yeni/temiz sunucuda güvenli)."
  read -rp "Devam edilsin mi? (yes yazın): " ans
  [ "$ans" = "yes" ] || { log "İptal edildi."; exit 0; }
fi

# ── 1) Veri servisleri ──
log "postgres başlatılıyor…"
docker compose up -d postgres
for i in $(seq 1 60); do
  docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 && break
  [ "$i" -eq 60 ] && { err "postgres 60 sn'de hazır olmadı."; exit 1; }
  sleep 1
done

# ── 2) PostgreSQL restore ──
log "PostgreSQL geri yükleniyor…"
dec_in < "$DB_FILE" | gunzip | docker compose exec -T postgres psql -v ON_ERROR_STOP=0 -U postgres -d postgres >/dev/null
log "  → DB geri yüklendi."

# ── 3) MinIO restore — volume, MinIO DURDURULMUŞ iken (canlı volume'e yazma yarışını önler) ──
log "MinIO durduruluyor ve nesne deposu geri yükleniyor…"
docker compose stop minio >/dev/null 2>&1 || true
dec_in < "$MINIO_FILE" | docker run --rm -i -v "${PROJECT}_miniodata:/data" alpine sh -c 'cd /data && tar xz'
log "  → nesne deposu geri yüklendi."

# ── 4) Tüm stack + sağlık doğrulaması ──
log "Tüm stack başlatılıyor…"
docker compose up -d

APP_PORT="$(grep -E '^APP_PORT=' .env | head -1 | cut -d= -f2- || echo 3000)"
log "Sağlık bekleniyor (≤${HEALTH_TIMEOUT}sn)…"
ok=0
for i in $(seq 1 "$HEALTH_TIMEOUT"); do
  if curl -fsS "http://localhost:${APP_PORT}/api/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
docker compose ps
if [ "$ok" -eq 1 ]; then
  log "✅ Geri yükleme tamam — uygulama sağlıklı (http://localhost:${APP_PORT})."
  log "   Aktif sınav timer'ları/streak Redis'te tutulur ve off-site yedeğe DAHİL DEĞİLDİR → yeniden başlatma gerekebilir."
else
  err "Stack başladı ama /api/health ${HEALTH_TIMEOUT}sn'de yanıt vermedi — 'docker compose logs -f app' ile inceleyin."
  exit 1
fi
