#!/usr/bin/env bash
# Güvenli on-prem GÜNCELLEME — yedek-önce ZORLA → yeni imaj → sağlık → BAŞARISIZSA oto-rollback.
#
# NEDEN: Kapalı container kendini güncellemez (immutable, air-gap için DOĞRU); güncelleme
# operatör-tetikli ve geri-dönülebilir OLMALI. `entrypoint.sh` her boot'ta `prisma migrate deploy`
# koşar (İLERİ-YÖNLÜ, geri-dönülemez). Bu script:
#   1) Güncelleme öncesi off-site yedeği ZORLAR (yoksa devam etmez).
#   2) Migration ÖNCE/SONRA farkını (_prisma_migrations) ölçer.
#   3) Sağlık geçmezse: yeni migration YOKSA → imaj geri; VARSA → yedekten otomatik restore.
#
# Kullanım (deploy/onprem/ içinden):
#   ./update.sh /yol/klinovax-onprem-images.tar.gz     # AIR-GAP: yeni tarball'ı yükle
#   ./update.sh --pull [tag]                           # KISITLI-ÇIKIŞ: registry'den çek
#   SKIP_BACKUP=1 ./update.sh ...                      # yedeği atla (ÇOK RİSKLİ, sorulur)
set -euo pipefail
cd "$(dirname "$0")"

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

log()  { printf '\033[0;36m[update]\033[0m %s\n' "$*"; }
err()  { printf '\033[0;31m[update] HATA:\033[0m %s\n' "$*" >&2; }
warn() { printf '\033[0;33m[update] UYARI:\033[0m %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || { err "docker bulunamadı."; exit 1; }
[ -f .env ] || { err ".env yok — bu bir kurulu sistem değil. Önce install.sh."; exit 1; }

# ── .env yardımcıları ──
ev() { grep -E "^$1=" .env | head -1 | cut -d= -f2- || true; }
set_env() { # $1=key $2=value (satır sırasını korur, '=' içeren değerlere güvenli)
  local key="$1" val="$2"
  if grep -qE "^${key}=" .env; then
    awk -v k="$key" -v v="$val" '{ if (index($0, k"=")==1) print k"="v; else print }' .env > .env.tmp && mv .env.tmp .env
  else
    printf '%s=%s\n' "$key" "$val" >> .env
  fi
  chmod 600 .env
}

APP_PORT="$(ev APP_PORT)"; APP_PORT="${APP_PORT:-3000}"
HEALTH_SECRET="$(ev HEALTH_CHECK_SECRET)"  # secret-scanner-disable-line (.env'den OKUR, literal değil)
OLD_APP_IMAGE="$(ev APP_IMAGE)"
[ -n "$OLD_APP_IMAGE" ] || { err ".env'de APP_IMAGE yok."; exit 1; }

# ── Argümanları çöz: tarball (offline) veya --pull (bağlı) ──
MODE=""; TARBALL=""; NEW_TAG=""
case "${1:-}" in
  --pull) MODE="pull"; NEW_TAG="${2:-}" ;;
  "" )    err "Kullanım: ./update.sh <images.tar.gz>  |  ./update.sh --pull [tag]"; exit 1 ;;
  * )     MODE="load"; TARBALL="$1"; [ -f "$TARBALL" ] || { err "Tarball bulunamadı: $TARBALL"; exit 1; } ;;
esac

# ── Sağlık poll yardımcısı (public /api/health: 200=DB+app hazır) ──
wait_healthy() {
  local ok=0 i
  for i in $(seq 1 "$HEALTH_TIMEOUT"); do
    if curl -fsS "http://localhost:${APP_PORT}/api/health" >/dev/null 2>&1; then ok=1; break; fi
    sleep 1
  done
  [ "$ok" -eq 1 ]
}
# ── Tamamlanmış migration sayısı (app down olsa da postgres'ten okunur) ──
migration_count() {
  docker compose exec -T postgres psql -U postgres -d postgres -tAc \
    "select count(*) from _prisma_migrations where finished_at is not null" 2>/dev/null | tr -d '[:space:]' || echo "ERR"
}

log "Mevcut sürüm (APP_IMAGE): $OLD_APP_IMAGE"

# ── 1) Güncelleme-öncesi off-site yedek ZORLA ──
if [ "${SKIP_BACKUP:-0}" = "1" ]; then
  warn "SKIP_BACKUP=1 — güncelleme-öncesi yedek ATLANIYOR. Kötü sürümde GERİ DÖNÜŞ İMKÂNSIZ olabilir."
  read -rp "Yedeksiz devam? (yes yazın): " a; [ "$a" = "yes" ] || { log "İptal."; exit 0; }
