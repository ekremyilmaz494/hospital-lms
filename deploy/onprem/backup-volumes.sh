#!/usr/bin/env bash
# Off-site yedek — pg_dump + MinIO nesne deposu → DEST dizinine (harici disk / NFS / rsync hedefi).
#
# NEDEN: App-içi şifreli yedek cron'u AYNI sunucudaki MinIO'ya yazar. Sunucu arızası,
# ransomware veya `docker compose down -v` durumunda veri + yedekler BİRLİKTE kaybolur.
# Bu script sunucu-DIŞI kopya alır → gerçek felaket kurtarma.
#
# Kullanım (deploy/onprem/ içinden):
#   ./backup-volumes.sh [DEST_DIR]          # varsayılan ./offsite-backups
#   OFFSITE_BACKUP_DIR=/mnt/nas/klx ./backup-volumes.sh
#
# Cron örneği (HOST crontab — konteyner içi supercronic DEĞİL, çünkü Docker soketi gerekir):
#   30 2 * * *  cd /opt/klinovax/deploy/onprem && ./backup-volumes.sh /mnt/nas/klinovax-backups >> /var/log/klinovax-offsite.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

DEST="${1:-${OFFSITE_BACKUP_DIR:-./offsite-backups}}"
PROJECT="klinovax-onprem"          # docker-compose.yml `name:` ile aynı olmalı (volume prefix'i)
TS="$(date +%Y%m%d-%H%M%S)"
RETENTION_DAYS="${OFFSITE_RETENTION_DAYS:-14}"

log() { printf '\033[0;36m[offsite-backup]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[offsite-backup] HATA:\033[0m %s\n' "$*" >&2; }

command -v docker >/dev/null 2>&1 || { err "docker bulunamadı."; exit 1; }
docker compose ps postgres >/dev/null 2>&1 || { err "stack çalışmıyor gibi (docker compose ps postgres başarısız)."; exit 1; }
mkdir -p "$DEST"
DEST_ABS="$(cd "$DEST" && pwd)"

# 1) PostgreSQL — mantıksal dump (tüm veritabanı, fresh DB'ye uygulanabilir)
log "PostgreSQL dump alınıyor…"
docker compose exec -T postgres pg_dump -U postgres -d postgres --clean --if-exists \
  | gzip > "$DEST_ABS/db-${TS}.sql.gz"
log "  → db-${TS}.sql.gz ($(du -h "$DEST_ABS/db-${TS}.sql.gz" | cut -f1))"

# 2) MinIO nesne deposu — volume tar'ı (videolar, belgeler, app-içi şifreli yedekler)
log "MinIO nesne deposu arşivleniyor…"
docker run --rm \
  -v "${PROJECT}_miniodata:/data:ro" \
  -v "$DEST_ABS:/backup" \
  alpine tar czf "/backup/minio-${TS}.tar.gz" -C /data .
log "  → minio-${TS}.tar.gz ($(du -h "$DEST_ABS/minio-${TS}.tar.gz" | cut -f1))"

# 3) Restore uyarısı — şifreleme anahtarları bu yedekte YOK (bilinçli); .env ayrı saklanmalı
cat > "$DEST_ABS/OKU-BENI-${TS}.txt" <<EOF
Off-site yedek: ${TS}
İçerik: db-${TS}.sql.gz (PostgreSQL) + minio-${TS}.tar.gz (nesne deposu).
GERİ YÜKLEME İÇİN .env'deki şu anahtarlar DA gerekli (güvenlik gereği bu yedekte YOK):
  ENCRYPTION_KEY, BACKUP_ENCRYPTION_KEY, JWT_SECRET, REALTIME_ENC_KEY
.env'i AYRI ve güvenli bir konumda saklayın; kaybı KALICI veri kaybıdır.
Adımlar: README.md → "Geri Yükleme (Restore)".
EOF

# 4) Yerel retention (DEST harici bir mount'sa oranın kendi politikası da olabilir)
if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  find "$DEST_ABS" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'minio-*.tar.gz' -o -name 'OKU-BENI-*.txt' \) \
    -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
fi

log "Off-site yedek tamam: $DEST_ABS"
log "UYARI: bu dizini SUNUCU DIŞINA taşıyın (NFS/harici disk/rsync). Aynı diskte kalırsa off-site kopya YOKTUR."
