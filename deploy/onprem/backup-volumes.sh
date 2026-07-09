#!/usr/bin/env bash
# Off-site yedek — pg_dump + MinIO nesne deposu → DEST dizinine (harici disk / NFS / rsync hedefi).
#
# NEDEN: App-içi şifreli yedek cron'u AYNI sunucudaki MinIO'ya yazar. Sunucu arızası,
# ransomware veya `docker compose down -v` durumunda veri + yedekler BİRLİKTE kaybolur.
# Bu script sunucu-DIŞI kopya alır → gerçek felaket kurtarma.
#
# ŞİFRELEME (KVKK md.12): çıktı dosyaları AES-256 ile şifrelenir (BACKUP_ENCRYPTION_KEY).
# pg_dump tüm hasta/personel PII'sini + auth.users bcrypt parola-hash'lerini içerir; şifresiz
# NAS'a yazmak (çalınan disk / içeriden erişim / ransomware exfiltrasyonu) doğrudan veri ihlalidir.
# Çözme: restore-offsite.sh (veya README > Geri Yükleme) aynı anahtarla otomatik yapar.
#
# Kullanım (deploy/onprem/ içinden):
#   ./backup-volumes.sh [DEST_DIR]          # varsayılan ./offsite-backups
#   OFFSITE_BACKUP_DIR=/mnt/nas/klx ./backup-volumes.sh
#   OFFSITE_ENCRYPT=false ./backup-volumes.sh   # şifrelemeyi kapat (ÖNERİLMEZ; yalnız DEST kendisi şifreliyse)
#
# Cron örneği (HOST crontab — konteyner içi supercronic DEĞİL, çünkü Docker soketi gerekir):
#   30 2 * * *  cd /opt/klinovax/deploy/onprem && ./backup-volumes.sh /mnt/nas/klinovax-backups >> /var/log/klinovax-offsite.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"

DEST="${1:-${OFFSITE_BACKUP_DIR:-./offsite-backups}}"
PROJECT="klinovax-onprem"          # docker-compose.yml `name:` ile aynı olmalı (volume prefix'i)
TS="$(date +%Y%m%d-%H%M%S)"
RETENTION_DAYS="${OFFSITE_RETENTION_DAYS:-14}"
# Retention yaşı ne olursa olsun DAİMA korunacak en yeni sağlam kopya sayısı (felakette
# "hepsi eskiydi, silindi" tuzağını önler). En az 1.
KEEP_MIN="${OFFSITE_KEEP_MIN:-3}"

log() { printf '\033[0;36m[offsite-backup]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[offsite-backup] HATA:\033[0m %s\n' "$*" >&2; }

command -v docker >/dev/null 2>&1 || { err "docker bulunamadı."; exit 1; }
docker compose ps postgres >/dev/null 2>&1 || { err "stack çalışmıyor gibi (docker compose ps postgres başarısız)."; exit 1; }
mkdir -p "$DEST"
DEST_ABS="$(cd "$DEST" && pwd)"

# ── Şifreleme yapılandırması ──
# BACKUP_ENCRYPTION_KEY .env'den okunur (install.sh 64-hex üretir; entrypoint/install format-kilitli).
ENCRYPT=1
[ "${OFFSITE_ENCRYPT:-true}" = "false" ] && ENCRYPT=0
BK_KEY=""
if [ "$ENCRYPT" -eq 1 ]; then
  command -v openssl >/dev/null 2>&1 || { err "openssl bulunamadı (yedek şifreleme için gerekli). OFFSITE_ENCRYPT=false ile kapatılabilir ama ÖNERİLMEZ."; exit 1; }
  BK_KEY="$(grep -E '^BACKUP_ENCRYPTION_KEY=' .env 2>/dev/null | head -1 | cut -d= -f2- || true)"
  if [ -z "$BK_KEY" ]; then
    err ".env'de BACKUP_ENCRYPTION_KEY bulunamadı — şifreli yedek üretilemez."
    err "install.sh ile üretin veya (yalnız DEST kendisi şifreliyse) OFFSITE_ENCRYPT=false kullanın."
    exit 1
  fi
fi
# AES-256-CBC + PBKDF2 (parola=64-hex anahtar). Şifreli çıktı .enc uzantılı; düz çıktı değil.
enc_out() { if [ "$ENCRYPT" -eq 1 ]; then BK_KEY="$BK_KEY" openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BK_KEY; else cat; fi; }
dec_in()  { if [ "$ENCRYPT" -eq 1 ]; then BK_KEY="$BK_KEY" openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BK_KEY; else cat; fi; }
EXT="$([ "$ENCRYPT" -eq 1 ] && echo '.enc' || echo '')"
DB_FILE="$DEST_ABS/db-${TS}.sql.gz${EXT}"
MINIO_FILE="$DEST_ABS/minio-${TS}.tar.gz${EXT}"

