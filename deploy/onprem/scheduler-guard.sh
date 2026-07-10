#!/usr/bin/env bash
# Scheduler-liveness guard — supercronic sessizce ölürse HOST-YEREL erken alarm.
#
# NEDEN: scheduler servisi (supercronic) TÜM zamanlanmış işleri çalıştırır — KVKK-imha
# (cleanup), off-site yedek, verify-backup, license-heartbeat + 8 iş cron'u. Sessizce
# takılırsa hiçbiri tetiklenmez ve tespit yalnız DOLAYLIdır: license-heartbeat yenilenmeyince
# graceDays sonra lisans 'offline_grace_exceeded' → LOCKED = TOPYEKÛN kesinti (günler sonra,
# 44-günlük sessiz-yedek olayının kardeşi). compose healthcheck container'ı 'unhealthy'
# işaretler; bu script o durumu HOST tarafında görünür alarma çevirir (syslog + durum-dosyası
# + stderr). disk-guard.sh / dead-man-check.sh ile aynı desen: YALNIZ ALARM, auto-restart YOK
# (tutarlılık + güvenlik; restart döngüsü sorunu maskeler).
#
# Kullanım (HOST crontab — install.sh opt-in kurar):
#   0 * * * *  cd /opt/klinovax/deploy/onprem && ./scheduler-guard.sh >> /var/log/klinovax-scheduler.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

STATUS_FILE="./.scheduler-health"

log()  { printf '\033[0;36m[scheduler-guard]\033[0m %s\n' "$*"; }
alarm() {
  local msg="$1"
  printf '\033[0;31m[scheduler-guard] ALARM:\033[0m %s\n' "$msg" >&2
  command -v logger >/dev/null 2>&1 && logger -t klinovax-scheduler -p user.err "SCHEDULER ALARMI: $msg" || true
  { echo "FAIL $(date '+%Y-%m-%d %H:%M:%S')"; echo "$msg"; } > "$STATUS_FILE" 2>/dev/null || true
}

# Scheduler konteynerini bul (compose proje bağlamı bu dizinde).
cid="$(docker compose ps -q scheduler 2>/dev/null || true)"
if [ -z "$cid" ]; then
  alarm "scheduler konteyneri ÇALIŞMIYOR (docker compose ps -q scheduler boş). Zamanlanmış işler (KVKK-imha/yedek/heartbeat) tetiklenmiyor → lisans LOCKED riski. 'docker compose up -d scheduler'."
  exit 1
fi

# Healthcheck durumu: '*/5' beacon bayatlarsa 'unhealthy'.
status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo unknown)"
case "$status" in
  unhealthy)
    alarm "scheduler 'unhealthy' — supercronic takılmış olabilir (liveness beacon >15dk bayat). Zamanlanmış işler durdu. 'docker compose logs --tail=100 scheduler' + gerekirse 'docker compose restart scheduler'."
    exit 1
    ;;
  healthy)
    log "Scheduler sağlıklı (healthy)."
    { echo "OK $(date '+%Y-%m-%d %H:%M:%S')"; echo "Scheduler: healthy (liveness beacon taze)"; } > "$STATUS_FILE" 2>/dev/null || true
    ;;
  starting)
    # start_period penceresi — henüz ilk beacon oturmadı; geçici, alarm üretme.
    log "Scheduler başlatılıyor (starting) — geçici, izleniyor."
    { echo "OK $(date '+%Y-%m-%d %H:%M:%S')"; echo "Scheduler: starting (ilk beacon bekleniyor)"; } > "$STATUS_FILE" 2>/dev/null || true
    ;;
  *)
    # 'none' (healthcheck'siz eski compose) veya 'unknown' — hard-alarm verme (false-positive
    # önle), ama durum-dosyasına yaz ki status.sh gösterebilsin.
    log "Scheduler healthcheck durumu belirsiz ($status) — eski compose olabilir. Alarm üretilmedi."
    { echo "OK $(date '+%Y-%m-%d %H:%M:%S')"; echo "Scheduler: durum belirsiz ($status) — healthcheck yok olabilir"; } > "$STATUS_FILE" 2>/dev/null || true
    ;;
esac
