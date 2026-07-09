#!/usr/bin/env bash
# Kapalı-ağ müşterisi için offline teslim paketi üretir.
# İmajı build eder, `docker save` ile tarball'a alır, compose+config'i yanına kor.
# Kullanım (repo kökünden):  deploy/onprem/build-offline-bundle.sh [tag]
set -euo pipefail
cd "$(dirname "$0")/../.."   # repo kökü

# Sürüm damgası — müşteri-başına takip + rollback hedefi. BUNDLE_VERSION verilmezse git tag/sha.
# Pinli tag (:onprem-<ver>) hareketli :onprem yerine; install.sh bunu .env'e ve VERSION'a yazar.
BUNDLE_VERSION="${BUNDLE_VERSION:-$(git describe --tags --always 2>/dev/null || date +%Y%m%d)}"
TAG="${1:-klinovax/hospital-lms:onprem-${BUNDLE_VERSION}}"
# Hedef mimari: hastane sunucuları çoğunlukla x86_64. Bu makinede (ör. Apple Silicon arm64)
# --platform'suz build/pull YEREL mimariyi üretir → müşterinin x86 sunucusunda TÜM konteynerler
# "exec format error" ile sonsuz restart-loop (lokal Docker smoke arm64'te 10/10 geçse bile).
# ARM sunucu için: TARGET_PLATFORM=linux/arm64 ile çalıştırın.
PLATFORM="${TARGET_PLATFORM:-linux/amd64}"
OUT="deploy/onprem/dist"
mkdir -p "$OUT"

echo "[bundle] İmaj build ediliyor: $TAG (platform: $PLATFORM)"
docker build --platform "$PLATFORM" -f deploy/onprem/Dockerfile -t "$TAG" .

# Arch assert: imaj GERÇEKTEN hedef mimaride mi? (yanlış mimari = müşteride exec format error)
EXPECT_ARCH="${PLATFORM##*/}"
GOT_ARCH="$(docker image inspect --format '{{.Architecture}}' "$TAG")"
if [ "$GOT_ARCH" != "$EXPECT_ARCH" ]; then
  echo "[bundle] HATA: imaj mimarisi '$GOT_ARCH' ≠ hedef '$EXPECT_ARCH' — müşteri sunucusunda çalışmaz." >&2
  echo "         (Docker buildx/QEMU emülasyonu gerekebilir; 'docker buildx' kurulu mu?)" >&2
  exit 1
fi
echo "[bundle] Mimari doğrulandı: $GOT_ARCH"

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

# --platform: yardımcı imajlar da hedef mimaride çekilmeli (app imajıyla aynı; aksi halde
# müşteride yalnız bazıları çalışır). Multi-arch olmayan bir imaj bu platformda yoksa pull hata verir.
for img in "${DEP_IMAGES[@]}"; do docker pull --platform "$PLATFORM" "$img"; done

echo "[bundle] docker save → tarball (bu birkaç dakika sürebilir)…"
docker save "$TAG" "${DEP_IMAGES[@]}" | gzip > "$OUT/klinovax-onprem-images.tar.gz"

echo "[bundle] Compose + config kopyalanıyor…"
cp deploy/onprem/docker-compose.yml "$OUT/"
cp deploy/onprem/.env.example "$OUT/"
cp deploy/onprem/install.sh "$OUT/"
cp deploy/onprem/backup-volumes.sh "$OUT/"
cp deploy/onprem/update.sh "$OUT/"
cp deploy/onprem/restore-offsite.sh "$OUT/"
cp deploy/onprem/dead-man-check.sh "$OUT/"
cp deploy/onprem/README.md "$OUT/" 2>/dev/null || true

# Sürüm manifesti — install.sh ilk satırdaki pinli tag'i .env APP_IMAGE'e yazar; müşteri-başına takip.
{ printf '%s\n' "$TAG"; printf 'built: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"; printf 'git: %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"; } > "$OUT/VERSION"
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

cat > "$OUT/LOAD.md" <<EOF
# Offline kurulum — ${TAG}

0. **Bütünlüğü doğrula** (USB/harici disk transferi bit-çürümesi/kurcalama):
   \`\`\`
   sha256sum -c SHA256SUMS
   \`\`\`
   Hepsi \`OK\` değilse transfer bozuk — TEKRAR kopyalayın, yüklemeyin.
1. İmajları yükle:  \`docker load < klinovax-onprem-images.tar.gz\`
2. \`./install.sh\` çalıştır (sırları üretir, .env yazar, sağlık doğrulayana kadar bekler).
3. Tarayıcıdan uygulamaya gir, /license ekranından lisansı etkinleştir
   (internet yoksa Klinovax'tan aldığın receipt.klr'i yükle).

## Güncelleme (yeni sürüm geldiğinde)
\`\`\`
sha256sum -c SHA256SUMS                       # yeni bundle'ı doğrula
./update.sh klinovax-onprem-images.tar.gz     # yedek-önce + sağlık + başarısızsa oto-rollback
\`\`\`
EOF

# ── SHA256 checksum — sneakernet (USB/harici disk) bütünlük doğrulaması ──
# install.sh/LOAD.md 'sha256sum -c SHA256SUMS' ile transfer bozulmasını yakalar.
echo "[bundle] SHA256SUMS üretiliyor…"
( cd "$OUT" && find . -maxdepth 2 -type f ! -name 'SHA256SUMS' -printf '%P\n' | sort | xargs sha256sum > SHA256SUMS )

echo "[bundle] Hazır: $OUT/  (sürüm: $TAG)"
ls -lh "$OUT/"
