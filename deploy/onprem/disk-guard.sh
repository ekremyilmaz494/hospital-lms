#!/usr/bin/env bash
# Disk-dolum guard — on-prem'in 1 numaralı öldürücüsüne karşı erken alarm.
#
# NEDEN: Video-ağırlıklı LMS'te MinIO nesne deposu (miniodata volume) SINIRSIZ büyür. Disk
# %100 dolunca PostgreSQL WAL fsync KIRILIR → veritabanı yazamaz → TOPYEKÛN kesinti (hasta
# eğitimi durur). Bu script disk kullanımını izler ve eşik aşılınca HOST-YEREL görünür alarm
# üretir (syslog + durum-dosyası + stderr; gerçek SMTP relay varsa e-posta ayrı katman).
#
# Kullanım (HOST crontab — install.sh opt-in kurar):
#   0 * * * *  cd /opt/klinovax/deploy/onprem && ./disk-guard.sh >> /var/log/klinovax-disk.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

THRESHOLD="${DISK_ALERT_PCT:-85}"          # yüzde eşiği
STATUS_FILE="./.disk-health"

log()  { printf '\033[0;36m[disk-guard]\033[0m %s\n' "$*"; }
alarm() {
  local msg="$1"
  printf '\033[0;31m[disk-guard] ALARM:\033[0m %s\n' "$msg" >&2
  command -v logger >/dev/null 2>&1 && logger -t klinovax-disk -p user.err "DISK ALARMI: $msg" || true
  { echo "FAIL $(date '+%Y-%m-%d %H:%M:%S')"; echo "$msg"; } > "$STATUS_FILE" 2>/dev/null || true
}

# İzlenecek yol: Docker data-root (volume'lerin yaşadığı yer). Tespit edilemezse '/'.
DOCKER_ROOT="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"
[ -d "$DOCKER_ROOT" ] || DOCKER_ROOT="/"

pct="$(df -P "$DOCKER_ROOT" 2>/dev/null | awk 'NR==2{gsub("%","",$5); print $5}')"
if [ -z "$pct" ]; then
  alarm "Disk kullanımı okunamadı ($DOCKER_ROOT)."
  exit 1
fi

if [ "$pct" -ge "$THRESHOLD" ]; then
  alarm "Docker diski %${pct} dolu (eşik %${THRESHOLD}, yol $DOCKER_ROOT). Disk %100 olursa postgres WAL kırılır = KESİNTİ. Eski video/yedekleri temizleyin veya disk büyütün."
  exit 1
fi

log "Disk sağlıklı: %${pct} (eşik %${THRESHOLD}, $DOCKER_ROOT)."
{ echo "OK $(date '+%Y-%m-%d %H:%M:%S')"; echo "Docker diski: %${pct} ($DOCKER_ROOT)"; } > "$STATUS_FILE" 2>/dev/null || true
