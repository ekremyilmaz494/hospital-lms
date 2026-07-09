#!/usr/bin/env bash
# Ölü-adam anahtarı — off-site yedeğin SESSİZ durmasını yakalar.
#
# NEDEN: Air-gapped kurulumda SMTP=mailpit ise yedek-arıza e-postası GİTMEZ; yedek cron'u
# ölse (disk dolu, NAS unmount, script bozuk) kimse aylarca fark etmez ("44 günlük sessiz
# yedek" olay sınıfı). Bu script en yeni off-site yedeğin tazeliğini kontrol eder ve
# bayatsa HOST-YEREL ve GÖRÜNÜR alarm üretir: syslog (`logger`) + durum-dosyası
# (status.sh/operatör yüzeyler) + stderr (cron log). Gerçek SMTP relay varsa +e-posta.
#
# Kullanım (HOST crontab — backup cron'undan BİR SAAT SONRA):
#   30 3 * * *  cd /opt/klinovax/deploy/onprem && ./dead-man-check.sh /mnt/nas/klinovax >> /var/log/klinovax-offsite.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

DEST="${1:-${OFFSITE_BACKUP_DIR:-./offsite-backups}}"
MAX_AGE_HOURS="${OFFSITE_MAX_AGE_HOURS:-26}"   # 24s yedek + 2s tolerans
STATUS_FILE="${DEST%/}/.backup-health"

log()  { printf '\033[0;36m[dead-man]\033[0m %s\n' "$*"; }
alarm() {
  local msg="$1"
  printf '\033[0;31m[dead-man] ALARM:\033[0m %s\n' "$msg" >&2
  command -v logger >/dev/null 2>&1 && logger -t klinovax-backup -p user.err "OFF-SITE YEDEK ALARMI: $msg" || true
  { echo "FAIL $(date '+%Y-%m-%d %H:%M:%S')"; echo "$msg"; } > "$STATUS_FILE" 2>/dev/null || true
}

# En yeni DB yedeği (backup-volumes.sh şifreli .enc veya düz üretir).
newest="$(find "$DEST" -maxdepth 1 -type f -name 'db-*.sql.gz*' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 || true)"

if [ -z "$newest" ]; then
  alarm "DEST'te ($DEST) HİÇ off-site yedek yok. backup-volumes.sh çalışıyor mu / NAS bağlı mı?"
  exit 1
fi

newest_epoch="${newest%% *}"
newest_epoch="${newest_epoch%.*}"
newest_file="${newest#* }"
now_epoch="$(date +%s)"
age_h=$(( (now_epoch - newest_epoch) / 3600 ))

if [ "$age_h" -gt "$MAX_AGE_HOURS" ]; then
  alarm "En yeni off-site yedek ${age_h} saat önce ($(basename "$newest_file")) — eşik ${MAX_AGE_HOURS}s. Yedek DURMUŞ olabilir."
  exit 1
fi

log "Off-site yedek taze: $(basename "$newest_file") (${age_h} saat önce)."
{ echo "OK $(date '+%Y-%m-%d %H:%M:%S')"; echo "En yeni: $(basename "$newest_file") (${age_h}s önce)"; } > "$STATUS_FILE" 2>/dev/null || true
