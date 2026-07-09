#!/usr/bin/env bash
# Tek-bakışta sistem durumu — teknik-olmayan operatör için insanca özet.
# Servis sağlığı + lisans durumu + disk + son off-site yedek yaşı + saat.
#
# Kullanım (deploy/onprem/ içinden):  ./status.sh
set -euo pipefail
cd "$(dirname "$0")"

ok()   { printf '  \033[0;32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[0;33m!\033[0m %s\n' "$*"; }
bad()  { printf '  \033[0;31mX\033[0m %s\n' "$*"; }
hdr()  { printf '\n\033[1m%s\033[0m\n' "$*"; }

[ -f .env ] || { echo "HATA: .env yok (kurulu sistem değil)."; exit 1; }
ev() { grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }
APP_PORT="$(ev APP_PORT)"; APP_PORT="${APP_PORT:-3000}"
HEALTH_SECRET="$(ev HEALTH_CHECK_SECRET)"  # secret-scanner-disable-line (.env'den OKUR)

hdr "KlinoVax on-prem — durum ($(date '+%Y-%m-%d %H:%M'))"
[ -f .installed-version ] && ok "Sürüm: $(head -1 .installed-version)" || warn "Sürüm bilinmiyor (.installed-version yok)"

# ── Servisler ──
hdr "Servisler (docker compose)"
if docker compose ps --format '{{.Service}} {{.Status}}' >/tmp/klx-ps.txt 2>/dev/null; then
  total="$(wc -l < /tmp/klx-ps.txt | tr -d ' ')"
  healthy="$(grep -icE 'healthy|running|Up' /tmp/klx-ps.txt || true)"
  while IFS= read -r line; do
    case "$line" in
      *healthy*|*"Up "*|*running*) ok "$line" ;;
      *) bad "$line" ;;
    esac
  done < /tmp/klx-ps.txt
  echo "  → ${healthy}/${total} çalışıyor/sağlıklı"
  rm -f /tmp/klx-ps.txt
else
  bad "docker compose ps başarısız (stack çalışmıyor olabilir)."
fi

# ── Uygulama + lisans (authenticated health) ──
hdr "Uygulama & lisans"
if summary="$(curl -fsS -H "x-health-secret: ${HEALTH_SECRET}" "http://localhost:${APP_PORT}/api/health" 2>/dev/null)"; then
  st="$(printf '%s' "$summary" | grep -oE '"status":"[^"]*"' | head -1 | cut -d'"' -f4)"
  lic="$(printf '%s' "$summary" | grep -oE '"state":"[^"]*"' | head -1 | cut -d'"' -f4)"
  case "$st" in healthy) ok "Uygulama: healthy" ;; degraded) warn "Uygulama: degraded" ;; *) bad "Uygulama: ${st:-?}" ;; esac
  case "$lic" in VALID|WARN) ok "Lisans: $lic" ;; "") warn "Lisans: bilinmiyor" ;; *) bad "Lisans: $lic (LOCKED/READONLY → /license)" ;; esac
else
  bad "Uygulama /api/health yanıt vermiyor (localhost:${APP_PORT})."
fi

# ── Disk ──
hdr "Disk"
if [ -f .disk-health ]; then
  head -1 .disk-health | grep -q '^OK' && ok "$(tail -1 .disk-health)" || bad "$(tail -1 .disk-health) (disk-guard alarmı)"
else
  root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"
  pct="$(df -P "$root" 2>/dev/null | awk 'NR==2{print $5}')"
  [ -n "$pct" ] && { [ "${pct%\%}" -ge 85 ] 2>/dev/null && bad "Docker diski: $pct" || ok "Docker diski: $pct"; } || warn "Disk okunamadı"
fi

# ── Off-site yedek tazeliği ──
hdr "Off-site yedek"
OFFSITE="$(ev OFFSITE_BACKUP_DIR)"; OFFSITE="${OFFSITE:-./offsite-backups}"
if [ -f "${OFFSITE%/}/.backup-health" ]; then
  head -1 "${OFFSITE%/}/.backup-health" | grep -q '^OK' && ok "$(tail -1 "${OFFSITE%/}/.backup-health")" || bad "$(tail -1 "${OFFSITE%/}/.backup-health") (dead-man alarmı)"
else
  newest="$(find "$OFFSITE" -maxdepth 1 -type f -name 'db-*.sql.gz*' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 || true)"
  if [ -n "$newest" ]; then
    newest_epoch="${newest%% *}"; newest_epoch="${newest_epoch%.*}"
    age_h=$(( ( $(date +%s) - newest_epoch ) / 3600 ))
    [ "$age_h" -le 26 ] && ok "En yeni yedek ${age_h} saat önce" || bad "En yeni yedek ${age_h} saat önce (bayat!)"
  else
    warn "Off-site yedek bulunamadı ($OFFSITE) — kurulu mu? (README > Yedekleme)"
  fi
fi

# ── Saat / NTP ──
hdr "Saat"
if command -v timedatectl >/dev/null 2>&1; then
  [ "$(timedatectl show -p NTPSynchronized --value 2>/dev/null)" = "yes" ] && ok "NTP senkron: evet ($(date '+%H:%M:%S'))" || bad "NTP senkron DEĞİL — lisans clock_tampering kilidi riski!"
else
  warn "timedatectl yok — saat senkronu doğrulanamadı ($(date '+%H:%M:%S'))"
fi
echo