# 1) PostgreSQL — mantıksal dump (tüm veritabanı, fresh DB'ye uygulanabilir)
log "PostgreSQL dump alınıyor$([ "$ENCRYPT" -eq 1 ] && echo ' (şifreli)')…"
docker compose exec -T postgres pg_dump -U postgres -d postgres --clean --if-exists \
  | gzip | enc_out > "$DB_FILE"
log "  → $(basename "$DB_FILE") ($(du -h "$DB_FILE" | cut -f1))"

# 2) MinIO nesne deposu — volume tar'ı (videolar, belgeler, app-içi şifreli yedekler)
# tar konteynerden STREAM edilir, host'ta şifrelenir (DEST'i konteynere mount ETMEYE gerek yok).
log "MinIO nesne deposu arşivleniyor$([ "$ENCRYPT" -eq 1 ] && echo ' (şifreli)')…"
docker run --rm -v "${PROJECT}_miniodata:/data:ro" alpine tar cz -C /data . \
  | enc_out > "$MINIO_FILE"
log "  → $(basename "$MINIO_FILE") ($(du -h "$MINIO_FILE" | cut -f1))"

# 3) Bütünlük doğrulaması — "test edilmemiş yedek = yedek yok". Bozuk yazılmış (kısmi/OOM/disk-dolu)
# arşiv retention tarafından zamanla tek sağlam kopyayı silene kadar SESSİZ kalırdı.
log "Yedek bütünlüğü doğrulanıyor…"
if ! dec_in < "$DB_FILE" | gunzip -t 2>/dev/null; then
  err "DB yedeği BOZUK (decrypt|gunzip -t başarısız): $(basename "$DB_FILE"). Silinip iptal ediliyor."
  rm -f "$DB_FILE" "$MINIO_FILE"; exit 1
fi
if ! dec_in < "$MINIO_FILE" | tar tz >/dev/null 2>&1; then
  err "MinIO yedeği BOZUK (decrypt|tar tz başarısız): $(basename "$MINIO_FILE"). Silinip iptal ediliyor."
  rm -f "$DB_FILE" "$MINIO_FILE"; exit 1
fi
log "  → doğrulandı (db + minio açılabilir)."

# 4) Restore uyarısı — şifreleme anahtarları bu yedekte YOK (bilinçli); .env ayrı saklanmalı
cat > "$DEST_ABS/OKU-BENI-${TS}.txt" <<EOF
Off-site yedek: ${TS}
İçerik: $(basename "$DB_FILE") (PostgreSQL) + $(basename "$MINIO_FILE") (nesne deposu).
Şifreleme: $([ "$ENCRYPT" -eq 1 ] && echo 'AES-256-CBC (BACKUP_ENCRYPTION_KEY)' || echo 'YOK (düz gzip — DEST kendisi şifreli olmalı!)').
GERİ YÜKLEME İÇİN .env'deki şu anahtarlar DA gerekli (güvenlik gereği bu yedekte YOK):
  ENCRYPTION_KEY, BACKUP_ENCRYPTION_KEY, JWT_SECRET, REALTIME_ENC_KEY
.env'i AYRI ve güvenli bir konumda saklayın; kaybı KALICI veri kaybıdır.
Adımlar: ./restore-offsite.sh $(basename "$DB_FILE") $(basename "$MINIO_FILE")   (veya README > Geri Yükleme).
EOF

# 5) Yerel retention — yaşı geçenleri sil AMA en yeni KEEP_MIN kopyayı DAİMA koru.
# (DEST harici bir mount'sa oranın kendi politikası da olabilir.)
prune() {
  # $1 = glob deseni (db-*.sql.gz* | minio-*.tar.gz* | OKU-BENI-*.txt)
  local pat="$1" f n=0
  # En yeniden eskiye: ilk KEEP_MIN'i atla, kalanlar arasında yaşı geçenleri sil.
  while IFS= read -r f; do
    n=$((n+1))
    [ "$n" -le "$KEEP_MIN" ] && continue
    if [ -n "$(find "$f" -mtime +"$RETENTION_DAYS" 2>/dev/null)" ]; then
      rm -f "$f" && log "  retention: silindi $(basename "$f")"
    fi
  done < <(find "$DEST_ABS" -maxdepth 1 -type f -name "$pat" -printf '%T@ %p\n' 2>/dev/null | sort -rn | cut -d' ' -f2-)
}
if [ "$RETENTION_DAYS" -gt 0 ] 2>/dev/null; then
  prune 'db-*.sql.gz*'
  prune 'minio-*.tar.gz*'
  prune 'OKU-BENI-*.txt'
fi

log "Off-site yedek tamam: $DEST_ABS"
log "UYARI: bu dizini SUNUCU DIŞINA taşıyın (NFS/harici disk/rsync). Aynı diskte kalırsa off-site kopya YOKTUR."
