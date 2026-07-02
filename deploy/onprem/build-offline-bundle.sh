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
DEP_IMAGES=(
  "supabase/postgres:15.8.1.060"
  "supabase/gotrue:v2.177.0"
  "supabase/realtime:v2.34.47"
  "kong:2.8.1"
  "redis:7-alpine"
  "hiett/serverless-redis-http:latest"
  "minio/minio:latest"
  "minio/mc:latest"
  "axllent/mailpit:latest"
)
for img in "${DEP_IMAGES[@]}"; do docker pull "$img"; done

echo "[bundle] docker save → tarball (bu birkaç dakika sürebilir)…"
docker save "$TAG" "${DEP_IMAGES[@]}" | gzip > "$OUT/klinovax-onprem-images.tar.gz"

echo "[bundle] Compose + config kopyalanıyor…"
cp deploy/onprem/docker-compose.yml "$OUT/"
cp deploy/onprem/.env.example "$OUT/"
cp deploy/onprem/install.sh "$OUT/"
cp deploy/onprem/README.md "$OUT/" 2>/dev/null || true
cp -r deploy/onprem/gateway "$OUT/"
cp -r deploy/onprem/scheduler "$OUT/"

cat > "$OUT/LOAD.md" <<'EOF'
# Offline kurulum

1. İmajları yükle:  `docker load < klinovax-onprem-images.tar.gz`
2. `./install.sh` çalıştır (sırları üretir, .env yazar, stack'i başlatır).
3. Tarayıcıdan uygulamaya gir, /license ekranından lisansı etkinleştir
   (internet yoksa Klinovax'tan aldığın receipt.klr'i yükle).
EOF

echo "[bundle] Hazır: $OUT/"
ls -lh "$OUT/"