else
  log "Güncelleme-öncesi off-site yedek alınıyor (zorunlu)…"
  if ! ./backup-volumes.sh; then
    err "Yedek BAŞARISIZ — güncelleme İPTAL (yedeksiz güncelleme yapılmaz). SKIP_BACKUP=1 ile zorlanabilir (önerilmez)."
    exit 1
  fi
fi

BEFORE_MIG="$(migration_count)"
log "Güncelleme öncesi tamamlanmış migration sayısı: $BEFORE_MIG"

# ── 2) Yeni imajı getir ──
if [ "$MODE" = "load" ]; then
  log "Yeni imaj yükleniyor: $TARBALL"
  load_out="$(docker load -i "$TARBALL")"
  printf '%s\n' "$load_out"
  # App imajı tag'ini load çıktısından çöz (dep imajları da yüklenir; app'i seç).
  NEW_TAG="$(printf '%s\n' "$load_out" | sed -n 's/^Loaded image: \(.*klinovax\/hospital-lms.*\)$/\1/p' | head -1)"
  [ -n "$NEW_TAG" ] || { err "Tarball'da klinovax/hospital-lms imajı bulunamadı."; exit 1; }
else
  [ -n "$NEW_TAG" ] || NEW_TAG="$OLD_APP_IMAGE"
  log "Registry'den çekiliyor: $NEW_TAG"
  APP_IMAGE="$NEW_TAG" docker compose pull app || { err "pull başarısız (kapalı ağda --pull kullanmayın; tarball verin)."; exit 1; }
fi
log "Hedef sürüm (APP_IMAGE): $NEW_TAG"

# ── 3) Uygula ──
set_env APP_IMAGE "$NEW_TAG"
log "Stack güncelleniyor (docker compose up -d)…"
docker compose up -d

# ── 4) Sağlık + karar ──
if wait_healthy; then
  AFTER_MIG="$(migration_count)"
  log "✅ Güncelleme başarılı — uygulama sağlıklı. Migration: ${BEFORE_MIG} → ${AFTER_MIG}."
  if [ -n "$HEALTH_SECRET" ]; then
    curl -fsS -H "x-health-secret: ${HEALTH_SECRET}" "http://localhost:${APP_PORT}/api/health" 2>/dev/null \
      | grep -oE '"version":"[^"]*"|"state":"[^"]*"' | tr '\n' ' ' | sed 's/^/[update] /' || true
    echo
  fi
  # Kurulu sürüm manifesti (müşteri-başına takip).
  printf '%s\n' "$NEW_TAG" > .installed-version 2>/dev/null || true
  exit 0
fi

# ── 5) BAŞARISIZ → oto-rollback ──
AFTER_MIG="$(migration_count)"
err "Yeni sürüm ${HEALTH_TIMEOUT}sn'de sağlıklı olmadı. Rollback başlıyor. Migration: ${BEFORE_MIG} → ${AFTER_MIG}."

if [ "$AFTER_MIG" = "$BEFORE_MIG" ] && [ "$BEFORE_MIG" != "ERR" ]; then
  # Yeni migration UYGULANMADI → şema aynı → imaj geri almak GÜVENLİ.
  warn "Yeni migration yok → eski imaja dönülüyor: $OLD_APP_IMAGE"
  set_env APP_IMAGE "$OLD_APP_IMAGE"
  docker compose up -d
  if wait_healthy; then
    log "✅ Rollback tamam — eski sürüm ($OLD_APP_IMAGE) sağlıklı."
    exit 1
  fi
  err "Rollback sonrası da sağlıksız — 'docker compose logs -f app' ile inceleyin, gerekirse restore-offsite.sh."
  exit 1
else
  # Yeni migration UYGULANDI → şema ileri gitti → imaj geri almak TANIMSIZ (Prisma ileri-yönlü).
  # Güncelleme-öncesi off-site yedekten otomatik RESTORE (bu betiğin adım 1'de aldığı yedek).
  err "Yeni migration uygulandı (${BEFORE_MIG}→${AFTER_MIG}) → imaj geri alınamaz. Güncelleme-öncesi yedekten restore ediliyor."
  set_env APP_IMAGE "$OLD_APP_IMAGE"
  if FORCE=1 ./restore-offsite.sh; then
    log "✅ Rollback tamam — güncelleme-öncesi yedeğe dönüldü (eski imaj: $OLD_APP_IMAGE)."
    exit 1
  fi
  err "OTOMATİK RESTORE BAŞARISIZ — MANUEL müdahale gerekli. En yeni off-site yedeği restore-offsite.sh ile yükleyin, .env APP_IMAGE=${OLD_APP_IMAGE} olduğundan emin olun."
  exit 1
fi
