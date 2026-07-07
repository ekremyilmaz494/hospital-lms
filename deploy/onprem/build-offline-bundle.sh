#!/usr/bin/env bash
# Kapalı-ağ müşterisi için offline teslim paketi üretir.
# İmajı build eder, `docker save` ile tarball'a alır, compose+config'i yanına kor.
# Kullanım (repo kökünden):  deploy/onprem/build-offline-bundle.sh [tag]
set -euo pipefail
cd "$(dirname "$0")/../.."   # repo kökü

TAG="${1:-klinovax/hospital-lms:onprem}"
OUT="deploy/onprem/dist"
mkdir -p "$OUT"

echo "[bundle] İmaj build ediliyor: $TAG"
docker build -f deploy/onprem/Dockerfile -t "$TAG" .

echo "[bundle] Yardımcı imajlar çekiliyor (compose bağımlılıkları)…"
# Compose'daki dış imajlar — offline makinede lazım olacak.
# KRİTİK: bu tag'ler docker-compose.yml'deki `image:` pin'leriyle BİREBİR aynı olmalı.
# Uyuşmazsa müşteri sunucusunda `docker load` :latest yükler ama compose pin'li tag'i
# arar, bulamaz, registry'den pull dener → kapalı ağda başarısız. Aşağıdaki drift
# guard'ı bu tutarlılığı build anında zorlar.
DEP_IMAGES=(
  "supabase/postgres:15.8.1.060"
  "supabase/gotrue:v2.177.0"
  "supabase/realtime:v2.34.47"
  "kong:2.8.1"
  "redis:7-alpine"
  "hiett/serverless-redis-http:0.0.10"
  "minio/minio:RELEASE.2025-09-07T16-13-09Z"
  "minio/mc:RELEASE.2025-08-13T08-35-41Z"
  "axllent/mailpit:v1.30.3"
)

echo "[bundle] Pin drift guard: her yardımcı imaj compose'da birebir mi?"
for img in "${DEP_IMAGES[@]}"; do
  if ! grep -qF "image: $img" deploy/onprem/docker-compose.yml; then
    echo "[bundle] HATA: '$img' docker-compose.yml'de bulunamadı (pin drift)." >&2
    echo "         DEP_IMAGES listesini docker-compose.yml'deki 'image:' satırlarıyla eşitleyin." >&2
    exit 1
  fi
done

for img in "${DEP_IMAGES[@]}"; do docker pull "$img"; done

echo "[bundle] docker save → tarball (bu birkaç dakika sürebilir)…"
docker save "$TAG" "${DEP_IMAGES[@]}" | gzip > "$OUT/klinovax-onprem-images.tar.gz"

echo "[bundle] Compose + config kopyalanıyor…"
cp deploy/onprem/docker-compose.yml "$OUT/"
cp deploy/onprem/.env.example "$OUT/"
cp deploy/onprem/install.sh "$OUT/"
cp deploy/onprem/backup-volumes.sh "$OUT/"
cp deploy/onprem/README.md "$OUT/" 2>/dev/null || true
cp -r deploy/onprem/gateway "$OUT/"
cp -r deploy/onprem/scheduler "$OUT/"
# db-init/: postgres ilk-boot init script'i (alt-rol parola senkronu + Prisma
# baseline). Compose bunu bind-mount eder; bundle'da OLMAZSA Docker boş dizin
# oluşturur → GoTrue/Realtime 28P01 crash-loop + Prisma P3005. Air-gap kurulumun
# sessiz kırılma noktasıydı — kopyalanması ŞART.
cp -r deploy/onprem/db-init "$OUT/"

# Bind-mount bütünlüğü: compose'un ./ ile başlayan TÜM volume kaynakları bundle'da
# olmalı; eksikse air-gap kurulum kırılır (yukarıdaki db-init tuzağının genel formu).
echo "[bundle] Bind-mount bütünlük kontrolü…"
missing=0
for src in $(grep -oE '\./[A-Za-z0-9_./-]+' deploy/onprem/docker-compose.yml | sort -u); do
  rel="${src#./}"
  if [ ! -e "$OUT/$rel" ]; then
    echo "[bundle] HATA: compose bind-mount kaynağı bundle'da yok: $rel" >&2
    missing=1
  fi
done
if [ "$missing" = 1 ]; then
  echo "[bundle] Bundle eksik bind-mount kaynağı içeriyor — kurulum kırılır, iptal edildi." >&2
  exit 1
fi

cat > "$OUT/LOAD.md" <<'EOF'
# Offline kurulum

1. İmajları yükle:  `docker load < klinovax-onprem-images.tar.gz`
2. `./install.sh` çalıştır (sırları üretir, .env yazar, stack'i başlatır).
3. Tarayıcıdan uygulamaya gir, /license ekranından lisansı etkinleştir
   (internet yoksa Klinovax'tan aldığın receipt.klr'i yükle).
EOF

echo "[bundle] Hazır: $OUT/"
ls -lh "$OUT/"
